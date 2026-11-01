import { useQuery } from '@tanstack/react-query';
import { Bell, Heart, Home, Plus, Search, User, X } from 'lucide-react';
import { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';

import { get } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useAppConfig } from '@/lib/catalog';
import { useI18n } from '@/lib/i18n';
import { persisted } from '@/lib/store';

import { SearchBox } from './search';
import { Button, cx, Dialog } from './ui';

export function Logo({ light }: { light?: boolean }) {
  return (
    <Link to="/" className="flex items-center gap-2" aria-label="عربيتي">
      <img src="/icon.png" alt="" className="h-9 w-9 rounded-lg" />
      <span className={cx('text-2xl font-extrabold leading-none', light ? 'text-white' : 'text-navy')}>عربيتي</span>
    </Link>
  );
}

export function useUnreadCount() {
  const { status } = useAuth();
  return useQuery({
    queryKey: ['me', 'unread'],
    queryFn: () => get<{ unreadCount: number }>('/notifications', { limit: 1 }).then((r) => r.unreadCount ?? 0),
    enabled: status === 'signedIn',
    refetchInterval: 60_000,
  });
}

function LanguageSwitch({ className }: { className?: string }) {
  const { lang, setLang } = useI18n();
  return (
    <button
      onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')}
      className={cx('rounded-lg px-2.5 py-1.5 text-sm font-bold hover:bg-white/10', className)}
      lang={lang === 'ar' ? 'en' : 'ar'}
    >
      {lang === 'ar' ? 'English' : 'عربي'}
    </button>
  );
}

function HeaderSearch() {
  const [q, setQ] = useState('');
  const { pathname } = useLocation();
  // The search page has its own, bigger box.
  if (pathname === '/search') return <div className="hidden flex-1 md:block" />;
  return <SearchBox value={q} onValueChange={setQ} className="hidden flex-1 md:block md:max-w-md" />;
}

function Header() {
  const { tr } = useI18n();
  const { status, user } = useAuth();
  const unread = useUnreadCount().data ?? 0;
  const link = ({ isActive }: { isActive: boolean }) =>
    cx('rounded-lg px-3 py-2 text-sm font-bold transition-colors', isActive ? 'bg-white/15 text-white' : 'text-white/80 hover:text-white');

  return (
    <header className="sticky top-0 z-30 bg-navy text-white" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
      <div className="mx-auto flex h-16 max-w-page items-center gap-4 px-4">
        <Logo light />
        <nav className="hidden items-center gap-1 lg:flex">
          <NavLink to="/" end className={link}>
            {tr('الرئيسية', 'Home')}
          </NavLink>
          <NavLink to="/search" className={link}>
            {tr('كل القطع', 'All parts')}
          </NavLink>
          <NavLink to="/shops" className={link}>
            {tr('المحلات', 'Shops')}
          </NavLink>
        </nav>
        <HeaderSearch />
        <div className="ms-auto flex items-center gap-1">
          <LanguageSwitch className="hidden sm:block" />
          <Link to="/saved" className="hidden rounded-lg p-2 hover:bg-white/10 md:block" aria-label={tr('المحفوظات', 'Saved')}>
            <Heart className="h-5 w-5" />
          </Link>
          {status === 'signedIn' && (
            <Link to="/notifications" className="relative rounded-lg p-2 hover:bg-white/10" aria-label={tr('الإشعارات', 'Notifications')}>
              <Bell className="h-5 w-5" />
              {unread > 0 && (
                <span className="absolute -top-0.5 end-0 min-w-5 rounded-full bg-orange px-1 text-center text-[11px] font-bold leading-5">
                  {unread > 99 ? '99+' : unread}
                </span>
              )}
            </Link>
          )}
          <Link to="/sell" className="hidden md:block">
            <Button variant="accent" size="sm" tabIndex={-1}>
              <Plus className="h-4 w-4" />
              {tr('بيع قطعة', 'Sell a part')}
            </Button>
          </Link>
          {status === 'signedIn' && user ? (
            <Link to="/account" className="hidden items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-white/10 md:flex">
              <User className="h-5 w-5" />
              <span className="max-w-28 truncate text-sm font-bold">{user.fullName.split(' ')[0]}</span>
            </Link>
          ) : status === 'guest' ? (
            <Link to="/login" className="hidden rounded-lg px-3 py-2 text-sm font-bold hover:bg-white/10 md:block">
              {tr('دخول', 'Sign in')}
            </Link>
          ) : null}
        </div>
      </div>
    </header>
  );
}

