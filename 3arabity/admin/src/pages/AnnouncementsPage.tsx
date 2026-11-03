import {
  Alert,
  Badge,
  Button,
  Card,
  Checkbox,
  Group,
  Modal,
  SegmentedControl,
  Stack,
  Text,
  TextInput,
  Textarea,
  Title,
} from '@mantine/core'
import { IconSend } from '@tabler/icons-react'
import { useState } from 'react'
import { Navigate } from 'react-router'

import { api, ApiError } from '../api/client'
import type { Announcement, Audience, Page } from '../api/types'
import { useSession } from '../auth/session'
import { Pager, QueryState } from '../components/common'
import { useAfterChange, useApi, useFilters } from '../hooks'
import { audiences, formatDateTime, label } from '../labels'

const errorText = (error: unknown) => (error instanceof ApiError ? error.message : 'حصل خطأ، جرّب تاني')
const number = new Intl.NumberFormat('ar-EG')

const empty = {
  titleAr: '',
  titleEn: '',
  bodyAr: '',
  bodyEn: '',
  audience: 'ALL' as Audience,
  inbox: true,
  banner: false,
  /** `datetime-local`, in the admin's time; empty means until taken down. */
  bannerUntil: '',
}

/** Writes the announcement in both languages, then asks before sending it. */
function Composer() {
  const afterChange = useAfterChange()
  const [form, setForm] = useState(empty)
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const set = <K extends keyof typeof empty>(key: K, value: (typeof empty)[K]) => setForm({ ...form, [key]: value })
  const filled = [form.titleAr, form.titleEn, form.bodyAr, form.bodyEn].every((value) => value.trim())
  const ready = filled && (form.inbox || form.banner)

  const send = async () => {
    setBusy(true)
    setError(null)
    try {
      const sent = await api<Announcement>('/announcements', {
        method: 'POST',
        body: {
          ...form,
          bannerUntil: form.banner && form.bannerUntil ? new Date(form.bannerUntil).toISOString() : null,
        },
      })
      setForm(empty)
      setConfirming(false)
      await afterChange(
        sent.inbox ? `اتبعت لـ ${number.format(sent.recipients)} مستخدم` : 'الرسالة ظاهرة في الرئيسية',
      )
    } catch (caught) {
      setError(errorText(caught))
      setConfirming(false)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card withBorder>
      <Stack>
        <div>
          <Title order={4}>رسالة جديدة</Title>
          <Text size="sm" c="dimmed">
            بيوصل في الإشعارات جوه التطبيق، وبيظهر بلغة المستخدم.
          </Text>
        </div>
        <Group grow align="flex-start">
          <TextInput
            label="العنوان بالعربي"
            maxLength={80}
            value={form.titleAr}
            onChange={(event) => set('titleAr', event.currentTarget.value)}
          />
          <TextInput
            label="العنوان بالإنجليزي"
            dir="ltr"
            maxLength={80}
            value={form.titleEn}
            onChange={(event) => set('titleEn', event.currentTarget.value)}
          />
        </Group>
        <Group grow align="flex-start">
          <Textarea
            label="الرسالة بالعربي"
            autosize
            minRows={3}
            maxLength={500}
            value={form.bodyAr}
            onChange={(event) => set('bodyAr', event.currentTarget.value)}
          />
          <Textarea
            label="الرسالة بالإنجليزي"
            dir="ltr"
            autosize
            minRows={3}
            maxLength={500}
            value={form.bodyEn}
            onChange={(event) => set('bodyEn', event.currentTarget.value)}
          />
        </Group>
        <div>
          <Text size="sm" fw={500} mb={4}>
            يوصل لمين
          </Text>
          <SegmentedControl
            value={form.audience}
            onChange={(value) => set('audience', value as Audience)}
            data={[
              { value: 'ALL', label: audiences.ALL! },
              { value: 'SELLERS', label: 'اللي نزّلوا قطع' },
            ]}
          />
        </div>
        <Checkbox
          label="في الإشعارات"
          description="للي عامل حساب، والحسابات الموقوفة لأ"
          checked={form.inbox}
          onChange={(event) => set('inbox', event.currentTarget.checked)}
        />
        <Checkbox
          label="كبانر في الرئيسية"
          description="لكل اللي فاتح التطبيق، حتى من غير حساب. بيظهر أحدث بانر بس، ويقدر المستخدم يقفله."
          checked={form.banner}
          onChange={(event) => set('banner', event.currentTarget.checked)}
        />
        {form.banner && (
          <TextInput
            type="datetime-local"
            label="يفضل ظاهر لحد"
            description="سيبه فاضي عشان يفضل لحد ما تشيله"
            w={260}
            value={form.bannerUntil}
            onChange={(event) => set('bannerUntil', event.currentTarget.value)}
          />
        )}
        {error && (
          <Alert color="red" variant="light">
            {error}
          </Alert>
        )}
        <Group justify="flex-end">
          <Button leftSection={<IconSend size={16} />} disabled={!ready} onClick={() => setConfirming(true)}>
            ابعت
          </Button>
        </Group>
      </Stack>

      <Modal opened={confirming} onClose={() => !busy && setConfirming(false)} title="تبعت الرسالة؟">
        <Stack>
          <Text size="sm">
            {form.inbox && `هيوصل في إشعارات ${label(audiences, form.audience)}.`}{' '}
            {form.banner && 'وهيظهر في الرئيسية لكل اللي فاتح التطبيق.'} الإشعار مينفعش يتعدّل بعد ما
            يتبعت، بس تقدر تمسحه.
          </Text>
          <Card withBorder padding="sm">
            <Text fw={600}>{form.titleAr}</Text>
            <Text size="sm">{form.bodyAr}</Text>
          </Card>
          <Group justify="flex-end">
            <Button variant="default" disabled={busy} onClick={() => setConfirming(false)}>
              رجوع
            </Button>
            <Button loading={busy} onClick={send}>
              ابعت
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Card>
  )
}

function SentAnnouncement({ item }: { item: Announcement }) {
  const afterChange = useAfterChange()
  const [busy, setBusy] = useState<'end' | 'remove' | null>(null)
  const [removing, setRemoving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const run = async (kind: 'end' | 'remove') => {
    setBusy(kind)
    setError(null)
    try {
      if (kind === 'end') await api(`/announcements/${item.id}/end`, { method: 'POST' })
      else await api(`/announcements/${item.id}`, { method: 'DELETE' })
      setRemoving(false)
      await afterChange(kind === 'end' ? 'البانر اتشال من الرئيسية' : 'الرسالة اتمسحت')
    } catch (caught) {
      setError(errorText(caught))
    } finally {
      setBusy(null)
    }
  }

  return (
    <Card withBorder>
      <Stack gap="xs">
        <Group justify="space-between" align="flex-start">
          <div>
            <Text fw={600}>{item.titleAr}</Text>
            <Text size="xs" c="dimmed">
              {formatDateTime(item.createdAt)} · {item.adminEmail}
            </Text>
          </div>
          <Group gap={6}>
            {item.inbox && (
              <Badge variant="light">
                {label(audiences, item.audience)} · {number.format(item.recipients)}
              </Badge>
            )}
            {item.banner &&
              (item.bannerLive ? (
                <Badge color="green" variant="light">
                  ظاهر في الرئيسية
                </Badge>
              ) : (
                <Badge color="gray" variant="light">
                  البانر خلص
                </Badge>
              ))}
          </Group>
        </Group>
        <Text size="sm">{item.bodyAr}</Text>
        {item.bannerLive && item.bannerUntil && (
          <Text size="xs" c="dimmed">
            ظاهر لحد {formatDateTime(item.bannerUntil)}
          </Text>
        )}
        {error && (
          <Alert color="red" variant="light">
            {error}
          </Alert>
        )}
        <Group justify="flex-end" gap="xs">
          {item.bannerLive && (
            <Button size="xs" variant="light" loading={busy === 'end'} onClick={() => run('end')}>
              شيل البانر
            </Button>
          )}
          <Button size="xs" variant="subtle" color="red" onClick={() => setRemoving(true)}>
            امسح
          </Button>
        </Group>
      </Stack>
      <Modal opened={removing} onClose={() => !busy && setRemoving(false)} title="تمسح الرسالة؟">
        <Stack>
          <Text size="sm">هتتشال من إشعارات كل اللي وصلهم ومن الرئيسية. مينفعش ترجّعه.</Text>
          <Group justify="flex-end">
            <Button variant="default" disabled={busy !== null} onClick={() => setRemoving(false)}>
              رجوع
            </Button>
            <Button color="red" loading={busy === 'remove'} onClick={() => run('remove')}>
              امسح
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Card>
  )
}

/** Messages from 3arabity to its users. Owners only. */
export function AnnouncementsPage() {
  const { isOwner } = useSession()
  const { page, set } = useFilters([] as const)
  const query = useApi<Page<Announcement>>('/announcements', { page })
  if (!isOwner) return <Navigate to="/" replace />
  const data = query.data

  return (
    <Stack>
      <Title order={2}>رسايل للمستخدمين</Title>
      <Composer />
      <Title order={4}>اللي اتبعت</Title>
      <QueryState
        isLoading={query.isLoading}
        error={query.error}
        isEmpty={data?.items.length === 0}
        empty="مفيش رسايل اتبعتت لسه"
        onRetry={() => query.refetch()}
      >
        {data && (
          <>
            {data.items.map((item) => (
              <SentAnnouncement key={item.id} item={item} />
            ))}
            <Pager page={data} onChange={(next) => set('page', next)} />
          </>
        )}
      </QueryState>
    </Stack>
  )
}
