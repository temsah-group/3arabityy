import {
  ActionIcon,
  Alert,
  Button,
  Card,
  Group,
  Stack,
  Tabs,
  Text,
  TextInput,
  Textarea,
  Title,
  Tooltip,
} from '@mantine/core'
import { IconArrowDown, IconArrowUp, IconPlus, IconTrash } from '@tabler/icons-react'
import { useState } from 'react'
import { Navigate } from 'react-router'

import { api, ApiError } from '../api/client'
import type { AppSettings, DocumentName, Section } from '../api/types'
import { useSession } from '../auth/session'
import { QueryState } from '../components/common'
import { useAfterChange, useApi } from '../hooks'
import { formatDateTime } from '../labels'

const documents: { name: DocumentName; label: string; item: string }[] = [
  { name: 'terms', label: 'الشروط والأحكام', item: 'جزء' },
  { name: 'privacy', label: 'سياسة الخصوصية', item: 'جزء' },
  { name: 'faq', label: 'الأسئلة الشائعة', item: 'سؤال' },
]

const errorText = (error: unknown) => (error instanceof ApiError ? error.message : 'حصل خطأ، جرّب تاني')

/** Support's email, call and WhatsApp numbers, as the app shows them. */
function SupportForm({ settings }: { settings: AppSettings }) {
  const afterChange = useAfterChange()
  const [form, setForm] = useState(settings.support)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const changed = JSON.stringify(form) !== JSON.stringify(settings.support)

  const save = async () => {
    setBusy(true)
    setError(null)
    try {
      await api('/settings/support', { method: 'PUT', body: form })
      await afterChange('اتحفظت بيانات الدعم')
    } catch (caught) {
      setError(errorText(caught))
    } finally {
      setBusy(false)
    }
  }

  const field = (key: keyof AppSettings['support'], label: string, hint?: string) => (
    <TextInput
      label={label}
      description={hint}
      dir="ltr"
      value={form[key]}
      onChange={(event) => setForm({ ...form, [key]: event.currentTarget.value.trim() })}
    />
  )

  return (
    <Card withBorder>
      <Stack>
        <div>
          <Title order={4}>التواصل مع الدعم</Title>
          <Text size="sm" c="dimmed">
            بيظهر في صفحة المساعدة، وللحسابات الموقوفة لما تحاول تدخل.
          </Text>
        </div>
        {field('email', 'البريد الإلكتروني')}
        {field('phone', 'رقم المكالمات', 'بالصيغة الدولية، مثلاً ‎+201001234567')}
        {field('whatsapp', 'رقم الواتساب', 'بالصيغة الدولية، مثلاً ‎+201001234567')}
        {error && (
          <Alert color="red" variant="light">
            {error}
          </Alert>
        )}
        <Group justify="flex-end">
          <Button onClick={save} loading={busy} disabled={!changed}>
            حفظ
          </Button>
        </Group>
      </Stack>
    </Card>
  )
}