function BottomNav() {
  const { tr } = useI18n();
  const item = ({ isActive }: { isActive: boolean }) =>
    cx('flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-bold', isActive ? 'text-navy' : 'text-ink-muted');
  return (
    <nav className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white md:hidden">
      <div className="flex items-end">
        <NavLink to="/" end className={item}>
          <Home className="h-5 w-5" />
          {tr('الرئيسية', 'Home')}
        </NavLink>
        <NavLink to="/search" className={item}>
          <Search className="h-5 w-5" />
          {tr('بحث', 'Search')}
        </NavLink>
        <NavLink to="/sell" className="flex flex-1 flex-col items-center gap-0.5 pb-2 text-[11px] font-bold text-orange-deep">
          <span className="-mt-5 flex h-12 w-12 items-center justify-center rounded-full bg-orange text-white shadow-md ring-4 ring-white">
            <Plus className="h-6 w-6" />
          </span>
          {tr('بيع', 'Sell')}
        </NavLink>
        <NavLink to="/saved" className={item}>
          <Heart className="h-5 w-5" />
          {tr('المحفوظات', 'Saved')}
        </NavLink>
        <NavLink to="/account" className={item}>
          <User className="h-5 w-5" />
          {tr('حسابي', 'Account')}
        </NavLink>
      </div>
    </nav>
  );
}

const dismissedBanners = persisted<string[]>('arabity.banners', []);

function AnnouncementBanner() {
  const { pick, tr } = useI18n();
  const announcement = useAppConfig().data?.announcement;
  const dismissed = dismissedBanners.use();
  if (!announcement || dismissed.includes(announcement.id)) return null;
  return (
    <div className="bg-orange-mist">
      <div className="mx-auto flex max-w-page items-start gap-3 px-4 py-3 text-sm">
        <div className="flex-1">
          <p className="font-extrabold">{pick(announcement.titleAr, announcement.titleEn)}</p>
          <p className="text-ink-soft">{pick(announcement.bodyAr, announcement.bodyEn)}</p>
        </div>
        <button
          onClick={() => dismissedBanners.set([...dismissed, announcement.id])}
          className="rounded-lg p-1 hover:bg-white"
          aria-label={tr('إخفاء', 'Dismiss')}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function SessionEndedDialog() {
  const { tr } = useI18n();
  const { sessionEnded, dismissSessionEnded } = useAuth();
  const navigate = useNavigate();
  return (
    <Dialog open={sessionEnded} onClose={dismissSessionEnded} title={tr('انتهت الجلسة', 'You were signed out')}>
      <p className="mb-5 text-ink-soft">
        {tr(
          'خرجت من حسابك على الجهاز ده. ادخل تاني عشان تكمل.',
          'Your session on this device ended. Sign in again to continue.',
        )}
      </p>
      <Button
        className="w-full"
        onClick={() => {
          dismissSessionEnded();
          navigate('/login');
        }}
      >
        {tr('تسجيل الدخول', 'Sign in')}
      </Button>
    </Dialog>
  );
}

function Footer() {
  const { tr } = useI18n();
  return (
    <footer className="mt-16 bg-navy-deep text-white/70">
      <div className="mx-auto grid max-w-page gap-8 px-4 py-10 sm:grid-cols-3">
        <div className="space-y-3">
          <Logo light />
          <p className="text-sm leading-7">
            {tr('قطع غيار عربيتك من بياعين ومحلات في كل مصر: جديد ومستعمل واستيراد.', 'Parts for your car from sellers and shops across Egypt: new, used and imported.')}
          </p>
        </div>
        <div className="flex flex-col gap-2 text-sm">
          <Link to="/search" className="hover:text-white">{tr('كل القطع', 'All parts')}</Link>
          <Link to="/shops" className="hover:text-white">{tr('المحلات', 'Shops')}</Link>
          <Link to="/sell" className="hover:text-white">{tr('بيع قطعة', 'Sell a part')}</Link>
        </div>
        <div className="flex flex-col gap-2 text-sm">
          <Link to="/help" className="hover:text-white">{tr('المساعدة والأسئلة', 'Help & FAQ')}</Link>
          <Link to="/legal/terms" className="hover:text-white">{tr('شروط الاستخدام', 'Terms of use')}</Link>
          <Link to="/legal/privacy" className="hover:text-white">{tr('سياسة الخصوصية', 'Privacy policy')}</Link>
          <LanguageSwitch className="self-start px-0 hover:bg-transparent hover:text-white" />
        </div>
      </div>
      <p className="border-t border-white/10 py-4 text-center text-xs">© {new Date().getFullYear()} عربيتي</p>
    </footer>
  );
}

export function Layout() {
  const { pathname } = useLocation();
  return (
    <div className="flex min-h-screen flex-col pb-20 md:pb-0">
      <Header />
      {pathname === '/' && <AnnouncementBanner />}
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
      <BottomNav />
      <SessionEndedDialog />
    </div>
  );
}

/** True inside the account layout, which already places and sizes the page. */
export const AccountPageContext = createContext(false);

/** A centred page with a title. */
export function PageShell({ title, children, wide, back }: { title?: string; children: ReactNode; wide?: boolean; back?: ReactNode }) {
  const inAccount = useContext(AccountPageContext);
  return (
    <div className={cx(!inAccount && 'mx-auto px-4 py-6 md:py-10', !inAccount && (wide ? 'max-w-page' : 'max-w-2xl'))}>
      {back}
      {title && <h1 className="mb-6 text-2xl font-extrabold md:text-3xl">{title}</h1>}
      {children}
    </div>
  );
}

