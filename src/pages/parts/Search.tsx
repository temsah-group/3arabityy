import { BadgeCheck, Banknote, Car, Check, ChevronDown, LayoutGrid, MapPin, Plus, Search as SearchIcon, SlidersHorizontal, Sparkles, X } from 'lucide-react';
import { Fragment, useEffect, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';

import { BrandLogo, CarPicker } from '@/components/cars';
import { categoryIcon, conditionLook, PartGrid, PartGridSkeleton } from '@/components/parts';
import { SearchBox } from '@/components/search';
import { Button, cx, Dialog, EmptyState, ErrorState, Input, Select } from '@/components/ui';
import { CATEGORIES, carsParam, CONDITIONS, GOVERNORATES, useLabels } from '@/lib/catalog';
import { addCar, garage } from '@/lib/collections';
import { useI18n } from '@/lib/i18n';
import { LoadMore, usePaged } from '@/lib/paging';
import type { Category, Condition, Part, SearchResult } from '@/lib/types';

const FILTER_KEYS = ['category', 'condition', 'origin', 'city', 'minPrice', 'maxPrice', 'cars', 'sellerId'] as const;

/** New, used, imported as three cards; pressing the chosen one again clears it. */
function ConditionTiles({ value, onToggle }: { value: string | null; onToggle: (id: Condition) => void }) {
  const { lang } = useI18n();
  return (
    <div className="grid grid-cols-3 gap-2">
      {CONDITIONS.map((c) => {
        const look = conditionLook[c.id];
        const Icon = look.icon;
        const on = value === c.id;
        return (
          <button
            key={c.id}
            type="button"
            onClick={() => onToggle(c.id)}
            aria-pressed={on}
            className={cx('relative flex flex-col items-center gap-2 rounded-xl px-1 py-3 text-sm font-bold ring-1 transition', on ? look.on : cx('bg-white ring-line', look.hover))}
          >
            {on && (
              <span className="absolute end-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-current">
                <Check className="h-3 w-3 text-white" strokeWidth={3} />
              </span>
            )}
            <span className={cx('flex h-9 w-9 items-center justify-center rounded-full', look.iconBox)}>
              <Icon className="h-[18px] w-[18px]" />
            </span>
            {lang === 'ar' ? c.ar : c.en}
          </button>
        );
      })}
    </div>
  );
}

/** Parts for all the garage's cars or just one; a way to add one when it's empty. */
function MyCarsFilter({ value, onChange }: { value: string | null; onChange: (cars: string | null) => void }) {
  const { tr } = useI18n();
  const labels = useLabels();
  const { cars } = garage.use();
  const [picking, setPicking] = useState(false);
  const all = carsParam(cars);

  const row = (key: string, param: string | undefined, content: ReactNode) => {
    const on = Boolean(param) && value === param;
    return (
      <button
        key={key}
        type="button"
        role="radio"
        aria-checked={on}
        onClick={() => onChange(on ? null : param ?? null)}
        className={cx(
          'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-start ring-1 transition',
          on ? 'bg-orange-mist ring-2 ring-orange' : 'bg-white ring-line hover:ring-navy/30',
        )}
      >
        {content}
        <span className={cx('flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2', on ? 'border-orange bg-orange' : 'border-line')}>
          {on && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
        </span>
      </button>
    );
  };

  return (
    <>
      {cars.length ? (
        <div role="radiogroup" aria-label={tr('عربياتي', 'My cars')} className="space-y-2">
          {cars.length > 1 &&
            row(
              'all',
              all,
              <>
                <span className="flex h-9 w-11 shrink-0 items-center justify-center rounded-lg bg-navy text-white">
                  <Car className="h-5 w-5" />
                </span>
                <span className="flex-1 text-sm font-extrabold">{tr('كل عربياتي', 'All my cars')}</span>
              </>,
            )}
          {cars.map((car) => {
            const brand = labels.brands.find((b) => b.id === car.brandId);
            return row(
              `${car.brandId}-${car.modelId}-${car.year}`,
              carsParam([car]),
              <>
                <span className="flex h-9 w-11 shrink-0 items-center justify-center rounded-lg bg-canvas">
                  {brand ? <BrandLogo brand={brand} className="h-6 w-8 text-sm" /> : <Car className="h-5 w-5" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-extrabold">
                    {labels.brand(car.brandId)} {labels.model(car.brandId, car.modelId)}
                  </span>
                  <span className="block text-xs font-bold text-ink-soft tabular-nums">{car.year}</span>
                </span>
              </>,
            );
          })}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setPicking(true)}
          className="flex w-full items-center gap-3 rounded-xl border-2 border-dashed border-line px-3 py-3 text-start transition hover:border-orange"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-orange-mist text-orange-deep">
            <Plus className="h-5 w-5" />
          </span>
          <span className="flex-1">
            <span className="block text-sm font-extrabold">{tr('ضيف عربيتك', 'Add your car')}</span>
            <span className="block text-xs text-ink-soft">{tr('وشوف القطع اللي بتركب عليها بس', 'and see only parts that fit it')}</span>
          </span>
        </button>
      )}
      <CarPicker
        open={picking}
        onClose={() => setPicking(false)}
        onPick={(car) => {
          addCar(car);
          onChange(carsParam([car]) ?? null);
        }}
      />
    </>
  );
}

/** A titled filter group that folds away. */
function Group({ title, icon, count, children, defaultOpen = true }: { title: string; icon: ReactNode; count?: number; children: ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-line py-4 first:pt-0 last:border-0 last:pb-0">
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="flex w-full items-center gap-2.5 text-start">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-navy-mist text-navy">{icon}</span>
        <span className="flex-1 font-extrabold">{title}</span>
        {!!count && <span className="rounded-full bg-orange px-2 text-xs font-bold leading-5 text-white">{count}</span>}
        <ChevronDown className={cx('h-4 w-4 text-ink-muted transition-transform', open && 'rotate-180')} />
      </button>
      {open && <div className="mt-3">{children}</div>}
    </div>
  );
}

/** Options side by side in one bar; pressing the chosen one again clears it. */
function Segmented({ options, value, onToggle }: { options: { id: string; label: string; dot?: string }[]; value: string | null; onToggle: (id: string) => void }) {
  return (
    <div className="flex gap-1 rounded-xl bg-canvas p-1">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onToggle(o.id)}
          aria-pressed={value === o.id}
          className={cx(
            'flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-sm font-bold transition',
            value === o.id ? 'bg-white text-navy shadow-sm ring-1 ring-line' : 'text-ink-soft hover:text-navy',
          )}
        >
          {o.dot && <span className={cx('h-2 w-2 rounded-full', o.dot)} />}
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Filters({
  params,
  set,
  update,
  maxPrice,
}: {
  params: URLSearchParams;
  set: (key: string, value: string | null) => void;
  update: (changes: Record<string, string | null>) => void;
  maxPrice?: number;
}) {
  const { tr, lang } = useI18n();
  const labels = useLabels();
  const [min, setMin] = useState(params.get('minPrice') ?? '');
  const [max, setMax] = useState(params.get('maxPrice') ?? '');
  useEffect(() => {
    setMin(params.get('minPrice') ?? '');
    setMax(params.get('maxPrice') ?? '');
  }, [params]);

  const toggle = (key: string, value: string) => set(key, params.get(key) === value ? null : value);
  const priceSet = Boolean(params.get('minPrice') || params.get('maxPrice'));
  const icon = 'h-4 w-4';

  return (
    <div>
      <Group title={tr('عربياتي', 'My cars')} icon={<Car className={icon} />} count={params.get('cars') ? 1 : 0}>
        <MyCarsFilter value={params.get('cars')} onChange={(cars) => set('cars', cars)} />
      </Group>

      <Group title={tr('القسم', 'Category')} icon={<LayoutGrid className={icon} />} count={params.get('category') ? 1 : 0}>
        <div className="grid grid-cols-2 gap-2">
          {CATEGORIES.map((c) => {
            const Icon = categoryIcon[c.id];
            const on = params.get('category') === c.id;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => toggle('category', c.id)}
                aria-pressed={on}
                className={cx(
                  'flex items-center gap-2 rounded-xl px-2.5 py-2 text-start text-sm font-bold ring-1 transition',
                  on ? 'bg-navy text-white ring-navy' : 'bg-white ring-line hover:ring-navy/40',
                )}
              >
                <Icon className={cx('h-4 w-4 shrink-0', on ? 'text-orange-light' : 'text-ink-soft')} strokeWidth={2} />
                <span className="leading-tight">{lang === 'ar' ? c.ar : c.en}</span>
              </button>
            );
          })}
        </div>
      </Group>

      <Group title={tr('الحالة', 'Condition')} icon={<Sparkles className={icon} />} count={params.get('condition') ? 1 : 0}>
        <ConditionTiles value={params.get('condition')} onToggle={(id) => toggle('condition', id)} />
      </Group>

      <Group title={tr('أصلي ولا تجاري', 'Original or aftermarket')} icon={<BadgeCheck className={icon} />} count={params.get('origin') ? 1 : 0}>
        <Segmented
          options={[
            { id: 'ORIGINAL', label: tr('أصلي', 'Original') },
            { id: 'AFTERMARKET', label: tr('تجاري', 'Aftermarket') },
          ]}
          value={params.get('origin')}
          onToggle={(id) => toggle('origin', id)}
        />
      </Group>

      <Group title={tr('المحافظة', 'Governorate')} icon={<MapPin className={icon} />} count={params.get('city') ? 1 : 0}>
        <Select value={params.get('city') ?? ''} onChange={(e) => set('city', e.target.value || null)} aria-label={tr('المحافظة', 'Governorate')} className="h-11">
          <option value="">{tr('كل المحافظات', 'All governorates')}</option>
          {GOVERNORATES.map((c) => (
            <option key={c} value={c}>
              {labels.city(c)}
            </option>
          ))}
        </Select>
      </Group>

      <Group title={tr('السعر', 'Price')} icon={<Banknote className={icon} />} count={priceSet ? 1 : 0}>
        <form
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            update({ minPrice: min || null, maxPrice: max || null });
          }}
          className="space-y-2.5"
        >
          <div className="flex items-center gap-2">
            {[
              { value: min, onChange: setMin, label: tr('من', 'From'), placeholder: '0' },
              { value: max, onChange: setMax, label: tr('لحد', 'To'), placeholder: maxPrice ? String(maxPrice) : '—' },
            ].map((f, i) => (
              <Fragment key={f.label}>
                {i === 1 && <span className="text-ink-muted">–</span>}
                <label className="relative block flex-1">
                  <span className="pointer-events-none absolute start-3 top-1.5 text-[11px] font-bold text-ink-muted">{f.label}</span>
                  <Input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    value={f.value}
                    onChange={(e) => f.onChange(e.target.value)}
                    placeholder={f.placeholder}
                    className="h-14 pe-10 pt-4 font-bold tabular-nums"
                  />
                  <span className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 pt-2 text-xs font-bold text-ink-muted">{tr('ج.م', 'EGP')}</span>
                </label>
              </Fragment>
            ))}
          </div>
          <Button size="sm" type="submit" variant="outline" className="h-10 w-full">
            {tr('طبّق السعر', 'Apply price')}
          </Button>
        </form>
      </Group>
    </div>
  );
}

