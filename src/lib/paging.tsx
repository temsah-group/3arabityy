import { useInfiniteQuery } from '@tanstack/react-query';
import type { QueryKey } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';

import { Spinner } from '@/components/ui';

import { get } from './api';
import type { Page } from './types';

type Query = Record<string, string | number | boolean | undefined | null>;

/** A cursor-paged list (`items`, `nextCursor`), 20 a page by default. */
export function usePaged<T, P extends Page<T> = Page<T>>(
  key: QueryKey,
  path: string,
  query: Query = {},
  options: { enabled?: boolean; limit?: number } = {},
) {
  const result = useInfiniteQuery({
    queryKey: [...key, query],
    queryFn: ({ pageParam, signal }) =>
      get<P>(path, { ...query, limit: options.limit ?? 20, cursor: pageParam ?? undefined }, signal),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
    enabled: options.enabled ?? true,
  });
  const items = result.data?.pages.flatMap((p) => p.items) ?? [];
  const first = result.data?.pages[0];
  return { ...result, items, first };
}

/** Loads the next page when it scrolls into view. */
export function LoadMore({
  hasNext,
  loading,
  onLoad,
}: {
  hasNext: boolean;
  loading: boolean;
  onLoad: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || !hasNext) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !loading) onLoad();
      },
      { rootMargin: '400px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasNext, loading, onLoad]);
  if (!hasNext) return null;
  return (
    <div ref={ref} className="flex justify-center py-8">
      {loading && <Spinner />}
    </div>
  );
}
