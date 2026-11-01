import { lazy, Suspense } from 'react';
import type { ReactNode } from 'react';
import { createBrowserRouter, Navigate, Outlet, RouterProvider, ScrollRestoration, useLocation } from 'react-router-dom';

import { Layout } from '@/components/Layout';
import { PageSpinner } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import Home from '@/pages/Home';

const Search = lazy(() => import('@/pages/parts/Search'));
const PartDetails = lazy(() => import('@/pages/parts/PartDetails'));
const Seller = lazy(() => import('@/pages/parts/Seller'));
const Saved = lazy(() => import('@/pages/parts/Saved'));
const Sell = lazy(() => import('@/pages/parts/Sell'));
const Shops = lazy(() => import('@/pages/shops/Shops'));
const ShopPage = lazy(() => import('@/pages/shops/ShopPage'));
const Login = lazy(() => import('@/pages/auth/Login'));
const Register = lazy(() => import('@/pages/auth/Register'));
const Verify = lazy(() => import('@/pages/auth/Verify'));
const ForgotPassword = lazy(() => import('@/pages/auth/ForgotPassword'));
const ResetPassword = lazy(() => import('@/pages/auth/ResetPassword'));
const AccountLayout = lazy(() => import('@/pages/account/AccountLayout'));
const Account = lazy(() => import('@/pages/account/Account'));
const PersonalInfo = lazy(() => import('@/pages/account/PersonalInfo'));
const ChangePassword = lazy(() => import('@/pages/account/ChangePassword'));
const DeleteAccount = lazy(() => import('@/pages/account/DeleteAccount'));
const MyParts = lazy(() => import('@/pages/account/MyParts'));
const MyShop = lazy(() => import('@/pages/account/MyShop'));
const ReceivedReviews = lazy(() => import('@/pages/account/ReceivedReviews'));
const Notifications = lazy(() => import('@/pages/notifications/Notifications'));
const NotificationSettings = lazy(() => import('@/pages/notifications/NotificationSettings'));
const Help = lazy(() => import('@/pages/Help').then((m) => ({ default: m.Help })));
const Legal = lazy(() => import('@/pages/Help').then((m) => ({ default: m.Legal })));
const NotFound = lazy(() => import('@/pages/NotFound'));

/** Signed-in pages send guests to sign in, then back. */
function RequireAuth({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const location = useLocation();
  if (status === 'loading') return <PageSpinner />;
  if (status === 'guest') return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  return <>{children}</>;
}

/** Sign-in pages send signed-in users home. */
function GuestOnly({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  if (status === 'signedIn') return <Navigate to="/" replace />;
  return <>{children}</>;
}

function Root() {
  return (
    <Suspense fallback={<PageSpinner />}>
      <Outlet />
      <ScrollRestoration />
    </Suspense>
  );
}

const auth = (el: ReactNode) => <RequireAuth>{el}</RequireAuth>;
const guest = (el: ReactNode) => <GuestOnly>{el}</GuestOnly>;
const page = (el: ReactNode) => <Suspense fallback={<PageSpinner />}>{el}</Suspense>;

const router = createBrowserRouter([
  {
    element: <Root />,
    children: [
      {
        element: <Layout />,
        children: [
          { path: '/', element: <Home /> },
          { path: '/search', element: page(<Search />) },
          { path: '/parts/:id', element: page(<PartDetails />) },
          { path: '/sellers/:id', element: page(<Seller />) },
          { path: '/shops', element: page(<Shops />) },
          { path: '/shops/:id', element: page(<ShopPage />) },
          { path: '/saved', element: page(<Saved />) },
          { path: '/help', element: page(<Help />) },
          { path: '/legal/:doc', element: page(<Legal />) },

          { path: '/login', element: guest(page(<Login />)) },
          { path: '/register', element: guest(page(<Register />)) },
          { path: '/verify', element: page(<Verify />) },
          { path: '/forgot-password', element: guest(page(<ForgotPassword />)) },
          { path: '/reset-password', element: page(<ResetPassword />) },

          { path: '/sell', element: auth(page(<Sell />)) },
          { path: '/sell/:id', element: auth(page(<Sell />)) },
          {
            element: auth(page(<AccountLayout />)),
            children: [
              { path: '/account', element: page(<Account />) },
              { path: '/account/info', element: page(<PersonalInfo />) },
              { path: '/account/password', element: page(<ChangePassword />) },
              { path: '/account/delete', element: page(<DeleteAccount />) },
              { path: '/account/parts', element: page(<MyParts />) },
              { path: '/account/shop', element: page(<MyShop />) },
              { path: '/account/reviews', element: page(<ReceivedReviews />) },
              { path: '/notifications', element: page(<Notifications />) },
              { path: '/notifications/settings', element: page(<NotificationSettings />) },
            ],
          },
          { path: '*', element: page(<NotFound />) },
        ],
      },
    ],
  },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
