import { BadgeCheck, ChevronLeft, ChevronRight, HelpCircle, LogOut, Pencil, Plus, Trash2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { Avatar, Button, Verified } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { formatDate, fromE164 } from '@/lib/format';
import { useI18n } from '@/lib/i18n';

import { useAccountLinks } from './AccountLayout';

function Row({ to, icon, label, badge, danger }: { to: string; icon: ReactNode; label: string; badge?: number; danger?: boolean }) {
  const { lang } = useI18n();
  const Arrow = lang === 'ar' ? ChevronLeft : ChevronRight;
  return (
    <Link to={to} className={`flex items-center gap-3 px-5 py-4 hover:bg-canvas ${danger ? 'text-red-600' : ''}`}>
      {icon}
      <span className="flex-1 font-bold">{label}</span>
      {!!badge && <span className="rounded-full bg-orange px-2 text-xs font-bold leading-5 text-white">{badge}</span>}
      <Arrow className="h-4 w-4 text-ink-muted" />
    </Link>
  );
}

/** Phones: the account menu as a list. */
function MobileMenu() {
  const { tr, lang, setLang } = useI18n();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const links = useAccountLinks();
  if (!user) return null;
  const icon = 'h-5 w-5';

  return (
    <div className="mx-auto max-w-2xl lg:hidden">
      <div className="flex items-center gap-4 rounded-2xl bg-navy p-5 text-white">
        <Avatar src={user.profilePhotoUrl} name={user.fullName} size={64} />
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-xl font-extrabold">
            <span className="truncate">{user.fullName}</span>
            {user.accountType === 'SELLER' && <Verified className="text-white" />}
          </p>
          <p className="truncate text-sm text-white/70" dir="ltr">{user.email}</p>
        </div>
      </div>

      <div className="mt-5 divide-y divide-line overflow-hidden rounded-2xl bg-white ring-1 ring-line">
        {links.activity.map((l) => <Row key={l.to} {...l} />)}
      </div>

      <div className="mt-5 divide-y divide-line overflow-hidden rounded-2xl bg-white ring-1 ring-line">
        {links.settings.map((l) => <Row key={l.to} {...l} />)}
        <button onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')} className="flex w-full items-center gap-3 px-5 py-4 text-start hover:bg-canvas">
          <span className="w-5 text-center font-extrabold">ع</span>
          <span className="flex-1 font-bold">{tr('اللغة', 'Language')}</span>
          <span className="text-sm text-ink-soft">{lang === 'ar' ? 'العربية' : 'English'}</span>
        </button>
        <Row to="/help" icon={<HelpCircle className={icon} />} label={tr('المساعدة والأسئلة', 'Help & FAQ')} />
      </div>

      <div className="mt-5 divide-y divide-line overflow-hidden rounded-2xl bg-white ring-1 ring-line">
        <button
          onClick={async () => {
            await logout();
            navigate('/', { replace: true });
          }}
          className="flex w-full items-center gap-3 px-5 py-4 text-start font-bold hover:bg-canvas"
        >
          <LogOut className={icon} />
          {tr('خروج', 'Sign out')}
        </button>
        <Row to="/account/delete" icon={<Trash2 className={icon} />} label={tr('امسح الحساب', 'Delete account')} danger />
      </div>
    </div>
  );
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="rounded-xl bg-canvas px-4 py-3">
      <dt className="text-xs font-bold text-ink-muted">{label}</dt>
      <dd className="mt-0.5 truncate font-bold">{children}</dd>
    </div>
  );
}

/** Wide screens: a dashboard beside the sidebar. */
function Overview() {
  const { tr, lang } = useI18n();
  const { user } = useAuth();
  const links = useAccountLinks();
  if (!user) return null;
  const hints: Record<string, string> = {
    '/account/parts': tr('تابع إعلاناتك، جدّدها أو علّمها اتباعت', 'Track, renew or mark your listings sold'),
    '/account/shop': tr('صفحة محلك وصوره وبياناته', "Your shop's page, photos and details"),
    '/account/reviews': tr('شوف رأي المشترين ورد عليهم', 'See what buyers say and reply'),
    '/notifications': tr('كل جديد عن إعلاناتك وحسابك', 'News about your listings and account'),
  };

  return (
    <div className="hidden space-y-6 lg:block">
      <section className="flex items-center justify-between gap-6 rounded-2xl bg-gradient-to-l from-navy to-navy-soft p-7 text-white">
        <div>
          <p className="text-sm text-white/70">{tr('أهلاً بيك', 'Welcome back')}</p>
          <h1 className="mt-1 text-3xl font-extrabold">{user.fullName.split(' ')[0]}</h1>
          <p className="mt-2 text-white/80">{tr('من هنا تقدر تدير إعلاناتك ومحلك وحسابك.', 'Manage your listings, shop and account from here.')}</p>
        </div>
        <Link to="/sell" className="shrink-0">
          <Button variant="accent" tabIndex={-1}>
            <Plus className="h-4 w-4" />
            {tr('بيع قطعة', 'Sell a part')}
          </Button>
        </Link>
      </section>

      <section className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {links.activity.map((l) => (
          <Link key={l.to} to={l.to} className="group relative rounded-2xl bg-white p-5 ring-1 ring-line transition hover:-translate-y-0.5 hover:shadow-md hover:ring-orange/40">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-orange-mist text-orange-deep transition group-hover:bg-orange group-hover:text-white">
              {l.icon}
            </span>
            {!!l.badge && (
              <span className="absolute end-4 top-4 rounded-full bg-orange px-2 text-xs font-bold leading-5 text-white">{l.badge}</span>
            )}
            <p className="mt-4 font-extrabold">{l.label}</p>
            <p className="mt-1 text-sm leading-6 text-ink-soft">{hints[l.to]}</p>
          </Link>
        ))}
      </section>

      <section className="rounded-2xl bg-white p-6 ring-1 ring-line">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-extrabold">{tr('بيانات الحساب', 'Account details')}</h2>
          <Link to="/account/info" className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-bold text-navy hover:bg-canvas">
            <Pencil className="h-4 w-4" />
            {tr('عدّل', 'Edit')}
          </Link>
        </div>
        <dl className="grid grid-cols-2 gap-3 xl:grid-cols-3">
          <Detail label={tr('الاسم', 'Name')}>{user.fullName}</Detail>
          <Detail label={tr('الإيميل', 'Email')}>
            <span className="flex items-center gap-1.5">
              <span className="truncate" dir="ltr">{user.email}</span>
              {user.emailVerification.isVerified && <BadgeCheck className="h-4 w-4 shrink-0 text-emerald-600" aria-label={tr('متأكد منه', 'Verified')} />}
            </span>
          </Detail>
          <Detail label={tr('الموبايل', 'Phone')}>
            <span dir="ltr">{fromE164(user.phone) || '—'}</span>
          </Detail>
          <Detail label={tr('نوع الحساب', 'Account type')}>
            {user.accountType === 'SELLER' ? tr('بيّاع موثّق', 'Verified seller') : tr('حساب عادي', 'Standard')}
          </Detail>
          <Detail label={tr('طريقة الدخول', 'Sign-in')}>
            {user.signedInWithGoogle ? 'Google' : tr('إيميل وكلمة سر', 'Email and password')}
          </Detail>
          <Detail label={tr('عضو من', 'Member since')}>{formatDate(user.createdAt, lang)}</Detail>
        </dl>
      </section>
    </div>
  );
}

export default function Account() {
  return (
    <>
      <MobileMenu />
      <Overview />
    </>
  );
}
