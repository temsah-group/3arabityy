import { DirectionProvider, MantineProvider } from '@mantine/core'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { SessionProvider } from '../auth/session'
import { routes } from '../router'
import { theme } from '../theme'

const admin = { id: 'a1', email: 'owner@3arabity.com', fullName: 'مدير', role: 'OWNER', lastLoginAt: null }

type Route = (url: string, init?: RequestInit) => { status?: number; data?: unknown; code?: string; message?: string }

function serve(route: Route) {
  const fetch = vi.fn(async (url: string, init?: RequestInit) => {
    const answer = route(url, init)
    const status = answer.status ?? 200
    const body = status < 400 ? { success: true, message: 'ok', data: answer.data ?? null } : { success: false, ...answer }
    return new Response(JSON.stringify(body), { status })
  })
  vi.stubGlobal('fetch', fetch)
  return fetch
}

function open(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  render(
    <DirectionProvider initialDirection="rtl">
      <MantineProvider theme={theme}>
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
          <SessionProvider>
            <RouterProvider router={router} />
          </SessionProvider>
        </QueryClientProvider>
      </MantineProvider>
    </DirectionProvider>,
  )
  return router
}

beforeEach(() => localStorage.clear())
afterEach(() => vi.unstubAllGlobals())

describe('sign-in', () => {
  it('sends signed-out admins to sign in, then where they were going', async () => {
    serve((url) => {
      if (url.endsWith('/auth/login')) {
        return { data: { accessToken: 't', expiresInSeconds: 3600, admin } }
      }
      return { data: { items: [], total: 0, page: 1, pageSize: 25 } }
    })
    const router = open('/users')
    expect(router.state.location.pathname).toBe('/login')

    await userEvent.type(screen.getByLabelText(/البريد الإلكتروني/), 'owner@3arabity.com')
    await userEvent.type(screen.getByLabelText(/كلمة المرور/), 'secret-password')
    await userEvent.click(screen.getByRole('button', { name: 'دخول' }))

    expect(await screen.findByText('مفيش مستخدمين بالبحث ده')).toBeTruthy()
    expect(router.state.location.pathname).toBe('/users')
    expect(JSON.parse(localStorage.getItem('arabity-admin-session')!).token).toBe('t')
  })

  it('shows the API\'s refusal', async () => {
    serve(() => ({ status: 401, code: 'INVALID_CREDENTIALS', message: 'البريد الإلكتروني أو كلمة المرور غير صحيحة' }))
    open('/login')
    await userEvent.type(screen.getByLabelText(/البريد الإلكتروني/), 'x@y.com')
    await userEvent.type(screen.getByLabelText(/كلمة المرور/), 'nope')
    await userEvent.click(screen.getByRole('button', { name: 'دخول' }))
    expect(await screen.findByText('البريد الإلكتروني أو كلمة المرور غير صحيحة')).toBeTruthy()
  })
})

describe('reports', () => {
  beforeEach(() => {
    localStorage.setItem(
      'arabity-admin-session',
      JSON.stringify({ token: 't', expiresAt: Date.now() + 3_600_000, admin }),
    )
  })

  it('lists grouped reports and resolves one with a reason', async () => {
    const part = {
      id: 'p1', name: 'طقم تيل فرامل', price: 1250, images: [], city: 'القاهرة',
      isSold: false, hiddenAt: null, hiddenReason: null,
      seller: { id: 'u1', name: 'مخزن الأمانة', accountStatus: 'ACTIVE' },
    }
    const fetch = serve((url) => {
      if (url.includes('/reports/PART/p1/resolve')) return { data: { closed: 2 } }
      if (url.includes('/reports/PART/p1')) {
        return {
          data: {
            target: 'PART', targetId: 'p1', subject: part,
            reports: [
              { id: 'r1', reason: 'FAKE', details: null, status: 'OPEN', createdAt: '2026-10-17T09:00:00Z', reporter: { id: 'u2', fullName: 'أحمد', email: 'a@x.com' }, resolution: null },
              { id: 'r2', reason: 'SCAM', details: 'طلب عربون', status: 'OPEN', createdAt: '2026-10-17T08:00:00Z', reporter: null, resolution: null },
            ],
          },
        }
      }
      if (url.includes('/reports')) {
        return {
          data: {
            items: [{ target: 'PART', targetId: 'p1', count: 2, reasons: { FAKE: 1, SCAM: 1 }, latestAt: '2026-10-17T09:00:00Z', subject: part }],
            total: 1, page: 1, pageSize: 25,
          },
        }
      }
      return { data: null }
    })
    const router = open('/reports')
    await userEvent.click(await screen.findByText('طقم تيل فرامل'))
    expect(router.state.location.pathname).toBe('/reports/PART/p1')
    expect(await screen.findByText('طلب عربون')).toBeTruthy()

    await userEvent.click(screen.getByRole('button', { name: 'مسح الإعلان' }))
    const dialog = within(await screen.findByRole('dialog'))
    // No reason yet: the button waits for one.
    const confirm = dialog.getByRole('button', { name: 'مسح الإعلان' })
    expect((confirm as HTMLButtonElement).disabled).toBe(true)
    await userEvent.type(dialog.getByLabelText('السبب'), 'إعلان وهمي')
    await userEvent.click(confirm)

    await vi.waitFor(() => expect(router.state.location.pathname).toBe('/reports'))
    const resolveCall = fetch.mock.calls.find(([url]) => String(url).endsWith('/resolve'))!
    expect(JSON.parse(String(resolveCall[1]?.body))).toEqual({ action: 'REMOVE_PART', note: 'إعلان وهمي' })
  })
})
