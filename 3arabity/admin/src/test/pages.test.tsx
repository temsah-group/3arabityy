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

  it('sends a moderator home from an owners\' page opened by its address', async () => {
    localStorage.setItem(
      'arabity-admin-session',
      JSON.stringify({ token: 't', expiresAt: Date.now() + 3_600_000, admin: { ...admin, role: 'MODERATOR' } }),
    )
    const fetch = serve(() => ({ data: { items: [], total: 0, page: 1, pageSize: 25 } }))
    const router = open('/settings')
    await vi.waitFor(() => expect(router.state.location.pathname).toBe('/'))
    expect(fetch.mock.calls.some(([url]) => String(url).includes('/admin/settings'))).toBe(false)
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

describe('settings', () => {
  beforeEach(() => {
    localStorage.setItem(
      'arabity-admin-session',
      JSON.stringify({ token: 't', expiresAt: Date.now() + 3_600_000, admin }),
    )
  })

  it('saves support details and a text', async () => {
    const doc = (title: string) => ({
      sections: [{ titleAr: title, titleEn: 'T', bodyAr: 'نص', bodyEn: 'Text' }],
      updatedAt: '2026-10-15T00:00:00Z',
    })
    const settings = {
      support: { email: 'support@3arabity.com', phone: '+201000000000', whatsapp: '+201000000000' },
      terms: doc('عن عربيتي'),
      privacy: doc('بياناتك'),
      faq: doc('إزاي أشتري؟'),
    }
    const fetch = serve(() => ({ data: settings }))
    open('/settings')

    const whatsapp = await screen.findByLabelText('رقم الواتساب')
    await userEvent.clear(whatsapp)
    await userEvent.type(whatsapp, '+201112223334')
    await userEvent.click(screen.getAllByRole('button', { name: 'حفظ' })[0]!)
    await vi.waitFor(() =>
      expect(fetch.mock.calls.some(([url]) => String(url).endsWith('/settings/support'))).toBe(true),
    )
    const support = fetch.mock.calls.find(([url]) => String(url).endsWith('/settings/support'))!
    expect(JSON.parse(String(support[1]?.body))).toEqual({
      ...settings.support,
      whatsapp: '+201112223334',
    })

    await userEvent.click(screen.getByRole('button', { name: /ضيف جزء/ }))
    const titles = screen.getAllByLabelText('العنوان بالعربي')
    expect(titles).toHaveLength(2)
    await userEvent.type(titles[1]!, 'جزء جديد')
    await userEvent.click(screen.getAllByRole('button', { name: 'حفظ' })[1]!)
    await vi.waitFor(() =>
      expect(fetch.mock.calls.some(([url]) => String(url).endsWith('/settings/documents/terms'))).toBe(true),
    )
    const terms = fetch.mock.calls.find(([url]) => String(url).endsWith('/settings/documents/terms'))!
    const sent = JSON.parse(String(terms[1]?.body)) as { sections: { titleAr: string }[] }
    expect(sent.sections.map((s) => s.titleAr)).toEqual(['عن عربيتي', 'جزء جديد'])
  })

  it('asks for support details until all three are set', async () => {
    const doc = { sections: [{ titleAr: 'ع', titleEn: 'T', bodyAr: 'نص', bodyEn: 'Text' }], updatedAt: '2026-10-15T00:00:00Z' }
    const fetch = serve(() => ({ data: { support: null, terms: doc, privacy: doc, faq: doc } }))
    open('/settings')

    expect(await screen.findByText(/لسه مفيش بيانات دعم/)).toBeTruthy()
    const save = screen.getAllByRole('button', { name: 'حفظ' })[0]!
    await userEvent.type(screen.getByLabelText('البريد الإلكتروني'), 'help@3arabity.com')
    await userEvent.type(screen.getByLabelText('رقم المكالمات'), '+201112223334')
    expect(save).toHaveProperty('disabled', true)
    await userEvent.type(screen.getByLabelText('رقم الواتساب'), '+201112223334')
    expect(save).toHaveProperty('disabled', false)
    await userEvent.click(save)
    await vi.waitFor(() =>
      expect(fetch.mock.calls.some(([url]) => String(url).endsWith('/settings/support'))).toBe(true),
    )
  })
})

describe('phase two', () => {
  beforeEach(() => {
    localStorage.setItem(
      'arabity-admin-session',
      JSON.stringify({ token: 't', expiresAt: Date.now() + 3_600_000, admin }),
    )
  })

  it('shows statistics for the chosen range', async () => {
    const stats = (days: number) => ({
      days,
      daily: Array.from({ length: days }, (_, i) => ({ date: `2026-10-${String(i + 1).padStart(2, '0')}`, users: i, parts: 1 })),
      totals: { users: 21, parts: days },
      forSale: { parts: 12, sellers: 4, sold: 3, views: 200, calls: 6, whatsapps: 14 },
      byCategory: [{ key: 'BRAKES', count: 7 }],
      byCity: [{ key: 'الجيزة', count: 5 }],
      byBrand: [{ key: 'toyota', count: 9, name: 'تويوتا' }],
      topParts: [{ id: 'p1', name: 'تيل فرامل', price: 1250, city: 'القاهرة', images: [], views: 50, calls: 2, whatsapps: 5 }],
    })
    const fetch = serve((url) => ({ data: stats(Number(new URL(url, 'http://x').searchParams.get('days'))) }))
    open('/stats')

    expect(await screen.findByText('تويوتا')).toBeTruthy()
    expect(screen.getByText('الفرامل')).toBeTruthy()
    expect(screen.getByText('تيل فرامل')).toBeTruthy()
    // 20 of every 200 views reach out: 10 in 100.
    expect(screen.getByText(/من كل 100 مشاهدة، ١٠/)).toBeTruthy()

    await userEvent.click(screen.getByText('7 أيام'))
    await vi.waitFor(() => expect(fetch.mock.calls.some(([url]) => String(url).includes('days=7'))).toBe(true))
  })

  it('sends a message to every inbox after asking', async () => {
    const fetch = serve((_url, init) => {
      if (init?.method === 'POST') {
        return { status: 201, data: { id: 'a1', inbox: true, recipients: 42 } }
      }
      return { data: { items: [], total: 0, page: 1, pageSize: 25 } }
    })
    open('/announcements')

    const send = await screen.findByRole('button', { name: 'ابعت' })
    expect((send as HTMLButtonElement).disabled).toBe(true)
    await userEvent.type(screen.getByLabelText('العنوان بالعربي'), 'عرض')
    await userEvent.type(screen.getByLabelText('العنوان بالإنجليزي'), 'Offer')
    await userEvent.type(screen.getByLabelText('الرسالة بالعربي'), 'انشر ببلاش')
    await userEvent.type(screen.getByLabelText('الرسالة بالإنجليزي'), 'List for free')
    await userEvent.click(send)

    const dialog = within(await screen.findByRole('dialog'))
    await userEvent.click(dialog.getByRole('button', { name: 'ابعت' }))
    await vi.waitFor(() => expect(fetch.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(true))
    const post = fetch.mock.calls.find(([, init]) => init?.method === 'POST')!
    expect(JSON.parse(String(post[1]?.body))).toEqual({
      titleAr: 'عرض',
      titleEn: 'Offer',
      bodyAr: 'انشر ببلاش',
      bodyEn: 'List for free',
      audience: 'ALL',
      inbox: true,
      banner: false,
      bannerUntil: null,
    })
  })

  it('adds a car make and shows why a removal is refused', async () => {
    const cars = {
      brands: [
        {
          id: 'toyota',
          nameAr: 'تويوتا',
          nameEn: 'Toyota',
          models: [{ id: 'corolla', nameAr: 'كورولا', nameEn: 'Corolla', fromYear: 2008, toYear: null }],
        },
      ],
      updatedAt: null,
    }
    let refuse = false
    const fetch = serve((_url, init) => {
      if (init?.method === 'PUT' && refuse) {
        return { status: 409, code: 'CARS_IN_USE', message: 'مينفعش تشيل تويوتا كورولا' }
      }
      return { data: { cars } }
    })
    open('/cars')

    await userEvent.click(await screen.findByRole('button', { name: /ضيف ماركة/ }))
    await userEvent.type(screen.getAllByLabelText('الاسم بالعربي').at(-1)!, 'بايك')
    await userEvent.type(screen.getAllByLabelText('الاسم بالإنجليزي').at(-1)!, 'BAIC')
    await userEvent.type(screen.getAllByLabelText('الموديل بالعربي').at(-1)!, 'إكس 35')
    await userEvent.type(screen.getAllByLabelText('الموديل بالإنجليزي').at(-1)!, 'X 35')
    await userEvent.click(screen.getByRole('button', { name: 'حفظ' }))
    await vi.waitFor(() => expect(fetch.mock.calls.some(([, init]) => init?.method === 'PUT')).toBe(true))
    const put = fetch.mock.calls.find(([, init]) => init?.method === 'PUT')!
    const sent = JSON.parse(String(put[1]?.body)) as { brands: { id: string; models: { id: string }[] }[] }
    // Codes come from the English names.
    expect(sent.brands.map((brand) => brand.id)).toEqual(['toyota', 'baic'])
    expect(sent.brands[1]!.models[0]!.id).toBe('x-35')

    refuse = true
    await userEvent.click(screen.getByRole('button', { name: 'حفظ' }))
    expect(await screen.findByText('مينفعش تشيل تويوتا كورولا')).toBeTruthy()
  })
})

describe('shops', () => {
  beforeEach(() => {
    localStorage.setItem(
      'arabity-admin-session',
      JSON.stringify({ token: 't', expiresAt: Date.now() + 3_600_000, admin }),
    )
  })

  const shop = {
    id: 's1', name: 'محل النور', description: null, logoUrl: null, coverUrl: null,
    phone: '+201001234567', whatsapp: null, city: 'القاهرة', address: 'الدقي', location: null,
    hours: null, brandIds: ['toyota'], categories: ['BRAKES'],
    delivery: { available: true, governorates: ['القاهرة', 'الجيزة'], feeFrom: 50, feeTo: 100, eta: null, note: null },
    verified: false, featured: false, rating: { avg: 0, count: 0 }, partsCount: 3,
    status: 'PENDING', statusReason: null, hidden: false, createdAt: '2026-10-19T09:00:00Z', approvedAt: null,
    owner: { id: 'u1', fullName: 'صاحب المحل', email: 'o@x.com', phone: '+201001234567', suspended: false },
  }

  it('lists new applications and rejects one with a reason the owner sees', async () => {
    const fetch = serve((url, init) => {
      if (url.includes('/shops/s1') && init?.method === 'PATCH') return { data: { ...shop, history: [] } }
      if (url.includes('/shops/s1')) return { data: { ...shop, history: [] } }
      if (url.includes('/shops')) {
        return { data: { items: [shop], total: 1, page: 1, pageSize: 25, counts: { PENDING: 1 } } }
      }
      return { data: { items: [], total: 0, page: 1, pageSize: 25 } }
    })
    const router = open('/shops')
    expect(await screen.findByText('2 محافظة')).toBeTruthy()
    expect(screen.getByText('طلب جديد (1)')).toBeTruthy()

    await userEvent.click(screen.getByText('محل النور'))
    expect(router.state.location.pathname).toBe('/shops/s1')
    await userEvent.click(await screen.findByRole('button', { name: 'ارفض' }))
    const dialog = within(await screen.findByRole('dialog'))
    expect(dialog.getByText('صاحب المحل هيشوف السبب ده في الإشعار وفي التطبيق')).toBeTruthy()
    await userEvent.type(dialog.getByLabelText('السبب'), 'العنوان ناقص')
    await userEvent.click(dialog.getByRole('button', { name: 'ارفض الطلب' }))

    await vi.waitFor(() => {
      const call = fetch.mock.calls.find(([, init]) => init?.method === 'PATCH')
      expect(JSON.parse(String(call?.[1]?.body))).toEqual({ status: 'REJECTED', note: 'العنوان ناقص' })
    })
  })

  it('shows where the shop put itself on the map', async () => {
    vi.stubEnv('VITE_MAPS_EMBED_KEY', 'embed-key')
    const pinned = { ...shop, location: { lat: 30.0385, lng: 31.2109 } }
    serve(() => ({ data: { ...pinned, history: [] } }))
    open('/shops/s1')

    const map = await screen.findByTitle('مكان محل النور على الخريطة')
    const src = new URL(map.getAttribute('src')!)
    expect(src.pathname).toBe('/maps/embed/v1/place')
    expect(src.searchParams.get('key')).toBe('embed-key')
    expect(src.searchParams.get('q')).toBe('30.0385,31.2109')
    expect(screen.getByText('افتح على Google Maps').getAttribute('href')).toContain('query=30.0385,31.2109')
    vi.unstubAllEnvs()
  })

  it('says so when the shop has no pin yet', async () => {
    serve(() => ({ data: { ...shop, history: [] } }))
    open('/shops/s1')
    expect(await screen.findByText('المحل لسه محددش مكانه على الخريطة.')).toBeTruthy()
  })
})

describe('home offers', () => {
  beforeEach(() => {
    localStorage.setItem(
      'arabity-admin-session',
      JSON.stringify({ token: 't', expiresAt: Date.now() + 3_600_000, admin }),
    )
  })

  const offer = (id: string, titleAr: string, extra: object = {}) => ({
    id,
    tagAr: 'عرض',
    tagEn: 'Offer',
    titleAr,
    titleEn: titleAr,
    subtitleAr: '',
    subtitleEn: '',
    image: `/uploads/offers/${id}.jpg`,
    condition: null,
    active: true,
    endsAt: null,
    live: true,
    order: 0,
    createdAt: '2026-10-01T10:00:00Z',
    ...extra,
  })

  it('says the app shows none until one is added', async () => {
    serve(() => ({ data: { items: [] } }))
    open('/offers')
    expect(await screen.findByText(/مفيش عروض/)).toBeTruthy()
  })

  it('adds a slide with its photo, in both languages', async () => {
    const fetch = serve((url, init) => {
      if (url.endsWith('/offers/photo')) return { status: 201, data: { path: '/uploads/offers/new.jpg' } }
      if (init?.method === 'POST') return { status: 201, data: offer('o9', 'خصم الفرامل') }
      return { data: { items: [] } }
    })
    open('/offers')
    await userEvent.click(await screen.findByRole('button', { name: 'عرض جديد' }))
    const dialog = within(await screen.findByRole('dialog'))
    const save = dialog.getByRole('button', {
      name: 'احفظ',
    }) as HTMLButtonElement
    await userEvent.type(dialog.getByLabelText('الشارة بالعربي'), 'عرض الأسبوع')
    await userEvent.type(dialog.getByLabelText('الشارة بالإنجليزي'), 'This week')
    await userEvent.type(dialog.getByLabelText('العنوان بالعربي'), 'خصم الفرامل')
    await userEvent.type(dialog.getByLabelText('العنوان بالإنجليزي'), 'Brakes on sale')
    // No photo yet.
    expect(save.disabled).toBe(true)
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    await userEvent.upload(
      input,
      new File([new Uint8Array([0xff, 0xd8, 0xff])], 'o.jpg', {
        type: 'image/jpeg',
      }),
    )
    await vi.waitFor(() => expect(save.disabled).toBe(false))
    const upload = fetch.mock.calls.find(([url]) => String(url).endsWith('/offers/photo'))!
    expect(upload[1]?.body).toBeInstanceOf(FormData)

    await userEvent.click(save)
    await vi.waitFor(() =>
      expect(fetch.mock.calls.some(([, init]) => init?.method === 'POST' && typeof init.body === 'string')).toBe(true),
    )
    const post = fetch.mock.calls.find(([, init]) => init?.method === 'POST' && typeof init.body === 'string')!
    expect(JSON.parse(String(post[1]?.body))).toEqual({
      tagAr: 'عرض الأسبوع',
      tagEn: 'This week',
      titleAr: 'خصم الفرامل',
      titleEn: 'Brakes on sale',
      subtitleAr: '',
      subtitleEn: '',
      image: '/uploads/offers/new.jpg',
      condition: null,
      active: true,
      endsAt: null,
    })
  })

  it('moves a slide up, and says which are paused or over', async () => {
    const fetch = serve(() => ({
      data: {
        items: [
          offer('o1', 'الأول'),
          offer('o2', 'التاني', { active: false, live: false }),
          offer('o3', 'التالت', {
            endsAt: '2026-01-01T00:00:00Z',
            live: false,
          }),
        ],
      },
    }))
    open('/offers')
    const second = within(await screen.findByTestId('offer-o2'))
    expect(second.getByText('متوقف')).toBeTruthy()
    expect(within(screen.getByTestId('offer-o3')).getByText('خلص')).toBeTruthy()
    expect(within(screen.getByTestId('offer-o1')).getByText('ظاهر')).toBeTruthy()

    await userEvent.click(second.getByRole('button', { name: 'لفوق' }))
    await vi.waitFor(() => expect(fetch.mock.calls.some(([, init]) => init?.method === 'PUT')).toBe(true))
    const put = fetch.mock.calls.find(([, init]) => init?.method === 'PUT')!
    expect(String(put[0])).toContain('/admin/offers/order')
    expect(JSON.parse(String(put[1]?.body))).toEqual({
      ids: ['o2', 'o1', 'o3'],
    })
  })
})
