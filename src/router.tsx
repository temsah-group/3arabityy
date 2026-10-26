import { createBrowserRouter, Navigate } from 'react-router'

import { RequireSignIn, Shell } from './components/Shell'
import { AnnouncementsPage } from './pages/AnnouncementsPage'
import { OffersPage } from './pages/OffersPage'
import { AuditPage } from './pages/AuditPage'
import { CarsPage } from './pages/CarsPage'
import { LoginPage } from './pages/LoginPage'
import { OverviewPage } from './pages/OverviewPage'
import { PartPage } from './pages/PartPage'
import { PartsPage } from './pages/PartsPage'
import { ReportPage } from './pages/ReportPage'
import { ReportsPage } from './pages/ReportsPage'
import { ReviewsPage } from './pages/ReviewsPage'
import { SettingsPage } from './pages/SettingsPage'
import { ShopPage } from './pages/ShopPage'
import { ShopsPage } from './pages/ShopsPage'
import { StatsPage } from './pages/StatsPage'
import { UserPage } from './pages/UserPage'
import { UsersPage } from './pages/UsersPage'

export const routes = [
  { path: '/login', element: <LoginPage /> },
  {
    element: (
      <RequireSignIn>
        <Shell />
      </RequireSignIn>
    ),
    children: [
      { index: true, element: <OverviewPage /> },
      { path: 'reports', element: <ReportsPage /> },
      { path: 'reports/:target/:id', element: <ReportPage /> },
      { path: 'users', element: <UsersPage /> },
      { path: 'users/:id', element: <UserPage /> },
      { path: 'parts', element: <PartsPage /> },
      { path: 'parts/:id', element: <PartPage /> },
      { path: 'shops', element: <ShopsPage /> },
      { path: 'shops/:id', element: <ShopPage /> },
      { path: 'reviews', element: <ReviewsPage /> },
      { path: 'stats', element: <StatsPage /> },
      { path: 'announcements', element: <AnnouncementsPage /> },
      { path: 'offers', element: <OffersPage /> },
      { path: 'cars', element: <CarsPage /> },
      { path: 'audit', element: <AuditPage /> },
      { path: 'settings', element: <SettingsPage /> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]

export const router = createBrowserRouter(routes)
