import { afterEach, describe, expect, it, vi } from 'vitest'

import { api, ApiError, mediaUrl, onUnauthorized, setToken } from '../api/client'

function reply(status: number, body: unknown) {
  return vi.fn(async () => new Response(JSON.stringify(body), { status }))
}

afterEach(() => {
  vi.unstubAllGlobals()
  setToken(null)
})

describe('api', () => {
  it('sends the token and the query, and returns data', async () => {
    const fetch = reply(200, { success: true, message: 'ok', data: { items: [1] } })
    vi.stubGlobal('fetch', fetch)
    setToken('t1')
    const data = await api<{ items: number[] }>('/users', { query: { q: 'أحمد', status: '', page: 2 } })
    expect(data.items).toEqual([1])
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('/api/v1/admin/users?q=%D8%A3%D8%AD%D9%85%D8%AF&page=2')
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer t1')
  })

  it('throws the API\'s message and code, and signs out on a stale token', async () => {
    const signedOut = vi.fn()
    onUnauthorized(signedOut)
    vi.stubGlobal('fetch', reply(403, { success: false, code: 'ADMIN_ROLE_REQUIRED', message: 'للمالك بس' }))
    setToken('t1')
    await expect(api('/audit')).rejects.toMatchObject({ status: 403, code: 'ADMIN_ROLE_REQUIRED', message: 'للمالك بس' })
    expect(signedOut).not.toHaveBeenCalled()

    vi.stubGlobal('fetch', reply(401, { success: false, code: 'SESSION_REVOKED', message: 'انتهت' }))
    await expect(api('/overview')).rejects.toBeInstanceOf(ApiError)
    expect(signedOut).toHaveBeenCalledOnce()

    // A wrong password is not a stale session.
    signedOut.mockClear()
    await expect(api('/auth/login', { method: 'POST', body: {} })).rejects.toBeInstanceOf(ApiError)
    expect(signedOut).not.toHaveBeenCalled()
  })

  it('says so when the server cannot be reached', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new TypeError('Failed to fetch'))))
    await expect(api('/overview')).rejects.toMatchObject({ status: 0, code: 'NETWORK' })
  })
})

describe('mediaUrl', () => {
  it('keeps outside photos and serves uploads from the API', () => {
    expect(mediaUrl('https://images.example.com/a.jpg')).toBe('https://images.example.com/a.jpg')
    expect(mediaUrl('/uploads/parts/a.jpg')).toBe('/uploads/parts/a.jpg')
  })
})