/** The filters in use, above the results, each with its own ×. */
function ActiveFilters({ params, update, clear }: { params: URLSearchParams; update: (changes: Record<string, string | null>) => void; clear: () => void }) {
  const { tr, lang } = useI18n();
  const labels = useLabels();
  const chips: { key: string; label: string; remove: () => void }[] = [];
  const add = (key: string, label: string) => chips.push({ key, label, remove: () => update({ [key]: null }) });

  const category = params.get('category');
  if (category) add('category', labels.category(category as Category));
  const condition = CONDITIONS.find((c) => c.id === params.get('condition'));
  if (condition) add('condition', lang === 'ar' ? condition.ar : condition.en);
  const origin = params.get('origin');
  if (origin) add('origin', origin === 'ORIGINAL' ? tr('أصلي', 'Original') : tr('تجاري', 'Aftermarket'));
  const city = params.get('city');
  if (city) add('city', labels.city(city));
  const min = params.get('minPrice');
  const max = params.get('maxPrice');
  if (min || max) {
    chips.push({
      key: 'price',
      label: min && max ? `${min} – ${max} ${tr('ج.م', 'EGP')}` : min ? tr(`من ${min} ج.م`, `From ${min} EGP`) : tr(`لحد ${max} ج.م`, `Up to ${max} EGP`),
      remove: () => update({ minPrice: null, maxPrice: null }),
    });
  }
  const cars = params.get('cars');
  if (cars) {
    const list = cars.split(',').map((c) => {
      const [brandId, modelId, year] = c.split(':');
      return labels.car({ brandId, modelId, year: Number(year) });
    });
    add('cars', list.length === 1 ? list[0] : tr(`${list.length} عربيات`, `${list.length} cars`));
  }
  if (params.get('sellerId')) add('sellerId', tr('بياع واحد', 'One seller'));

  if (!chips.length) return null;
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      {chips.map((c) => (
        <span key={c.key} className="inline-flex items-center gap-1 rounded-full bg-navy py-1 pe-1 ps-3 text-sm font-bold text-white">
          {c.label}
          <button type="button" onClick={c.remove} className="rounded-full p-0.5 hover:bg-white/20" aria-label={tr(`شيل ${c.label}`, `Remove ${c.label}`)}>
            <X className="h-3.5 w-3.5" />
          </button>
        </span>
      ))}
      {chips.length > 1 && (
        <button type="button" onClick={clear} className="px-2 text-sm font-bold text-orange-deep hover:underline">
          {tr('امسح الكل', 'Clear all')}
        </button>
      )}
    </div>
  );
}

