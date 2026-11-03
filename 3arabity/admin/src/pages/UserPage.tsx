import { Avatar, Button, Card, Group, SimpleGrid, Stack, Switch, Text, Title } from '@mantine/core'
import { IconArrowRight } from '@tabler/icons-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router'

import { api, mediaUrl } from '../api/client'
import type { AccountDetail } from '../api/types'
import { History } from '../components/History'
import { NoteModal, type NoteRequest } from '../components/NoteModal'
import { AccountStatusBadge, QueryState, VerifiedBadge } from '../components/common'
import { useSession } from '../auth/session'
import { useAfterChange, useApi } from '../hooks'
import { formatDate } from '../labels'

function Count({ label, value, to }: { label: string; value: number; to?: string }) {
  const content = (
    <>
      <Text size="xs" c="dimmed">
        {label}
      </Text>
      <Text fw={700} size="xl">
        {value}
      </Text>
    </>
  )
  return to ? (
    <Card withBorder padding="sm" component={Link} to={to}>
      {content}
    </Card>
  ) : (
    <Card withBorder padding="sm">
      {content}
    </Card>
  )
}

export function UserPage() {
  const { id = '' } = useParams()
  const { isOwner } = useSession()
  const afterChange = useAfterChange()
  const query = useApi<AccountDetail>(`/users/${id}`)
  const [request, setRequest] = useState<NoteRequest | null>(null)
  const user = query.data
  const suspended = user?.accountStatus === 'SUSPENDED'

  const update = (body: object) => api(`/users/${id}`, { method: 'PATCH', body })

  const changeStatus = () =>
    setRequest(
      suspended
        ? {
            title: 'رجوع الحساب',
            description: 'هيقدر يدخل تاني، والإعلانات اللي اتخفت مع الإيقاف هترجع تظهر.',
            confirmLabel: 'رجّع الحساب',
            run: async (note) => {
              await update({ status: 'ACTIVE', note })
              await afterChange('الحساب رجع')
            },
          }
        : {
            title: 'إيقاف الحساب',
            description: 'هيخرج من كل أجهزته ومش هيقدر يدخل، وكل إعلاناته هتختفي من عند المشترين.',
            confirmLabel: 'أوقف الحساب',
            danger: true,
            run: async (note) => {
              await update({ status: 'SUSPENDED', note })
              await afterChange('الحساب اتوقف')
            },
          },
    )

  const setVerified = (verified: boolean) =>
    setRequest({
      title: verified ? 'توثيق البائع' : 'شيل التوثيق',
      description: verified
        ? 'علامة "بائع موثّق" هتظهر جنب اسمه في التطبيق.'
        : 'علامة "بائع موثّق" هتختفي من التطبيق.',
      confirmLabel: verified ? 'وثّق' : 'شيل التوثيق',
      noteRequired: false,
      run: async (note) => {
        await update({ verified, note })
        await afterChange()
      },
    })

  return (
    <Stack>
      <Group>
        <Button variant="subtle" leftSection={<IconArrowRight size={16} />} component={Link} to="/users">
          المستخدمين
        </Button>
      </Group>
      <QueryState isLoading={query.isLoading} error={query.error} onRetry={() => query.refetch()}>
        {user && (
          <>
            <Card withBorder>
              <Group justify="space-between" align="flex-start">
                <Group wrap="nowrap">
                  <Avatar
                    src={user.profilePhotoUrl ? mediaUrl(user.profilePhotoUrl) : null}
                    size={64}
                    radius="xl"
                  >
                    {user.fullName.slice(0, 1)}
                  </Avatar>
                  <Stack gap={4}>
                    <Group gap="xs">
                      <Title order={3}>{user.fullName}</Title>
                      <AccountStatusBadge status={user.accountStatus} />
                      <VerifiedBadge verified={user.isVerifiedSeller} />
                    </Group>
                    <Text size="sm" dir="ltr" ta="right">
                      {user.email} {user.emailVerified ? '✓' : '(مش متأكد)'} · {user.phone}
                    </Text>
                    <Text size="xs" c="dimmed">
                      اشترك {formatDate(user.createdAt)}
                    </Text>
                  </Stack>
                </Group>
                <Stack gap="xs" align="flex-end">
                  <Button color={suspended ? 'green' : 'red'} onClick={changeStatus}>
                    {suspended ? 'رجّع الحساب' : 'أوقف الحساب'}
                  </Button>
                  {isOwner && (
                    <Switch
                      label="بائع موثّق"
                      checked={user.isVerifiedSeller}
                      onChange={(event) => setVerified(event.currentTarget.checked)}
                    />
                  )}
                </Stack>
              </Group>
            </Card>

            <SimpleGrid cols={{ base: 2, sm: 3, md: 6 }}>
              <Count label="إعلانات معروضة" value={user.parts.forSale} to={`/parts?sellerId=${user.id}`} />
              <Count label="اتباعت" value={user.parts.sold} />
              <Count label="مخفية" value={user.parts.hidden} />
              <Count
                label="بلاغات على الحساب"
                value={user.reports.openOnAccount}
                to={user.reports.openOnAccount ? `/reports/SELLER/${user.id}` : undefined}
              />
              <Count label="بلاغات على إعلاناته" value={user.reports.openOnParts} />
              <Count label="بلاغات بعتها" value={user.reports.sent} />
            </SimpleGrid>

            <Card withBorder>
              <Title order={4} mb="sm">
                الإجراءات على الحساب
              </Title>
              <History entries={user.history} />
            </Card>
          </>
        )}
      </QueryState>
      <NoteModal request={request} onClose={() => setRequest(null)} />
    </Stack>
  )
}
