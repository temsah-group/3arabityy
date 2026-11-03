import { useQuery } from '@tanstack/react-query';
import { Heart } from 'lucide-react';
import { Link } from 'react-router-dom';

import { PageShell } from '@/components/Layout';
import { PartGrid, PartGridSkeleton } from '@/components/parts';
import { Button, EmptyState, ErrorState } from '@/components/ui';
import { get } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { saved } from '@/lib/collections';
import { useI18n } from '@/lib/i18n';
import type { Part } from '@/lib/types';
import { usePageMeta } from '@/lib/seo';

export default function Saved() {
  const { tr } = useI18n();
  usePageMeta(tr('المحفوظات', 'Saved parts'));
  const { status } = useAuth();
  const ids = saved.use();
  // The ids drive the list, so removing one hides it at once.
  const parts = useQuery({
    queryKey: ['parts', 'batch', 'saved', ids.join(',')],
    queryFn: async () => {
      const chunks: string[][] = [];
      for (let i = 0; i < Math.min(ids.length, 200); i += 50) chunks.push(ids.slice(i, i + 50));
      const pages = await Promise.all(chunks.map((c) => get<{ items: Part[] }>('/parts/batch', { ids: c.join(',') })));
      return { items: pages.flatMap((p) => p.items) };
    },
    enabled: ids.length > 0,
    placeholderData: (previous) => previous,
  });
  const items = (parts.data?.items ?? []).filter((p) => ids.includes(p.id));

  return (
    <PageShell title={tr('المحفوظات', 'Saved parts')} wide>
      {status === 'guest' && ids.length > 0 && (
        <p className="mb-5 rounded-xl bg-navy-mist p-4 text-sm">
          {tr('محفوظاتك على الجهاز ده بس. ', 'Your saved parts are on this device only. ')}
          <Link to="/login" className="font-bold text-orange-deep underline">{tr('ادخل', 'Sign in')}</Link>
          {tr(' عشان تلاقيها في أي مكان.', ' to keep them everywhere.')}
        </p>
      )}
      {ids.length === 0 ? (
        <EmptyState
          icon={<Heart className="h-10 w-10" />}
          title={tr('لسه محفظتش حاجة', 'Nothing saved yet')}
          body={tr('دوس على القلب في أي قطعة عشان ترجعلها بسهولة، وهنقولك لو سعرها نزل.', "Tap the heart on any part to find it again, and we'll tell you if its price drops.")}
          action={<Link to="/search"><Button tabIndex={-1}>{tr('دوّر على قطع', 'Browse parts')}</Button></Link>}
        />
      ) : parts.isLoading ? (
        <PartGridSkeleton count={Math.min(ids.length, 8)} />
      ) : parts.isError ? (
        <ErrorState error={parts.error} onRetry={() => parts.refetch()} />
      ) : (
        <PartGrid parts={items} />
      )}
    </PageShell>
  );
}
