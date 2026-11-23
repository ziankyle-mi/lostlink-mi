import { lazy, Suspense, useState, type ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { LostLinkProvider, useLostLink } from './lib/store';
import { LandingPage } from './pages/LandingPage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';

const AdminPage = lazy(() => import('./pages/AdminPage').then((m) => ({ default: m.AdminPage })));
const AdminUsersPage = lazy(() =>
  import('./pages/AdminUsersPage').then((m) => ({ default: m.AdminUsersPage }))
);
const FeedPage = lazy(() => import('./pages/FeedPage').then((m) => ({ default: m.FeedPage })));
const LegalPage = lazy(() => import('./pages/LegalPage').then((m) => ({ default: m.LegalPage })));
const ProfilePage = lazy(() =>
  import('./pages/ProfilePage').then((m) => ({ default: m.ProfilePage }))
);
const ResetPasswordPage = lazy(() =>
  import('./pages/ResetPasswordPage').then((m) => ({ default: m.ResetPasswordPage }))
);

function RequireAuth({ children }: { children: ReactNode }) {
  const { currentUser, authReady } = useLostLink();
  if (!authReady) return <div className="min-h-[100svh] bg-[#f6f7f2]" />;
  if (!currentUser) return <Navigate to="/login" replace />;
  if (currentUser.mustChangePassword) return <Navigate to="/reset-password" replace />;
  return <>{children}</>;
}

function RequireAdmin({ children }: { children: ReactNode }) {
  const { currentUser, authReady } = useLostLink();
  if (!authReady) return <div className="min-h-[100svh] bg-[#f6f7f2]" />;
  if (!currentUser) return <Navigate to="/login" replace />;
  if (currentUser.mustChangePassword) return <Navigate to="/reset-password" replace />;
  if (currentUser.role !== 'admin') return <Navigate to="/feed" replace />;
  return <>{children}</>;
}

function RequirePasswordReset({ children }: { children: ReactNode }) {
  const { currentUser, authReady } = useLostLink();
  if (!authReady) return <div className="min-h-[100svh] bg-[#f6f7f2]" />;
  if (!currentUser) return <Navigate to="/login" replace />;
  if (!currentUser.mustChangePassword) {
    return <Navigate to={currentUser.role === 'admin' ? '/admin' : '/feed'} replace />;
  }
  return <>{children}</>;
}

function AppRoutes() {
  const { pathname } = useLocation();
  const isLanding = pathname === '/';
  // Keep the landing iframe mounted once visited so returning to `/` is instant (no 2s cold reload).
  const [landingMounted, setLandingMounted] = useState(isLanding);
  if (isLanding && !landingMounted) setLandingMounted(true);

  return (
    <>
      {landingMounted && <LandingPage active={isLanding} />}
      {!isLanding && (
        <Suspense fallback={<div className="min-h-[100svh] bg-[#f6f7f2]" />}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route
              path="/reset-password"
              element={
                <RequirePasswordReset>
                  <ResetPasswordPage />
                </RequirePasswordReset>
              }
            />
            <Route
              path="/feed"
              element={
                <RequireAuth>
                  <FeedPage />
                </RequireAuth>
              }
            />
            <Route
              path="/profile"
              element={
                <RequireAuth>
                  <ProfilePage />
                </RequireAuth>
              }
            />
            <Route
              path="/admin"
              element={
                <RequireAdmin>
                  <AdminPage />
                </RequireAdmin>
              }
            />
            <Route
              path="/admin/users"
              element={
                <RequireAdmin>
                  <AdminUsersPage />
                </RequireAdmin>
              }
            />
            <Route path="/privacy" element={<LegalPage kind="privacy" />} />
            <Route path="/terms" element={<LegalPage kind="terms" />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      )}
    </>
  );
}

export function App() {
  return (
    <LostLinkProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </LostLinkProvider>
  );
}

export default App;
