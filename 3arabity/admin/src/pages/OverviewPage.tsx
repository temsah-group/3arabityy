import { Button, Card, Group, SimpleGrid, Stack, Text, Title } from '@mantine/core'
import { Link } from 'react-router'

import type { Overview } from '../api/types'
import { QueryState } from '../components/common'
import { useApi } from '../hooks'

const number = new Intl.NumberFormat('ar-EG')

function Stat({ label, value, hint, to }: { label: string; value: number; hint?: string; to: string }) {
  return (
    <Card withBorder padding="lg" component={Link} to={to}>
      <Text size="sm" c="dimmed">
        {label}
      </Text>
      <Text fw={700} fz={28}>
        {number.format(value)}
      </Text>
      {hint && (
        <Text size="xs" c="dimmed">
          {hint}
        </Text>
      )}
    </Card>
  )
}

export function OverviewPage() {
  const query = useApi<Overview>('/overview')
  const data = query.data
  return (
    <Stack>
      <Title order={2}>الرئيسية</Title>
      <QueryState isLoading={query.isLoading} error={query.error} onRetry={() => query.refetch()}>
        {data && (
          <>
            {data.reports.openTargets > 0 && (
              <Card withBorder bg="var(--mantine-color-orange-light)">
                <Group justify="space-between">
                  <Text fw={600}>
                    فيه {number.format(data.reports.openTargets)} إعلان أو بائع عليهم بلاغات مستنية مراجعة
                  </Text>
                  <Button component={Link} to="/reports" color="orange">
                    راجع البلاغات
                  </Button>
                </Group>
              </Card>
            )}
            <SimpleGrid cols={{ base: 1, xs: 2, md: 4 }}>
              <Stat label="بلاغات مفتوحة" value={data.reports.openTargets} to="/reports" />
              <Stat
                label="المستخدمين"
                value={data.users.total}
                hint={`${number.format(data.users.thisWeek)} جديد الأسبوع ده`}
                to="/users"
              />
              <Stat
                label="قطع معروضة"
                value={data.parts.forSale}
                hint={`${number.format(data.parts.thisWeek)} اتنشرت الأسبوع ده`}
                to="/parts?status=FOR_SALE"
              />
              <Stat label="بائعين موثّقين" value={data.users.verifiedSellers} to="/users?verified=true" />
              <Stat label="حسابات موقوفة" value={data.users.suspended} to="/users?status=SUSPENDED" />
              <Stat label="إعلانات مخفية" value={data.parts.hidden} to="/parts?status=HIDDEN" />
            </SimpleGrid>
          </>
        )}
      </QueryState>
    </Stack>
  )
}
