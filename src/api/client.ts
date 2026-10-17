/** Where the API lives; in development Vite forwards `/api` to it. */
export const API_URL = (import.meta.env.VITE_API_URL as string | undefined) || '/api/v1'

/** Photos under `/uploads` come from the API's host; outside URLs as they are. */
export function mediaUrl(path: string): string {
  if (/^https?:\/\//.test(path)) return path
  const origin = /^https?:\/\//.test(API_URL) ? new URL(API_URL).origin : ''
  return `${origin}${path}`
}

/** A refusal from the API, with its stable code and translated message. */
export class ApiError extends Error {
  readonly status: number
  readonly code: string

  constructor(status: number, code: string, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

type Envelope<T> = { success: boolean; message: string; data: T; code?: string }

let token: string | null = null
let onSignedOut: () => void = () => {}

/** The dashboard token every request carries; null when signed out. */
export function setToken(value: string | null): void {
  token = value
}

/** Called when the API says the token is no longer good. */
export function onUnauthorized(handler: () => void): void {
  onSignedOut = handler
}

type Query = Record<string, string | number | boolean | null | undefined>

function withQuery(path: string, query?: Query): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null && value !== '') params.set(key, String(value))
  }
  const text = params.toString()
  return text ? `${path}?${text}` : path
}

/** Calls `/admin…` and returns the envelope's `data`, or throws [ApiError]. */
export async function api<T>(
  path: string,
  options: { method?: string; body?: unknown; query?: Query } = {},
): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${API_URL}/admin${withQuery(path, options.query)}`, {
      method: options.method ?? 'GET',
      headers: {
        Accept: 'application/json',
        'Accept-Language': 'ar',
        ...(options.body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    })
  } catch {
    throw new ApiError(0, 'NETWORK', 'مش قادر يوصل للسيرفر، اتأكد إنه شغال')
  }
  let body: Envelope<T> | null = null
  try {
    body = (await response.json()) as Envelope<T>
  } catch {
    // Not JSON: a proxy page or an empty reply.
  }
  if (!response.ok || !body?.success) {
    const error = new ApiError(
      response.status,
      body?.code ?? 'UNKNOWN',
      body?.message ?? `حصل خطأ (${response.status})`,
    )
    // A login with a wrong password is also a 401; only a stale token signs out.
    if (response.status === 401 && token && !path.startsWith('/auth/login')) onSignedOut()
    throw error
  }
  return body.data
}