export default function Search() {
  const { tr } = useI18n();
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState(params.get('q') ?? '');
  const [filtersOpen, setFiltersOpen] = useState(false);
  useEffect(() => setQ(params.get('q') ?? ''), [params]);

  const query: Record<string, string | undefined> = { q: params.get('q') ?? undefined, sort: params.get('sort') ?? 'NEWEST' };
  for (const key of FILTER_KEYS) query[key] = params.get(key) ?? undefined;

  const list = usePaged<Part, SearchResult>(['parts', 'search'], '/parts', query);
  const active = FILTER_KEYS.filter((k) => params.get(k)).length;

  // Several keys in one go: react-router's updates don't stack within a render,
  // so setting min and then max price one by one would drop the min.
  const update = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    setParams(next, { replace: true });
  };
  const set = (key: string, value: string | null) => update({ [key]: value });
  const clear = () => {
    const next = new URLSearchParams();
    if (params.get('q')) next.set('q', params.get('q')!);
    setParams(next, { replace: true });
  };

  const facets = list.first?.facets;
  const filters = <Filters params={params} set={set} update={update} maxPrice={facets?.maxPrice} />;

  return (
    <div className="mx-auto max-w-page px-4 py-6">
      {/* A search here keeps the filters already chosen. */}
      <SearchBox value={q} onValueChange={setQ} onSearch={(text) => set('q', text || null)} size="lg" />

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-ink-soft" aria-live="polite">
          {list.first?.total !== undefined && tr(`${list.first.total} قطعة`, `${list.first.total} parts`)}
        </p>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="lg:hidden" onClick={() => setFiltersOpen(true)}>
            <SlidersHorizontal className="h-4 w-4" />
            {tr('الفلاتر', 'Filters')}
            {active > 0 && <span className="rounded-full bg-orange px-1.5 text-xs text-white">{active}</span>}
          </Button>
          <Select value={params.get('sort') ?? 'NEWEST'} onChange={(e) => set('sort', e.target.value)} className="h-9 w-auto text-sm" aria-label={tr('الترتيب', 'Sort')}>
            <option value="NEWEST">{tr('الأحدث', 'Newest')}</option>
            <option value="PRICE_LOW">{tr('الأرخص', 'Lowest price')}</option>
            <option value="PRICE_HIGH">{tr('الأغلى', 'Highest price')}</option>
          </Select>
        </div>
      </div>

      <div className="mt-6 grid gap-8 lg:grid-cols-[20rem_minmax(0,1fr)]">
        <aside className="hidden lg:block">
          <div className="no-scrollbar sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto rounded-2xl bg-white ring-1 ring-line">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-white px-5 py-4">
              <h2 className="flex items-center gap-2 text-lg font-extrabold">
                <SlidersHorizontal className="h-5 w-5 text-orange" />
                {tr('الفلاتر', 'Filters')}
                {active > 0 && <span className="rounded-full bg-orange px-2 text-xs font-bold leading-5 text-white">{active}</span>}
              </h2>
              {active > 0 && (
                <button onClick={clear} className="flex items-center gap-1 rounded-lg px-2 py-1 text-sm font-bold text-orange-deep hover:bg-orange-mist">
                  <X className="h-4 w-4" />
                  {tr('امسح الكل', 'Clear all')}
                </button>
              )}
            </div>
            <div className="p-5">{filters}</div>
          </div>
        </aside>
        <div>
          <ActiveFilters params={params} update={update} clear={clear} />
          {list.isLoading ? (
            <PartGridSkeleton />
          ) : list.isError ? (
            <ErrorState error={list.error} onRetry={() => list.refetch()} />
          ) : list.items.length === 0 ? (
            <EmptyState
              icon={<SearchIcon className="h-10 w-10" />}
              title={tr('مفيش قطع بالمواصفات دي', 'No parts match')}
              body={tr('جرّب كلمة تانية أو شيل شوية فلاتر.', 'Try other words or fewer filters.')}
              action={active > 0 ? <Button variant="outline" onClick={clear}>{tr('امسح الفلاتر', 'Clear filters')}</Button> : undefined}
            />
          ) : (
            <>
              <PartGrid parts={list.items} className="lg:grid-cols-3 xl:grid-cols-4" />
              <LoadMore hasNext={list.hasNextPage} loading={list.isFetchingNextPage} onLoad={() => list.fetchNextPage()} />
            </>
          )}
        </div>
      </div>

      <Dialog open={filtersOpen} onClose={() => setFiltersOpen(false)} title={tr('الفلاتر', 'Filters')}>
        {filters}
        <div className="mt-6 flex gap-2">
          <Button className="flex-1" onClick={() => setFiltersOpen(false)}>
            {list.first?.total !== undefined ? tr(`اعرض ${list.first.total} قطعة`, `Show ${list.first.total} parts`) : tr('اعرض', 'Show')}
          </Button>
          {active > 0 && (
            <Button variant="outline" onClick={clear}>
              {tr('امسح', 'Clear')}
            </Button>
          )}
        </div>
      </Dialog>
    </div>
  );
}
