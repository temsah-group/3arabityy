import {
  Anchor,
  Badge,
  Button,
  Card,
  Group,
  Image,
  SimpleGrid,
  Stack,
  Switch,
  Text,
  Title,
} from '@mantine/core'
import { IconArrowRight } from '@tabler/icons-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'

import { api, mediaUrl } from '../api/client'
import type { PartDetail } from '../api/types'
import { useSession } from '../auth/session'
import { History } from '../components/History'
import { NoteModal, type NoteRequest } from '../components/NoteModal'
import { AccountStatusBadge, PartStateBadge, QueryState } from '../components/common'
import { useAfterChange, useApi } from '../hooks'
import { categories, conditions, formatDateTime, formatPrice, label } from '../labels'

function Fact({ label: name, value }: { label: string; value: string | number }) {
  return (
    <div>
      <Text size="xs" c="dimmed">
        {name}
      </Text>
      <Text size="sm" fw={600}>
        {value}
      </Text>
    </div>
  )
}

export function PartPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { isOwner } = useSession()
  const afterChange = useAfterChange()
  const query = useApi<PartDetail>(`/parts/${id}`)
  const [request, setRequest] = useState<NoteRequest | null>(null)
  const part = query.data

  const update = (body: object) => api(`/parts/${id}`, { method: 'PATCH', body })

  const toggleHidden = () => {
    const hide = !part?.hiddenAt
    setRequest({
      title: hide ? 'إخفاء الإعلان' : 'إظهار الإعلان',
      description: hide
        ? 'هيختفي من البحث والرئيسية وصفحة البائع والمحفوظات، والبائع هيوصله إشعار.'
        : 'هيرجع يظهر للمشترين، والبائع هيوصله إشعار.',
      confirmLabel: hide ? 'اخفي' : 'اظهر',
      danger: hide,
      run: async (note) => {
        await update({ hidden: hide, note })
        await afterChange()
      },
    })
  }

  const remove = () =>
    setRequest({
      title: 'مسح الإعلان',
      description: 'الإعلان وصوره هيتمسحوا نهائياً ومش هينفع يرجعوا، والبائع هيوصله إشعار.',
      confirmLabel: 'امسح نهائياً',
      danger: true,
      run: async (note) => {
        await api(`/parts/${id}`, { method: 'DELETE', body: { note } })
        await afterChange('الإعلان اتمسح')
        navigate('/parts')
      },
    })

  const setFeatured = (featured: boolean) =>
    setRequest({
      title: featured ? 'تمييز الإعلان' : 'شيل التمييز',
      description: featured ? 'هيظهر في "مميّز" في الرئيسية.' : 'هيخرج من "مميّز" في الرئيسية.',
      confirmLabel: featured ? 'ميّز' : 'شيل التمييز',
      noteRequired: false,
      run: async (note) => {
        await update({ featured, note })
        await afterChange()
      },
    })

  return (
    <Stack>
      <Group>
        <Button variant="subtle" leftSection={<IconArrowRight size={16} />} component={Link} to="/parts">
          الإعلانات
        </Button>
      </Group>
      <QueryState isLoading={query.isLoading} error={query.error} onRetry={() => query.refetch()}>
        {part && (
          <>
            <Card withBorder>
              <Group justify="space-between" align="flex-start">
                <Stack gap={4}>
                  <Group gap="xs">
                    <Title order={3}>{part.name}</Title>
                    <PartStateBadge part={part} />
                    {part.isFeatured && <Badge color="orange">مميّز</Badge>}
                    {part.openReports > 0 && (
                      <Badge
                        color="red"
                        component={Link}
                        to={`/reports/PART/${part.id}`}
                        style={{ cursor: 'pointer' }}
                      >
                        {part.openReports} بلاغ مفتوح
                      </Badge>
                    )}
                  </Group>
                  <Text fw={700} size="lg">
                    {formatPrice(part.price)}
                    {part.oldPrice && (
                      <Text span td="line-through" c="dimmed" size="sm" ms="xs">
                        {formatPrice(part.oldPrice)}
                      </Text>
                    )}
                  </Text>
                  <Group gap={6}>
                    <Text size="sm" c="dimmed">
                      البائع:
                    </Text>
                    <Anchor component={Link} to={`/users/${part.seller.id}`} size="sm">
                      {part.seller.name}
                    </Anchor>
                    <AccountStatusBadge status={part.seller.accountStatus} />
                    <Text size="sm" dir="ltr">
                      {part.seller.phone}
                    </Text>
                  </Group>
                </Stack>
                <Stack gap="xs" align="flex-end">
                  {part.hiddenReason !== 'SUSPENDED' && (
                    <Button color={part.hiddenAt ? 'green' : 'orange'} onClick={toggleHidden}>
                      {part.hiddenAt ? 'اظهر الإعلان' : 'اخفي الإعلان'}
                    </Button>
                  )}
                  <Button color="red" variant="light" onClick={remove}>
                    امسح نهائياً
                  </Button>
                  {isOwner && (
                    <Switch
                      label="مميّز"
                      checked={part.isFeatured}
                      onChange={(event) => setFeatured(event.currentTarget.checked)}
                    />
                  )}
                </Stack>
              </Group>
              {part.hiddenReason === 'SUSPENDED' && (
                <Text size="sm" c="red" mt="sm">
                  مخفي لأن البائع موقوف، وهيرجع لوحده لما الحساب يرجع.
                </Text>
              )}
            </Card>

            {part.images.length > 0 && (
              <SimpleGrid cols={{ base: 2, sm: 4 }}>
                {part.images.map((image) => (
                  <Image
                    key={image}
                    src={mediaUrl(image)}
                    h={160}
                    radius="md"
                    fit="cover"
                    alt=""
                    fallbackSrc="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'/%3E"
                  />
                ))}
              </SimpleGrid>
            )}

            <Card withBorder>
              <SimpleGrid cols={{ base: 2, sm: 4 }}>
                <Fact label="القسم" value={label(categories, part.category)} />
                <Fact label="الحالة" value={label(conditions, part.condition)} />
                <Fact label="أصلي" value={part.isOriginal ? 'أصلي' : 'تجاري'} />
                <Fact label="المدينة" value={part.city} />
                <Fact label="رقم القطعة" value={part.partNumber ?? '—'} />
                <Fact label="اتنشر" value={formatDateTime(part.createdAt)} />
                <Fact label="مشاهدات" value={part.stats?.views ?? 0} />
                <Fact label="مكالمات / واتساب" value={`${part.stats?.calls ?? 0} / ${part.stats?.whatsapps ?? 0}`} />
              </SimpleGrid>
              {part.fitments.length > 0 && (
                <Group gap={4} mt="md">
                  {part.fitments.map((fit) => (
                    <Badge key={`${fit.brandId}-${fit.modelId}-${fit.fromYear}`} variant="outline" color="gray">
                      {fit.brandId} {fit.modelId} {fit.fromYear}–{fit.toYear}
                    </Badge>
                  ))}
                </Group>
              )}
              {part.description && (
                <Text size="sm" mt="md" style={{ whiteSpace: 'pre-line' }}>
                  {part.description}
                </Text>
              )}
            </Card>

            <Card withBorder>
              <Title order={4} mb="sm">
                الإجراءات على الإعلان
              </Title>
              <History entries={part.history} />
            </Card>
          </>
        )}
      </QueryState>
      <NoteModal request={request} onClose={() => setRequest(null)} />
    </Stack>
  )
}
