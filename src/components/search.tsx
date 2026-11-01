import { useQuery } from '@tanstack/react-query';
import { ArrowUpLeft, ArrowUpRight, Clock, Search as SearchIcon, X } from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { FormEvent, KeyboardEvent, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';

import { get } from '@/lib/api';
import { CATEGORIES, useLabels } from '@/lib/catalog';
import { formatPrice } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import { persisted } from '@/lib/store';
import type { CarBrand, Part } from '@/lib/types';

import { BrandLogo } from './cars';
import { categoryIcon } from './parts';
import { cx, Img } from './ui';

const MAX_RECENT = 6;
const recentSearches = persisted<string[]>('arabity.recentSearches', []);

export function rememberSearch(q: string) {
  const text = q.trim();
  if (!text) return;
  recentSearches.set([text, ...recentSearches.get().filter((s) => s !== text)].slice(0, MAX_RECENT));
}

/** Folds the Arabic letters people type interchangeably, so "اسكودا" finds "إسكودا". */
const fold = (s: string) =>
  s
    .toLowerCase()
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي');

/** The text with the part that matches the query in bold. */
function Highlight({ text, query }: { text: string; query: string }) {
  const q = fold(query.trim());
  const i = q ? fold(text).indexOf(q) : -1;
  // Folding keeps one letter per letter, so the index fits the original text.
  if (i < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <mark className="bg-transparent font-extrabold text-navy">{text.slice(i, i + q.length)}</mark>
      {text.slice(i + q.length)}
    </>
  );
}

function useDebounced<T>(value: T, ms: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

interface Item {
  key: string;
  go: () => void;
  render: (active: boolean) => ReactNode;
}

/**
 * The search box, with suggestions as you type: makes and models, categories
 * and parts. Focused while empty, it shows recent searches.
 */
export function SearchBox({
  value,
  onValueChange,
  onSearch,
  size = 'md',
  className,
}: {
  value: string;
  onValueChange: (q: string) => void;
  /** Runs a full search for the text; navigates to /search when not given. */
  onSearch?: (q: string) => void;
  size?: 'md' | 'lg';
  className?: string;
}) {
  const { tr, pick, lang } = useI18n();
  const labels = useLabels();
  const navigate = useNavigate();
  const recent = recentSearches.use();
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  const q = value.trim();
  const debounced = useDebounced(q, 250);
  const parts = useQuery({
    queryKey: ['suggest', debounced],
    queryFn: ({ signal }) => get<{ items: Part[] }>('/parts', { q: debounced, limit: 5, sort: 'NEWEST' }, signal),
    enabled: open && debounced.length >= 2,
    staleTime: 30_000,
  });

  const search = (text: string) => {
    const t = text.trim();
    rememberSearch(t);
    setOpen(false);
    inputRef.current?.blur();
    if (onSearch) onSearch(t);
    else navigate(t ? `/search?q=${encodeURIComponent(t)}` : '/search');
  };
  const goTo = (to: string, remember?: string) => {
    if (remember) rememberSearch(remember);
    setOpen(false);
    inputRef.current?.blur();
    navigate(to);
  };

  // Makes and their models that match, best first: a make by name, then models.
  const cars = useMemo(() => {
    const f = fold(q);
    if (f.length < 2) return [];
    const out: { brand: CarBrand; modelName?: string; label: string }[] = [];
    for (const brand of labels.brands) {
      const brandName = pick(brand.nameAr, brand.nameEn);
      if (fold(brand.nameAr).includes(f) || fold(brand.nameEn).includes(f)) out.push({ brand, label: brandName });
    }
    for (const brand of labels.brands) {
      for (const model of brand.models) {
        if (fold(model.nameAr).includes(f) || fold(model.nameEn).includes(f)) {
          out.push({ brand, modelName: pick(model.nameAr, model.nameEn), label: `${pick(brand.nameAr, brand.nameEn)} ${pick(model.nameAr, model.nameEn)}` });
        }
      }
    }
    return out.slice(0, 4);
  }, [q, labels.brands, pick]);

  const categories = useMemo(() => {
    const f = fold(q);
    if (!f) return [];
    return CATEGORIES.filter((c) => fold(c.ar).includes(f) || fold(c.en).includes(f)).slice(0, 3);
  }, [q]);

  const Arrow = lang === 'ar' ? ArrowUpLeft : ArrowUpRight;
  const row = (active: boolean, extra?: string) =>
    cx('flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-start text-sm', active ? 'bg-canvas' : 'hover:bg-canvas', extra);

  // Every row, in order, so the arrow keys walk through all groups.
  const groups: { title?: string; action?: ReactNode; items: Item[] }[] = [];
  if (!q) {
    if (recent.length) {
      groups.push({
        title: tr('عمليات البحث الأخيرة', 'Recent searches'),
        action: (
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => recentSearches.set([])} className="text-xs font-bold text-orange-deep hover:underline">
            {tr('امسح', 'Clear')}
          </button>
        ),
        items: recent.map((s) => ({
          key: `recent-${s}`,
          go: () => {
            onValueChange(s);
            search(s);
          },
          render: (active) => (
            <div className={row(active, 'group')}>
              <Clock className="h-4 w-4 shrink-0 text-ink-muted" />
              <span className="flex-1 truncate font-bold">{s}</span>
              <button
                type="button"
                tabIndex={-1}
                onMouseDown={(e) => e.preventDefault()}
                onClick={(e) => {
                  e.stopPropagation();
                  recentSearches.set(recent.filter((x) => x !== s));
                }}
                className="rounded p-0.5 text-ink-muted opacity-0 hover:text-navy group-hover:opacity-100"
                aria-label={tr(`امسح ${s}`, `Remove ${s}`)}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ),
        })),
      });
    }
    groups.push({
      title: tr('تصفّح الأقسام', 'Browse categories'),
      items: CATEGORIES.map((c) => {
        const Icon = categoryIcon[c.id];
        return {
          key: `browse-${c.id}`,
          go: () => goTo(`/search?category=${c.id}`),
          render: (active) => (
            <div className={row(active)}>
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-navy-mist text-navy">
                <Icon className="h-4 w-4" />
              </span>
              <span className="flex-1 font-bold">{lang === 'ar' ? c.ar : c.en}</span>
            </div>
          ),
        };
      }),
    });
  } else {
    groups.push({
      items: [
        {
          key: 'query',
          go: () => search(q),
          render: (active) => (
            <div className={row(active)}>
              <SearchIcon className="h-4 w-4 shrink-0 text-orange-deep" />
              <span className="flex-1 truncate">
                {tr('دوّر على', 'Search for')} <span className="font-extrabold">«{q}»</span>
              </span>
              <span className="text-xs text-ink-muted">Enter ↵</span>
            </div>
          ),
        },
      ],
    });
    if (cars.length) {
      groups.push({
        title: tr('عربيات', 'Cars'),
        items: cars.map((c) => ({
          key: `car-${c.label}`,
          go: () => {
            onValueChange(c.label);
            search(c.label);
          },
          render: (active) => (
            <div className={row(active)}>
              <span className="flex h-7 w-9 shrink-0 items-center justify-center">
                <BrandLogo brand={c.brand} className="h-6 w-8 text-xs" />
              </span>
              <span className="flex-1 truncate font-bold">
                <Highlight text={c.label} query={q} />
              </span>
              <Arrow className="h-4 w-4 shrink-0 text-ink-muted" />
            </div>
          ),
        })),
      });
    }
    if (categories.length) {
      groups.push({
        title: tr('أقسام', 'Categories'),
        items: categories.map((c) => {
          const Icon = categoryIcon[c.id];
          return {
            key: `cat-${c.id}`,
            go: () => goTo(`/search?category=${c.id}`),
            render: (active) => (
              <div className={row(active)}>
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-navy-mist text-navy">
                  <Icon className="h-4 w-4" />
                </span>
                <span className="flex-1 truncate font-bold">
                  <Highlight text={lang === 'ar' ? c.ar : c.en} query={q} />
                </span>
                <span className="text-xs text-ink-muted">{tr('قسم', 'Category')}</span>
              </div>
            ),
          };
        }),
      });
    }
    const found = debounced === q ? parts.data?.items ?? [] : [];
    if (found.length) {
      groups.push({
        title: tr('قطع غيار', 'Parts'),
        items: found.map((p) => ({
          key: `part-${p.id}`,
          go: () => goTo(`/parts/${p.id}`, q),
          render: (active) => (
            <div className={row(active)}>
              <Img src={p.images[0]} alt="" className="h-10 w-10 shrink-0 rounded-lg" />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-bold">
                  <Highlight text={p.name} query={q} />
                </span>
                <span className="block truncate text-xs text-ink-soft">
                  {labels.category(p.category)} · {labels.city(p.city)}
                </span>
              </span>
              <span className="shrink-0 text-sm font-extrabold text-navy">{formatPrice(p.price, lang)}</span>
            </div>
          ),
        })),
      });
    }
  }
  const items = groups.flatMap((g) => g.items);
  const loadingParts = Boolean(q.length >= 2) && (debounced !== q || parts.isFetching) && !parts.data;

  // Back to the "search for" row whenever the text changes.
  useEffect(() => setHighlight(q ? 0 : -1), [q]);

  useEffect(() => {
    if (!open) return;
    const outside = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [open]);

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setHighlight((i) => Math.min(i + 1, items.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((i) => Math.max(i - 1, -1));
    } else if (e.key === 'Escape') {
      if (open) {
        e.preventDefault();
        setOpen(false);
      } else {
        inputRef.current?.blur();
      }
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (open && highlight >= 0 && items[highlight]) items[highlight].go();
    else search(q);
  };

  const large = size === 'lg';
  let index = -1;

  return (
    <div ref={rootRef} className={cx('relative', className)}>
      <form onSubmit={submit} role="search">
        <SearchIcon className={cx('pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-ink-muted', large ? 'start-4 h-5 w-5' : 'h-4 w-4')} />
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => {
            onValueChange(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder={tr('اسم القطعة، رقمها، أو العربية', 'Part name, number or car')}
          aria-label={tr('ابحث', 'Search')}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && highlight >= 0 && items[highlight] ? `${listId}-${highlight}` : undefined}
          autoComplete="off"
          enterKeyHint="search"
          className={cx(
            'w-full border-0 bg-white text-navy placeholder:text-ink-muted focus:outline-none',
            large
              ? 'h-14 rounded-2xl pe-10 ps-12 text-base ring-1 ring-line focus:ring-2 focus:ring-navy/20'
              : 'h-10 rounded-xl bg-white/95 pe-9 ps-9 text-sm focus:ring-2 focus:ring-orange',
            open && 'rounded-b-none',
          )}
        />
        {value && (
          <button
            type="button"
            onClick={() => {
              onValueChange('');
              inputRef.current?.focus();
            }}
            className="absolute end-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-ink-muted hover:bg-canvas hover:text-navy"
            aria-label={tr('امسح', 'Clear')}
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </form>
      {open && (
        <div
          id={listId}
          role="listbox"
          className="absolute inset-x-0 top-full z-40 max-h-[min(28rem,70vh)] overflow-y-auto rounded-b-2xl border-t border-line bg-white p-2 text-navy shadow-2xl ring-1 ring-line"
        >
          {groups.map((g, gi) => (
            <div key={g.title ?? gi} className={cx(gi > 0 && 'mt-1 border-t border-line pt-1')}>
              {g.title && (
                <div className="flex items-center justify-between px-3 pb-1 pt-2">
                  <p className="text-xs font-extrabold text-ink-muted">{g.title}</p>
                  {g.action}
                </div>
              )}
              {g.items.map((item) => {
                index += 1;
                const i = index;
                return (
                  <div
                    key={item.key}
                    id={`${listId}-${i}`}
                    role="option"
                    aria-selected={i === highlight}
                    onMouseDown={(e) => e.preventDefault()}
                    onMouseMove={() => setHighlight(i)}
                    onClick={item.go}
                  >
                    {item.render(i === highlight)}
                  </div>
                );
              })}
            </div>
          ))}
          {loadingParts && (
            <div className="mt-1 space-y-2 border-t border-line px-3 pb-1 pt-3">
              {[0, 1].map((i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="h-10 w-10 animate-pulse rounded-lg bg-canvas" />
                  <span className="h-3 flex-1 animate-pulse rounded bg-canvas" />
                </div>
              ))}
            </div>
          )}
          {q.length >= 2 && !loadingParts && items.length === 1 && (
            <p className="px-3 pb-2 pt-3 text-center text-sm text-ink-soft">{tr('مفيش اقتراحات، دوس Enter وهندوّر في كل القطع.', 'No suggestions. Press Enter to search all parts.')}</p>
          )}
        </div>
      )}
    </div>
  );
}
