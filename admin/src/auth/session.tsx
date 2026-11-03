import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'

import { api, onUnauthorized, setToken } from '../api/client'
import type { Admin } from '../api/types'

const STORAGE_KEY = 'arabity-admin-session'

type Stored = { token: string; expiresAt: number; admin: Admin }

type Session = {
  admin: Admin | null
  isOwner: boolean
  signIn(email: string, password: string): Promise<void>
  signOut(): void
}

const SessionContext = createContext<Session | null>(null)

/** The saved session, while its token is still good. */
function readStored(): Stored | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const stored = raw ? (JSON.parse(raw) as Stored) : null
    return stored && stored.expiresAt > Date.now() ? stored : null
  } catch {
    return null
  }
}

function writeStored(value: Stored | null): void {
  try {
    if (value) localStorage.setItem(STORAGE_KEY, JSON.stringify(value))
    else localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Private mode: the session lasts as long as the tab.
  }
}

/** Who is signed in. The token lives a few hours; then the admin signs in again. */
export function SessionProvider({ children }: { children: ReactNode }) {
  const [admin, setAdmin] = useState<Admin | null>(() => {
    const stored = readStored()
    setToken(stored?.token ?? null)
    return stored?.admin ?? null
  })

  const signOut = useCallback(() => {
    setToken(null)
    writeStored(null)
    setAdmin(null)
  }, [])

  useEffect(() => {
    onUnauthorized(signOut)
    const stored = readStored()
    if (!stored) return
    // Ends at the token's expiry, even with the tab left open.
    const timer = window.setTimeout(signOut, stored.expiresAt - Date.now())
    return () => window.clearTimeout(timer)
  }, [admin, signOut])

  const signIn = useCallback(async (email: string, password: string) => {
    const result = await api<{ accessToken: string; expiresInSeconds: number; admin: Admin }>(
      '/auth/login',
      { method: 'POST', body: { email, password } },
    )
    setToken(result.accessToken)
    writeStored({
      token: result.accessToken,
      expiresAt: Date.now() + result.expiresInSeconds * 1000,
      admin: result.admin,
    })
    setAdmin(result.admin)
  }, [])

  const value = useMemo(
    () => ({ admin, isOwner: admin?.role === 'OWNER', signIn, signOut }),
    [admin, signIn, signOut],
  )
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

export function useSession(): Session {
  const session = useContext(SessionContext)
  if (!session) throw new Error('useSession outside SessionProvider')
  return session
}
