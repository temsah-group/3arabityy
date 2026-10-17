import { Anchor, Badge, Stack, Table, Text, Title } from '@mantine/core'
import { Link, Navigate } from 'react-router'

import type { HistoryEntry, Page } from '../api/types'
import { useSession } from '../auth/session'
import { Pager, QueryState } from '../components/common'
import { useApi, useFilters } from '../hooks'
import { auditActions, formatDateTime, label } from '../labels'

/** Where an entry's target opens. */
function targetLink(entry: HistoryEntry): string | null {
  if (entry.target === 'SETTINGS') return entry.targetId === 'cars' ? '/cars' : '/settings'
  if (entry.target === 'ANNOUNCEMENT') return entry.action === 'ANNOUNCEMENT_REMOVED' ? null : '/announcements'
  if (entry.target === 'USER') return `/users/${entry.targetId}`
  if (entry.target === 'PART') return entry.action === 'PART_REMOVED' ? null : `/parts/${entry.targetId}`
  const target = entry.changes?.target
  return typeof target === 'string' ? `/reports/${target}/${entry.targetId}` : null
}

export function AuditPage() {
  const { isOwner } = useSession()
  const { values, page, set } = useFilters(['targetId'] as const)
  const query = useApi<Page<HistoryEntry>>('/audit', { targetId: values.targetId || undefined, page })
  if (!isOwner) return <Navigate to="/" replace />
  const data = query.data

  return (
    <Stack>
      <Title order={2}>سجل العمليات</Title>
      <QueryState
        isLoading={query.isLoading}
        error={query.error}
        isEmpty={data?.items.length === 0}
        empty="مفيش عمليات لسه"
        onRetry={() => query.refetch()}
      >
        {data && (
          <>
            <Table.ScrollContainer minWidth={720}>
              <Table verticalSpacing="sm">
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>الوقت</Table.Th>
                    <Table.Th>المشرف</Table.Th>
                    <Table.Th>الإجراء</Table.Th>
                    <Table.Th>على</Table.Th>
                    <Table.Th>السبب</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {data.items.map((entry) => {
                    const to = targetLink(entry)
                    return (
                      <Table.Tr key={entry.id}>
                        <Table.Td>
                          <Text size="sm">{formatDateTime(entry.createdAt)}</Text>
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm" dir="ltr" ta="right">
                            {entry.adminEmail}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <Badge variant="light">{label(auditActions, entry.action)}</Badge>
                        </Table.Td>
                        <Table.Td>
                          {to ? (
                            <Anchor component={Link} to={to} size="sm">
                              فتح
                            </Anchor>
                          ) : (
                            <Text size="sm" c="dimmed">
                              {typeof entry.changes?.name === 'string'
                                ? entry.changes.name
                                : typeof entry.changes?.titleAr === 'string'
                                  ? entry.changes.titleAr
                                  : 'اتمسح'}
                            </Text>
                          )}
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm">{entry.note ?? '—'}</Text>
                        </Table.Td>
                      </Table.Tr>
                    )
                  })}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>
            <Pager page={data} onChange={(next) => set('page', next)} />
          </>
        )}
      </QueryState>
    </Stack>
  )
}
