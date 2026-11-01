import { MapPin, Truck } from 'lucide-react';
import { Link } from 'react-router-dom';

import { useLabels } from '@/lib/catalog';
import { useI18n } from '@/lib/i18n';
import type { Shop } from '@/lib/types';

import { Avatar, cx, Img, Stars, Verified } from './ui';

export function ShopCard({ shop, compact }: { shop: Shop; compact?: boolean }) {
  const { tr } = useI18n();
  const labels = useLabels();
  return (
    <Link to={`/shops/${shop.id}`} className="flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-white hover:border-navy-soft">
      {!compact && <Img src={shop.coverUrl} alt="" className="h-28 w-full" />}
      <div className={cx('flex items-start gap-3 p-4', !compact && '-mt-8')}>
        <span className={cx('rounded-xl bg-white', !compact && 'ring-4 ring-white')}>
          {shop.logoUrl ? <Img src={shop.logoUrl} alt="" className="h-14 w-14 rounded-xl" /> : <Avatar src={null} name={shop.name} size={56} />}
        </span>
        <div className={cx('min-w-0 flex-1', !compact && 'pt-8')}>
          <p className="flex items-center gap-1 font-extrabold">
            <span className="truncate">{shop.name}</span>
            {shop.verified && <Verified />}
          </p>
          <p className="mt-0.5 flex items-center gap-1 text-xs text-ink-soft">
            <MapPin className="h-3.5 w-3.5" />
            {labels.city(shop.city)}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-soft">
            {shop.rating.count > 0 ? (
              <span className="flex items-center gap-1">
                <Stars value={shop.rating.avg} size={12} />
                {shop.rating.avg.toFixed(1)} ({shop.rating.count})
              </span>
            ) : (
              <span>{tr('لسه مفيش تقييمات', 'No reviews yet')}</span>
            )}
            <span>{tr(`${shop.partsCount} قطعة`, `${shop.partsCount} parts`)}</span>
            {shop.delivers && (
              <span className="flex items-center gap-1 font-bold text-emerald-700">
                <Truck className="h-3.5 w-3.5" />
                {tr('توصيل', 'Delivery')}
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
