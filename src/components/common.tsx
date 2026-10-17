import { Alert, Avatar, Badge, Button, Center, Group, Loader, Pagination, Text } from '@mantine/core'
import { IconPhotoOff } from '@tabler/icons-react'
import type { ReactNode } from 'react'

import { ApiError, mediaUrl } from '../api/client'
import type { AccountStatus, Page, PartRow } from '../api/types'

/** Loading, error and empty states around a query's content. */
export function QueryState({
  isLoading,
  error,
  isEmpty,
  empty = 'مفيش حاجة هنا',
  onRetry,
  children,
}: {
  isLoading: boolean
  error: unknown
  isEmpty?: boolean
  empty?: string
  onRetry?: () => void
  children: ReactNode
}) {
  if (isLoading) {
    return (
      <Center py="xl">
        <Loader />
      </Center>
    )
  }
  if (error) {
    return (
      <Alert color="red" variant="light" title="مقدرناش نجيب البيانات">
        <Group justify="space-between">
          <Text size="sm">{error instanceof ApiError ? error.message : 'حصل خطأ'}</Text>
          {onRetry && (
            <Button size="xs" variant="light" color="red" onClick={onRetry}>
              جرّب تاني
            </Button>
          )}
        </Group>
      </Alert>
    )
  }
  if (isEmpty) {
    return (
      <Center py="xl">
        <Text c="dimmed">{empty}</Text>
      </Center>
    )
  }
  return <>{children}</>
}

/** "Showing 1–25 of 80" and the page buttons. */
export function Pager({ page, onChange }: { page: Page<unknown>; onChange(page: number): void }) {
  const pages = Math.max(1, Math.ceil(page.total / page.pageSize))
  const from = page.total === 0 ? 0 : (page.page - 1) * page.pageSize + 1
  const to = Math.min(page.total, page.page * page.pageSize)
  return (
    <Group justify="space-between" mt="md">
      <Text size="sm" c="dimmed">
        {from}–{to} من {page.total}
      </Text>
      {pages > 1 && <Pagination total={pages} value={page.page} onChange={onChange} size="sm" />}
    </Group>
  )
}

export function AccountStatusBadge({ status }: { status: AccountStatus | null }) {
  if (status === 'SUSPENDED') return <Badge color="red">موقوف</Badge>
  return <Badge color="green" variant="light">نشط</Badge>
}

export function VerifiedBadge({ verified }: { verified: boolean }) {
  return verified ? (
    <Badge color="orange" variant="light">
      موثّق
    </Badge>
  ) : null
}

/** For sale, sold or hidden (and why). */
export function PartStateBadge({ part }: { part: PartRow }) {
  if (part.hiddenAt) {
    return (
      <Badge color="red" variant="light">
        {part.hiddenReason === 'SUSPENDED' ? 'مخفي (البائع موقوف)' : 'مخفي'}
      </Badge>
    )
  }
  if (part.isSold) return <Badge color="gray">اتباع</Badge>
  return (
    <Badge color="green" variant="light">
      معروض
    </Badge>
  )
}

export function PartThumb({ part, size = 48 }: { part: Pick<PartRow, 'images'>; size?: number }) {
  const cover = part.images[0]
  return (
    <Avatar src={cover ? mediaUrl(cover) : null} size={size} radius="sm" alt="">
      <IconPhotoOff size={size / 2} />
    </Avatar>
  )
}
