import { Badge, Stack, Text, Timeline } from '@mantine/core'

import type { HistoryEntry } from '../api/types'
import { auditActions, formatDateTime, label } from '../labels'

/** What admins did to one account or part, newest first. */
export function History({ entries }: { entries: HistoryEntry[] }) {
  if (entries.length === 0) {
    return (
      <Text c="dimmed" size="sm">
        مفيش إجراءات لسه
      </Text>
    )
  }
  return (
    <Timeline bulletSize={14} lineWidth={2}>
      {entries.map((entry) => (
        <Timeline.Item key={entry.id} title={label(auditActions, entry.action)}>
          <Stack gap={2}>
            {entry.note && <Text size="sm">{entry.note}</Text>}
            <Text size="xs" c="dimmed">
              {entry.adminEmail} · {formatDateTime(entry.createdAt)}
            </Text>
            {entry.action === 'REPORTS_RESOLVED' && typeof entry.changes?.closed === 'number' && (
              <Badge size="xs" variant="light" w="fit-content">
                {entry.changes.closed} بلاغ
              </Badge>
            )}
          </Stack>
        </Timeline.Item>
      ))}
    </Timeline>
  )
}
