import { lazy, type ComponentType } from 'react';

type ModuleLoader<T extends ComponentType<any>> = () => Promise<{ default: T }>;

function lazyNamed<T extends ComponentType<any>, M extends Record<string, unknown>>(
  loader: () => Promise<M>,
  exportName: keyof M
) {
  const loadDefault: ModuleLoader<T> = () =>
    loader().then((mod) => ({ default: mod[exportName] as T }));
  return {
    Component: lazy(loadDefault),
    preload: loadDefault,
  };
}

export const LazyLoginPage = lazyNamed(() => import('../pages/LoginPage'), 'LoginPage');
export const LazyRegisterPage = lazyNamed(() => import('../pages/RegisterPage'), 'RegisterPage');
export const LazyResetPasswordPage = lazyNamed(
  () => import('../pages/ResetPasswordPage'),
  'ResetPasswordPage'
);
export const LazyFeedPage = lazyNamed(() => import('../pages/FeedPage'), 'FeedPage');
export const LazyProfilePage = lazyNamed(() => import('../pages/ProfilePage'), 'ProfilePage');
export const LazyAdminPage = lazyNamed(() => import('../pages/AdminPage'), 'AdminPage');
export const LazyAdminUsersPage = lazyNamed(
  () => import('../pages/AdminUsersPage'),
  'AdminUsersPage'
);
export const LazyLegalPage = lazyNamed(() => import('../pages/LegalPage'), 'LegalPage');

const ROUTE_PRELOADERS: Record<string, () => Promise<unknown>> = {
  '/login': LazyLoginPage.preload,
  '/register': LazyRegisterPage.preload,
  '/reset-password': LazyResetPasswordPage.preload,
  '/feed': LazyFeedPage.preload,
  '/profile': LazyProfilePage.preload,
  '/admin': LazyAdminPage.preload,
  '/admin/users': LazyAdminUsersPage.preload,
  '/privacy': LazyLegalPage.preload,
  '/terms': LazyLegalPage.preload,
};

/** Preloads the lazy page chunk for an internal route before navigation commits. */
export function preloadRoute(to: string): void {
  const pathname = to.split(/[?#]/, 1)[0];
  const preload = ROUTE_PRELOADERS[pathname];
  if (preload) void preload();
}