/** The sections of one text, edited in both languages, then saved together. */
function DocumentEditor({
  name,
  item,
  document,
}: {
  name: DocumentName
  item: string
  document: { sections: Section[]; updatedAt: string }
}) {
  const afterChange = useAfterChange()
  const [sections, setSections] = useState(document.sections)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const changed = JSON.stringify(sections) !== JSON.stringify(document.sections)

  const update = (index: number, key: keyof Section, value: string) =>
    setSections(sections.map((section, i) => (i === index ? { ...section, [key]: value } : section)))
  const move = (index: number, by: number) => {
    const next = [...sections]
    const [section] = next.splice(index, 1)
    next.splice(index + by, 0, section!)
    setSections(next)
  }

  const save = async () => {
    setBusy(true)
    setError(null)
    try {
      await api(`/settings/documents/${name}`, { method: 'PUT', body: { sections } })
      await afterChange('اتحفظ النص، والتطبيق هيعرضه خلال دقايق')
    } catch (caught) {
      setError(errorText(caught))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Stack>
      <Text size="sm" c="dimmed">
        آخر تحديث {formatDateTime(document.updatedAt)}. اكتب ‎{'{supportEmail}'}‎ في أي مكان عشان يظهر بريد الدعم.
      </Text>
      {sections.map((section, index) => (
        <Card key={index} withBorder>
          <Stack gap="xs">
            <Group justify="space-between">
              <Text fw={600}>
                {item} {index + 1}
              </Text>
              <Group gap={4}>
                <Tooltip label="لفوق">
                  <ActionIcon variant="subtle" disabled={index === 0} onClick={() => move(index, -1)}>
                    <IconArrowUp size={16} />
                  </ActionIcon>
                </Tooltip>
                <Tooltip label="لتحت">
                  <ActionIcon
                    variant="subtle"
                    disabled={index === sections.length - 1}
                    onClick={() => move(index, 1)}
                  >
                    <IconArrowDown size={16} />
                  </ActionIcon>
                </Tooltip>
                <Tooltip label="امسح">
                  <ActionIcon
                    variant="subtle"
                    color="red"
                    disabled={sections.length === 1}
                    onClick={() => setSections(sections.filter((_, i) => i !== index))}
                  >
                    <IconTrash size={16} />
                  </ActionIcon>
                </Tooltip>
              </Group>
            </Group>
            <Group grow align="flex-start">
              <TextInput
                label={name === 'faq' ? 'السؤال بالعربي' : 'العنوان بالعربي'}
                value={section.titleAr}
                onChange={(event) => update(index, 'titleAr', event.currentTarget.value)}
              />
              <TextInput
                label={name === 'faq' ? 'السؤال بالإنجليزي' : 'العنوان بالإنجليزي'}
                dir="ltr"
                value={section.titleEn}
                onChange={(event) => update(index, 'titleEn', event.currentTarget.value)}
              />
            </Group>
            <Group grow align="flex-start">
              <Textarea
                label={name === 'faq' ? 'الإجابة بالعربي' : 'النص بالعربي'}
                autosize
                minRows={3}
                value={section.bodyAr}
                onChange={(event) => update(index, 'bodyAr', event.currentTarget.value)}
              />
              <Textarea
                label={name === 'faq' ? 'الإجابة بالإنجليزي' : 'النص بالإنجليزي'}
                dir="ltr"
                autosize
                minRows={3}
                value={section.bodyEn}
                onChange={(event) => update(index, 'bodyEn', event.currentTarget.value)}
              />
            </Group>
          </Stack>
        </Card>
      ))}
      {error && (
        <Alert color="red" variant="light">
          {error}
        </Alert>
      )}
      <Group justify="space-between">
        <Button
          variant="light"
          leftSection={<IconPlus size={16} />}
          onClick={() => setSections([...sections, { titleAr: '', titleEn: '', bodyAr: '', bodyEn: '' }])}
        >
          ضيف {item}
        </Button>
        <Group>
          <Button variant="default" disabled={!changed || busy} onClick={() => setSections(document.sections)}>
            تراجع
          </Button>
          <Button onClick={save} loading={busy} disabled={!changed}>
            حفظ
          </Button>
        </Group>
      </Group>
    </Stack>
  )
}

/** What the app says about 3arabity: support details and its texts. Owners only. */
export function SettingsPage() {
  const { isOwner } = useSession()
  const query = useApi<AppSettings>('/settings')
  if (!isOwner) return <Navigate to="/" replace />
  const settings = query.data

  return (
    <Stack>
      <Title order={2}>إعدادات التطبيق</Title>
      <QueryState isLoading={query.isLoading} error={query.error} onRetry={() => query.refetch()}>
        {settings && (
          <>
            {/* Saved data starts the form afresh. */}
            <SupportForm key={JSON.stringify(settings.support)} settings={settings} />
            <Card withBorder>
              <Tabs defaultValue="terms" keepMounted={false}>
                <Tabs.List mb="md">
                  {documents.map((doc) => (
                    <Tabs.Tab key={doc.name} value={doc.name}>
                      {doc.label}
                    </Tabs.Tab>
                  ))}
                </Tabs.List>
                {documents.map((doc) => (
                  <Tabs.Panel key={doc.name} value={doc.name}>
                    <DocumentEditor
                      key={settings[doc.name].updatedAt}
                      name={doc.name} item={doc.item} document={settings[doc.name]} />
                  </Tabs.Panel>
                ))}
              </Tabs>
            </Card>
          </>
        )}
      </QueryState>
    </Stack>
  )
}
