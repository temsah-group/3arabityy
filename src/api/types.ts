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
  target: 'USER' | 'PART' | 'REPORT'
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

export type ReportTarget = 'PART' | 'SELLER'
export type ReportAction = 'DISMISS' | 'HIDE_PART' | 'REMOVE_PART' | 'SUSPEND_SELLER'

export type ReportGroup = {
  target: ReportTarget
  targetId: string
  count: number
  reasons: Record<string, number>
  latestAt: string
  subject: PartRow | Account | null
}

export type ReportsOn = {
  target: ReportTarget
  targetId: string
  subject: PartRow | Account | null
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
