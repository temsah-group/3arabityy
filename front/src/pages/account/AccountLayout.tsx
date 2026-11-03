import { Bell, BellRing, HelpCircle, KeyRound, LogOut, Package, Star, Store, Trash2, UserRound } from 'lucide-react';
import type { ReactNode } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';

import { AccountPageContext, useUnreadCount } from '@/components/Layout';
import { Avatar, cx, Verified } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { formatDate } from '@/lib/format';
import { useI18n } from '@/lib/i18n';

const icon = 'h-5 w-5 shrink-0';

export function useAccountLinks() {
  const { tr } = useI18n();
  const { user } = useAuth();
  const unread = useUnreadCount().data ?? 0;
  return {
    activity: [
      { to: '/account/parts', icon: <Package className={icon} />, label: tr('إعلاناتي', 'My listings') },
      { to: '/account/shop', icon: <Store className={icon} />, label: tr('محلي', 'My shop') },
      { to: '/account/reviews', icon: <Star className={icon} />, label: tr('التقييمات اللي وصلتني', 'Reviews I received') },
      { to: '/notifications', icon: <Bell className={icon} />, label: tr('الإشعارات', 'Notifications'), badge: unread },
    ],
    settings: [
      { to: '/account/info', icon: <UserRound className={icon} />, label: tr('بياناتي', 'Personal info') },
      {
        to: '/account/password',
        icon: <KeyRound className={icon} />,
        label: user?.hasPassword ? tr('غيّر كلمة السر', 'Change password') : tr('اعمل كلمة سر', 'Set a password'),
      },
      { to: '/notifications/settings', icon: <BellRing className={icon} />, label: tr('إعدادات الإشعارات', 'Notification settings') },
    ],
  };
}

function SideLink({ to, icon, label, badge }: { to: string; icon: ReactNode; label: string; badge?: number }) {
  return (
    <NavLink
      to={to}
      end
      className={({ isActive }) =>
        cx(
          'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold transition-colors',
          isActive ? 'bg-navy text-white' : 'text-ink hover:bg-canvas',
        )
      }
    >
      {icon}
      <span className="flex-1 truncate">{label}</span>
      {!!badge && <span className="rounded-full bg-orange px-2 text-xs font-bold leading-5 text-white">{badge > 99 ? '99+' : badge}</span>}
    </NavLink>
  );
}

function SideGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <p className="mb-1 px-3 text-xs font-bold text-ink-muted">{title}</p>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

/** The profile card and menu beside every account page on wide screens. */
function Sidebar() {
  const { tr, lang } = useI18n();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const links = useAccountLinks();
  if (!user) return null;

  return (
    <aside className="sticky top-24 hidden space-y-4 self-start lg:block">
      <div className="overflow-hidden rounded-2xl bg-white ring-1 ring-line">
        <div className="h-16 bg-gradient-to-l from-navy to-navy-soft" />
        <div className="-mt-9 px-5 pb-5 text-center">
          <div className="mx-auto w-fit rounded-full ring-4 ring-white">
            <Avatar src={user.profilePhotoUrl} name={user.fullName} size={72} />
          </div>
          <p className="mt-2 flex items-center justify-center gap-1.5 text-lg font-extrabold">
            <span className="truncate">{user.fullName}</span>
            {user.accountType === 'SELLER' && <Verified />}
          </p>
          <p className="truncate text-sm text-ink-soft" dir="ltr">{user.email}</p>
          <p className="mt-2 text-xs text-ink-muted">
            {tr('عضو من', 'Member since')} {formatDate(user.createdAt, lang)}
          </p>
        </div>
      </div>

      <nav className="space-y-4 rounded-2xl bg-white p-3 ring-1 ring-line">
        <SideGroup title={tr('نشاطي', 'Activity')}>
          {links.activity.map((l) => <SideLink key={l.to} {...l} />)}
        </SideGroup>
        <SideGroup title={tr('الإعدادات', 'Settings')}>
          {links.settings.map((l) => <SideLink key={l.to} {...l} />)}
          <SideLink to="/help" icon={<HelpCircle className={icon} />} label={tr('المساعدة والأسئلة', 'Help & FAQ')} />
        </SideGroup>
        <div className="space-y-0.5 border-t border-line pt-3">
          <button
            onClick={async () => {
              await logout();
              navigate('/', { replace: true });
            }}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-start text-sm font-bold hover:bg-canvas"
          >
            <LogOut className={icon} />
            {tr('خروج', 'Sign out')}
          </button>
          <NavLink
            to="/account/delete"
            className={({ isActive }) =>
              cx('flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold text-red-600', isActive ? 'bg-red-50' : 'hover:bg-red-50')
            }
          >
            <Trash2 className={icon} />
            {tr('امسح الحساب', 'Delete account')}
          </NavLink>
        </div>
      </nav>
    </aside>
  );
}

/** Account pages: a sidebar and the page on wide screens, the page alone on phones. */
export default function AccountLayout() {
  const { pathname } = useLocation();
  return (
    <AccountPageContext.Provider value>
      <div className="mx-auto grid max-w-page gap-8 px-4 py-6 md:py-10 lg:grid-cols-[17rem_minmax(0,1fr)]">
        <Sidebar />
        <div className={cx('min-w-0', pathname !== '/account' && 'mx-auto w-full max-w-3xl lg:mx-0')}>
          <Outlet />
        </div>
      </div>
    </AccountPageContext.Provider>
  );
}
