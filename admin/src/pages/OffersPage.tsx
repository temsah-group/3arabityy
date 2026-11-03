import {
  ActionIcon,
  Alert,
  Badge,
  Box,
  Button,
  Card,
  FileButton,
  Group,
  Image,
  Modal,
  Select,
  Stack,
  Switch,
  Text,
  TextInput,
  Title,
} from '@mantine/core'
import { IconArrowDown, IconArrowUp, IconPhoto, IconPlus } from '@tabler/icons-react'
import { useState } from 'react'
import { Navigate } from 'react-router'

import { api, ApiError, mediaUrl } from '../api/client'
import type { Offer } from '../api/types'
import { useSession } from '../auth/session'
import { QueryState } from '../components/common'
import { useAfterChange, useApi } from '../hooks'
import { conditions, formatDateTime } from '../labels'

const errorText = (error: unknown) => (error instanceof ApiError ? error.message : 'حصل خطأ، جرّب تاني')

/** The app shows this many at most; the rest wait their turn. */
const MAX_LIVE = 10

type Form = {
  tagAr: string
  tagEn: string
  titleAr: string
  titleEn: string
  subtitleAr: string
  subtitleEn: string
  image: string
  /** '' = the slide opens nothing. */
  condition: string
  active: boolean
  /** `datetime-local`, in the admin's time; empty means until paused. */
  endsAt: string
}

const empty: Form = {
  tagAr: '',
  tagEn: '',
  titleAr: '',
  titleEn: '',
  subtitleAr: '',
  subtitleEn: '',
  image: '',
  condition: '',
  active: true,
  endsAt: '',
}

/** `2026-11-01T18:30` in the admin's own time, as the date field wants it. */
function localInput(iso: string | null): string {
  if (!iso) return ''
  const date = new Date(iso)
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
}

function formOf(offer: Offer): Form {
  return {
    tagAr: offer.tagAr,
    tagEn: offer.tagEn,
    titleAr: offer.titleAr,
    titleEn: offer.titleEn,
    subtitleAr: offer.subtitleAr,
    subtitleEn: offer.subtitleEn,
    image: offer.image,
    condition: offer.condition ?? '',
    active: offer.active,
    endsAt: localInput(offer.endsAt),
  }
}

