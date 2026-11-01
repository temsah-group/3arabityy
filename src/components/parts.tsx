import { ArrowUpDown, Car, CircleDot, Cog, Disc3, Droplets, Heart, Lightbulb, MapPin, PackageCheck, Plane, RefreshCw, Store, Zap } from 'lucide-react';
import type { MouseEvent } from 'react';
import { Link } from 'react-router-dom';

import { useLabels } from '@/lib/catalog';
import { saved, toggleSaved } from '@/lib/collections';
import { formatPrice, relativeDay } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import type { Category, Condition, Part } from '@/lib/types';

import { ConditionBadge, cx, errorMessage, Img, Skeleton, Stars, useToast, Verified } from './ui';

export const categoryIcon: Record<Category, typeof Cog> = {
  ENGINE: Cog,
  BRAKES: Disc3,
  SUSPENSION: ArrowUpDown,
  ELECTRICAL: Zap,
  BODY: Car,
  LIGHTS: Lightbulb,
  FILTERS: Droplets,
  TYRES: CircleDot,
};

/** Each condition's icon and colours: green new, amber used, sky imported. */
export const conditionLook: Record<Condition, { icon: typeof Cog; hover: string; on: string; iconBox: string }> = {
  NEW: { icon: PackageCheck, hover: 'hover:ring-emerald-300', on: 'bg-emerald-50 ring-2 ring-emerald-500 text-emerald-800', iconBox: 'bg-emerald-100 text-emerald-700' },
  USED: { icon: RefreshCw, hover: 'hover:ring-amber-300', on: 'bg-amber-50 ring-2 ring-amber-500 text-amber-800', iconBox: 'bg-amber-100 text-amber-700' },
  IMPORTED: { icon: Plane, hover: 'hover:ring-sky-300', on: 'bg-sky-50 ring-2 ring-sky-500 text-sky-800', iconBox: 'bg-sky-100 text-sky-700' },
};

export function SaveButton({ partId, className, withLabel }: { partId: string; className?: string; withLabel?: boolean }) {
  const { tr } = useI18n();
  const toast = useToast();
  const ids = saved.use();
  const isSaved = ids.includes(partId);
  const onClick = async (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      const now = await toggleSaved(partId);
      toast(now ? tr('اتحفظت في المحفوظات', 'Saved') : tr('اتشالت من المحفوظات', 'Removed from saved'));
    } catch (error) {
      toast(errorMessage(error, tr('محصلش حفظ، حاول تاني', "Couldn't save, try again")));
    }
  };
  return (
    <button
      onClick={onClick}
      aria-pressed={isSaved}
      aria-label={isSaved ? tr('شيل من المحفوظات', 'Remove from saved') : tr('احفظ', 'Save')}
      className={cx('flex items-center gap-2 rounded-full bg-white/95 p-2 shadow-sm transition-transform active:scale-90', className)}
    >
      <Heart className={cx('h-5 w-5', isSaved ? 'fill-red-500 text-red-500' : 'text-navy')} />
      {withLabel && <span className="text-sm font-bold">{isSaved ? tr('محفوظة', 'Saved') : tr('احفظ', 'Save')}</span>}
    </button>
  );
}

export function PartCard({ part }: { part: Part }) {
  const { lang, tr } = useI18n();
  const labels = useLabels();
  const fit = part.fitments[0];
  return (
    <Link
      to={`/parts/${part.id}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-line bg-white transition-colors hover:border-navy-soft"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-navy-mist">
        <Img src={part.images[0]} alt={part.name} className="h-full w-full transition-transform duration-300 group-hover:scale-[1.03]" />
        <SaveButton partId={part.id} className="absolute end-2 top-2" />
        {part.isSold && (
          <span className="absolute inset-x-0 bottom-0 bg-navy-deep/80 py-1 text-center text-sm font-bold text-white">
            {tr('اتباعت', 'Sold')}
          </span>
        )}
        {part.oldPrice && !part.isSold && (
          <span className="absolute start-2 top-2 rounded-md bg-orange px-2 py-0.5 text-xs font-bold text-white">
            {tr('سعر أقل', 'Price cut')}
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <ConditionBadge condition={part.condition} label={labels.condition(part.condition)} />
          {part.isOriginal && <span className="rounded-md bg-navy-mist px-2 py-0.5 text-xs font-bold">{tr('أصلي', 'Original')}</span>}
        </div>
        <h3 className="line-clamp-2 font-bold leading-6">{part.name}</h3>
        {fit && (
          <p className="truncate text-xs text-ink-soft">
            {labels.brand(fit.brandId)} {labels.model(fit.brandId, fit.modelId)} {fit.fromYear}–{fit.toYear}
            {part.fitments.length > 1 && ` +${part.fitments.length - 1}`}
          </p>
        )}
        <div className="mt-auto flex items-baseline gap-2 pt-1">
          <span className="text-lg font-extrabold">{formatPrice(part.price, lang)}</span>
          {part.oldPrice && <s className="text-xs text-ink-muted">{formatPrice(part.oldPrice, lang)}</s>}
        </div>
        <div className="flex items-center justify-between gap-2 text-xs text-ink-soft">
          <span className="flex min-w-0 items-center gap-1">
            {part.shop ? <Store className="h-3.5 w-3.5 shrink-0" /> : <MapPin className="h-3.5 w-3.5 shrink-0" />}
            <span className="truncate">{part.shop ? part.shop.name : labels.city(part.city)}</span>
            {(part.shop?.verified ?? part.seller.verified) && <Verified className="h-3.5 w-3.5" />}
          </span>
          <span className="shrink-0">{relativeDay(part.listedAt, lang)}</span>
        </div>
        {part.rating && part.rating.count > 0 && (
          <span className="flex items-center gap-1 text-xs text-ink-soft">
            <Stars value={part.rating.avg} size={12} /> ({part.rating.count})
          </span>
        )}
      </div>
    </Link>
  );
}

export function PartGrid({ parts, className }: { parts: Part[]; className?: string }) {
  return (
    <div className={cx('grid grid-cols-2 gap-3 sm:grid-cols-3 md:gap-4 lg:grid-cols-4', className)}>
      {parts.map((p) => (
        <PartCard key={p.id} part={p} />
      ))}
    </div>
  );
}

export function PartGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:gap-4 lg:grid-cols-4">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="overflow-hidden rounded-2xl border border-line bg-white">
          <Skeleton className="aspect-[4/3] rounded-none" />
          <div className="space-y-2 p-3">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-5 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** A horizontal row of cards that scrolls on small screens. */
export function PartRow({ parts }: { parts: Part[] }) {
  return (
    <div className="no-scrollbar -mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1 md:mx-0 md:grid md:grid-cols-4 md:gap-4 md:overflow-visible md:px-0">
      {parts.map((p) => (
        <div key={p.id} className="w-44 shrink-0 snap-start md:w-auto">
          <PartCard part={p} />
        </div>
      ))}
    </div>
  );
}
