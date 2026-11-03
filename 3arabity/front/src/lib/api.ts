import type { AuthResult } from './types';

/** Empty means same origin (the dev proxy, or one domain in production). */
const API_ORIGIN = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/+$/, '') ?? '';
/** Where `/uploads/...` paths live: the API host without `/api/v1`. */
const MEDIA_ORIGIN = API_ORIGIN.replace(/\/api\/v\d+$/, '');
// Takes the host alone or with `/api/v1`.
const API_BASE = `${MEDIA_ORIGIN}/api/v1`;

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly errors: { field: string; message: string }[] = [],
    readonly details: Record<string, unknown> = {},
  ) {
    super(message);
  }

  fieldError(field: string) {
    return this.errors.find((e) => e.field === field)?.message;
  }
}

/** Joins a stored path such as `/uploads/parts/x.jpg` to the server. */
export function mediaUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (/^https?:\/\//.test(path)) return path;
  return `${MEDIA_ORIGIN}${path}`;
}

// ---- Session storage ----

const ACCESS_KEY = 'arabity.access';
const REFRESH_KEY = 'arabity.refresh';

export const tokens = {
  get access() {
    return localStorage.getItem(ACCESS_KEY);
  },
  get refresh() {
    return localStorage.getItem(REFRESH_KEY);
  },
  set(result: { accessToken: string; refreshToken: string }) {
    localStorage.setItem(ACCESS_KEY, result.accessToken);
    localStorage.setItem(REFRESH_KEY, result.refreshToken);
  },
  clear() {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
  },
};

type SessionListener = (reason: 'ended' | 'refreshed', result?: AuthResult) => void;
const listeners = new Set<SessionListener>();
export function onSession(listener: SessionListener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

let language: 'ar' | 'en' = 'ar';
export function setApiLanguage(lang: 'ar' | 'en') {
  language = lang;
}

// ---- Requests ----

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
  /** Sends no token even when signed in. */
  anonymous?: boolean;
  signal?: AbortSignal;
}

function buildUrl(path: string, query?: RequestOptions['query']) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null && value !== '') params.set(key, String(value));
  }
  const qs = params.toString();
  return `${API_BASE}${path}${qs ? `?${qs}` : ''}`;
}

async function send(path: string, options: RequestOptions, token: string | null) {
  const headers: Record<string, string> = { 'Accept-Language': language };
  let body: BodyInit | undefined;
  if (options.body instanceof FormData) {
    body = options.body;
  } else if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(options.body);
  }
  if (token && !options.anonymous) headers.Authorization = `Bearer ${token}`;
  return fetch(buildUrl(path, options.query), {
    method: options.method ?? 'GET',
    headers,
    body,
    signal: options.signal,
  });
}

async function parse<T>(response: Response): Promise<T> {
  if (response.status === 204) return undefined as T;
  let json: Record<string, unknown> | null = null;
  try {
    json = await response.json();
  } catch {
    json = null;
  }
  if (!response.ok || !json || json.success === false) {
    const { message, code, errors, success: _s, ...details } = json ?? {};
    throw new ApiError(
      response.status,
      (code as string) ?? 'NETWORK_ERROR',
      (message as string) ??
        (language === 'ar' ? 'حصلت مشكلة، حاول تاني' : 'Something went wrong, try again'),
      (errors as ApiError['errors']) ?? [],
      details,
    );
  }
  return json.data as T;
}

// One refresh at a time; parallel 401s wait for the same one.
let refreshing: Promise<boolean> | null = null;

function refreshSession(): Promise<boolean> {
  const refreshToken = tokens.refresh;
  if (!refreshToken) return Promise.resolve(false);
  refreshing ??= (async () => {
    try {
      const response = await send('/auth/refresh', { method: 'POST', body: { refreshToken } }, null);
      const result = await parse<AuthResult>(response);
      tokens.set(result);
      listeners.forEach((l) => l('refreshed', result));
      return true;
    } catch (error) {
      // A network failure keeps the session for the next try.
      if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
        tokens.clear();
        listeners.forEach((l) => l('ended'));
      }
      return false;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  let response: Response;
  try {
    response = await send(path, options, tokens.access);
  } catch (error) {
    if ((error as Error).name === 'AbortError') throw error;
    throw new ApiError(
      0,
      'OFFLINE',
      language === 'ar' ? 'مفيش اتصال بالإنترنت' : 'No internet connection',
    );
  }
  const signedIn = Boolean(tokens.access) && !options.anonymous;
  if (response.status === 401 && signedIn && !path.startsWith('/auth/')) {
    if (await refreshSession()) response = await send(path, options, tokens.access);
  }
  return parse<T>(response);
}

export const get = <T>(path: string, query?: RequestOptions['query'], signal?: AbortSignal) =>
  api<T>(path, { query, signal });
export const post = <T>(path: string, body?: unknown) => api<T>(path, { method: 'POST', body });
export const put = <T>(path: string, body?: unknown) => api<T>(path, { method: 'PUT', body });
export const patch = <T>(path: string, body?: unknown) => api<T>(path, { method: 'PATCH', body });
export const del = <T>(path: string, body?: unknown) => api<T>(path, { method: 'DELETE', body });

export function upload<T>(path: string, file: File, field = 'photo') {
  const form = new FormData();
  form.append(field, file);
  return api<T>(path, { method: 'POST', body: form });
}
