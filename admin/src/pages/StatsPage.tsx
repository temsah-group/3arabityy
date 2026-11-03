import {
  Anchor,
  Box,
  Card,
  Group,
  Progress,
  SegmentedControl,
  SimpleGrid,
  Stack,
  Table,
  Text,
  Title,
  Tooltip,
} from '@mantine/core'
import { useState } from 'react'
import { Link } from 'react-router'

import type { Count, Stats } from '../api/types'
import { PartThumb, QueryState } from '../components/common'
import { useApi } from '../hooks'
import { categories, formatPrice, label } from '../labels'

const number = new Intl.NumberFormat('ar-EG')
const day = new Intl.DateTimeFormat('ar-EG', { day: 'numeric', month: 'short', timeZone: 'UTC' })
/** `YYYY-MM-DD` as "17 أكتوبر"; read as UTC so it stays that day. */
const formatDay = (date: string) => day.format(new Date(`${date}T00:00:00Z`))

function Total({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <Card withBorder padding="md">
      <Text size="sm" c="dimmed">
        {label}
      </Text>
      <Text fw={700} fz={24}>
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

/** One bar per day, quiet days included; hover a bar for its number. */
function DailyBars({
  title,
  daily,
  pick,
  color,
}: {
  title: string
  daily: Stats['daily']
  pick: (day: Stats['daily'][number]) => number
  color: string
}) {
  const max = Math.max(1, ...daily.map(pick))
  const total = daily.reduce((sum, item) => sum + pick(item), 0)
  return (
    <Card withBorder>
      <Group justify="space-between" mb="sm">
        <Text fw={600}>{title}</Text>
        <Text size="sm" c="dimmed">
          {number.format(total)} في الفترة دي
        </Text>
      </Group>
      {/* Oldest on the left, like any chart, even in Arabic. */}
      <Box dir="ltr" style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 140 }}>
        {daily.map((item) => {
          const value = pick(item)
          return (
            <Tooltip key={item.date} label={`${formatDay(item.date)}: ${number.format(value)}`}>
              <Box
                aria-label={`${formatDay(item.date)}: ${value}`}
                style={{
                  flex: 1,
                  minWidth: 2,
                  height: `${Math.max(value ? 4 : 1, (value / max) * 100)}%`,
                  background: value ? `var(--mantine-color-${color}-6)` : 'var(--mantine-color-default-border)',
                  borderRadius: '3px 3px 0 0',
                }}
              />
            </Tooltip>
          )
        })}
      </Box>
      <Group justify="space-between" mt={6} dir="ltr">
        <Text size="xs" c="dimmed">
          {formatDay(daily[0]!.date)}
        </Text>
        <Text size="xs" c="dimmed">
          {formatDay(daily.at(-1)!.date)}
        </Text>
      </Group>
    </Card>
  )
}

/** Parts per category, city or car make, as bars of the largest. */
function Breakdown({ title, rows, name }: { title: string; rows: Count[]; name(row: Count): string }) {
  const max = Math.max(1, ...rows.map((row) => row.count))
  return (
    <Card withBorder>
      <Text fw={600} mb="sm">
        {title}
      </Text>
      {rows.length === 0 ? (
        <Text size="sm" c="dimmed">
          مفيش قطع معروضة
        </Text>
      ) : (
        <Stack gap="xs">
          {rows.map((row) => (
            <div key={row.key}>
              <Group justify="space-between" gap="xs">
                <Text size="sm">{name(row)}</Text>
                <Text size="sm" c="dimmed">
                  {number.format(row.count)}
                </Text>
              </Group>
              <Progress value={(row.count / max) * 100} size="sm" />
            </div>
          ))}
        </Stack>
      )}
    </Card>
  )
}

const ranges = [
  { value: '7', label: '7 أيام' },
  { value: '30', label: '30 يوم' },
  { value: '90', label: '3 شهور' },
  { value: '365', label: 'سنة' },
]