/** Adds a slide, or edits [offer]. */
function Editor({ offer, opened, onClose }: { offer: Offer | null; opened: boolean; onClose: () => void }) {
  const afterChange = useAfterChange()
  const [form, setForm] = useState<Form>(offer ? formOf(offer) : empty)
  const [busy, setBusy] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((current) => ({ ...current, [key]: value }))
  const ready = [form.tagAr, form.tagEn, form.titleAr, form.titleEn, form.image].every((value) => value.trim())

  const upload = async (file: File | null) => {
    if (!file) return
    setUploading(true)
    setError(null)
    try {
      const body = new FormData()
      body.append('photo', file)
      const { path } = await api<{ path: string }>('/offers/photo', {
        method: 'POST',
        body,
      })
      set('image', path)
    } catch (caught) {
      setError(errorText(caught))
    } finally {
      setUploading(false)
    }
  }

  const save = async () => {
    setBusy(true)
    setError(null)
    const body = {
      ...form,
      condition: form.condition || null,
      endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : null,
    }
    try {
      if (offer) await api(`/offers/${offer.id}`, { method: 'PATCH', body })
      else await api('/offers', { method: 'POST', body })
      onClose()
      await afterChange(offer ? 'العرض اتعدّل' : 'العرض اتضاف، وهيظهر في الرئيسية خلال دقايق')
    } catch (caught) {
      setError(errorText(caught))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal opened={opened} onClose={() => !busy && onClose()} title={offer ? 'تعديل العرض' : 'عرض جديد'} size="lg">
      <Stack>
        <div>
          <Text size="sm" fw={500} mb={4}>
            الصورة
          </Text>
          <Group align="center">
            {form.image ? (
              <Image src={mediaUrl(form.image)} w={240} h={110} radius="md" fit="cover" alt="" />
            ) : (
              <Box
                w={240}
                h={110}
                bg="gray.1"
                style={{
                  borderRadius: 8,
                  display: 'grid',
                  placeItems: 'center',
                }}
              >
                <IconPhoto color="gray" />
              </Box>
            )}
            <FileButton onChange={upload} accept="image/jpeg,image/png,image/webp">
              {(props) => (
                <Button {...props} variant="light" loading={uploading}>
                  {form.image ? 'غيّر الصورة' : 'ارفع صورة'}
                </Button>
              )}
            </FileButton>
          </Group>
          <Text size="xs" c="dimmed" mt={4}>
            عرضية (حوالي 900 × 420)، JPG أو PNG أو WebP، لحد 8 ميجا. الكلام بيتكتب فوقها، فالأحسن تكون غامقة شوية.
          </Text>
        </div>
        <Group grow align="flex-start">
          <TextInput
            label="الشارة بالعربي"
            placeholder="عرض الأسبوع"
            maxLength={24}
            value={form.tagAr}
            onChange={(event) => set('tagAr', event.currentTarget.value)}
          />
          <TextInput
            label="الشارة بالإنجليزي"
            placeholder="This week"
            dir="ltr"
            maxLength={24}
            value={form.tagEn}
            onChange={(event) => set('tagEn', event.currentTarget.value)}
          />
        </Group>
        <Group grow align="flex-start">
          <TextInput
            label="العنوان بالعربي"
            maxLength={60}
            value={form.titleAr}
            onChange={(event) => set('titleAr', event.currentTarget.value)}
          />
          <TextInput
            label="العنوان بالإنجليزي"
            dir="ltr"
            maxLength={60}
            value={form.titleEn}
            onChange={(event) => set('titleEn', event.currentTarget.value)}
          />
        </Group>
        <Group grow align="flex-start">
          <TextInput
            label="سطر تحت العنوان بالعربي"
            description="اختياري"
            maxLength={90}
            value={form.subtitleAr}
            onChange={(event) => set('subtitleAr', event.currentTarget.value)}
          />
          <TextInput
            label="سطر تحت العنوان بالإنجليزي"
            description="اختياري"
            dir="ltr"
            maxLength={90}
            value={form.subtitleEn}
            onChange={(event) => set('subtitleEn', event.currentTarget.value)}
          />
        </Group>
        <Group grow align="flex-start">
          <Select
            label="لما المستخدم يدوس عليه"
            value={form.condition}
            onChange={(value) => set('condition', value ?? '')}
            allowDeselect={false}
            data={[
              { value: '', label: 'ميفتحش حاجة' },
              { value: 'NEW', label: 'يعرض القطع الجديدة' },
              { value: 'USED', label: 'يعرض القطع المستعملة' },
              { value: 'IMPORTED', label: 'يعرض قطع الاستيراد' },
            ]}
          />
          <TextInput
            type="datetime-local"
            label="يفضل ظاهر لحد"
            description="سيبه فاضي عشان يفضل لحد ما توقفه"
            value={form.endsAt}
            onChange={(event) => set('endsAt', event.currentTarget.value)}
          />
        </Group>
        <Switch
          label="ظاهر في التطبيق"
          checked={form.active}
          onChange={(event) => set('active', event.currentTarget.checked)}
        />
        {error && (
          <Alert color="red" variant="light">
            {error}
          </Alert>
        )}
        <Group justify="flex-end">
          <Button variant="default" disabled={busy} onClick={onClose}>
            رجوع
          </Button>
          <Button loading={busy} disabled={!ready || uploading} onClick={save}>
            احفظ
          </Button>
        </Group>
      </Stack>
    </Modal>
  )
}

function OfferCard({
  offer,
  position,
  count,
  onMove,
  onEdit,
}: {
  offer: Offer
  position: number
  count: number
  onMove: (step: -1 | 1) => void
  onEdit: () => void
}) {
  const afterChange = useAfterChange()
  const [busy, setBusy] = useState<'toggle' | 'remove' | null>(null)
  const [removing, setRemoving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Active but not live: its end has passed.
  const ended = offer.active && !offer.live

  const run = async (kind: 'toggle' | 'remove') => {
    setBusy(kind)
    setError(null)
    try {
      if (kind === 'toggle')
        await api(`/offers/${offer.id}`, {
          method: 'PATCH',
          body: { active: !offer.active },
        })
      else await api(`/offers/${offer.id}`, { method: 'DELETE' })
      setRemoving(false)
      await afterChange(kind === 'remove' ? 'العرض اتمسح' : offer.active ? 'العرض اتوقف' : 'العرض رجع')
    } catch (caught) {
      setError(errorText(caught))
    } finally {
      setBusy(null)
    }
  }

  return (
    <Card withBorder data-testid={`offer-${offer.id}`}>
      <Group align="flex-start" wrap="nowrap">
        <Stack gap={4}>
          <ActionIcon variant="subtle" aria-label="لفوق" disabled={position === 0} onClick={() => onMove(-1)}>
            <IconArrowUp size={16} />
          </ActionIcon>
          <ActionIcon variant="subtle" aria-label="لتحت" disabled={position === count - 1} onClick={() => onMove(1)}>
            <IconArrowDown size={16} />
          </ActionIcon>
        </Stack>
        <Image src={mediaUrl(offer.image)} w={180} h={84} radius="md" fit="cover" alt="" />
        <Stack gap={4} style={{ flex: 1 }}>
          <Group gap={6}>
            <Badge variant="light">{offer.tagAr}</Badge>
            {offer.live && position < MAX_LIVE ? (
              <Badge color="green" variant="light">
                ظاهر
              </Badge>
            ) : (
              <Badge color="gray" variant="light">
                {ended ? 'خلص' : !offer.active ? 'متوقف' : 'مستني دوره'}
              </Badge>
            )}
            {offer.condition && (
              <Badge color="orange" variant="light">
                {conditions[offer.condition]}
              </Badge>
            )}
          </Group>
          <Text fw={600}>{offer.titleAr}</Text>
          {offer.subtitleAr && <Text size="sm">{offer.subtitleAr}</Text>}
          {offer.endsAt && (
            <Text size="xs" c="dimmed">
              {ended ? 'خلص في' : 'ظاهر لحد'} {formatDateTime(offer.endsAt)}
            </Text>
          )}
          {error && (
            <Alert color="red" variant="light">
              {error}
            </Alert>
          )}
        </Stack>
        <Stack gap={6}>
          <Button size="xs" variant="light" onClick={onEdit}>
            عدّل
          </Button>
          <Button size="xs" variant="default" loading={busy === 'toggle'} onClick={() => run('toggle')}>
            {offer.active ? 'وقّف' : 'رجّع'}
          </Button>
          <Button size="xs" variant="subtle" color="red" onClick={() => setRemoving(true)}>
            امسح
          </Button>
        </Stack>
      </Group>
      <Modal opened={removing} onClose={() => !busy && setRemoving(false)} title="تمسح العرض؟">
        <Stack>
          <Text size="sm">هيتشال من الرئيسية هو وصورته. لو عايز ترجّعه بعدين، وقّفه بدل ما تمسحه.</Text>
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

/** The slides at the top of the app's home screen. Owners only. */
export function OffersPage() {
  const { isOwner } = useSession()
  const afterChange = useAfterChange()
  const query = useApi<{ items: Offer[] }>('/offers')
  // null: closed; 'new'; or the slide being edited.
  const [editing, setEditing] = useState<Offer | 'new' | null>(null)
  const [error, setError] = useState<string | null>(null)
  if (!isOwner) return <Navigate to="/" replace />
  const items = query.data?.items ?? []

  const move = async (index: number, step: -1 | 1) => {
    const ids = items.map((offer) => offer.id)
    const [moved] = ids.splice(index, 1)
    ids.splice(index + step, 0, moved!)
    setError(null)
    try {
      await api('/offers/order', { method: 'PUT', body: { ids } })
      await afterChange('الترتيب اتحفظ')
    } catch (caught) {
      setError(errorText(caught))
    }
  }

  return (
    <Stack>
      <Group justify="space-between">
        <div>
          <Title order={2}>عروض الرئيسية</Title>
          <Text size="sm" c="dimmed">
            الشرايح اللي فوق في الصفحة الرئيسية للتطبيق، بنفس الترتيب ده. بيظهر أول {MAX_LIVE} بس، والتغيير بيوصل خلال
            دقايق.
          </Text>
        </div>
        <Button leftSection={<IconPlus size={16} />} onClick={() => setEditing('new')}>
          عرض جديد
        </Button>
      </Group>
      {error && (
        <Alert color="red" variant="light">
          {error}
        </Alert>
      )}
      <QueryState
        isLoading={query.isLoading}
        error={query.error}
        isEmpty={items.length === 0}
        empty="مفيش عروض. الرئيسية في التطبيق مش هتعرض شرايح لحد ما تضيف واحد."
        onRetry={() => query.refetch()}
      >
        {items.map((offer, index) => (
          <OfferCard
            key={offer.id}
            offer={offer}
            position={index}
            count={items.length}
            onMove={(step) => move(index, step)}
            onEdit={() => setEditing(offer)}
          />
        ))}
      </QueryState>
      {editing && (
        <Editor
          key={editing === 'new' ? 'new' : editing.id}
          offer={editing === 'new' ? null : editing}
          opened
          onClose={() => setEditing(null)}
        />
      )}
    </Stack>
  )
}
