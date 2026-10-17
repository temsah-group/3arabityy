import { Anchor, Badge, Group, Select, Stack, Table, Text, Title } from '@mantine/core'
import { Link, useNavigate } from 'react-router'

import type { Page, PartRow } from '../api/types'
import { SearchBox } from '../components/SearchBox'
import { PartStateBadge, PartThumb, Pager, QueryState } from '../components/common'
import { useApi, useFilters } from '../hooks'
import { categories, conditions, formatDate, formatPrice, label } from '../labels'

export function PartsPage() {
  const navigate = useNavigate()
  const { values, page, set } = useFilters(['q', 'status', 'featured', 'sellerId'] as const)
  const query = useApi<Page<PartRow>>('/parts', {
    q: values.q.trim() || undefined,
    status: values.status || undefined,
    featured: values.featured || undefined,
    sellerId: values.sellerId || undefined,
    page,
  })
  const data = query.data

  return (
    <Stack>
      <Title order={2}>الإعلانات</Title>
      <Group>
        <SearchBox value={values.q} onSearch={(q) => set('q', q)} placeholder="اسم القطعة أو رقمها أو البائع" />
        <Select
          placeholder="كل الحالات"
          clearable
          w={150}
          value={values.status || null}
          onChange={(value) => set('status', value)}
          data={[
            { value: 'FOR_SALE', label: 'معروضة' },
            { value: 'SOLD', label: 'اتباعت' },
            { value: 'HIDDEN', label: 'مخفية' },
          ]}
        />
        <Select
          placeholder="مميّزة أو لأ"
          clearable
          w={150}
          value={values.featured || null}
          onChange={(value) => set('featured', value)}
          data={[
            { value: 'true', label: 'مميّزة' },
            { value: 'false', label: 'عادية' },
          ]}
        />
        {values.sellerId && (
          <Badge
            size="lg"
            variant="light"
            style={{ cursor: 'pointer' }}
            onClick={() => set('sellerId', null)}
          >
            بائع واحد ✕
          </Badge>
        )}
      </Group>
      <QueryState
        isLoading={query.isLoading}
        error={query.error}
        isEmpty={data?.items.length === 0}
        empty="مفيش إعلانات بالبحث ده"
        onRetry={() => query.refetch()}
      >
        {data && (
          <>
            <Table.ScrollContainer minWidth={820}>
              <Table highlightOnHover verticalSpacing="sm">
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>القطعة</Table.Th>
                    <Table.Th>السعر</Table.Th>
                    <Table.Th>البائع</Table.Th>
                    <Table.Th>الحالة</Table.Th>
                    <Table.Th>بلاغات</Table.Th>
                    <Table.Th>اتنشرت</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {data.items.map((part) => (
                    <Table.Tr
                      key={part.id}
                      style={{ cursor: 'pointer' }}
                      onClick={() => navigate(`/parts/${part.id}`)}
                    >
                      <Table.Td>
                        <Group gap="sm" wrap="nowrap">
                          <PartThumb part={part} size={40} />
                          <div>
                            <Group gap={4}>
                              <Text size="sm" fw={600} lineClamp={1}>
                                {part.name}
                              </Text>
                              {part.isFeatured && (
                                <Badge size="xs" color="orange">
                                  مميّز
                                </Badge>
                              )}
                            </Group>
                            <Text size="xs" c="dimmed">
                              {label(categories, part.category)} · {label(conditions, part.condition)} ·{' '}
                              {part.city}
                            </Text>
                          </div>
                        </Group>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm">{formatPrice(part.price)}</Text>
                      </Table.Td>
                      <Table.Td onClick={(event) => event.stopPropagation()}>
                        <Anchor component={Link} to={`/users/${part.seller.id}`} size="sm">
                          {part.seller.name}
                        </Anchor>
                      </Table.Td>
                      <Table.Td>
                        <PartStateBadge part={part} />
                      </Table.Td>
                      <Table.Td>
                        <Text c={part.openReports ? 'red' : 'dimmed'} fw={part.openReports ? 700 : 400}>
                          {part.openReports ?? 0}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm">{formatDate(part.createdAt)}</Text>
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
