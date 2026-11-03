import { useQuery } from '@tanstack/react-query';
import { Calendar, MapPin, Package } from 'lucide-react';
import { Navigate, useParams } from 'react-router-dom';

import { ContactButtons, ReportButton } from '@/components/actions';
import { PartGrid, PartGridSkeleton } from '@/components/parts';
import { Avatar, EmptyState, ErrorState, PageSpinner, Verified } from '@/components/ui';
import { get } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useLabels } from '@/lib/catalog';
import { formatDate } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import { LoadMore, usePaged } from '@/lib/paging';
import type { Part, Seller as SellerT } from '@/lib/types';
import { usePageMeta } from '@/lib/seo';

export default function Seller() {
  const { id = '' } = useParams();
  const { tr, lang } = useI18n();
  const labels = useLabels();
  const { user } = useAuth();
  const seller = useQuery({ queryKey: ['seller', id], queryFn: () => get<SellerT>(`/sellers/${id}`) });
  usePageMeta(seller.data?.name, seller.data && tr(`قطع غيار من ${seller.data.name} على عربيتي`, `Car parts from ${seller.data.name} on 3arabity`));
  const parts = usePaged<Part>(['seller', id, 'parts'], `/sellers/${id}/parts`, {}, { enabled: seller.isSuccess && !seller.data?.shopId });

  if (seller.isLoading) return <PageSpinner />;
  if (seller.isError || !seller.data) return <ErrorState error={seller.error} onRetry={() => seller.refetch()} />;
  const s = seller.data;
  // A seller with an open shop is shown as the shop.
  if (s.shopId) return <Navigate to={`/shops/${s.shopId}`} replace />;

  return (
    <div className="mx-auto max-w-page px-4 py-6 md:py-10">
      <div className="flex flex-col gap-5 rounded-2xl bg-white p-5 ring-1 ring-line md:flex-row md:items-center md:p-6">
        <Avatar src={s.photoUrl} name={s.name} size={72} />
        <div className="flex-1">
          <h1 className="flex items-center gap-2 text-2xl font-extrabold">
            {s.name}
            {s.verified && <Verified className="h-5 w-5" />}
          </h1>
          <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-ink-soft">
            {s.city && <span className="flex items-center gap-1"><MapPin className="h-4 w-4" />{labels.city(s.city)}</span>}
            <span className="flex items-center gap-1"><Package className="h-4 w-4" />{tr(`${s.partsCount} قطعة للبيع`, `${s.partsCount} parts for sale`)}</span>
            {s.firstListedAt && <span className="flex items-center gap-1"><Calendar className="h-4 w-4" />{tr('بيعرض من ', 'Selling since ')}{formatDate(s.firstListedAt, lang)}</span>}
          </div>
        </div>
        {user?.id !== s.id && (
          <div className="w-full space-y-3 md:w-72">
            <ContactButtons phone={s.phone} />
            <ReportButton target="SELLER" targetId={s.id} />
          </div>
        )}
      </div>

      <h2 className="mb-4 mt-8 text-xl font-extrabold">{tr('قطعه', 'Their parts')}</h2>
      {parts.isLoading ? (
        <PartGridSkeleton />
      ) : parts.items.length === 0 ? (
        <EmptyState title={tr('مفيش قطع للبيع دلوقتي', 'Nothing for sale right now')} />
      ) : (
        <>
          <PartGrid parts={parts.items} />
          <LoadMore hasNext={parts.hasNextPage} loading={parts.isFetchingNextPage} onLoad={() => parts.fetchNextPage()} />
        </>
      )}
    </div>
  );
}
