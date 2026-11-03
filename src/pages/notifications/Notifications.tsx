import { useQueryClient } from '@tanstack/react-query';
import { Bell, BellRing, Car, Megaphone, Settings, Star, Store, Tag, Trash2 } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

import { PageShell } from '@/components/Layout';
import { Button, cx, EmptyState, ErrorState, PageSpinner } from '@/components/ui';
import { del, post } from '@/lib/api';
import { relativeDay } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import { LoadMore, usePaged } from '@/lib/paging';
import type { AppNotification, NotificationKind, Page } from '@/lib/types';
import { usePageMeta } from '@/lib/seo';

const icons: Record<NotificationKind, typeof Bell> = {
  FITS_YOUR_CAR: Car,
  PRICE_DROP: Tag,
  LISTING: BellRing,
  SHOP: Store,
  REVIEW: Star,
  SYSTEM: Megaphone,
};

export default function Notifications() {
  const { tr, lang } = useI18n();
  usePageMeta(tr('الإشعارات', 'Notifications'));
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const list = usePaged<AppNotification, Page<AppNotification> & { unreadCount?: number }>(['me', 'notifications'], '/notifications');
  const unread = list.first?.unreadCount ?? 0;

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['me', 'notifications'] });
    queryClient.invalidateQueries({ queryKey: ['me', 'unread'] });
  };

  const open = async (n: AppNotification) => {
    if (!n.read) post(`/notifications/${n.id}/read`).then(refresh).catch(() => {});
    if (n.partId) navigate(n.kind === 'LISTING' ? '/account/parts' : `/parts/${n.partId}`);
    else if (n.shopId) navigate(n.kind === 'SHOP' ? '/account/shop' : `/shops/${n.shopId}`);
  };

  return (
    <PageShell title={tr('الإشعارات', 'Notifications')}>
      <div className="mb-4 flex items-center justify-between">
        <Link to="/notifications/settings" className="flex items-center gap-1.5 text-sm font-bold text-ink-soft hover:text-navy">
          <Settings className="h-4 w-4" />
          {tr('الإعدادات', 'Settings')}
        </Link>
        {unread > 0 && (
          <Button variant="ghost" size="sm" onClick={() => post('/notifications/read-all').then(refresh)}>
            {tr('علّم الكل مقروء', 'Mark all as read')}
          </Button>
        )}
      </div>
      {list.isLoading ? (
        <PageSpinner />
      ) : list.isError ? (
        <ErrorState error={list.error} onRetry={() => list.refetch()} />
      ) : list.items.length === 0 ? (
        <EmptyState icon={<Bell className="h-10 w-10" />} title={tr('مفيش إشعارات', 'No notifications')} body={tr('هنقولك هنا لما تنزل قطعة لعربيتك أو سعر حاجة حافظها يقل.', "We'll tell you here when a part for your car comes up or a saved part gets cheaper.")} />
      ) : (
        <>
          <ul className="divide-y divide-line overflow-hidden rounded-2xl bg-white ring-1 ring-line">
            {list.items.map((n) => {
              const Icon = icons[n.kind] ?? Bell;
              return (
                <li key={n.id} className={cx('flex gap-3 p-4', !n.read && 'bg-orange-mist/60')}>
                  <span className={cx('flex h-10 w-10 shrink-0 items-center justify-center rounded-full', n.read ? 'bg-canvas text-ink-soft' : 'bg-orange text-white')}>
                    <Icon className="h-5 w-5" />
                  </span>
                  <button onClick={() => open(n)} className="min-w-0 flex-1 text-start">
                    <p className={cx('leading-6', !n.read && 'font-extrabold')}>{n.title}</p>
                    <p className="text-sm leading-6 text-ink-soft">{n.body}</p>
                    <p className="mt-1 text-xs text-ink-muted">{relativeDay(n.createdAt, lang)}</p>
                  </button>
                  <button onClick={() => del(`/notifications/${n.id}`).then(refresh)} className="self-start rounded-lg p-1.5 text-ink-muted hover:bg-canvas hover:text-red-600" aria-label={tr('امسح', 'Delete')}>
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              );
            })}
          </ul>
          <LoadMore hasNext={list.hasNextPage} loading={list.isFetchingNextPage} onLoad={() => list.fetchNextPage()} />
        </>
      )}
    </PageShell>
  );
}
