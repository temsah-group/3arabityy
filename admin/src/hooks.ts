import { notifications } from '@mantine/notifications'
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router'

import { api } from './api/client'

/** A GET that keeps the last page on screen while the next one loads. */
export function useApi<T>(path: string, query?: Record<string, string | number | undefined>) {
  return useQuery({
    queryKey: [path, query],
    queryFn: () => api<T>(path, { query }),
    placeholderData: keepPreviousData,
  })
}

/** After a change: every table and page reloads, and a toast says it worked. */
export function useAfterChange() {
  const client = useQueryClient()
  return async (message = 'تم الحفظ') => {
    await client.invalidateQueries()
    notifications.show({ message, color: 'green' })
  }
}

/** Filters and the page number, kept in the address so links and back work. */
export function useFilters<K extends string>(keys: readonly K[]) {
  const [params, setParams] = useSearchParams()
  const values = Object.fromEntries(keys.map((key) => [key, params.get(key) ?? ''])) as Record<
    K,
    string
  >
  const page = Number(params.get('page')) || 1
  const set = (key: K | 'page', value: string | number | null) => {
    setParams(
      (current) => {
        const next = new URLSearchParams(current)
        if (value === null || value === '') next.delete(key)
        else next.set(key, String(value))
        // A new filter starts from the first page.
        if (key !== 'page') next.delete('page')
        return next
      },
      { replace: key !== 'page' },
    )
  }
  return { values, page, set }
}
