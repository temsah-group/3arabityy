import { Alert, Button, Center, Paper, PasswordInput, Stack, Text, TextInput, Title } from '@mantine/core'
import { useState } from 'react'
import type { FormEvent } from 'react'
import { Navigate, useLocation } from 'react-router'

import { ApiError } from '../api/client'
import { useSession } from '../auth/session'

export function LoginPage() {
  const { admin, signIn } = useSession()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (admin) {
    const from = (location.state as { from?: string } | null)?.from
    return <Navigate to={from && from !== '/login' ? from : '/'} replace />
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await signIn(email, password)
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'حصل خطأ، جرّب تاني')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Center mih="100vh" p="md" bg="var(--mantine-color-body)">
      <Paper withBorder shadow="sm" p="xl" w="100%" maw={380}>
        <form onSubmit={submit}>
          <Stack>
            <div>
              <Title order={2}>
                لوحة <Text span c="orange.6" inherit>عربيتي</Text>
              </Title>
              <Text c="dimmed" size="sm">
                للمشرفين بس
              </Text>
            </div>
            <TextInput
              label="البريد الإلكتروني"
              type="email"
              autoComplete="username"
              dir="ltr"
              required
              value={email}
              onChange={(event) => setEmail(event.currentTarget.value)}
            />
            <PasswordInput
              label="كلمة المرور"
              autoComplete="current-password"
              dir="ltr"
              required
              value={password}
              onChange={(event) => setPassword(event.currentTarget.value)}
            />
            {error && (
              <Alert color="red" variant="light">
                {error}
              </Alert>
            )}
            <Button type="submit" loading={busy} fullWidth>
              دخول
            </Button>
          </Stack>
        </form>
      </Paper>
    </Center>
  )
}
