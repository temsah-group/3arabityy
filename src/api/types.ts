/** Shapes of the `/admin` API (see the backend's `docs/api-contract.md`). */

export type AdminRole = 'OWNER' | 'MODERATOR'

export type Admin = {
  id: string
  email: string
  fullName: string
  role: AdminRole
  lastLoginAt: string | null
}

export type Page<T> = { items: T[]; total: number; page: number; pageSize: number }

export type AccountStatus = 'ACTIVE' | 'SUSPENDED'

export type Account = {
  id: string
  fullName: string
  email: string
  phone: string
  profilePhotoUrl: string | null
  accountStatus: AccountStatus
  isVerifiedSeller: boolean
  emailVerified: boolean
  createdAt: string
}

export type AccountRow = Account & { partsCount: number; openReports: number }

export type HistoryEntry = {
  id: string
  adminEmail: string
  action: string
  target: 'USER' | 'PART' | 'REPORT' | 'SETTINGS' | 'ANNOUNCEMENT' | 'SHOP' | 'REVIEW'
  targetId: string
  note: string | null
  changes: Record<string, unknown> | null
  createdAt: string
}

export type AccountDetail = Account & {
  cars: { brandId: string; modelId: string; year: number }[]
  parts: { forSale: number; sold: number; hidden: number; total: number }
  reports: { openOnAccount: number; openOnParts: number; sent: number }
  history: HistoryEntry[]
}

export type PartRow = {
  id: string
  name: string
  category: string
  condition: string
  isOriginal: boolean
  price: number
  oldPrice: number | null
  partNumber: string | null
  images: string[]
  fitments: { brandId: string; modelId: string; fromYear: number; toYear: number }[]
  city: string
  isFeatured: boolean
  isSold: boolean
  listedAt: string
  createdAt: string
  hiddenAt: string | null
  hiddenReason: 'ADMIN' | 'SUSPENDED' | null
  stats?: { views: number; calls: number; whatsapps: number }
  seller: {
    id: string
    name: string
    phone: string
    photoUrl: string | null
    verified: boolean
    email: string | null
    accountStatus: AccountStatus | null
  }
  openReports?: number
}

export type PartDetail = PartRow & {
  description: string | null
  openReports: number
  history: HistoryEntry[]
}

export type ReportTarget = 'PART' | 'SELLER' | 'REVIEW'
export type ReportAction = 'DISMISS' | 'HIDE_PART' | 'REMOVE_PART' | 'HIDE_REVIEW' | 'SUSPEND_SELLER'

export type ReportGroup = {
  target: ReportTarget
  targetId: string
  count: number
  reasons: Record<string, number>
  latestAt: string
  subject: PartRow | Account | ReviewRow | null
}

export type ReportsOn = {
  target: ReportTarget
  targetId: string
  subject: PartRow | Account | ReviewRow | null
  reports: {
    id: string
    reason: string
    details: string | null
    status: 'OPEN' | 'CLOSED'
    createdAt: string
    reporter: { id: string; fullName: string; email: string } | null
    resolution: { action: ReportAction; note: string | null; at: string } | null
  }[]
}

export type Overview = {
  users: { total: number; thisWeek: number; suspended: number; verifiedSellers: number }
  parts: { forSale: number; thisWeek: number; hidden: number }
  reports: { openTargets: number }
}

/** A section of the terms or privacy policy, or a question of the FAQ. */
export type Section = { titleAr: string; titleEn: string; bodyAr: string; bodyEn: string }

export type DocumentName = 'terms' | 'privacy' | 'faq'

export type SupportContact = { email: string; phone: string; whatsapp: string }

export type AppSettings = {
  /** Null until an owner sets it; until then the app shows no way to reach support. */
  support: SupportContact | null
  terms: { sections: Section[]; updatedAt: string }
  privacy: { sections: Section[]; updatedAt: string }
  faq: { sections: Section[]; updatedAt: string }
}

export type CarModel = { id: string; nameAr: string; nameEn: string; fromYear: number; toYear: number | null }
export type CarBrand = { id: string; nameAr: string; nameEn: string; models: CarModel[] }

/** `/settings` also carries the cars, as `/app-config` does. */
export type CarsSettings = { cars: { brands: CarBrand[]; updatedAt: string | null } }

export type Audience = 'ALL' | 'SELLERS'

export type Announcement = {
  id: string
  titleAr: string
  titleEn: string
  bodyAr: string
  bodyEn: string
  audience: Audience
  inbox: boolean
  banner: boolean
  bannerUntil: string | null
  /** Still on the home screen. */
  bannerLive: boolean
  endedAt: string | null
  recipients: number
  adminEmail: string
  createdAt: string
}

export type Count = { key: string; count: number; name?: string }

export type Stats = {
  days: number
  daily: { date: string; users: number; parts: number }[]
  totals: { users: number; parts: number }
  forSale: { parts: number; sellers: number; sold: number; views: number; calls: number; whatsapps: number }
  byCategory: Count[]
  byCity: Count[]
  byBrand: Count[]
  topParts: {
    id: string
    name: string
    price: number
    city: string
    images: string[]
    views: number
    calls: number
    whatsapps: number
  }[]
}

export type ShopStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED'

export type ShopRow = {
  id: string
  name: string
  description: string | null
  logoUrl: string | null
  coverUrl: string | null
  phone: string
  whatsapp: string | null
  city: string
  address: string
  location: { lat: number; lng: number } | null
  hours: string | null
  brandIds: string[]
  categories: string[]
  delivery: {
    available: boolean
    governorates: string[]
    feeFrom: number | null
    feeTo: number | null
    eta: string | null
    note: string | null
  }
  verified: boolean
  featured: boolean
  rating: { avg: number; count: number }
  partsCount: number
  status: ShopStatus
  statusReason: string | null
  /** The owner's account is suspended. */
  hidden: boolean
  createdAt: string
  approvedAt: string | null
  owner: { id: string; fullName: string; email: string; phone: string; suspended: boolean } | null
}

export type ShopsPage = Page<ShopRow> & { counts: Partial<Record<ShopStatus, number>> }

export type ShopDetail = ShopRow & { history: HistoryEntry[] }

export type ReviewRow = {
  id: string
  target: 'SHOP' | 'PART'
  targetId: string
  targetName: string | null
  rating: number
  text: string | null
  reply: { text: string; at: string } | null
  author: { id: string; fullName: string; email: string } | null
  seller: { id: string; fullName: string; email: string } | null
  hidden: boolean
  createdAt: string
}