export function StatsPage() {
  const [days, setDays] = useState('30')
  const query = useApi<Stats>('/stats', { days })
  const data = query.data
  const contacts = data ? data.forSale.calls + data.forSale.whatsapps : 0

  return (
    <Stack>
      <Group justify="space-between">
        <Title order={2}>الإحصائيات</Title>
        <SegmentedControl data={ranges} value={days} onChange={setDays} />
      </Group>
      <QueryState isLoading={query.isLoading} error={query.error} onRetry={() => query.refetch()}>
        {data && (
          <>
            <SimpleGrid cols={{ base: 1, sm: 2 }}>
              <DailyBars title="مستخدمين جداد" daily={data.daily} pick={(d) => d.users} color="blue" />
              <DailyBars title="قطع اتنشرت" daily={data.daily} pick={(d) => d.parts} color="orange" />
            </SimpleGrid>

            <Text size="sm" c="dimmed">
              القطع المعروضة دلوقتي. المشاهدات والتواصل محسوبين من يوم ما كل قطعة اتنشرت.
            </Text>
            <SimpleGrid cols={{ base: 2, md: 3, lg: 6 }}>
              <Total label="قطع معروضة" value={data.forSale.parts} />
              <Total label="بائعين ليهم قطع" value={data.forSale.sellers} />
              <Total label="قطع اتباعت" value={data.forSale.sold} hint="من أول ما بدأنا" />
              <Total label="مشاهدات" value={data.forSale.views} />
              <Total label="مكالمات" value={data.forSale.calls} />
              <Total label="رسايل واتساب" value={data.forSale.whatsapps} />
            </SimpleGrid>
            {data.forSale.views > 0 && (
              <Text size="sm">
                من كل 100 مشاهدة، {number.format(Math.round((contacts / data.forSale.views) * 100))} بيتواصلوا
                مع البائع.
              </Text>
            )}

            <SimpleGrid cols={{ base: 1, md: 3 }}>
              <Breakdown title="حسب القسم" rows={data.byCategory} name={(row) => label(categories, row.key)} />
              <Breakdown title="أكتر المحافظات" rows={data.byCity} name={(row) => row.key} />
              <Breakdown title="أكتر الماركات" rows={data.byBrand} name={(row) => row.name ?? row.key} />
            </SimpleGrid>

            <Card withBorder>
              <Text fw={600} mb="sm">
                أكتر القطع اللي الناس تواصلت عليها
              </Text>
              {data.topParts.length === 0 ? (
                <Text size="sm" c="dimmed">
                  محدش تواصل على قطعة لسه
                </Text>
              ) : (
                <Table.ScrollContainer minWidth={560}>
                  <Table verticalSpacing="xs">
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>القطعة</Table.Th>
                        <Table.Th>السعر</Table.Th>
                        <Table.Th>مشاهدات</Table.Th>
                        <Table.Th>مكالمات</Table.Th>
                        <Table.Th>واتساب</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {data.topParts.map((part) => (
                        <Table.Tr key={part.id}>
                          <Table.Td>
                            <Group gap="sm" wrap="nowrap">
                              <PartThumb part={part} size={36} />
                              <div>
                                <Anchor component={Link} to={`/parts/${part.id}`} size="sm">
                                  {part.name}
                                </Anchor>
                                <Text size="xs" c="dimmed">
                                  {part.city}
                                </Text>
                              </div>
                            </Group>
                          </Table.Td>
                          <Table.Td>{formatPrice(part.price)}</Table.Td>
                          <Table.Td>{number.format(part.views)}</Table.Td>
                          <Table.Td>{number.format(part.calls)}</Table.Td>
                          <Table.Td>{number.format(part.whatsapps)}</Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                </Table.ScrollContainer>
              )}
            </Card>
          </>
        )}
      </QueryState>
    </Stack>
  )
}
