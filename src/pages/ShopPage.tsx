import {
  Alert,
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
import { Link, useParams } from 'react-router'

import { api, mediaUrl } from '../api/client'
import type { ShopDetail, ShopStatus } from '../api/types'
import { History } from '../components/History'
import { NoteModal, type NoteRequest } from '../components/NoteModal'
import { QueryState, ShopLogo, ShopStatusBadge } from '../components/common'
import { useSession } from '../auth/session'
import { useAfterChange, useApi } from '../hooks'
import { categories, formatDate, formatPrice, label } from '../labels'

/** One line of the shop's details; nothing when it's empty. */
function Detail({ name, children }: { name: string; children: React.ReactNode }) {
  if (children === null || children === undefined || children === '') return null
  return (
    <Group gap="xs" align="flex-start" wrap="nowrap">
      <Text size="sm" c="dimmed" w={110} style={{ flexShrink: 0 }}>
        {name}
      </Text>
      <Text size="sm" component="div">
        {children}
      </Text>
    </Group>
  )
}

/** What the owner sees, so the reason must make sense to them. */
const OWNER_SEES = 'صاحب المحل هيشوف السبب ده في الإشعار وفي التطبيق'

export function ShopPage() {
  const { id = '' } = useParams()
  const { isOwner } = useSession()
  const afterChange = useAfterChange()
  const query = useApi<ShopDetail>(`/shops/${id}`)
  const [request, setRequest] = useState<NoteRequest | null>(null)
  const shop = query.data

  const update = (body: object) => api(`/shops/${id}`, { method: 'PATCH', body })

  const setStatus = (status: ShopStatus) => {
    const restoring = status === 'APPROVED' && shop?.status === 'SUSPENDED'
    const requests: Record<string, NoteRequest> = {
      APPROVED: restoring
        ? {
            title: 'رجوع المحل',
            description: 'المحل هيرجع يظهر للمشترين، وصاحبه هيوصله إشعار.',
            confirmLabel: 'رجّع المحل',
            noteRequired: false,
            run: async (note) => {
              await update({ status, note })
              await afterChange('المحل رجع')
            },
          }
        : {
            title: 'قبول المحل',
            description:
              'المحل هيظهر للمشترين، وكل قطع صاحبه (القديمة والجديدة) هتبقى تحته. صاحبه هيوصله إشعار.',
            confirmLabel: 'اقبل المحل',
            noteRequired: false,
            run: async (note) => {
              await update({ status, note })
              await afterChange('المحل اتقبل')
            },
          },
      REJECTED: {
        title: 'رفض الطلب',
        description: 'اكتب لصاحب المحل يعدّل إيه؛ لما يعدّل الطلب بيرجع للمراجعة.',
        confirmLabel: 'ارفض الطلب',
        noteHint: OWNER_SEES,
        danger: true,
        run: async (note) => {
          await update({ status, note })
          await afterChange('الطلب اترفض')
        },
      },
      SUSPENDED: {
        title: 'إيقاف المحل',
        description: 'المحل هيختفي من عند المشترين، وصاحبه مش هيقدر يعدّله. قطعه هتفضل ظاهرة كبائع عادي.',
        confirmLabel: 'أوقف المحل',
        noteHint: OWNER_SEES,
        danger: true,
        run: async (note) => {
          await update({ status, note })
          await afterChange('المحل اتوقف')
        },
      },
    }
    setRequest(requests[status]!)
  }

  const setFlag = (flag: 'featured' | 'verified', value: boolean) =>
    setRequest({
      title:
        flag === 'featured'
          ? value
            ? 'تمييز المحل'
            : 'شيل التمييز'
          : value
            ? 'توثيق المحل'
            : 'شيل التوثيق',
      description:
        flag === 'featured'
          ? value
            ? 'المحل هيظهر أول المحلات في الرئيسية والقايمة.'
            : 'المحل هيترتب عادي بالتقييم.'
          : value
            ? 'علامة "محل موثّق" هتظهر جنب اسمه في التطبيق.'
            : 'علامة "محل موثّق" هتختفي.',
      confirmLabel: 'تمام',
      noteRequired: false,
      run: async (note) => {
        await update({ [flag]: value, note })
        await afterChange()
      },
    })

  return (
    <Stack>
      <Group>
        <Button variant="subtle" leftSection={<IconArrowRight size={16} />} component={Link} to="/shops">
          المحلات
        </Button>
      </Group>
      <QueryState isLoading={query.isLoading} error={query.error} onRetry={() => query.refetch()}>
        {shop && (
          <>
            {shop.coverUrl && (
              <Image src={mediaUrl(shop.coverUrl)} h={160} radius="md" alt="" fit="cover" />
            )}
            <Card withBorder>
              <Group justify="space-between" align="flex-start">
                <Group wrap="nowrap" align="flex-start">
                  <ShopLogo shop={shop} size={72} />
                  <Stack gap={4}>
                    <Group gap="xs">
                      <Title order={3}>{shop.name}</Title>
                      <ShopStatusBadge shop={shop} />
                      {shop.featured && <Badge color="orange">مميّز</Badge>}
                      {shop.verified && (
                        <Badge color="orange" variant="light">
                          موثّق
                        </Badge>
                      )}
                    </Group>
                    <Text size="sm">
                      {shop.city} · {shop.address}
                    </Text>
                    <Text size="xs" c="dimmed">
                      قدّم {formatDate(shop.createdAt)}
                      {shop.approvedAt && ` · اتقبل ${formatDate(shop.approvedAt)}`}
                    </Text>
                  </Stack>
                </Group>
                <Stack gap="xs" align="flex-end">
                  {(shop.status === 'PENDING' || shop.status === 'REJECTED') && (
                    <Group gap="xs">
                      <Button color="green" onClick={() => setStatus('APPROVED')}>
                        اقبل المحل
                      </Button>
                      {shop.status === 'PENDING' && (
                        <Button color="red" variant="light" onClick={() => setStatus('REJECTED')}>
                          ارفض
                        </Button>
                      )}
                    </Group>
                  )}
                  {shop.status === 'APPROVED' && (
                    <Button color="red" onClick={() => setStatus('SUSPENDED')}>
                      أوقف المحل
                    </Button>
                  )}
                  {shop.status === 'SUSPENDED' && (
                    <Button color="green" onClick={() => setStatus('APPROVED')}>
                      رجّع المحل
                    </Button>
                  )}
                  {isOwner && shop.status === 'APPROVED' && (
                    <>
                      <Switch
                        label="محل مميّز"
                        checked={shop.featured}
                        onChange={(event) => setFlag('featured', event.currentTarget.checked)}
                      />
                      <Switch
                        label="محل موثّق"
                        checked={shop.verified}
                        onChange={(event) => setFlag('verified', event.currentTarget.checked)}
                      />
                    </>
                  )}
                </Stack>
              </Group>
              {shop.statusReason && (
                <Alert color={shop.status === 'SUSPENDED' ? 'red' : 'gray'} variant="light" mt="md">
                  السبب اللي صاحب المحل شايفه: {shop.statusReason}
                </Alert>
              )}
            </Card>

            <SimpleGrid cols={{ base: 1, md: 2 }}>
              <Card withBorder>
                <Title order={4} mb="sm">
                  بيانات المحل
                </Title>
                <Stack gap={6}>
                  <Detail name="الوصف">{shop.description}</Detail>
                  <Detail name="التليفون">
                    <span dir="ltr">{shop.phone}</span>
                  </Detail>
                  <Detail name="واتساب">{shop.whatsapp && <span dir="ltr">{shop.whatsapp}</span>}</Detail>
                  <Detail name="المواعيد">{shop.hours}</Detail>
                  <Detail name="الموقع">
                    {shop.location && (
                      <Anchor
                        href={`https://maps.google.com/?q=${shop.location.lat},${shop.location.lng}`}
                        target="_blank"
                        size="sm"
                      >
                        افتح على الخريطة
                      </Anchor>
                    )}
                  </Detail>
                  <Detail name="الأقسام">
                    {shop.categories.map((value) => label(categories, value)).join('، ')}
                  </Detail>
                  <Detail name="الماركات">{shop.brandIds.join('، ')}</Detail>
                  <Detail name="صاحب المحل">
                    {shop.owner && (
                      <>
                        <Anchor component={Link} to={`/users/${shop.owner.id}`} size="sm">
                          {shop.owner.fullName}
                        </Anchor>{' '}
                        <span dir="ltr">
                          ({shop.owner.email} · {shop.owner.phone})
                        </span>
                        {shop.owner.suspended && (
                          <Badge color="red" size="xs" ms={4}>
                            موقوف
                          </Badge>
                        )}
                      </>
                    )}
                  </Detail>
                </Stack>
              </Card>
              <Card withBorder>
                <Title order={4} mb="sm">
                  التوصيل
                </Title>
                {shop.delivery.available ? (
                  <Stack gap={6}>
                    <Detail name="لـ">{shop.delivery.governorates.join('، ')}</Detail>
                    <Detail name="الرسوم">
                      {shop.delivery.feeFrom !== null &&
                        (shop.delivery.feeTo !== null && shop.delivery.feeTo !== shop.delivery.feeFrom
                          ? `${formatPrice(shop.delivery.feeFrom)} – ${formatPrice(shop.delivery.feeTo)}`
                          : formatPrice(shop.delivery.feeFrom))}
                    </Detail>
                    <Detail name="المدة">{shop.delivery.eta}</Detail>
                    <Detail name="ملاحظة">{shop.delivery.note}</Detail>
                  </Stack>
                ) : (
                  <Text c="dimmed" size="sm">
                    مش بيوصّل
                  </Text>
                )}
                <Group mt="md">
                  {shop.owner && (
                    <Button variant="light" component={Link} to={`/parts?sellerId=${shop.owner.id}`}>
                      القطع ({shop.partsCount})
                    </Button>
                  )}
                  {shop.owner && (
                    <Button variant="light" component={Link} to={`/reviews?sellerId=${shop.owner.id}`}>
                      التقييمات ({shop.rating.count})
                    </Button>
                  )}
                </Group>
              </Card>
            </SimpleGrid>

            <Card withBorder>
              <Title order={4} mb="sm">
                الإجراءات على المحل
              </Title>
              <History entries={shop.history} />
            </Card>
          </>
        )}
      </QueryState>
      <NoteModal request={request} onClose={() => setRequest(null)} />
    </Stack>
  )
}
