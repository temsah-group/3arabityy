import { useQuery, useQueryClient } from '@tanstack/react-query';

import { PageShell } from '@/components/Layout';
import { cx, ErrorState, errorMessage, PageSpinner, useToast } from '@/components/ui';
import { get, put } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import type { NotificationSettings as Settings } from '@/lib/types';
import { usePageMeta } from '@/lib/seo';

export default function NotificationSettings() {
  const { tr } = useI18n();
  usePageMeta(tr('إعدادات الإشعارات', 'Notification settings'));
  const toast = useToast();
  const queryClient = useQueryClient();
  const settings = useQuery({ queryKey: ['me', 'notification-settings'], queryFn: () => get<Settings>('/notifications/settings') });

  const toggle = async (key: keyof Settings) => {
    if (!settings.data) return;
    const next = { ...settings.data, [key]: !settings.data[key] };
    queryClient.setQueryData(['me', 'notification-settings'], next);
    try {
      await put('/notifications/settings', next);
    } catch (error) {
      queryClient.setQueryData(['me', 'notification-settings'], settings.data);
      toast(errorMessage(error, tr('محصلش حفظ', "Couldn't save")));
    }
  };

  const rows: { key: keyof Settings; title: string; body: string }[] = [
    { key: 'fitsMyCar', title: tr('قطع جديدة لعربيتي', 'New parts for my cars'), body: tr('لما حد يعرض قطعة بتركب على عربية من عربياتك.', 'When someone lists a part that fits one of your cars.') },
    { key: 'priceDrops', title: tr('سعر نزل', 'Price drops'), body: tr('لما سعر قطعة في محفوظاتك يقل.', 'When a saved part gets cheaper.') },
    { key: 'news', title: tr('أخبار عربيتي', '3arabity news'), body: tr('عروض وأخبار من فريق عربيتي.', 'Offers and news from the 3arabity team.') },
  ];

  return (
    <PageShell title={tr('إعدادات الإشعارات', 'Notification settings')}>
      {settings.isLoading ? (
        <PageSpinner />
      ) : settings.isError || !settings.data ? (
        <ErrorState error={settings.error} onRetry={() => settings.refetch()} />
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-2xl bg-white ring-1 ring-line">
          {rows.map((r) => {
            const on = settings.data[r.key];
            return (
              <li key={r.key}>
                <button role="switch" aria-checked={on} onClick={() => toggle(r.key)} className="flex w-full items-center gap-4 p-5 text-start hover:bg-canvas">
                  <span className="flex-1">
                    <span className="block font-bold">{r.title}</span>
                    <span className="block text-sm text-ink-soft">{r.body}</span>
                  </span>
                  <span className={cx('relative h-7 w-12 shrink-0 rounded-full transition-colors', on ? 'bg-orange' : 'bg-line')}>
                    <span className={cx('absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all', on ? 'end-1' : 'end-6')} />
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </PageShell>
  );
}
