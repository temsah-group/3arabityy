import { useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import { ApiError, get, onSession, post, tokens } from './api';
import { clearAccountCollections, syncAfterSignIn } from './collections';
import type { AuthResult, User } from './types';

/**
 * The password typed at sign-up, held in memory only (never in history state)
 * so confirming the email can sign straight in.
 */
let pendingPassword: string | null = null;
export const rememberPassword = (password: string | null) => {
  pendingPassword = password;
};
export const takePassword = () => {
  const value = pendingPassword;
  pendingPassword = null;
  return value;
};

type Status = 'loading' | 'guest' | 'signedIn';

interface Auth {
  status: Status;
  user: User | null;
  /** Shown once after the server ends the session (expired, signed out elsewhere, suspended). */
  sessionEnded: boolean;
  dismissSessionEnded: () => void;
  signIn: (result: AuthResult) => Promise<void>;
  login: (identifier: string, password: string, rememberMe: boolean) => Promise<void>;
  logout: () => Promise<void>;
  setUser: (user: User) => void;
  /** After deleting the account: drop the session without calling the server. */
  forget: () => void;
}

const AuthContext = createContext<Auth | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<Status>(tokens.access ? 'loading' : 'guest');
  const [sessionEnded, setSessionEnded] = useState(false);

  const forget = useCallback(() => {
    tokens.clear();
    clearAccountCollections();
    setUser(null);
    setStatus('guest');
    queryClient.clear();
  }, [queryClient]);

  // Restore the session on load.
  useEffect(() => {
    if (!tokens.access) return;
    get<User>('/users/me')
      .then((me) => {
        setUser(me);
        setStatus('signedIn');
        void syncAfterSignIn();
      })
      .catch((error) => {
        if (error instanceof ApiError && error.status === 0) {
          // Offline: stay signed in on the token, try again later.
          setStatus('guest');
          return;
        }
        tokens.clear();
        setStatus('guest');
      });
  }, []);

  useEffect(
    () =>
      onSession((reason, result) => {
        if (reason === 'refreshed' && result) setUser(result.user);
        if (reason === 'ended') {
          clearAccountCollections();
          setUser(null);
          setStatus('guest');
          setSessionEnded(true);
          queryClient.removeQueries({ predicate: (q) => q.queryKey[0] === 'me' });
        }
      }),
    [queryClient],
  );

  const signIn = useCallback(
    async (result: AuthResult) => {
      tokens.set(result);
      setUser(result.user);
      setStatus('signedIn');
      setSessionEnded(false);
      await syncAfterSignIn();
      queryClient.invalidateQueries();
    },
    [queryClient],
  );

  const login = useCallback(
    async (identifier: string, password: string, rememberMe: boolean) => {
      const result = await post<AuthResult>('/auth/login', { identifier, password, rememberMe });
      await signIn(result);
    },
    [signIn],
  );

  const logout = useCallback(async () => {
    try {
      await post('/auth/logout');
    } catch {
      // Signed out on this device either way.
    }
    forget();
  }, [forget]);

  const value = useMemo<Auth>(
    () => ({
      status,
      user,
      sessionEnded,
      dismissSessionEnded: () => setSessionEnded(false),
      signIn,
      login,
      logout,
      setUser,
      forget,
    }),
    [status, user, sessionEnded, signIn, login, logout, forget],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth outside AuthProvider');
  return value;
}
