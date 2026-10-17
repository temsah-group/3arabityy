/** Arabic words for the API's wire values. */

export const categories: Record<string, string> = {
  ENGINE: 'المحرك',
  BRAKES: 'الفرامل',
  SUSPENSION: 'العفشة',
  ELECTRICAL: 'الكهرباء',
  BODY: 'الصاج والبودي',
  LIGHTS: 'الفوانيس',
  FILTERS: 'الفلاتر والزيوت',
  TYRES: 'الكاوتش',
}

export const conditions: Record<string, string> = {
  NEW: 'جديد',
  USED: 'مستعمل',
  IMPORTED: 'استيراد',
}

export const reasons: Record<string, string> = {
  FAKE: 'إعلان وهمي',
  WRONG_INFO: 'بيانات غلط',
  COUNTERFEIT: 'تقليد',
  STOLEN: 'مسروقة',
  SCAM: 'نصب',
  UNREACHABLE: 'مش بيرد',
  ABUSIVE: 'أسلوب مسيء',
  OTHER: 'سبب تاني',
}

export const reportActions: Record<string, string> = {
  DISMISS: 'تجاهل البلاغ',
  HIDE_PART: 'إخفاء الإعلان',
  REMOVE_PART: 'مسح الإعلان',
  SUSPEND_SELLER: 'إيقاف البائع',
}

/** What the audit log calls each action. */
export const auditActions: Record<string, string> = {
  REPORTS_RESOLVED: 'قفل بلاغات',
  USER_SUSPENDED: 'إيقاف حساب',
  USER_RESTORED: 'رجوع حساب',
  SELLER_VERIFIED: 'توثيق بائع',
  SELLER_UNVERIFIED: 'شيل التوثيق',
  PART_HIDDEN: 'إخفاء إعلان',
  PART_SHOWN: 'إظهار إعلان',
  PART_FEATURED: 'تمييز إعلان',
  PART_UNFEATURED: 'شيل التمييز',
  PART_REMOVED: 'مسح إعلان',
}

export const roles: Record<string, string> = { OWNER: 'مالك', MODERATOR: 'مشرف' }

export const label = (map: Record<string, string>, value: string) => map[value] ?? value

const money = new Intl.NumberFormat('ar-EG')
export const formatPrice = (value: number) => `${money.format(value)} ج.م`

const dateTime = new Intl.DateTimeFormat('ar-EG', { dateStyle: 'medium', timeStyle: 'short' })
const dateOnly = new Intl.DateTimeFormat('ar-EG', { dateStyle: 'medium' })
export const formatDateTime = (value: string) => dateTime.format(new Date(value))
export const formatDate = (value: string) => dateOnly.format(new Date(value))
