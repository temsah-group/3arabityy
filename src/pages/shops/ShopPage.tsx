import { useQuery } from '@tanstack/react-query';
import { Clock, ExternalLink, MapPin, Truck } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';

import { ContactButtons, ReportButton, ShareButton } from '@/components/actions';
import { PartGrid, PartGridSkeleton } from '@/components/parts';
import { Reviews } from '@/components/reviews';
import { Avatar, EmptyState, ErrorState, Img, PageSpinner, Stars, Verified } from '@/components/ui';
import { get } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useLabels } from '@/lib/catalog';
import { formatPrice } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import { LoadMore, usePaged } from '@/lib/paging';
import type { Part, Shop } from '@/lib/types';

export default function ShopPage() {
  const { id = '' } = useParams();
  const { tr, lang } = useI18n();
  const labels = useLabels();
  const { user } = useAuth();
  const shop = useQuery({ queryKey: ['shop', id], queryFn: () => get<Shop>(`/shops/${id}`) });
  const parts = usePaged<Part>(['shop', id, 'parts'], `/shops/${id}/parts`);

  if (shop.isLoading) return <PageSpinner />;
  if (shop.isError || !shop.data) return <ErrorState error={shop.error} onRetry={() => shop.refetch()} />;
  const s = shop.data;
  const isMine = user?.id === s.ownerId;
  const d = s.delivery;
  const fee =
    d.feeFrom != null && d.feeTo != null && d.feeTo !== d.feeFrom
      ? `${formatPrice(d.feeFrom, lang)} – ${formatPrice(d.feeTo, lang)}`
      : d.feeFrom != null
        ? formatPrice(d.feeFrom, lang)
        : null;
  const mapUrl = s.location
    ? `https://www.google.com/maps/search/?api=1&query=${s.location.lat},${s.location.lng}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${s.address} ${s.city}`)}`;

  return (
    <div className="mx-auto max-w-page px-4 py-6 md:py-10">
      <div className="overflow-hidden rounded-2xl bg-white ring-1 ring-line">
        <div className="relative h-40 bg-navy md:h-56">
          {s.coverUrl && <Img src={s.coverUrl} alt="" className="h-full w-full" />}
          <div className="absolute end-3 top-3"><ShareButton title={s.name} /></div>
        </div>
        <div className="flex flex-col gap-5 p-5 md:flex-row md:p-6">
          <div className="-mt-16 shrink-0 rounded-2xl bg-white p-1 ring-1 ring-line md:-mt-20">
            {s.logoUrl ? <Img src={s.logoUrl} alt="" className="h-24 w-24 rounded-xl" /> : <Avatar src={null} name={s.name} size={96} />}
          </div>
          <div className="flex-1">
            <h1 className="flex items-center gap-2 text-2xl font-extrabold md:text-3xl">
              {s.name}
              {s.verified && <Verified className="h-6 w-6" />}
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-soft">
              {s.rating.count > 0 && (
                <span className="flex items-center gap-1"><Stars value={s.rating.avg} />{s.rating.avg.toFixed(1)} ({s.rating.count})</span>
              )}
              <span>{tr(`${s.partsCount} قطعة`, `${s.partsCount} parts`)}</span>
              {s.categories.length > 0 && <span>{s.categories.map(labels.category).join('، ')}</span>}
            </div>
            {s.description && <p className="mt-3 max-w-2xl leading-7">{s.description}</p>}
            {s.brandIds.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {s.brandIds.map((b) => <span key={b} className="rounded-full bg-canvas px-3 py-1 text-xs font-bold">{labels.brand(b)}</span>)}
              </div>
            )}
          </div>
          <div className="w-full space-y-3 md:w-80">
            {isMine ? (
              <Link to="/account/shop" className="block rounded-xl bg-navy-mist p-3 text-center font-bold">{tr('ده محلك، اضغط عشان تعدّله', 'This is your shop. Tap to edit')}</Link>
            ) : (
              <ContactButtons phone={s.phone} whatsapp={s.whatsapp} contactPath={`/shops/${s.id}/contact`} />
            )}
          </div>
        </div>
        <div className="grid gap-4 border-t border-line p-5 text-sm md:grid-cols-3 md:p-6">
          <a href={mapUrl} target="_blank" rel="noopener noreferrer" className="flex gap-2 hover:text-orange-deep">
            <MapPin className="h-5 w-5 shrink-0" />
            <span>{s.address}، {labels.city(s.city)} <ExternalLink className="inline h-3.5 w-3.5" /></span>
          </a>
          {s.hours && <p className="flex gap-2"><Clock className="h-5 w-5 shrink-0" />{s.hours}</p>}
          <div className="flex gap-2">
            <Truck className="h-5 w-5 shrink-0" />
            {d.available ? (
              <div>
                <p className="font-bold text-emerald-700">{tr('بيوصّل لـ', 'Delivers to')} {d.governorates.map(labels.city).join('، ')}</p>
                {(fee || d.eta) && <p className="text-ink-soft">{[fee, d.eta].filter(Boolean).join(' · ')}</p>}
                {d.note && <p className="text-ink-soft">{d.note}</p>}
              </div>
            ) : (
              <p className="text-ink-soft">{tr('مفيش توصيل، الاستلام من المحل', 'No delivery, pick up at the shop')}</p>
            )}
          </div>
        </div>
      </div>

      <h2 className="mb-4 mt-10 text-xl font-extrabold">{tr('قطع المحل', 'Parts in this shop')}</h2>
      {parts.isLoading ? (
        <PartGridSkeleton />
      ) : parts.items.length === 0 ? (
        <EmptyState title={tr('مفيش قطع معروضة دلوقتي', 'Nothing listed right now')} />
      ) : (
        <>
          <PartGrid parts={parts.items} />
          <LoadMore hasNext={parts.hasNextPage} loading={parts.isFetchingNextPage} onLoad={() => parts.fetchNextPage()} />
        </>
      )}

      <div className="mt-10">
        <Reviews target="shops" id={s.id} ownerId={s.ownerId} />
      </div>
      {!isMine && <div className="mt-6"><ReportButton target="SELLER" targetId={s.ownerId} label={tr('بلّغ عن المحل', 'Report this shop')} /></div>}
    </div>
  );
}
