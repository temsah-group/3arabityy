import '@mantine/core/styles.css'
import '@mantine/notifications/styles.css'

import { DirectionProvider, MantineProvider } from '@mantine/core'
import { Notifications } from '@mantine/notifications'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router'

import { ApiError } from './api/client'
import { SessionProvider } from './auth/session'
import { router } from './router'
import { theme } from './theme'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15_000,
      // Refusals (not found, signed out) are answers; only retry network trouble.
      retry: (count, error) => count < 2 && error instanceof ApiError && error.status === 0,
      refetchOnWindowFocus: false,
    },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <DirectionProvider initialDirection="rtl">
      <MantineProvider theme={theme} defaultColorScheme="auto">
        <Notifications position="top-left" />
        <QueryClientProvider client={queryClient}>
          <SessionProvider>
            <RouterProvider router={router} />
          </SessionProvider>
        </QueryClientProvider>
      </MantineProvider>
    </DirectionProvider>
  </StrictMode>,
)
