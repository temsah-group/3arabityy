import { useQuery } from '@tanstack/react-query';
import { Check, Eye, MessageCircle, Pencil, Phone, Store, Truck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { ContactButtons, ReportButton, ShareButton } from '@/components/actions';
import { FitCheck, fitsCar } from '@/components/cars';
import { PartRow, SaveButton } from '@/components/parts';
import { Reviews } from '@/components/reviews';
import { Avatar, Button, ConditionBadge, cx, ErrorState, Img, PageSpinner, Stars, Verified } from '@/components/ui';
import { ApiError, get } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useLabels } from '@/lib/catalog';
import { garage, markViewed } from '@/lib/collections';
import { formatPrice, relativeDay } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import type { Part } from '@/lib/types';
import { usePageMeta } from '@/lib/seo';

function Gallery({ part }: { part: Part }) {
  const [index, setIndex] = useState(0);
  const images = part.images.length ? part.images : [null];
  return (
    <div>
      <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-navy-mist">
        <Img src={images[index]} alt={part.name} className="h-full w-full" />
        <div className="absolute end-3 top-3 flex gap-2">
          <ShareButton title={part.name} />
          <SaveButton partId={part.id} />
        </div>
      </div>
      {images.length > 1 && (
        <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto">
          {images.map((src, i) => (
            <button
              key={i}
              onClick={() => setIndex(i)}
              aria-label={`${i + 1}`}
              aria-current={i === index}
              className={cx('h-16 w-20 shrink-0 overflow-hidden rounded-xl ring-2', i === index ? 'ring-orange' : 'ring-transparent')}
            >
              <Img src={src} alt="" className="h-full w-full" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function PartDetails() {
  const { id = '' } = useParams();
  const { tr, lang } = useI18n();
  const labels = useLabels();
  const { cars } = garage.use();
  const { user } = useAuth();

  const part = useQuery({ queryKey: ['part', id], queryFn: () => get<Part>(`/parts/${id}`) });
  const similar = useQuery({
    queryKey: ['part', id, 'similar'],
    queryFn: () => get<{ items: Part[] }>(`/parts/${id}/similar`, { limit: 8 }),
    enabled: part.isSuccess,
  });

  useEffect(() => {
    if (part.data) markViewed(part.data.id);
  }, [part.data]);
  const shown = part.data;
  usePageMeta(
    shown?.name,
    shown &&
      [`${labels.condition(shown.condition)} · ${shown.price.toLocaleString('en')} ${tr('جنيه', 'EGP')} · ${labels.city(shown.city)}`, shown.description]
        .filter(Boolean)
        .join('. '),
  );

  if (part.isLoading) return <PageSpinner />;
  if (part.isError || !part.data) {
    const gone = part.error instanceof ApiError && part.error.code === 'PART_NOT_FOUND';
    return (
      <div className="mx-auto max-w-page px-4">
        {gone ? (
          <div className="py-20 text-center">
            <p className="text-xl font-extrabold">{tr('القطعة دي مش موجودة', "This part isn't available")}</p>
            <p className="mt-2 text-ink-soft">{tr('ممكن البياع شالها.', 'The seller may have removed it.')}</p>
            <Link to="/search" className="mt-5 inline-block">
              <Button tabIndex={-1}>{tr('دوّر على قطع تانية', 'Browse other parts')}</Button>
            </Link>
          </div>
        ) : (
          <ErrorState error={part.error} onRetry={() => part.refetch()} />
        )}
      </div>
    );
  }

  const p = part.data;
  const isMine = user?.id === p.seller.id;
  const sellerLink = p.shop ? `/shops/${p.shop.id}` : `/sellers/${p.seller.id}`;

  return (
    <div className="mx-auto max-w-page px-4 py-6 md:py-10">
      <nav className="mb-4 text-sm text-ink-soft">
        <Link to="/" className="hover:text-navy">{tr('الرئيسية', 'Home')}</Link>
        <span className="mx-2">/</span>
        <Link to={`/search?category=${p.category}`} className="hover:text-navy">{labels.category(p.category)}</Link>
      </nav>

      {p.isSold && (
        <div className="mb-4 rounded-xl bg-navy-mist p-4 font-bold">{tr('القطعة دي اتباعت.', 'This part has been sold.')}</div>
      )}
      {p.isHidden && (
        <div className="mb-4 rounded-xl bg-red-50 p-4 font-bold text-red-700">{tr('الإعلان ده مخفي من الإدارة ومحدش شايفه غيرك.', 'This listing was hidden by moderators. Only you can see it.')}</div>
      )}

      <div className="grid gap-8 lg:grid-cols-[1.15fr_1fr]">
        <Gallery part={p} />

        <div className="space-y-5">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <ConditionBadge condition={p.condition} label={labels.condition(p.condition)} />
              <span className="rounded-md bg-navy-mist px-2 py-0.5 text-xs font-bold">{p.isOriginal ? tr('أصلي', 'Original') : tr('تجاري', 'Aftermarket')}</span>
              <span className="text-xs text-ink-soft">{labels.category(p.category)}</span>
            </div>
            <h1 className="mt-2 text-2xl font-extrabold leading-snug md:text-3xl">{p.name}</h1>
            {p.rating && p.rating.count > 0 && (
              <p className="mt-1 flex items-center gap-1.5 text-sm text-ink-soft">
                <Stars value={p.rating.avg} /> {p.rating.avg.toFixed(1)} ({p.rating.count})
              </p>
            )}
            <div className="mt-3 flex items-baseline gap-3">
              <span className="text-3xl font-extrabold">{formatPrice(p.price, lang)}</span>
              {p.oldPrice && <s className="text-ink-muted">{formatPrice(p.oldPrice, lang)}</s>}
            </div>
            <p className="mt-1 text-sm text-ink-soft">
              {labels.city(p.city)} · {relativeDay(p.listedAt, lang)}
            </p>
          </div>

          {!isMine && <FitCheck fitments={p.fitments} />}

          {isMine ? (
            <div className="space-y-3 rounded-2xl bg-white p-4 ring-1 ring-line">
              <p className="font-bold">{tr('ده إعلانك', 'This is your listing')}</p>
              {p.stats && (
                <div className="flex gap-6 text-sm">
                  <span className="flex items-center gap-1.5"><Eye className="h-4 w-4" />{p.stats.views}</span>
                  <span className="flex items-center gap-1.5"><Phone className="h-4 w-4" />{p.stats.calls}</span>
                  <span className="flex items-center gap-1.5"><MessageCircle className="h-4 w-4" />{p.stats.whatsapps}</span>
                </div>
              )}
              <Link to={`/sell/${p.id}`}>
                <Button variant="outline" className="w-full" tabIndex={-1}>
                  <Pencil className="h-4 w-4" />
                  {tr('عدّل الإعلان', 'Edit listing')}
                </Button>
              </Link>
            </div>
          ) : (
            !p.isSold && (
              <ContactButtons
                phone={p.seller.phone}
                contactPath={`/parts/${p.id}/contact`}
                message={tr(`السلام عليكم، بخصوص "${p.name}" على عربيتي: ${window.location.href}`, `Hi, about "${p.name}" on 3arabity: ${window.location.href}`)}
              />
            )
          )}

          <Link to={sellerLink} className="flex items-center gap-3 rounded-2xl bg-white p-4 ring-1 ring-line hover:ring-navy">
            {p.shop ? (
              <Img src={p.shop.logoUrl} alt="" className="h-12 w-12 rounded-xl" />
            ) : (
              <Avatar src={p.seller.photoUrl} name={p.seller.name} size={48} />
            )}
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1 font-extrabold">
                <span className="truncate">{p.shop?.name ?? p.seller.name}</span>
                {(p.shop?.verified ?? p.seller.verified) && <Verified />}
              </p>
              <p className="flex items-center gap-2 text-sm text-ink-soft">
                {p.shop ? <><Store className="h-4 w-4" />{tr('محل', 'Shop')}</> : tr('بياع', 'Seller')}
                {p.shop?.delivers && <span className="flex items-center gap-1 text-emerald-700"><Truck className="h-4 w-4" />{tr('بيوصّل', 'Delivers')}</span>}
              </p>
            </div>
          </Link>

          <section className="rounded-2xl bg-white p-4 ring-1 ring-line">
            <h2 className="mb-3 font-extrabold">{tr('بتركب على', 'Fits')}</h2>
            <ul className="space-y-2">
              {p.fitments.map((f, i) => {
                const mine = cars.some((car) => fitsCar(car, [f]));
                return (
                  <li key={i} className={cx('flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-sm', mine ? 'bg-emerald-50 ring-1 ring-emerald-200' : 'bg-canvas')}>
                    <span className="flex items-center gap-1.5 font-bold">
                      {mine && <Check className="h-4 w-4 text-emerald-600" strokeWidth={3} />}
                      {labels.brand(f.brandId)} {labels.model(f.brandId, f.modelId)}
                      {mine && <span className="text-xs font-bold text-emerald-700">{tr('عربيتك', 'Your car')}</span>}
                    </span>
                    <span className="tabular-nums text-ink-soft" dir="ltr">{f.fromYear}–{f.toYear}</span>
                  </li>
                );
              })}
            </ul>
          </section>

          {(p.description || p.partNumber) && (
            <section className="rounded-2xl bg-white p-4 ring-1 ring-line">
              <h2 className="mb-2 font-extrabold">{tr('التفاصيل', 'Details')}</h2>
              {p.partNumber && (
                <p className="mb-2 text-sm">
                  <span className="text-ink-soft">{tr('رقم القطعة: ', 'Part number: ')}</span>
                  <span className="font-bold" dir="ltr">{p.partNumber}</span>
                </p>
              )}
              {p.description && <p className="whitespace-pre-line leading-7">{p.description}</p>}
            </section>
          )}

          {!isMine && <ReportButton target="PART" targetId={p.id} />}
        </div>
      </div>

      <div className="mt-10">
        <Reviews target="parts" id={p.id} ownerId={p.seller.id} />
      </div>

      {!!similar.data?.items.length && (
        <section className="mt-10">
          <h2 className="mb-4 text-xl font-extrabold">{tr('قطع شبهها', 'Similar parts')}</h2>
          <PartRow parts={similar.data.items} />
        </section>
      )}
    </div>
  );
}
