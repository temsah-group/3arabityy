import { Anchor, Badge, Group, SegmentedControl, Stack, Table, Text, Title } from '@mantine/core'
import { Link, useNavigate } from 'react-router'

import type { ShopsPage as ShopsData, ShopStatus } from '../api/types'
import { SearchBox } from '../components/SearchBox'
import { Pager, QueryState, ShopLogo, ShopStatusBadge } from '../components/common'
import { useApi, useFilters } from '../hooks'
import { formatDate, shopStatuses } from '../labels'

const tabs: ShopStatus[] = ['PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED']

export function ShopsPage() {
  const navigate = useNavigate()
  const { values, page, set } = useFilters(['q', 'status'] as const)
  // New applications first: they are what needs doing.
  const status = (values.status || 'PENDING') as ShopStatus
  const query = useApi<ShopsData>('/shops', { q: values.q.trim() || undefined, status, page })
  const data = query.data

  return (
    <Stack>
      <Title order={2}>المحلات</Title>
      <Group>
        <SegmentedControl
          value={status}
          onChange={(value) => set('status', value)}
          data={tabs.map((value) => ({
            value,
            label: `${shopStatuses[value]}${data?.counts?.[value] ? ` (${data.counts[value]})` : ''}`,
          }))}
        />
        <SearchBox value={values.q} onSearch={(q) => set('q', q)} placeholder="اسم المحل أو تليفونه أو المحافظة" />
      </Group>
      <QueryState
        isLoading={query.isLoading}
        error={query.error}
        isEmpty={data?.items.length === 0}
        empty={status === 'PENDING' ? 'مفيش طلبات جديدة' : 'مفيش محلات هنا'}
        onRetry={() => query.refetch()}
      >
        {data && (
          <>
            <Table.ScrollContainer minWidth={820}>
              <Table highlightOnHover verticalSpacing="sm">
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>المحل</Table.Th>
                    <Table.Th>صاحبه</Table.Th>
                    <Table.Th>التوصيل</Table.Th>
                    <Table.Th>القطع</Table.Th>
                    <Table.Th>التقييم</Table.Th>
                    <Table.Th>الحالة</Table.Th>
                    <Table.Th>قدّم</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {data.items.map((shop) => (
                    <Table.Tr
                      key={shop.id}
                      style={{ cursor: 'pointer' }}
                      onClick={() => navigate(`/shops/${shop.id}`)}
                    >
                      <Table.Td>
                        <Group gap="sm" wrap="nowrap">
                          <ShopLogo shop={shop} size={40} />
                          <div>
                            <Group gap={4}>
                              <Text size="sm" fw={600} lineClamp={1}>
                                {shop.name}
                              </Text>
                              {shop.featured && (
                                <Badge size="xs" color="orange">
                                  مميّز
                                </Badge>
                              )}
                              {shop.verified && (
                                <Badge size="xs" color="orange" variant="light">
                                  موثّق
                                </Badge>
                              )}
                            </Group>
                            <Text size="xs" c="dimmed">
                              {shop.city} · <span dir="ltr">{shop.phone}</span>
                            </Text>
                          </div>
                        </Group>
                      </Table.Td>
                      <Table.Td onClick={(event) => event.stopPropagation()}>
                        {shop.owner ? (
                          <Anchor component={Link} to={`/users/${shop.owner.id}`} size="sm">
                            {shop.owner.fullName}
                          </Anchor>
                        ) : (
                          <Text size="sm" c="dimmed">
                            —
                          </Text>
                        )}
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm">
                          {shop.delivery.available
                            ? `${shop.delivery.governorates.length} محافظة`
                            : 'لا'}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm">{shop.partsCount}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm">
                          {shop.rating.count ? `${shop.rating.avg} ★ (${shop.rating.count})` : '—'}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <ShopStatusBadge shop={shop} />
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm">{formatDate(shop.createdAt)}</Text>
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
