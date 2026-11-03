import { Anchor, Badge, Button, Card, Group, Stack, Text, Title } from '@mantine/core'
import { IconArrowRight } from '@tabler/icons-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'

import { api } from '../api/client'
import type { Account, PartRow, ReportAction, ReportsOn, ReviewRow } from '../api/types'
import { NoteModal, type NoteRequest } from '../components/NoteModal'
import {
  AccountStatusBadge,
  PartStateBadge,
  PartThumb,
  QueryState,
  VerifiedBadge,
} from '../components/common'
import { useAfterChange, useApi } from '../hooks'
import { formatDateTime, formatPrice, label, reasons, reportActions, stars } from '../labels'
import { ReviewTarget } from './ReviewsPage'

function PartSubject({ part }: { part: PartRow }) {
  return (
    <Group wrap="nowrap" align="flex-start">
      <PartThumb part={part} size={72} />
      <Stack gap={4}>
        <Anchor component={Link} to={`/parts/${part.id}`} fw={700}>
          {part.name}
        </Anchor>
        <Text size="sm">{formatPrice(part.price)} · {part.city}</Text>
        <Group gap={6}>
          <PartStateBadge part={part} />
          <Text size="sm" c="dimmed">
            البائع:
          </Text>
          <Anchor component={Link} to={`/users/${part.seller.id}`} size="sm">
            {part.seller.name}
          </Anchor>
          <AccountStatusBadge status={part.seller.accountStatus} />
        </Group>
      </Stack>
    </Group>
  )
}

function AccountSubject({ account }: { account: Account }) {
  return (
    <Stack gap={4}>
      <Group gap="xs">
        <Anchor component={Link} to={`/users/${account.id}`} fw={700}>
          {account.fullName}
        </Anchor>
        <AccountStatusBadge status={account.accountStatus} />
        <VerifiedBadge verified={account.isVerifiedSeller} />
      </Group>
      <Text size="sm" dir="ltr" ta="right">
        {account.email} · {account.phone}
      </Text>
    </Stack>
  )
}

function ReviewSubject({ review }: { review: ReviewRow }) {
  return (
    <Stack gap={4}>
      <Group gap="xs">
        <Text c="orange.6">{stars(review.rating)}</Text>
        {review.hidden && <Badge color="red" variant="light">مخفي</Badge>}
      </Group>
      {review.text && <Text>{review.text}</Text>}
      <Text size="sm" c="dimmed">
        على <ReviewTarget review={review} /> · كتبه{' '}
        {review.author ? (
          <Anchor component={Link} to={`/users/${review.author.id}`} size="sm">
            {review.author.fullName}
          </Anchor>
        ) : (
          'حساب اتمسح'
        )}
      </Text>
    </Stack>
  )
}

const titles = { PART: 'بلاغات على إعلان', SELLER: 'بلاغات على بائع', REVIEW: 'بلاغات على تقييم' }

