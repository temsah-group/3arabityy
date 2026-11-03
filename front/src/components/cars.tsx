import { AlertTriangle, CarFront, Check, ChevronDown, ChevronLeft, ChevronRight, Plus, Search, Trash2 } from 'lucide-react';
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';

import { brandLogo, modelYears, useLabels } from '@/lib/catalog';
import { addCar, followCar, garage, MAX_CARS, removeCar } from '@/lib/collections';
import { useI18n } from '@/lib/i18n';
import type { CarBrand, CarModel, Fitment, GarageCar } from '@/lib/types';

import { Button, cx, Dialog, Input } from './ui';

/**
 * A car as an Egyptian number plate: the blue band with مصر / EGYPT on top,
 * the car where the letters and numbers go.
 */
export function CarPlate({
  car,
  active,
  onClick,
  size = 'md',
}: {
  car: GarageCar;
  active?: boolean;
  onClick?: () => void;
  size?: 'md' | 'lg';
}) {
  const labels = useLabels();
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      onClick={onClick}
      aria-pressed={onClick ? active : undefined}
      className={cx(
        'shrink-0 overflow-hidden rounded-lg border-2 bg-white text-navy transition-all',
        active ? 'border-orange shadow-[0_0_0_3px_rgba(247,127,0,0.35)]' : 'border-navy-deep/80',
        onClick && 'hover:-translate-y-0.5',
        size === 'lg' ? 'min-w-48' : 'min-w-36',
      )}
    >
      <div className="flex items-center justify-between bg-plate px-2 py-0.5 text-[10px] font-bold text-white" dir="ltr">
        <span>EGYPT</span>
        <span>مصر</span>
      </div>
      <div className={cx('flex items-center gap-2 px-3', size === 'lg' ? 'py-2' : 'py-1.5')}>
        <span className={cx('font-extrabold leading-tight', size === 'lg' ? 'text-lg' : 'text-sm')}>
          {labels.brand(car.brandId)} {labels.model(car.brandId, car.modelId)}
        </span>
        <span className="ms-auto border-s-2 border-navy-deep/20 ps-2 text-sm font-bold tabular-nums" dir="ltr">
          {car.year}
        </span>
      </div>
    </Tag>
  );
}

/** A make's logo, or its initial when there is none or it fails to load. */
export function BrandLogo({ brand, className }: { brand: CarBrand; className?: string }) {
  const [failed, setFailed] = useState(false);
  const src = brandLogo(brand.id);
  if (!src || failed) {
    return (
      <span className={cx('flex items-center justify-center font-extrabold text-navy', className)} dir="ltr" aria-hidden>
        {brand.nameEn.charAt(0)}
      </span>
    );
  }
  return <img src={src} alt="" loading="lazy" className={cx('object-contain', className)} onError={() => setFailed(true)} />;
}

type Step = { kind: 'brand' } | { kind: 'model'; brand: CarBrand } | { kind: 'year'; brand: CarBrand; model: CarModel };

/**
 * A make dropdown with logos, in place of a `<select>` (whose options can only
 * be text). The list is fixed to the viewport so dialogs that scroll don't clip it.
 */
