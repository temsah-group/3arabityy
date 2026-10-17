import { AppShell, Burger, Group, Menu, NavLink, Text, UnstyledButton } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import {
  IconChevronDown,
  IconFlag,
  IconHistory,
  IconHome,
  IconLogout,
  IconPackage,
  IconUsers,
} from '@tabler/icons-react'
import type { ReactNode } from 'react'
import { Link, Navigate, Outlet, useLocation } from 'react-router'

import { useSession } from '../auth/session'
import { roles } from '../labels'

/** Sends anyone signed out to the sign-in page, then back where they were going. */
export function RequireSignIn({ children }: { children: ReactNode }) {
  const { admin } = useSession()
  const location = useLocation()
  if (!admin) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  }
  return <>{children}</>
}

const links = [
  { to: '/', label: 'الرئيسية', icon: IconHome, exact: true },
  { to: '/reports', label: 'البلاغات', icon: IconFlag },
  { to: '/users', label: 'المستخدمين', icon: IconUsers },
  { to: '/parts', label: 'الإعلانات', icon: IconPackage },
]

export function Shell() {
  const [opened, { toggle, close }] = useDisclosure()
  const { admin, isOwner, signOut } = useSession()
  const { pathname } = useLocation()
  const visible = isOwner
    ? [...links, { to: '/audit', label: 'سجل العمليات', icon: IconHistory }]
    : links

  return (
    <AppShell
      header={{ height: 56 }}
      navbar={{ width: 220, breakpoint: 'sm', collapsed: { mobile: !opened } }}
      padding="md"
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Group gap="sm">
            <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" />
            <Text fw={700} size="lg">
              لوحة <Text span c="orange.6" inherit>عربيتي</Text>
            </Text>
          </Group>
          <Menu position="bottom-end">
            <Menu.Target>
              <UnstyledButton>
                <Group gap={6}>
                  <div>
                    <Text size="sm" fw={600}>
                      {admin?.fullName}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {admin && roles[admin.role]}
                    </Text>
                  </div>
                  <IconChevronDown size={14} />
                </Group>
              </UnstyledButton>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Label>{admin?.email}</Menu.Label>
              <Menu.Item color="red" leftSection={<IconLogout size={16} />} onClick={signOut}>
                تسجيل الخروج
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="xs">
        {visible.map((link) => {
          const active =
            'exact' in link && link.exact ? pathname === link.to : pathname.startsWith(link.to)
          return (
            <NavLink
              key={link.to}
              component={Link}
              to={link.to}
              label={link.label}
              leftSection={<link.icon size={18} />}
              active={active}
              onClick={close}
            />
          )
        })}
      </AppShell.Navbar>

      <AppShell.Main>
        <Outlet />
      </AppShell.Main>
    </AppShell>
  )
}
