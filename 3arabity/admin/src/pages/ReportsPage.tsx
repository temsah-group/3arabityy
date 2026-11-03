import { Badge, Group, SegmentedControl, Select, Stack, Table, Text, Title } from '@mantine/core'
import { useNavigate } from 'react-router'

import type { Account, Page, PartRow, ReportGroup, ReviewRow } from '../api/types'
import { PartThumb, Pager, QueryState } from '../components/common'
import { useApi, useFilters } from '../hooks'
import { formatDateTime, formatPrice, label, reasons, stars } from '../labels'

const targetNames = { PART: 'إعلان', SELLER: 'بائع', REVIEW: 'تقييم' } as const
const targetColors = { PART: 'navy', SELLER: 'grape', REVIEW: 'orange' } as const

function Subject({ group }: { group: ReportGroup }) {
  if (!group.subject) {
    return (
      <Text c="dimmed" size="sm">
        {group.target === 'PART' ? 'إعلان اتمسح' : group.target === 'REVIEW' ? 'تقييم اتمسح' : 'حساب اتمسح'}
      </Text>
    )
  }
  if (group.target === 'PART') {
    const part = group.subject as PartRow
    return (
      <Group gap="sm" wrap="nowrap">
        <PartThumb part={part} size={40} />
        <div>
          <Text size="sm" fw={600} lineClamp={1}>
            {part.name}
          </Text>
          <Text size="xs" c="dimmed">
            {part.seller.name} · {formatPrice(part.price)}
          </Text>
        </div>
      </Group>
    )
  }
  if (group.target === 'REVIEW') {
    const review = group.subject as ReviewRow
    return (
      <div>
        <Text size="sm" fw={600} lineClamp={1}>
          <Text span c="orange.6">
            {stars(review.rating)}
          </Text>{' '}
          {review.text}
        </Text>
        <Text size="xs" c="dimmed">
          على {review.targetName ?? '—'} · {review.author?.fullName ?? '—'}
        </Text>
      </div>
    )
  }
  const account = group.subject as Account
  return (
    <div>
      <Text size="sm" fw={600}>
        {account.fullName}
      </Text>
      <Text size="xs" c="dimmed" dir="ltr" ta="right">
        {account.email}
      </Text>
    </div>
  )
}

export function ReportsPage() {
  const navigate = useNavigate()
  const { values, page, set } = useFilters(['status', 'target'] as const)
  const status = values.status || 'OPEN'
  const query = useApi<Page<ReportGroup>>('/reports', {
    status,
    target: values.target || undefined,
    page,
  })
  const data = query.data

  return (
    <Stack>
      <Title order={2}>البلاغات</Title>
      <Group>
        <SegmentedControl
          value={status}
          onChange={(value) => set('status', value === 'OPEN' ? null : value)}
          data={[
            { value: 'OPEN', label: 'مفتوحة' },
            { value: 'CLOSED', label: 'مقفولة' },
          ]}
        />
        <Select
          placeholder="الكل"
          clearable
          w={160}
          value={values.target || null}
          onChange={(value) => set('target', value)}
          data={[
            { value: 'PART', label: 'إعلانات' },
            { value: 'SELLER', label: 'بائعين' },
            { value: 'REVIEW', label: 'تقييمات' },
          ]}
        />
      </Group>
      <QueryState
        isLoading={query.isLoading}
        error={query.error}
        isEmpty={data?.items.length === 0}
        empty={status === 'OPEN' ? 'مفيش بلاغات مستنية 🎉' : 'مفيش بلاغات مقفولة'}
        onRetry={() => query.refetch()}
      >
        {data && (
          <>
            <Table.ScrollContainer minWidth={720}>
              <Table highlightOnHover verticalSpacing="sm">
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>على إيه</Table.Th>
                    <Table.Th>النوع</Table.Th>
                    <Table.Th>عدد البلاغات</Table.Th>
                    <Table.Th>الأسباب</Table.Th>
                    <Table.Th>آخر بلاغ</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {data.items.map((group) => (
                    <Table.Tr
                      key={`${group.target}:${group.targetId}`}
                      style={{ cursor: 'pointer' }}
                      onClick={() => navigate(`/reports/${group.target}/${group.targetId}`)}
                    >
                      <Table.Td>
                        <Subject group={group} />
                      </Table.Td>
                      <Table.Td>
                        <Badge variant="light" color={targetColors[group.target]}>
                          {targetNames[group.target]}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        <Text fw={700} c={group.count >= 3 ? 'red' : undefined}>
                          {group.count}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Group gap={4}>
                          {Object.entries(group.reasons).map(([reason, count]) => (
                            <Badge key={reason} variant="outline" color="gray" size="sm">
                              {label(reasons, reason)}
                              {count > 1 ? ` ×${count}` : ''}
                            </Badge>
                          ))}
                        </Group>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm">{formatDateTime(group.latestAt)}</Text>
                      </Table.Td>
                    </Table.Tr>
                  ))}
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