export function BrandSelect({
  brands,
  value,
  onChange,
  placeholder,
  ariaLabel,
}: {
  brands: CarBrand[];
  value: string;
  onChange: (brandId: string) => void;
  placeholder: string;
  ariaLabel?: string;
}) {
  const { tr, pick, lang } = useI18n();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState('');
  const [highlight, setHighlight] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const selected = brands.find((b) => b.id === value);

  const shown = useMemo(() => {
    const f = filter.trim().toLowerCase();
    return f ? brands.filter((b) => b.nameAr.includes(f) || b.nameEn.toLowerCase().includes(f)) : brands;
  }, [brands, filter]);

  const close = (focusButton = true) => {
    setOpen(false);
    setFilter('');
    if (focusButton) buttonRef.current?.focus();
  };
  const choose = (brand: CarBrand) => {
    onChange(brand.id);
    close();
  };

  useLayoutEffect(() => {
    if (!open) return;
    const place = () => buttonRef.current && setRect(buttonRef.current.getBoundingClientRect());
    place();
    const outside = (e: PointerEvent) => {
      if (!listRef.current?.contains(e.target as Node) && !buttonRef.current?.contains(e.target as Node)) close(false);
    };
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    document.addEventListener('pointerdown', outside);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
      document.removeEventListener('pointerdown', outside);
    };
  }, [open]);

  useEffect(() => {
    if (open) setHighlight(Math.max(0, shown.findIndex((b) => b.id === value)));
    // Only when it opens; typing resets it to the first match.
  }, [open]);

  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${highlight}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [highlight, rect]);

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      // Keeps a surrounding <dialog> open.
      e.preventDefault();
      e.stopPropagation();
      close();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight((i) => Math.min(i + 1, shown.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (shown[highlight]) choose(shown[highlight]);
    } else if (e.key === 'Tab') {
      close(false);
    }
  };

  // Opens upwards when there is no room below.
  const below = rect ? document.documentElement.clientHeight - rect.bottom : 0;
  const up = rect ? below < 300 && rect.top > below : false;

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => (open ? close() : setOpen(true))}
        onKeyDown={(e) => {
          if (!open && (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            setOpen(true);
          }
        }}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={ariaLabel}
        className={cx(
          'flex h-12 w-full items-center gap-2.5 rounded-xl border bg-white px-3 text-start text-[15px] font-normal text-navy focus:outline-none focus:ring-2 focus:ring-navy/15',
          open ? 'border-navy ring-2 ring-navy/15' : 'border-line focus:border-navy',
        )}
      >
        {selected ? (
          <>
            <BrandLogo brand={selected} className="h-7 w-8 shrink-0 text-sm" />
            <span className="flex-1 truncate font-bold">{pick(selected.nameAr, selected.nameEn)}</span>
          </>
        ) : (
          <span className="flex-1 truncate text-ink-muted">{placeholder}</span>
        )}
        <ChevronDown className={cx('h-4 w-4 shrink-0 text-ink-muted transition-transform', open && 'rotate-180')} />
      </button>
      {open && rect && (
        <div
          ref={listRef}
          onKeyDown={onKeyDown}
          className="fixed z-50 flex max-h-80 flex-col overflow-hidden rounded-xl bg-white shadow-2xl ring-1 ring-line"
          style={{
            // Lines up with the field's start edge and grows towards its end.
            ...(lang === 'ar' ? { right: document.documentElement.clientWidth - rect.right } : { left: rect.left }),
            width: Math.min(Math.max(rect.width, 240), document.documentElement.clientWidth - 16),
            ...(up ? { bottom: document.documentElement.clientHeight - rect.top + 6 } : { top: rect.bottom + 6 }),
          }}
        >
          <div className="relative border-b border-line p-2">
            <Search className="pointer-events-none absolute start-5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
            <input
              autoFocus
              value={filter}
              onChange={(e) => {
                setFilter(e.target.value);
                setHighlight(0);
              }}
              placeholder={tr('دوّر على الماركة…', 'Find a make…')}
              aria-label={tr('دوّر على الماركة', 'Find a make')}
              aria-controls={listId}
              aria-activedescendant={shown[highlight] ? `${listId}-${shown[highlight].id}` : undefined}
              className="h-10 w-full rounded-lg bg-canvas pe-3 ps-9 text-sm text-navy placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-navy/15"
            />
          </div>
          <ul id={listId} role="listbox" aria-label={ariaLabel} className="overflow-y-auto p-1.5">
            {shown.map((brand, i) => (
              <li
                key={brand.id}
                id={`${listId}-${brand.id}`}
                data-index={i}
                role="option"
                aria-selected={brand.id === value}
                onPointerMove={() => setHighlight(i)}
                onClick={() => choose(brand)}
                className={cx(
                  'flex cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2 text-sm font-bold',
                  i === highlight && 'bg-canvas',
                  brand.id === value && 'text-orange-deep',
                )}
              >
                <BrandLogo brand={brand} className="h-7 w-9 shrink-0 text-sm" />
                <span className="flex-1 truncate">{pick(brand.nameAr, brand.nameEn)}</span>
                {brand.id === value && <Check className="h-4 w-4 shrink-0" />}
              </li>
            ))}
            {!shown.length && <li className="px-3 py-6 text-center text-sm text-ink-muted">{tr('مفيش ماركة بالاسم ده', 'No make by that name')}</li>}
          </ul>
        </div>
      )}
    </>
  );
}

