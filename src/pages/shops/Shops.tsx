import { Search, Store } from 'lucide-react';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';

import { ShopCard } from '@/components/shops';
import { EmptyState, ErrorState, Input, Select, Skeleton } from '@/components/ui';
import { GOVERNORATES, useLabels } from '@/lib/catalog';
import { useI18n } from '@/lib/i18n';
import { LoadMore, usePaged } from '@/lib/paging';
import type { Shop } from '@/lib/types';

export default function Shops() {
  const { tr } = useI18n();
  const labels = useLabels();
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState(params.get('q') ?? '');

  const query = {
    q: params.get('q') ?? undefined,
    city: params.get('city') ?? undefined,
    deliversTo: params.get('deliversTo') ?? undefined,
    brandId: params.get('brandId') ?? undefined,
    sort: params.get('sort') ?? 'TOP',
  };
  const list = usePaged<Shop>(['shops'], '/shops', query);

  const set = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };

  return (
    <div className="mx-auto max-w-page px-4 py-6 md:py-10">
      <h1 className="text-2xl font-extrabold md:text-3xl">{tr('محلات قطع الغيار', 'Parts shops')}</h1>
      <p className="mt-1 text-ink-soft">{tr('محلات مراجَعة، بعناوينها ومواعيدها وتوصيلها.', 'Reviewed shops with their address, hours and delivery.')}</p>

      <div className="mt-6 grid gap-3 md:grid-cols-[1fr_auto_auto_auto]">
        <form onSubmit={(e: FormEvent) => { e.preventDefault(); set('q', q.trim()); }} className="relative">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-muted" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={tr('اسم المحل', 'Shop name')} className="ps-10" aria-label={tr('ابحث', 'Search')} />
        </form>
        <Select value={query.city ?? ''} onChange={(e) => set('city', e.target.value)} aria-label={tr('المحافظة', 'Governorate')}>
          <option value="">{tr('في أي محافظة', 'In any governorate')}</option>
          {GOVERNORATES.map((g) => <option key={g} value={g}>{labels.city(g)}</option>)}
        </Select>
        <Select value={query.deliversTo ?? ''} onChange={(e) => set('deliversTo', e.target.value)} aria-label={tr('بيوصّل لـ', 'Delivers to')}>
          <option value="">{tr('بيوصّل لأي مكان', 'Delivers anywhere')}</option>
          {GOVERNORATES.map((g) => <option key={g} value={g}>{tr('بيوصّل لـ', 'Delivers to')} {labels.city(g)}</option>)}
        </Select>
        <Select value={query.sort} onChange={(e) => set('sort', e.target.value)} aria-label={tr('الترتيب', 'Sort')}>
          <option value="TOP">{tr('الأعلى تقييماً', 'Top rated')}</option>
          <option value="NEWEST">{tr('الأحدث', 'Newest')}</option>
        </Select>
      </div>

      <div className="mt-6">
        {list.isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-52" />)}
          </div>
        ) : list.isError ? (
          <ErrorState error={list.error} onRetry={() => list.refetch()} />
        ) : list.items.length === 0 ? (
          <EmptyState icon={<Store className="h-10 w-10" />} title={tr('مفيش محلات بالمواصفات دي', 'No shops match')} />
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {list.items.map((s) => <ShopCard key={s.id} shop={s} />)}
            </div>
            <LoadMore hasNext={list.hasNextPage} loading={list.isFetchingNextPage} onLoad={() => list.fetchNextPage()} />
          </>
        )}
      </div>
    </div>
  );
}
