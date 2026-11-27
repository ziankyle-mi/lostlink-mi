import { Suspense, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  createBrowserRouter,
  Navigate,
  Outlet,
  RouterProvider,
  ScrollRestoration,
  useLocation,
} from 'react-router-dom';
import {
  LazyAdminPage,
  LazyAdminUsersPage,
  LazyFeedPage,
  LazyLegalPage,
  LazyLoginPage,
  LazyProfilePage,
  LazyRegisterPage,
  LazyResetPasswordPage,
} from './lib/routes';
import { LostLinkProvider, useLostLink } from './lib/store';
import { LandingPage } from './pages/LandingPage';

const LoginPage = LazyLoginPage.Component;
const RegisterPage = LazyRegisterPage.Component;
const AdminPage = LazyAdminPage.Component;
const AdminUsersPage = LazyAdminUsersPage.Component;
const FeedPage = LazyFeedPage.Component;
const LegalPage = LazyLegalPage.Component;
const ProfilePage = LazyProfilePage.Component;
const ResetPasswordPage = LazyResetPasswordPage.Component;

const PAGE_FALLBACK = <div className="min-h-[100svh] bg-[#f6f7f2]" />;

function RequireAuth({ children }: { children: ReactNode }) {
  const { currentUser, authReady } = useLostLink();
  const { pathname, search } = useLocation();
  if (!authReady) return PAGE_FALLBACK;
  if (!currentUser) {
    const next = encodeURIComponent(`${pathname}${search}`);
    return <Navigate to={`/login?next=${next}`} replace />;
  }
  if (currentUser.mustChangePassword) return <Navigate to="/reset-password" replace />;
  return <>{children}</>;
}

function RequireAdmin({ children }: { children: ReactNode }) {
  const { currentUser, authReady } = useLostLink();
  const { pathname, search } = useLocation();
  if (!authReady) return PAGE_FALLBACK;
  if (!currentUser) {
    const next = encodeURIComponent(`${pathname}${search}`);
    return <Navigate to={`/login?next=${next}`} replace />;
  }
  if (currentUser.mustChangePassword) return <Navigate to="/reset-password" replace />;
  if (currentUser.role !== 'admin') return <Navigate to="/feed" replace />;
  return <>{children}</>;
}

function FeedRoute({ children }: { children: ReactNode }) {
  const { currentUser, authReady } = useLostLink();
  if (!authReady) return PAGE_FALLBACK;
  if (currentUser?.mustChangePassword) return <Navigate to="/reset-password" replace />;
  return <>{children}</>;
}

function RequirePasswordReset({ children }: { children: ReactNode }) {
  const { currentUser, authReady } = useLostLink();
  if (!authReady) return PAGE_FALLBACK;
  if (!currentUser) return <Navigate to="/login" replace />;
  if (!currentUser.mustChangePassword) {
    return <Navigate to={currentUser.role === 'admin' ? '/admin' : '/feed'} replace />;
  }
  return <>{children}</>;
}

function RootLayout() {
  const { pathname } = useLocation();
  const isLanding = pathname === '/';
  const prevPathnameRef = useRef(pathname);
  // Keep the landing iframe mounted once visited so returning to `/` is instant (no 2s cold reload).
  const [landingVisited, setLandingVisited] = useState(isLanding);

  useEffect(() => {
    if (isLanding && !landingVisited) setLandingVisited(true);
  }, [isLanding, landingVisited]);

  // Shift focus to the incoming <main> after SPA navigation so keyboard/AT users track context.
  useEffect(() => {
    if (prevPathnameRef.current === pathname) return;
    prevPathnameRef.current = pathname;
    if (pathname === '/') return;
    const raf = requestAnimationFrame(() => {
      const main = document.querySelector<HTMLElement>('main');
      if (!main) return;
      if (!main.hasAttribute('tabindex')) main.setAttribute('tabindex', '-1');
      main.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(raf);
  }, [pathname]);

  const landingMounted = landingVisited || isLanding;

  return (
    <>
      <ScrollRestoration />
      {landingMounted && <LandingPage active={isLanding} />}
      {!isLanding && (
        <Suspense fallback={PAGE_FALLBACK}>
          <Outlet />
        </Suspense>
      )}
    </>
  );
}

const router = createBrowserRouter([
  {
    element: <RootLayout />,
    children: [
      { path: '/', element: null },
      { path: '/login', element: <LoginPage /> },
      { path: '/register', element: <RegisterPage /> },
      {
        path: '/reset-password',
        element: (
          <RequirePasswordReset>
            <ResetPasswordPage />
          </RequirePasswordReset>
        ),
      },
      {
        path: '/feed',
        element: (
          <FeedRoute>
            <FeedPage />
          </FeedRoute>
        ),
      },
      {
        path: '/profile',
        element: (
          <RequireAuth>
            <ProfilePage />
          </RequireAuth>
        ),
      },
      {
        path: '/admin',
        element: (
          <RequireAdmin>
            <AdminPage />
          </RequireAdmin>
        ),
      },
      {
        path: '/admin/users',
        element: (
          <RequireAdmin>
            <AdminUsersPage />
          </RequireAdmin>
        ),
      },
      { path: '/privacy', element: <LegalPage kind="privacy" /> },
      { path: '/terms', element: <LegalPage kind="terms" /> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]);

export function App() {
  return (
    <LostLinkProvider>
      <RouterProvider router={router} />
    </LostLinkProvider>
  );
}

export default App;
