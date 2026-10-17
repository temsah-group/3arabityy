import { Group, Select, Stack, Table, Text, Title } from '@mantine/core'
import { useNavigate } from 'react-router'

import type { AccountRow, Page } from '../api/types'
import { SearchBox } from '../components/SearchBox'
import { AccountStatusBadge, Pager, QueryState, VerifiedBadge } from '../components/common'
import { useApi, useFilters } from '../hooks'
import { formatDate } from '../labels'

export function UsersPage() {
  const navigate = useNavigate()
  const { values, page, set } = useFilters(['q', 'status', 'verified'] as const)
  const query = useApi<Page<AccountRow>>('/users', {
    q: values.q.trim() || undefined,
    status: values.status || undefined,
    verified: values.verified || undefined,
    page,
  })
  const data = query.data

  return (
    <Stack>
      <Title order={2}>المستخدمين</Title>
      <Group>
        <SearchBox
          value={values.q}
          onSearch={(q) => set('q', q)}
          placeholder="اسم أو إيميل أو موبايل"
        />
        <Select
          placeholder="كل الحالات"
          clearable
          w={150}
          value={values.status || null}
          onChange={(value) => set('status', value)}
          data={[
            { value: 'ACTIVE', label: 'نشط' },
            { value: 'SUSPENDED', label: 'موقوف' },
          ]}
        />
        <Select
          placeholder="موثّق أو لأ"
          clearable
          w={150}
          value={values.verified || null}
          onChange={(value) => set('verified', value)}
          data={[
            { value: 'true', label: 'موثّق' },
            { value: 'false', label: 'مش موثّق' },
          ]}
        />
      </Group>
      <QueryState
        isLoading={query.isLoading}
        error={query.error}
        isEmpty={data?.items.length === 0}
        empty="مفيش مستخدمين بالبحث ده"
        onRetry={() => query.refetch()}
      >
        {data && (
          <>
            <Table.ScrollContainer minWidth={760}>
              <Table highlightOnHover verticalSpacing="sm">
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>الاسم</Table.Th>
                    <Table.Th>التواصل</Table.Th>
                    <Table.Th>الحالة</Table.Th>
                    <Table.Th>الإعلانات</Table.Th>
                    <Table.Th>بلاغات مفتوحة</Table.Th>
                    <Table.Th>اشترك</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {data.items.map((user) => (
                    <Table.Tr
                      key={user.id}
                      style={{ cursor: 'pointer' }}
                      onClick={() => navigate(`/users/${user.id}`)}
                    >
                      <Table.Td>
                        <Group gap={6}>
                          <Text size="sm" fw={600}>
                            {user.fullName}
                          </Text>
                          <VerifiedBadge verified={user.isVerifiedSeller} />
                        </Group>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm" dir="ltr" ta="right">
                          {user.email}
                        </Text>
                        <Text size="xs" c="dimmed" dir="ltr" ta="right">
                          {user.phone}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <AccountStatusBadge status={user.accountStatus} />
                      </Table.Td>
                      <Table.Td>{user.partsCount}</Table.Td>
                      <Table.Td>
                        <Text c={user.openReports > 0 ? 'red' : 'dimmed'} fw={user.openReports ? 700 : 400}>
                          {user.openReports}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm">{formatDate(user.createdAt)}</Text>
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
