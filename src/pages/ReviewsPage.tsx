import { Anchor, Badge, Button, Group, Select, Stack, Table, Text, Title } from '@mantine/core'
import { useState } from 'react'
import { Link } from 'react-router'

import { api } from '../api/client'
import type { Page, ReviewRow } from '../api/types'
import { NoteModal, type NoteRequest } from '../components/NoteModal'
import { Pager, QueryState } from '../components/common'
import { useAfterChange, useApi, useFilters } from '../hooks'
import { formatDate, stars } from '../labels'

/** What a review is about, linked where the dashboard has a page for it. */
export function ReviewTarget({ review }: { review: ReviewRow }) {
  const name = review.targetName ?? 'اتمسح'
  return review.target === 'PART' ? (
    <Anchor component={Link} to={`/parts/${review.targetId}`} size="sm">
      {name}
    </Anchor>
  ) : (
    <Anchor component={Link} to={`/shops/${review.targetId}`} size="sm">
      {name}
    </Anchor>
  )
}

export function ReviewsPage() {
  const afterChange = useAfterChange()
  const { values, page, set } = useFilters(['hidden', 'target', 'sellerId'] as const)
  const query = useApi<Page<ReviewRow>>('/reviews', {
    hidden: values.hidden || undefined,
    target: values.target || undefined,
    sellerId: values.sellerId || undefined,
    page,
  })
  const [request, setRequest] = useState<NoteRequest | null>(null)
  const data = query.data

  const setHidden = (review: ReviewRow, hidden: boolean) =>
    setRequest({
      title: hidden ? 'إخفاء التقييم' : 'إظهار التقييم',
      description: hidden
        ? 'التقييم هيختفي من التطبيق ومش هيتحسب في التقييم.'
        : 'التقييم هيرجع يظهر ويتحسب.',
      confirmLabel: hidden ? 'اخفي' : 'أظهر',
      danger: hidden,
      noteRequired: hidden,
      run: async (note) => {
        await api(`/reviews/${review.id}`, { method: 'PATCH', body: { hidden, note } })
        await afterChange()
      },
    })

  return (
    <Stack>
      <Title order={2}>التقييمات</Title>
      <Group>
        <Select
          placeholder="محلات وقطع"
          clearable
          w={150}
          value={values.target || null}
          onChange={(value) => set('target', value)}
          data={[
            { value: 'SHOP', label: 'محلات' },
            { value: 'PART', label: 'قطع' },
          ]}
        />
        <Select
          placeholder="ظاهرة ومخفية"
          clearable
          w={150}
          value={values.hidden || null}
          onChange={(value) => set('hidden', value)}
          data={[
            { value: 'false', label: 'ظاهرة' },
            { value: 'true', label: 'مخفية' },
          ]}
        />
        {values.sellerId && (
          <Badge size="lg" variant="light" style={{ cursor: 'pointer' }} onClick={() => set('sellerId', null)}>
            بائع واحد ✕
          </Badge>
        )}
      </Group>
      <QueryState
        isLoading={query.isLoading}
        error={query.error}
        isEmpty={data?.items.length === 0}
        empty="مفيش تقييمات"
        onRetry={() => query.refetch()}
      >
        {data && (
          <>
            <Table.ScrollContainer minWidth={860}>
              <Table verticalSpacing="sm">
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>التقييم</Table.Th>
                    <Table.Th>على</Table.Th>
                    <Table.Th>كاتبه</Table.Th>
                    <Table.Th>التاريخ</Table.Th>
                    <Table.Th />
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {data.items.map((review) => (
                    <Table.Tr key={review.id} opacity={review.hidden ? 0.6 : 1}>
                      <Table.Td maw={380}>
                        <Group gap={6}>
                          <Text c="orange.6" size="sm">
                            {stars(review.rating)}
                          </Text>
                          {review.hidden && (
                            <Badge size="xs" color="red" variant="light">
                              مخفي
                            </Badge>
                          )}
                        </Group>
                        {review.text && <Text size="sm">{review.text}</Text>}
                        {review.reply && (
                          <Text size="xs" c="dimmed">
                            رد البياع: {review.reply.text}
                          </Text>
                        )}
                      </Table.Td>
                      <Table.Td>
                        <Stack gap={0}>
                          <ReviewTarget review={review} />
                          <Text size="xs" c="dimmed">
                            {review.target === 'SHOP' ? 'محل' : 'قطعة'}
                          </Text>
                        </Stack>
                      </Table.Td>
                      <Table.Td>
                        {review.author ? (
                          <Anchor component={Link} to={`/users/${review.author.id}`} size="sm">
                            {review.author.fullName}
                          </Anchor>
                        ) : (
                          <Text size="sm" c="dimmed">
                            —
                          </Text>
                        )}
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm">{formatDate(review.createdAt)}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Button
                          size="xs"
                          variant="light"
                          color={review.hidden ? 'green' : 'red'}
                          onClick={() => setHidden(review, !review.hidden)}
                        >
                          {review.hidden ? 'أظهر' : 'اخفي'}
                        </Button>
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
      <NoteModal request={request} onClose={() => setRequest(null)} />
    </Stack>
  )
}