/** Make → model → year. */
export function CarPicker({
  open,
  onClose,
  onPick,
  title,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (car: GarageCar) => void;
  title?: string;
}) {
  const { tr, pick, lang } = useI18n();
  const { brands } = useLabels();
  const [step, setStep] = useState<Step>({ kind: 'brand' });
  const [filter, setFilter] = useState('');
  const Back = lang === 'ar' ? ChevronRight : ChevronLeft;
  const Next = lang === 'ar' ? ChevronLeft : ChevronRight;

  const close = () => {
    setStep({ kind: 'brand' });
    setFilter('');
    onClose();
  };

  const list = useMemo(() => {
    const f = filter.trim().toLowerCase();
    const match = (x: { nameAr: string; nameEn: string }) => !f || x.nameAr.includes(f) || x.nameEn.toLowerCase().includes(f);
    if (step.kind === 'brand') return brands.filter(match);
    if (step.kind === 'model') return step.brand.models.filter(match);
    return [];
  }, [brands, step, filter]);

  const years = useMemo(() => {
    if (step.kind !== 'year') return [];
    const [first, last] = modelYears(step.model);
    return Array.from({ length: last - first + 1 }, (_, i) => last - i);
  }, [step]);

  const heading =
    step.kind === 'brand'
      ? tr('اختار الماركة', 'Choose the make')
      : step.kind === 'model'
        ? pick(step.brand.nameAr, step.brand.nameEn)
        : `${pick(step.brand.nameAr, step.brand.nameEn)} ${pick(step.model.nameAr, step.model.nameEn)}`;

  return (
    <Dialog open={open} onClose={close} title={title ?? tr('ضيف عربيتك', 'Add your car')}>
      <div className="mb-3 flex items-center gap-2">
        {step.kind !== 'brand' && (
          <button
            onClick={() => {
              setFilter('');
              setStep(step.kind === 'year' ? { kind: 'model', brand: step.brand } : { kind: 'brand' });
            }}
            className="rounded-lg p-1 hover:bg-canvas"
            aria-label={tr('رجوع', 'Back')}
          >
            <Back className="h-5 w-5" />
          </button>
        )}
        <p className="font-bold">{heading}</p>
      </div>
      {step.kind !== 'year' && (
        <Input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder={tr('دوّر…', 'Filter…')}
          className="mb-3 h-10"
          autoFocus
        />
      )}
      {step.kind === 'year' ? (
        <div className="grid grid-cols-4 gap-2">
          {years.map((year) => (
            <button
              key={year}
              onClick={() => {
                onPick({ brandId: step.brand.id, modelId: step.model.id, year });
                close();
              }}
              className="rounded-xl border border-line py-2.5 font-bold tabular-nums hover:border-navy hover:bg-navy-mist"
            >
              {year}
            </button>
          ))}
        </div>
      ) : (
        <ul className="divide-y divide-line">
          {list.map((item) => (
            <li key={item.id}>
              <button
                onClick={() => {
                  setFilter('');
                  setStep(
                    step.kind === 'brand'
                      ? { kind: 'model', brand: item as CarBrand }
                      : { kind: 'year', brand: step.brand, model: item as CarModel },
                  );
                }}
                className="flex w-full items-center gap-3 py-3 text-start font-semibold hover:text-orange-deep"
              >
                {step.kind === 'brand' && <BrandLogo brand={item as CarBrand} className="h-7 w-9 shrink-0 text-sm" />}
                <span className="flex-1">{pick(item.nameAr, item.nameEn)}</span>
                <Next className="h-4 w-4 text-ink-muted" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </Dialog>
  );
}

/** The garage editor: follow one car or all, add, remove. */
export function GarageDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { tr } = useI18n();
  const labels = useLabels();
  const { cars, active } = garage.use();
  const [picking, setPicking] = useState(false);

  return (
    <>
      <Dialog open={open && !picking} onClose={onClose} title={tr('عربياتي', 'My cars')}>
        <p className="mb-4 text-sm text-ink-soft">
          {tr(
            `ضيف لحد ${MAX_CARS} عربيات، والرئيسية هتوريك القطع اللي بتركب عليها.`,
            `Add up to ${MAX_CARS} cars and the home page shows parts that fit them.`,
          )}
        </p>
        <ul className="space-y-2">
          {cars.length > 1 && (
            <li>
              <button
                onClick={() => followCar(-1)}
                className={cx('flex w-full items-center justify-between rounded-xl border px-4 py-3 font-bold', active === -1 ? 'border-orange bg-orange-mist' : 'border-line')}
              >
                {tr('كل عربياتي', 'All my cars')}
                {active === -1 && <Check className="h-5 w-5 text-orange-deep" />}
              </button>
            </li>
          )}
          {cars.map((car, i) => (
            <li key={`${car.brandId}-${car.modelId}-${car.year}`} className="flex items-center gap-2">
              <button
                onClick={() => followCar(i)}
                className={cx('flex flex-1 items-center justify-between rounded-xl border px-4 py-3 text-start font-bold', active === i || (cars.length === 1) ? 'border-orange bg-orange-mist' : 'border-line')}
              >
                {labels.car(car)}
                {(active === i || cars.length === 1) && <Check className="h-5 w-5 text-orange-deep" />}
              </button>
              <button onClick={() => removeCar(i)} className="rounded-xl p-3 text-red-600 hover:bg-red-50" aria-label={tr('امسح', 'Remove')}>
                <Trash2 className="h-5 w-5" />
              </button>
            </li>
          ))}
        </ul>
        {cars.length < MAX_CARS && (
          <Button variant="outline" className="mt-4 w-full" onClick={() => setPicking(true)}>
            <Plus className="h-4 w-4" />
            {tr('ضيف عربية', 'Add a car')}
          </Button>
        )}
      </Dialog>
      <CarPicker
        open={picking}
        onClose={() => setPicking(false)}
        onPick={(car) => {
          addCar(car);
        }}
      />
    </>
  );
}

export const fitsCar = (car: GarageCar, fitments: Fitment[]) =>
  fitments.some((f) => f.brandId === car.brandId && f.modelId === car.modelId && car.year >= f.fromYear && car.year <= f.toYear);

/**
 * Whether a part fits the cars in the garage, from its fitments: green when
 * one does, amber when none does, and a way to add a car when there is none.
 */
export function FitCheck({ fitments }: { fitments: Fitment[] }) {
  const { tr } = useI18n();
  const labels = useLabels();
  const { cars } = garage.use();
  const [picking, setPicking] = useState(false);
  const fitting = cars.filter((car) => fitsCar(car, fitments));
  const others = cars.filter((car) => !fitsCar(car, fitments));

  const picker = <CarPicker open={picking} onClose={() => setPicking(false)} onPick={addCar} />;

  if (!cars.length) {
    return (
      <div className="flex items-center gap-3 rounded-2xl bg-navy-mist p-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-navy">
          <CarFront className="h-5 w-5" />
        </span>
        <p className="flex-1 text-sm font-bold">{tr('عايز تعرف لو القطعة دي بتركب على عربيتك؟', 'Want to know if this part fits your car?')}</p>
        <Button size="sm" variant="outline" onClick={() => setPicking(true)} className="shrink-0 bg-white">
          <Plus className="h-4 w-4" />
          {tr('ضيف عربيتك', 'Add your car')}
        </Button>
        {picker}
      </div>
    );
  }

  if (fitting.length) {
    return (
      <div className="rounded-2xl bg-emerald-50 p-4 ring-1 ring-emerald-200">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white">
            <Check className="h-5 w-5" strokeWidth={3} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-extrabold text-emerald-800">
              {fitting.length === 1
                ? tr(`بتركب على عربيتك ${labels.car(fitting[0])}`, `Fits your ${labels.car(fitting[0])}`)
                : tr('بتركب على عربياتك', 'Fits your cars')}
            </p>
            {fitting.length > 1 && <p className="mt-0.5 text-sm font-bold text-emerald-800">{fitting.map((c) => labels.car(c)).join('، ')}</p>}
            {others.length > 0 && (
              <p className="mt-1 text-xs text-emerald-900/70">
                {tr(`مش بتركب على: ${others.map((c) => labels.car(c)).join('، ')}`, `Doesn't fit: ${others.map((c) => labels.car(c)).join(', ')}`)}
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-amber-50 p-4 ring-1 ring-amber-200">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-500 text-white">
          <AlertTriangle className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-extrabold text-amber-900">
            {cars.length === 1
              ? tr(`مش متسجّل إنها بتركب على ${labels.car(cars[0])}`, `Not listed as fitting your ${labels.car(cars[0])}`)
              : tr('مش متسجّل إنها بتركب على أي عربية من عربياتك', 'Not listed as fitting any of your cars')}
          </p>
          <p className="mt-1 text-sm leading-6 text-amber-900/80">
            {tr('اسأل البياع قبل ما تشتري، وقارن رقم القطعة باللي في عربيتك.', 'Ask the seller before you buy, and compare the part number with yours.')}
          </p>
        </div>
      </div>
    </div>
  );
}