export function ReportPage() {
  const { target = '', id = '' } = useParams()
  const navigate = useNavigate()
  const afterChange = useAfterChange()
  const query = useApi<ReportsOn>(`/reports/${target}/${id}`)
  const [request, setRequest] = useState<NoteRequest | null>(null)
  const data = query.data
  const open = data?.reports.filter((report) => report.status === 'OPEN') ?? []
  const isPart = target === 'PART'
  const isReview = target === 'REVIEW'

  const resolve = (action: ReportAction, danger: boolean, description: string) =>
    setRequest({
      title: label(reportActions, action),
      description: `${description} البلاغات المفتوحة (${open.length}) هتتقفل.`,
      confirmLabel: label(reportActions, action),
      danger,
      noteRequired: action !== 'DISMISS',
      run: async (note) => {
        await api(`/reports/${target}/${id}/resolve`, { method: 'POST', body: { action, note } })
        await afterChange('اتقفلت البلاغات')
        navigate('/reports')
      },
    })

  return (
    <Stack>
      <Group>
        <Button
          variant="subtle"
          leftSection={<IconArrowRight size={16} />}
          component={Link}
          to="/reports"
        >
          البلاغات
        </Button>
      </Group>
      <Title order={2}>{titles[target as keyof typeof titles] ?? titles.SELLER}</Title>
      <QueryState isLoading={query.isLoading} error={query.error} onRetry={() => query.refetch()}>
        {data && (
          <>
            <Card withBorder>
              {data.subject ? (
                isPart ? (
                  <PartSubject part={data.subject as PartRow} />
                ) : isReview ? (
                  <ReviewSubject review={data.subject as ReviewRow} />
                ) : (
                  <AccountSubject account={data.subject as Account} />
                )
              ) : (
                <Text c="dimmed">
                  {isPart ? 'الإعلان ده اتمسح' : isReview ? 'التقييم ده اتمسح' : 'الحساب ده اتمسح'}
                </Text>
              )}
            </Card>

            {open.length > 0 && (
              <Group>
                <Button
                  variant="default"
                  onClick={() => resolve('DISMISS', false, 'البلاغات مش في محلها.')}
                >
                  تجاهل البلاغات
                </Button>
                {isPart && data.subject && !(data.subject as PartRow).hiddenAt && (
                  <Button
                    color="orange"
                    onClick={() =>
                      resolve('HIDE_PART', false, 'الإعلان هيختفي من عند المشترين، والبائع هيوصله إشعار.')
                    }
                  >
                    إخفاء الإعلان
                  </Button>
                )}
                {isPart && data.subject && (
                  <Button
                    color="red"
                    variant="light"
                    onClick={() =>
                      resolve('REMOVE_PART', true, 'الإعلان وصوره هيتمسحوا نهائياً، والبائع هيوصله إشعار.')
                    }
                  >
                    مسح الإعلان
                  </Button>
                )}
                {isReview && data.subject && !(data.subject as ReviewRow).hidden && (
                  <Button
                    color="orange"
                    onClick={() =>
                      resolve('HIDE_REVIEW', false, 'التقييم هيختفي من التطبيق ومش هيتحسب في التقييم.')
                    }
                  >
                    إخفاء التقييم
                  </Button>
                )}
                {data.subject && (
                  <Button
                    color="red"
                    onClick={() =>
                      resolve(
                        'SUSPEND_SELLER',
                        true,
                        isReview
                          ? 'كاتب التقييم هيخرج من كل أجهزته ومش هيقدر يدخل.'
                          : 'البائع هيخرج من كل أجهزته ومش هيقدر يدخل، وكل إعلاناته هتختفي.',
                      )
                    }
                  >
                    {isReview ? 'إيقاف كاتب التقييم' : 'إيقاف البائع'}
                  </Button>
                )}
              </Group>
            )}

            <Title order={4}>البلاغات ({data.reports.length})</Title>
            <Stack gap="sm">
              {data.reports.map((report) => (
                <Card key={report.id} withBorder padding="sm">
                  <Group justify="space-between" align="flex-start">
                    <Stack gap={4}>
                      <Group gap="xs">
                        <Badge variant="light" color="red">
                          {label(reasons, report.reason)}
                        </Badge>
                        {report.status === 'CLOSED' && <Badge color="gray">مقفول</Badge>}
                      </Group>
                      {report.details && <Text size="sm">{report.details}</Text>}
                      <Text size="xs" c="dimmed">
                        {report.reporter ? (
                          <Anchor component={Link} to={`/users/${report.reporter.id}`} size="xs">
                            {report.reporter.fullName}
                          </Anchor>
                        ) : (
                          'حساب اتمسح'
                        )}{' '}
                        · {formatDateTime(report.createdAt)}
                      </Text>
                    </Stack>
                    {report.resolution && (
                      <Stack gap={2} align="flex-end">
                        <Text size="xs" fw={600}>
                          {label(reportActions, report.resolution.action)}
                        </Text>
                        {report.resolution.note && (
                          <Text size="xs" c="dimmed">
                            {report.resolution.note}
                          </Text>
                        )}
                        <Text size="xs" c="dimmed">
                          {formatDateTime(report.resolution.at)}
                        </Text>
                      </Stack>
                    )}
                  </Group>
                </Card>
              ))}
            </Stack>
          </>
        )}
      </QueryState>
      <NoteModal request={request} onClose={() => setRequest(null)} />
    </Stack>
  )
}
