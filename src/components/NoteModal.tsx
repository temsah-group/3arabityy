import { Alert, Button, Group, Modal, Stack, Text, Textarea } from '@mantine/core'
import { useState } from 'react'

import { ApiError } from '../api/client'

export type NoteRequest = {
  title: string
  description?: string
  confirmLabel: string
  /** Red for actions buyers or sellers will feel. */
  danger?: boolean
  /** The API refuses most actions without a reason. */
  noteRequired?: boolean
  run(note: string | null): Promise<unknown>
}

/** Asks for the reason (kept in the audit log, never shown to the user), then acts. */
export function NoteModal({
  request,
  onClose,
}: {
  request: NoteRequest | null
  onClose(): void
}) {
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const required = request?.noteRequired ?? true
  const tooShort = required && note.trim().length < 3

  const close = () => {
    if (busy) return
    setNote('')
    setError(null)
    onClose()
  }

  const confirm = async () => {
    if (!request) return
    setBusy(true)
    setError(null)
    try {
      await request.run(note.trim() || null)
      setNote('')
      onClose()
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'حصل خطأ، جرّب تاني')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal opened={request !== null} onClose={close} title={request?.title} centered>
      <Stack>
        {request?.description && <Text size="sm">{request.description}</Text>}
        <Textarea
          label={required ? 'السبب' : 'السبب (اختياري)'}
          description="بيتسجل في سجل العمليات، والمستخدم مش بيشوفه"
          autosize
          minRows={2}
          maxLength={500}
          value={note}
          onChange={(event) => setNote(event.currentTarget.value)}
          data-autofocus
        />
        {error && (
          <Alert color="red" variant="light">
            {error}
          </Alert>
        )}
        <Group justify="flex-end">
          <Button variant="default" onClick={close} disabled={busy}>
            رجوع
          </Button>
          <Button
            color={request?.danger ? 'red' : undefined}
            onClick={confirm}
            loading={busy}
            disabled={tooShort}
          >
            {request?.confirmLabel}
          </Button>
        </Group>
      </Stack>
    </Modal>
  )
}
