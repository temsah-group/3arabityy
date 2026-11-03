import type { Lang } from './i18n';

/** `12500` → `12,500 ج.م` (or `12,500 EGP`). */
export function formatPrice(pounds: number, lang: Lang) {
  return `${pounds.toLocaleString('en-US')} ${lang === 'ar' ? 'ج.م' : 'EGP'}`;
}

const dayStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

/** "اليوم"، "أمس"، "منذ 3 أيام"… like the app. */
export function relativeDay(iso: string, lang: Lang) {
  const days = Math.round((dayStart(new Date()) - dayStart(new Date(iso))) / 86_400_000);
  if (lang === 'en') {
    if (days <= 0) return 'Today';
    if (days === 1) return 'Yesterday';
    return `${days} days ago`;
  }
  if (days <= 0) return 'اليوم';
  if (days === 1) return 'أمس';
  if (days === 2) return 'منذ يومين';
  if (days <= 10) return `منذ ${days} أيام`;
  return `منذ ${days} يوم`;
}

export function formatDate(iso: string, lang: Lang) {
  return new Date(iso).toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-GB', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/** Egyptian numbers as typed (`010…`, `+2010…`, `2010…`) → E.164, or null. */
export function toE164(input: string): string | null {
  const digits = input.replace(/[^\d+]/g, '');
  let local = digits;
  if (local.startsWith('+20')) local = local.slice(3);
  else if (local.startsWith('0020')) local = local.slice(4);
  else if (local.startsWith('20') && local.length === 12) local = local.slice(2);
  if (local.startsWith('0')) local = local.slice(1);
  return /^1[0125]\d{8}$/.test(local) ? `+20${local}` : null;
}

/** `+201012345678` → `01012345678` for the form. */
export function fromE164(phone: string | null | undefined) {
  if (!phone) return '';
  return phone.startsWith('+20') ? `0${phone.slice(3)}` : phone;
}

export const telLink = (phone: string) => `tel:${phone}`;
export const whatsappLink = (phone: string, text?: string) =>
  `https://wa.me/${phone.replace(/\D/g, '')}${text ? `?text=${encodeURIComponent(text)}` : ''}`;

/** Shows Latin digits inside RTL text the right way round. */
export const ltr = (text: string) => `\u2066${text}\u2069`;
