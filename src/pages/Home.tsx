import { useQuery } from '@tanstack/react-query';
import { BadgeCheck, Car, Check, ChevronLeft, ChevronRight, History, MapPin, PhoneCall, Plus, Search, Settings2, Sparkles } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { BrandLogo, BrandSelect, CarPicker, GarageDialog } from '@/components/cars';
import { categoryIcon, conditionLook, PartGrid, PartGridSkeleton, PartRow } from '@/components/parts';
import { Button, cx, ErrorState, Img, Select } from '@/components/ui';
import { get } from '@/lib/api';
import { carsParam, CATEGORIES, CONDITIONS, GOVERNORATES, modelYears, useAppConfig, useCars, useLabels } from '@/lib/catalog';
import { addCar, followCar, followedCars, garage, MAX_CARS, recent } from '@/lib/collections';
import { useI18n } from '@/lib/i18n';
import type { CarBrand, Category, Condition, HomeData, Part } from '@/lib/types';

function Section({ title, subtitle, link, children }: { title: string; subtitle?: string; link?: string; children: ReactNode }) {
  const { tr, lang } = useI18n();
  const Arrow = lang === 'ar' ? ChevronLeft : ChevronRight;
  return (
    <section className="mt-12 md:mt-16">
      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2.5 text-xl font-extrabold md:text-2xl">
            <span aria-hidden className="h-6 w-1.5 rounded-full bg-orange" />
            {title}
          </h2>
          {subtitle && <p className="mt-1 text-sm text-ink-soft md:ms-4">{subtitle}</p>}
        </div>
        {link && (
          <Link to={link} className="flex shrink-0 items-center gap-0.5 rounded-lg px-3 py-1.5 text-sm font-bold text-orange-deep hover:bg-orange-mist">
            {tr('عرض الكل', 'View all')}
            <Arrow className="h-4 w-4" />
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

function CarSearch() {
  const { tr, pick } = useI18n();
  const navigate = useNavigate();
  const brands = useCars();
  const labels = useLabels();
  const state = garage.use();
  const [brandId, setBrandId] = useState('');
  const [modelId, setModelId] = useState('');
  const [year, setYear] = useState('');
  const [category, setCategory] = useState<Category | ''>('');

  const brand = brands.find((item) => item.id === brandId);
  const model = brand?.models.find((item) => item.id === modelId);
  const models = brand?.models ?? [];
  const years = useMemo(() => {
    if (!model) return [];
    const [first, last] = modelYears(model);
    return Array.from({ length: last - first + 1 }, (_, index) => last - index);
  }, [model]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!brandId || !modelId || !year) return;
    const car = { brandId, modelId, year: Number(year) };
    addCar(car);
    const params = new URLSearchParams({ cars: `${car.brandId}:${car.modelId}:${car.year}` });
    if (category) params.set('category', category);
    navigate(`/search?${params.toString()}`);
  };

  return (
    <div className="rounded-3xl bg-white p-5 text-navy shadow-2xl shadow-navy-deep/30 md:p-6">
      <div className="mb-5 flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-orange text-white">
          <Car className="h-6 w-6" />
        </span>
        <div>
          <h2 className="text-lg font-extrabold">{tr('دوّر بعربيتك', 'Search by your car')}</h2>
          <p className="mt-0.5 text-sm text-ink-soft">{tr('هنعرضلك القطع المتوافقة مع عربيتك بس', 'We’ll show only parts that fit your car')}</p>
        </div>
      </div>
      <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5 text-sm font-bold">
          <span>{tr('الماركة', 'Make')}</span>
          <BrandSelect brands={brands} value={brandId} onChange={(id) => { setBrandId(id); setModelId(''); setYear(''); }} placeholder={tr('اختار الماركة', 'Choose make')} ariaLabel={tr('اختار الماركة', 'Choose make')} />
        </div>
        <label className="space-y-1.5 text-sm font-bold">
          <span>{tr('النوع / الموديل', 'Model')}</span>
          <Select value={modelId} disabled={!brand} onChange={(event) => { setModelId(event.target.value); setYear(''); }} aria-label={tr('اختار النوع', 'Choose model')}>
            <option value="">{tr('اختار النوع', 'Choose model')}</option>
            {models.map((item) => <option key={item.id} value={item.id}>{pick(item.nameAr, item.nameEn)}</option>)}
          </Select>
        </label>
        <label className="space-y-1.5 text-sm font-bold">
          <span>{tr('سنة الصنع', 'Model year')}</span>
          <Select value={year} disabled={!model} onChange={(event) => setYear(event.target.value)} aria-label={tr('اختار سنة الصنع', 'Choose year')}>
            <option value="">{tr('اختار السنة', 'Choose year')}</option>
            {years.map((item) => <option key={item} value={item}>{item}</option>)}
          </Select>
        </label>
        <label className="space-y-1.5 text-sm font-bold">
          <span>{tr('القسم', 'Category')}</span>
          <Select value={category} onChange={(event) => setCategory(event.target.value as Category | '')} aria-label={tr('اختار القسم', 'Choose category')}>
            <option value="">{tr('كل الأقسام', 'All categories')}</option>
            {CATEGORIES.map((item) => <option key={item.id} value={item.id}>{labels.category(item.id)}</option>)}
          </Select>
        </label>
        <Button type="submit" variant="accent" disabled={!brandId || !modelId || !year} className="mt-1 sm:col-span-2">
          <Search className="h-4 w-4" />{tr('دور على قطع', 'Find parts')}
        </Button>
      </form>
      {!!state.cars.length && (
        <button type="button" onClick={() => navigate('/search')} className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-xl bg-orange-mist px-3 py-2.5 text-sm font-bold text-orange-deep hover:bg-orange/15">
          <Sparkles className="h-4 w-4" />
          {tr('شوف القطع المناسبة للعربيات اللي في جراجك', 'Browse parts for the cars in your garage')}
        </button>
      )}
    </div>
  );
}

// An engine bay under repair (unsplash.com/photos/ec889cbff17f), in public/hero.
const HERO_WIDTHS = [800, 1200, 1600, 2400];
const heroPhoto = (width: number) => `/hero/engine-${width}.jpg`;
// Phones: an engine's belt and pulleys (unsplash.com/photos/67b85e0b08d3), cut tall.
const PHONE_HERO_WIDTHS = [600, 900, 1200];
const phoneHeroPhoto = (width: number) => `/hero/pulley-${width}.jpg`;

function Hero() {
  const { tr } = useI18n();
  const points = [
    { icon: BadgeCheck, label: tr('جديد ومستعمل واستيراد', 'New, used and imported') },
    { icon: MapPin, label: tr(`بياعين في ${GOVERNORATES.length} محافظة`, `Sellers in ${GOVERNORATES.length} governorates`) },
    { icon: PhoneCall, label: tr('كلّم البياع على طول', 'Call the seller directly') },
  ];
  return (
    <section className="relative overflow-hidden bg-navy-deep text-white">
      <picture>
        {/* The wide photo turns to a blur when cut tall, so phones get their own. */}
        <source
          media="(max-width: 767px)"
          srcSet={PHONE_HERO_WIDTHS.map((w) => `${phoneHeroPhoto(w)} ${w}w`).join(', ')}
          sizes="100vw"
        />
        <img
          src={heroPhoto(1600)}
          srcSet={HERO_WIDTHS.map((w) => `${heroPhoto(w)} ${w}w`).join(', ')}
          sizes="100vw"
          alt=""
          fetchPriority="high"
          className="absolute inset-0 h-full w-full object-cover object-center md:scale-105"
        />
      </picture>
      {/* Phones: dark under the text above and the search below. Wider: dark behind the text, the photo towards the other side. */}
      <div aria-hidden className="absolute inset-0 bg-gradient-to-b from-navy-deep/90 via-navy-deep/75 to-navy-deep/95 md:hidden" />
      <div aria-hidden className="absolute inset-0 hidden bg-gradient-to-l from-navy-deep/95 via-navy-deep/60 to-navy-deep/10 ltr:bg-gradient-to-r md:block" />
      <div aria-hidden className="absolute inset-x-0 bottom-0 hidden h-1/3 bg-gradient-to-t from-navy-deep/80 to-transparent md:block" />
      <div aria-hidden className="pointer-events-none absolute -end-40 -top-40 h-[34rem] w-[34rem] rounded-full bg-orange/15 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -bottom-24 start-1/3 h-72 w-72 rounded-full border-[48px] border-white/[0.04]" />
      <div className="relative mx-auto grid max-w-page items-center gap-10 px-4 pb-12 pt-10 md:pb-16 md:pt-14 lg:grid-cols-[minmax(0,1fr)_28rem] lg:gap-14 lg:pb-20 lg:pt-16">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-sm font-bold text-orange-light ring-1 ring-white/10">
            <span className="h-2 w-2 rounded-full bg-orange" />
            {tr('سوق قطع الغيار في مصر', 'Egypt’s auto parts marketplace')}
          </p>
          <h1 className="mt-5 text-4xl font-extrabold leading-tight md:text-5xl md:leading-[1.2] xl:text-6xl xl:leading-[1.15]">
            {tr('قطعة عربيتك،', 'The right part,')}
            <br />
            <span className="text-orange">{tr('أقرب وأسهل', 'closer and easier')}</span>
          </h1>
          <p className="mt-5 max-w-xl text-base leading-8 text-white/75 md:text-lg">
            {tr('اختار ماركة وموديل عربيتك، واوصل لقطع الغيار المناسبة من البياعين والمحلات في كل مصر.', 'Choose your car and find compatible parts from sellers and shops across Egypt.')}
          </p>
          <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-3">
            {points.map(({ icon: Icon, label }) => (
              <li key={label} className="flex items-center gap-2 text-sm font-bold text-white/90">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 text-orange-light">
                  <Icon className="h-4 w-4" />
                </span>
                {label}
              </li>
            ))}
          </ul>
        </div>
        <CarSearch />
      </div>
    </section>
  );
}

function ConditionStrip() {
  const { tr, lang } = useI18n();
  const Arrow = lang === 'ar' ? ChevronLeft : ChevronRight;
  const hints: Record<Condition, string> = {
    NEW: tr('قطع جديدة', 'Brand-new parts'),
    USED: tr('قطع مستعملة بسعر أقل', 'Used parts for less'),
    IMPORTED: tr('قطع وارد من برّه', 'Parts from abroad'),
  };
  return (
    <div className="relative z-10 mx-auto -mt-8 max-w-page px-4">
      <div className="grid grid-cols-3 gap-2 rounded-2xl bg-white p-2 shadow-xl shadow-navy/10 ring-1 ring-line sm:gap-3 sm:p-3 lg:grid-cols-[repeat(3,minmax(0,1fr))_auto]">
        {CONDITIONS.map((c) => {
          const look = conditionLook[c.id];
          const Icon = look.icon;
          return (
            <Link
              key={c.id}
              to={`/search?condition=${c.id}`}
              className="group flex flex-col items-center gap-2 rounded-xl p-2.5 text-center transition hover:bg-canvas sm:flex-row sm:gap-3 sm:p-3 sm:text-start"
            >
              <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition group-hover:scale-105 sm:h-12 sm:w-12 ${look.iconBox}`}>
                <Icon className="h-5 w-5 sm:h-6 sm:w-6" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-extrabold">{lang === 'ar' ? c.ar : c.en}</span>
                <span className="hidden truncate text-xs text-ink-soft sm:block">{hints[c.id]}</span>
              </span>
              <Arrow className="hidden h-4 w-4 shrink-0 text-ink-muted transition group-hover:text-navy sm:block" />
            </Link>
          );
        })}
        <Link
          to="/search"
          className="col-span-3 flex items-center justify-center gap-2 rounded-xl bg-navy px-5 py-3 text-sm font-bold text-white transition hover:bg-navy-soft lg:col-span-1"
        >
          <Search className="h-4 w-4" />
          {tr('كل القطع', 'All parts')}
        </Link>
      </div>
    </div>
  );
}

function Categories() {
  const { tr, lang } = useI18n();
  return (
    <Section title={tr('تسوق حسب القسم', 'Shop by category')} subtitle={tr('اختار القسم ووصل للقطعة أسرع', 'Pick a category to get there faster')}>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 md:gap-4">
        {CATEGORIES.map((item) => {
          const Icon = categoryIcon[item.id];
          return (
            <Link
              key={item.id}
              to={`/search?category=${item.id}`}
              className="group relative flex items-center gap-4 overflow-hidden rounded-2xl bg-white p-4 ring-1 ring-line transition hover:-translate-y-0.5 hover:shadow-lg hover:ring-orange/50 md:p-5"
            >
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-navy-mist text-navy transition group-hover:bg-orange group-hover:text-white md:h-14 md:w-14">
                <Icon className="h-6 w-6 md:h-7 md:w-7" strokeWidth={1.8} />
              </span>
              <span className="font-extrabold md:text-lg">{lang === 'ar' ? item.ar : item.en}</span>
              <Icon aria-hidden className="pointer-events-none absolute -bottom-4 -end-4 h-20 w-20 text-navy/[0.04] transition group-hover:text-orange/10" />
            </Link>
          );
        })}
      </div>
    </Section>
  );
}

function Offers() {
  const { pick, tr } = useI18n();
  const offers = useAppConfig().data?.offers ?? [];
  if (!offers.length) return null;
  return (
    <Section title={tr('عروض وإعلانات', 'Offers & announcements')}>
      <div className="no-scrollbar -mx-4 flex snap-x gap-4 overflow-x-auto px-4 md:mx-0 md:grid md:grid-cols-2 md:px-0">
        {offers.map((offer) => <Link key={offer.id} to={offer.condition ? `/search?condition=${offer.condition}` : '/search'} className="group relative flex h-52 w-[88%] shrink-0 snap-start items-end overflow-hidden rounded-3xl bg-navy-deep text-white md:w-auto">
          <Img src={offer.image} alt={pick(offer.titleAr, offer.titleEn)} className="absolute inset-0 h-full w-full object-cover opacity-60 transition-transform duration-500 group-hover:scale-105" />
          <div className="absolute inset-0 bg-gradient-to-t from-navy-deep/95 via-navy-deep/20 to-transparent" />
          <div className="relative p-6"><span className="rounded-md bg-orange px-2 py-0.5 text-xs font-bold">{pick(offer.tagAr, offer.tagEn)}</span><p className="mt-2 text-2xl font-extrabold">{pick(offer.titleAr, offer.titleEn)}</p>{(offer.subtitleAr || offer.subtitleEn) && <p className="text-sm text-white/80">{pick(offer.subtitleAr, offer.subtitleEn)}</p>}</div>
        </Link>)}
      </div>
    </Section>
  );
}

function HowItWorks() {
  const { tr } = useI18n();
  const steps = [
    { icon: Car, title: tr('اختار عربيتك', 'Choose your car'), body: tr('الماركة والموديل وسنة الصنع، وهنفتكرها لك في جراجك.', 'Make, model and year; we keep it in your garage.') },
    { icon: Search, title: tr('لاقي القطعة', 'Find the part'), body: tr('قطع متوافقة مع عربيتك من بياعين ومحلات قريبة منك.', 'Parts that fit, from sellers and shops near you.') },
    { icon: PhoneCall, title: tr('كلّم البياع', 'Call the seller'), body: tr('اتصال أو واتساب على طول، من غير وسيط.', 'Call or WhatsApp directly, no middleman.') },
  ];
  return (
    <section className="mt-12 rounded-3xl bg-navy-mist p-6 md:mt-16 md:p-10">
      <h2 className="text-center text-xl font-extrabold md:text-2xl">{tr('إزاي عربيتي بتشتغل؟', 'How 3arabity works')}</h2>
      <ol className="mt-8 grid gap-6 md:grid-cols-3">
        {steps.map(({ icon: Icon, title, body }, i) => (
          <li key={title} className="flex gap-4 rounded-2xl bg-white p-5 ring-1 ring-line md:flex-col md:items-center md:p-6 md:text-center">
            <span className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-navy text-white">
              <Icon className="h-6 w-6" />
              <span className="absolute -end-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-orange text-xs font-extrabold ring-2 ring-white">{i + 1}</span>
            </span>
            <div>
              <p className="text-lg font-extrabold">{title}</p>
              <p className="mt-1 text-sm leading-6 text-ink-soft">{body}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

function SellBanner() {
  const { tr } = useI18n();
  return (
    <section className="relative mt-12 overflow-hidden rounded-3xl bg-gradient-to-l from-orange to-orange-deep p-7 text-white md:mt-16 md:p-10">
      <div aria-hidden className="pointer-events-none absolute -end-16 -top-16 h-56 w-56 rounded-full border-[36px] border-white/10" />
      <div className="relative flex flex-col items-start gap-5 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-extrabold md:text-3xl">{tr('عندك قطعة مش محتاجها؟', 'Got a part you don’t need?')}</h2>
          <p className="mt-2 max-w-xl text-white/90">{tr('اعرضها على عربيتي في دقيقة، والمشترين هيكلموك على طول.', 'List it on 3arabity in a minute and buyers will call you directly.')}</p>
        </div>
        <Link to="/sell" className="inline-flex h-12 shrink-0 items-center gap-2 rounded-xl bg-white px-6 font-extrabold text-orange-deep shadow-lg transition hover:bg-navy hover:text-white">
          <Plus className="h-5 w-5" />
          {tr('بيع قطعة', 'Sell a part')}
        </Link>
      </div>
    </section>
  );
}

function Brands() {
  const { tr, lang, pick } = useI18n();
  const labels = useLabels();
  return (
    <Section title={tr('ماركات السيارات', 'Car makes')}>
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
        {labels.brands.map((brand: CarBrand) => (
          <Link
            key={brand.id}
            to={`/search?q=${encodeURIComponent(lang === 'ar' ? brand.nameAr : brand.nameEn)}`}
            className="group flex flex-col items-center gap-3 rounded-2xl bg-white px-2 pb-3 pt-4 text-center ring-1 ring-line transition hover:-translate-y-0.5 hover:shadow-md hover:ring-orange/50"
          >
            <BrandLogo brand={brand} className="h-12 w-16 text-2xl transition duration-300 group-hover:scale-110" />
            <span className="w-full truncate text-sm font-bold">{pick(brand.nameAr, brand.nameEn)}</span>
          </Link>
        ))}
      </div>
    </Section>
  );
}

function EmptyNote({ children }: { children: ReactNode }) {
  return <p className="rounded-2xl bg-white p-8 text-center text-ink-soft ring-1 ring-line">{children}</p>;
}

/** The parts last opened on this device, newest first. */
function RecentlyViewed() {
  const { tr } = useI18n();
  const ids = recent.use();
  const parts = useQuery({
    queryKey: ['parts', 'batch', 'recent', ids.join(',')],
    queryFn: () => get<{ items: Part[] }>('/parts/batch', { ids: ids.join(',') }),
    enabled: ids.length > 0,
    placeholderData: (previous) => previous,
  });
  // In the order they were viewed; the batch may come back in any order.
  const items = ids.map((id) => parts.data?.items.find((p) => p.id === id)).filter((p): p is Part => Boolean(p));
  if (!items.length) return null;

  return (
    <section className="mt-12 md:mt-16">
      <div className="mb-5 flex items-end justify-between gap-4">
        <h2 className="flex items-center gap-2.5 text-xl font-extrabold md:text-2xl">
          <span aria-hidden className="h-6 w-1.5 rounded-full bg-orange" />
          <History className="h-6 w-6 text-ink-soft" />
          {tr('شفتها مؤخرًا', 'Recently viewed')}
        </h2>
        <button onClick={() => recent.set([])} className="shrink-0 rounded-lg px-3 py-1.5 text-sm font-bold text-ink-soft hover:bg-white hover:text-navy">
          {tr('امسح', 'Clear')}
        </button>
      </div>
      <PartRow parts={items.slice(0, 8)} />
    </section>
  );
}

/** One car (or all of them) to follow, as a card with a check when chosen. */
function CarChoice({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      className={cx(
        'relative flex min-h-[4.5rem] min-w-44 shrink-0 items-center gap-3 rounded-2xl bg-white py-3 pe-10 ps-3 text-start transition',
        active ? 'shadow-md ring-2 ring-orange' : 'ring-1 ring-line hover:-translate-y-0.5 hover:shadow-md hover:ring-navy/30',
      )}
    >
      {children}
      <span
        className={cx(
          'absolute end-3 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full border-2 transition',
          active ? 'border-orange bg-orange' : 'border-line',
        )}
      >
        {active && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
      </span>
    </button>
  );
}

/** Add your car, then parts that fit it, right on the home screen. */
function MyGarage() {
  const { tr } = useI18n();
  const labels = useLabels();
  const state = garage.use();
  const [picking, setPicking] = useState(false);
  const [managing, setManaging] = useState(false);
  const followed = followedCars(state);
  const query = carsParam(followed);
  const parts = useQuery({
    queryKey: ['home', 'fitted-parts', query],
    queryFn: () => get<{ items: Part[] }>('/parts', { cars: query, limit: 8, sort: 'NEWEST' }),
    enabled: Boolean(query),
  });

  const dialogs = (
    <>
      <CarPicker open={picking} onClose={() => setPicking(false)} onPick={addCar} />
      <GarageDialog open={managing} onClose={() => setManaging(false)} />
    </>
  );

  if (!state.cars.length) {
    return (
      <section className="mt-12 md:mt-16">
        <div className="relative overflow-hidden rounded-3xl bg-white p-6 ring-1 ring-line md:p-8">
          <div aria-hidden className="pointer-events-none absolute -end-10 -top-10 h-40 w-40 rounded-full bg-orange-mist" />
          <Car aria-hidden className="pointer-events-none absolute -bottom-6 end-6 hidden h-40 w-40 text-navy/[0.05] md:block" strokeWidth={1.2} />
          <div className="relative flex flex-col items-start gap-5 md:flex-row md:items-center">
            <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-navy text-white">
              <Car className="h-8 w-8" />
            </span>
            <div className="flex-1">
              <h2 className="text-xl font-extrabold md:text-2xl">{tr('ضيف عربيتك', 'Add your car')}</h2>
              <p className="mt-1 max-w-xl leading-7 text-ink-soft">
                {tr('قولنا عربيتك إيه، وهنعرضلك هنا قطع الغيار اللي بتركب عليها بس، كل ما تفتح عربيتي.', 'Tell us your car and we’ll show parts that fit it right here, every time you open 3arabity.')}
              </p>
            </div>
            <Button variant="accent" onClick={() => setPicking(true)} className="shrink-0">
              <Plus className="h-5 w-5" />
              {tr('ضيف عربيتك', 'Add your car')}
            </Button>
          </div>
        </div>
        {dialogs}
      </section>
    );
  }

  const title =
    followed.length === 1
      ? tr(`قطع غيار ${labels.car(followed[0])}`, `Parts for your ${labels.car(followed[0])}`)
      : tr('قطع غيار عربياتك', 'Parts for your cars');

  return (
    <Section title={title} subtitle={tr('قطع متوافقة مع عربيتك من البياعين والمحلات', 'Parts that fit, from sellers and shops')} link={query ? `/search?cars=${encodeURIComponent(query)}` : '/search'}>
      <div role="radiogroup" aria-label={tr('عربياتي', 'My cars')} className="no-scrollbar -mx-4 mb-6 flex items-stretch gap-3 overflow-x-auto px-4 pb-2 pt-1 md:mx-0 md:px-0">
        {state.cars.length > 1 && (
          <CarChoice active={state.active === -1} onClick={() => followCar(-1)}>
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-navy text-white">
              <Car className="h-5 w-5" />
            </span>
            <span>
              <span className="block font-extrabold">{tr('كل عربياتي', 'All my cars')}</span>
              <span className="block text-xs font-bold text-ink-soft">{tr(`${state.cars.length} عربيات`, `${state.cars.length} cars`)}</span>
            </span>
          </CarChoice>
        )}
        {state.cars.map((car, i) => {
          const brand = labels.brands.find((b) => b.id === car.brandId);
          return (
            <CarChoice key={`${car.brandId}-${car.modelId}-${car.year}`} active={state.cars.length === 1 || state.active === i} onClick={() => followCar(i)}>
              <span className="flex h-11 w-12 shrink-0 items-center justify-center rounded-xl bg-canvas">
                {brand ? <BrandLogo brand={brand} className="h-7 w-9 text-base" /> : <Car className="h-5 w-5" />}
              </span>
              <span className="min-w-0">
                <span className="block truncate font-extrabold">
                  {labels.brand(car.brandId)} {labels.model(car.brandId, car.modelId)}
                </span>
                <span className="block text-xs font-bold tabular-nums text-ink-soft">{car.year}</span>
              </span>
            </CarChoice>
          );
        })}
        {state.cars.length < MAX_CARS && (
          <button
            onClick={() => setPicking(true)}
            className="flex min-h-[4.5rem] shrink-0 items-center gap-2 rounded-2xl border-2 border-dashed border-navy/20 px-5 text-sm font-bold text-ink-soft transition hover:border-orange hover:bg-orange-mist/50 hover:text-orange-deep"
          >
            <Plus className="h-5 w-5" />
            {tr('ضيف عربية', 'Add a car')}
          </button>
        )}
        <button
          onClick={() => setManaging(true)}
          className="flex min-h-[4.5rem] shrink-0 flex-col items-center justify-center gap-1 rounded-2xl px-4 text-xs font-bold text-ink-soft transition hover:bg-white hover:text-navy"
        >
          <Settings2 className="h-5 w-5" />
          {tr('تعديل', 'Edit')}
        </button>
      </div>
      {parts.isError ? (
        <ErrorState error={parts.error} onRetry={() => parts.refetch()} />
      ) : parts.data ? (
        parts.data.items.length ? (
          <PartGrid parts={parts.data.items} />
        ) : (
          <EmptyNote>{tr('مفيش قطع متاحة للعربية دي دلوقتي. هنوريك أول ما بياع يعرض قطعة ليها.', 'No parts for this car yet. They’ll show here as soon as a seller lists one.')}</EmptyNote>
        )
      ) : (
        <PartGridSkeleton count={4} />
      )}
      {dialogs}
    </Section>
  );
}

export default function Home() {
  const { tr } = useI18n();
  const state = garage.use();
  const carQuery = carsParam(followedCars(state));
  const home = useQuery({ queryKey: ['home', carQuery], queryFn: () => get<HomeData>('/parts/home', { cars: carQuery }), placeholderData: (previous) => previous });

  return <>
    <Hero />
    <ConditionStrip />

    <div className="mx-auto max-w-page px-4 pb-8">
      <MyGarage />

      <Categories />

      <Offers />

      {home.isError && !home.data ? <div className="mt-8"><ErrorState error={home.error} onRetry={() => home.refetch()} /></div> : <>
        {!carQuery && (home.isLoading || (home.data?.featured.length ?? 0) > 0) && <Section title={tr('قطع مميزة', 'Featured parts')} subtitle={tr('مختارة من البياعين والمحلات الموثّقة', 'Picked from verified sellers and shops')} link="/search">{home.data ? <PartGrid parts={home.data.featured} /> : <PartGridSkeleton count={4} />}</Section>}

        <HowItWorks />

        <Section title={tr('أحدث قطع الغيار', 'Latest parts')} link={carQuery ? `/search?cars=${encodeURIComponent(carQuery)}` : '/search'}>
          {home.data ? (home.data.latest.length ? <PartGrid parts={home.data.latest} /> : <EmptyNote>{tr('لسه مفيش قطع معروضة. ارجع قريب وشوف الجديد.', 'No parts are listed yet. Check back soon.')}</EmptyNote>) : <PartGridSkeleton count={4} />}
        </Section>
      </>}

      {home.isError && !home.data && <HowItWorks />}

      <RecentlyViewed />

      <SellBanner />

      <Brands />
    </div>
  </>;
}
