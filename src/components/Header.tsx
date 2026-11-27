import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { AlertCircle, LogOut, Bell, Check, Menu, X } from 'lucide-react';
import { preloadRoute } from '../lib/routes';
import { useLostLink } from '../lib/store';
import { Tooltip } from './InfoTip';

interface HeaderProps {
  variant?: 'auth' | 'app';
  onOpenReport?: () => void;
}

function LostLinkLogo() {
  return (
    <Link
      to="/"
      viewTransition
      className="inline-flex min-h-[44px] shrink-0 items-center gap-3 text-[24px] font-semibold tracking-[-0.02em] text-[#0a0a0a]"
    >
      <img
        src="/assets/img/lostlink-badge.svg"
        alt=""
        width={44}
        height={44}
        className="h-11 w-11 shrink-0"
      />
      <span>LostLink</span>
    </Link>
  );
}

function DlsauSeal({ showName = false }: { showName?: boolean }) {
  return (
    <div className="inline-flex shrink-0 items-center gap-3 text-right text-base font-medium text-[#454545]">
      {showName && <span className="hidden sm:inline">De La Salle Araneta University</span>}
      <a
        href="https://www.dlsau.edu.ph/"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="De La Salle Araneta University"
        className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg transition-opacity hover:opacity-85"
      >
        <img
          src="/assets/img/dlsau-logo.svg"
          alt="De La Salle Araneta University seal"
          width={44}
          height={44}
          className="h-11 w-11 object-contain"
        />
      </a>
    </div>
  );
}

const desktopNavLinkClass = ({ isActive }: { isActive: boolean }) =>
  `relative inline-flex min-h-[44px] items-center whitespace-nowrap rounded-lg px-3 text-sm font-medium transition-colors ${
    isActive ? 'text-[#0a0a0a]' : 'text-[#454545] hover:bg-white hover:text-[#0a0a0a]'
  }`;

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `inline-flex min-h-[44px] items-center whitespace-nowrap rounded-lg px-3 text-sm font-medium transition-colors ${isActive
    ? 'border border-[var(--color-line-strong)] bg-white text-[#0a0a0a]'
    : 'text-[#454545] hover:bg-white hover:text-[#0a0a0a]'
  }`;

export function Header({ variant = 'app', onOpenReport }: HeaderProps) {
  if (variant === 'auth') {
    return (
      <header data-site-header="" className="border-b border-[var(--color-line)] bg-[#f6f7f2]">
        <div className="mx-auto flex min-h-[72px] w-full max-w-[1280px] items-center justify-between gap-3 px-6 py-2 sm:px-12 lg:px-20">
          <LostLinkLogo />
          <DlsauSeal showName />
        </div>
      </header>
    );
  }

  return <AppHeader onOpenReport={onOpenReport} />;
}

function AppHeader({ onOpenReport }: { onOpenReport?: () => void }) {
  const {
    currentUser,
    notifications,
    syncError,
    clearSyncError,
    markNotificationRead,
    markAllNotificationsRead,
    signOut,
  } = useLostLink();
  const navigate = useNavigate();
  const { pathname, search } = useLocation();

  const [notifOpen, setNotifOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [signOutOpen, setSignOutOpen] = useState(false);
  const notifWrapRef = useRef<HTMLDivElement>(null);
  const confirmDialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    setMobileNavOpen(false);
    setNotifOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileNavOpen) return;
    const mq = window.matchMedia('(min-width: 1024px)');
    const onMqChange = (e: MediaQueryListEvent) => {
      if (e.matches) setMobileNavOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileNavOpen(false);
    };
    mq.addEventListener('change', onMqChange);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      mq.removeEventListener('change', onMqChange);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [mobileNavOpen]);

  useEffect(() => {
    const el = confirmDialogRef.current;
    if (!el) return;
    if (signOutOpen && !el.open) el.showModal();
    else if (!signOutOpen && el.open) el.close();
  }, [signOutOpen]);

  const userNotifs = useMemo(
    () => notifications.filter((n) => n.userId === currentUser?.id),
    [notifications, currentUser?.id]
  );
  const unreadCount = useMemo(
    () => userNotifs.reduce((acc, n) => acc + (n.read ? 0 : 1), 0),
    [userNotifs]
  );

  useEffect(() => {
    if (!notifOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      if (notifWrapRef.current && !notifWrapRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setNotifOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [notifOpen]);

  const handleConfirmSignOut = () => {
    setSignOutOpen(false);
    // Stay on /feed as a guest if signing out from the feed; otherwise go to /login.
    navigate(pathname === '/feed' ? '/feed' : '/login', { replace: true, viewTransition: true });
    void signOut();
  };

  const portalLinks = currentUser
    ? [
        { to: '/feed', label: 'Campus Feed', end: false },
        { to: '/profile', label: 'My Activity', end: false },
        ...(currentUser.role === 'admin'
          ? [
              { to: '/admin', label: 'DO Console', end: true },
              { to: '/admin/users', label: 'User Directory', end: false },
            ]
          : []),
      ]
    : [{ to: '/feed', label: 'Campus Feed', end: false }];

  return (
    <header data-site-header="" className="sm:sticky sm:top-0 z-20 border-b border-[var(--color-line)] bg-[#f6f7f2]">
      <div className="mx-auto flex min-h-[72px] w-full max-w-[1280px] flex-wrap items-center justify-between gap-x-4 gap-y-2 px-6 py-2 sm:flex-nowrap sm:px-12 lg:px-20">
        <div className="flex min-w-0 items-center gap-4">
          <LostLinkLogo />

          <nav className="hidden items-center gap-1 lg:flex" aria-label="Portal sections">
            {portalLinks.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.end}
                viewTransition
                onPointerEnter={() => preloadRoute(link.to)}
                onFocus={() => preloadRoute(link.to)}
                className={desktopNavLinkClass}
              >
                {({ isActive }) => (
                  <>
                    {isActive && (
                      <span
                        aria-hidden="true"
                        className="vt-nav-pill pointer-events-none absolute inset-0 rounded-lg border border-[var(--color-line-strong)] bg-white"
                      />
                    )}
                    <span className="relative z-10">{link.label}</span>
                  </>
                )}
              </NavLink>
            ))}
          </nav>
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-3">
          {currentUser ? (
            <>
              {/* Notifications Bell */}
              <div ref={notifWrapRef} className="relative">
                <Tooltip
                  side="bottom"
                  text={unreadCount > 0 ? `${unreadCount} unread notifications` : 'Account notifications'}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setMobileNavOpen(false);
                      setNotifOpen((v) => !v);
                    }}
                    aria-expanded={notifOpen}
                    aria-haspopup="dialog"
                    aria-label={
                      unreadCount > 0
                        ? `Notifications (${unreadCount} unread)`
                        : 'Notifications'
                    }
                    className={`relative grid h-11 w-11 place-items-center rounded-lg border transition-colors cursor-pointer ${notifOpen
                        ? 'border-[#1f6b3a] bg-white text-[#1f6b3a]'
                        : 'border-[var(--color-line-strong)] bg-white text-[#0a0a0a] hover:bg-[#ecefe7]'
                      }`}
                  >
                    <Bell className="h-[18px] w-[18px]" strokeWidth={1.85} aria-hidden="true" />
                    {unreadCount > 0 && (
                      <span className="pointer-events-none absolute -top-1 -right-1 grid min-h-[18px] min-w-[18px] place-items-center rounded-full bg-[#1f6b3a] px-1 font-mono text-[10px] font-medium leading-none text-white ring-2 ring-[#f6f7f2]">
                        {unreadCount > 9 ? '9+' : unreadCount}
                      </span>
                    )}
                  </button>
                </Tooltip>

                {notifOpen && (
                  <div
                    role="dialog"
                    data-popover-panel=""
                    aria-label="Account notifications"
                    className="absolute right-0 z-30 mt-2 w-[min(calc(100vw-24px),360px)] overflow-hidden rounded-xl border border-[var(--color-line-strong)] bg-white shadow-[0_18px_40px_-12px_rgba(10,10,10,0.22)]"
                  >
                    <div className="flex items-center justify-between gap-2 border-b border-[var(--color-line)] bg-[#f6f7f2] px-4 py-1.5">
                      <div className="flex items-center gap-2 py-1.5">
                        <span className="text-sm font-semibold text-[#0a0a0a]">Notifications</span>
                        {unreadCount > 0 && (
                          <span className="rounded-full bg-[#e7f3ea] px-2 py-0.5 font-mono text-[11px] font-medium text-[#15522b]">
                            {unreadCount} new
                          </span>
                        )}
                      </div>
                      {unreadCount > 0 && (
                        <button
                          type="button"
                          onClick={markAllNotificationsRead}
                          className="inline-flex min-h-[44px] items-center gap-1 rounded-md px-2 text-xs font-medium text-[#1f6b3a] hover:bg-[#e7f3ea] cursor-pointer"
                        >
                          <Check className="h-3.5 w-3.5" aria-hidden="true" />
                          Mark all read
                        </button>
                      )}
                    </div>

                    <div className="max-h-[320px] divide-y divide-[var(--color-line)] overflow-y-auto [scrollbar-color:rgba(10,10,10,0.22)_transparent] [scrollbar-width:thin]">
                      {userNotifs.length === 0 ? (
                        <p className="px-4 py-8 text-center text-sm text-[#454545]">
                          No account notifications yet.
                        </p>
                      ) : (
                        userNotifs.slice(0, 8).map((n) => (
                          <button
                            key={n.id}
                            type="button"
                            onClick={() => {
                              if (!n.read) markNotificationRead(n.id);
                            }}
                            className={`flex min-h-[44px] w-full items-start gap-2.5 px-4 py-3 text-left transition-colors cursor-pointer ${n.read
                                ? 'bg-white hover:bg-[#f6f7f2]'
                                : 'bg-[#e7f3ea]/45 hover:bg-[#e7f3ea]/75'
                              }`}
                          >
                            <span
                              aria-hidden="true"
                              className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.read ? 'bg-transparent' : 'bg-[#1f6b3a]'
                                }`}
                            />
                            <span className="min-w-0 flex-1">
                              <span
                                className={`block text-[13px] leading-snug ${n.read ? 'text-[#454545]' : 'font-medium text-[#0a0a0a]'
                                  }`}
                              >
                                {n.message}
                              </span>
                              <span className="mt-1 block font-mono text-[11px] text-[#454545]">
                                {n.createdAt.slice(0, 10)}
                              </span>
                            </span>
                          </button>
                        ))
                      )}
                    </div>

                    <div className="border-t border-[var(--color-line)] bg-[#f6f7f2] px-4 py-1 text-right">
                      <Link
                        to="/profile"
                        viewTransition
                        onPointerEnter={() => preloadRoute('/profile')}
                        onClick={() => setNotifOpen(false)}
                        className="inline-flex min-h-[44px] items-center text-xs font-medium text-[#1f6b3a] underline-offset-4 hover:underline"
                      >
                        View all in My Activity
                      </Link>
                    </div>
                  </div>
                )}
              </div>

              {onOpenReport && (
                <button
                  type="button"
                  onClick={onOpenReport}
                  className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-[#1f6b3a] px-3.5 text-sm font-medium text-white transition-[background-color,transform] duration-150 hover:bg-[#19562e] active:scale-[0.985] sm:px-5 sm:text-base cursor-pointer"
                >
                  Post an item +
                </button>
              )}
              {currentUser.role === 'admin' && (
                <Tooltip
                  side="bottom"
                  text="Disciplinary Office custody desk · Mon–Fri, 8:00 AM–5:00 PM"
                  className="hidden xl:inline-flex"
                >
                  <span className="inline-flex min-h-[44px] items-center rounded-lg border border-[var(--color-line)] bg-white px-3.5 font-mono text-xs text-[#1f6b3a]">
                    DO Admin · LSB 102
                  </span>
                </Tooltip>
              )}
              <button
                type="button"
                onClick={() => setSignOutOpen(true)}
                className="inline-flex min-h-[44px] items-center px-2 text-sm font-medium text-[#454545] underline-offset-4 hover:text-[#0a0a0a] hover:underline cursor-pointer"
              >
                Sign out
              </button>
            </>
          ) : (
            <>
              <Link
                to={`/login?next=${encodeURIComponent(`${pathname}${search}`)}`}
                viewTransition
                onPointerEnter={() => preloadRoute('/login')}
                onFocus={() => preloadRoute('/login')}
                className="inline-flex min-h-[44px] items-center px-2.5 text-sm font-medium text-[#454545] underline-offset-4 hover:text-[#0a0a0a] hover:underline"
              >
                Sign in
              </Link>
              {onOpenReport && (
                <button
                  type="button"
                  onClick={onOpenReport}
                  className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-[#1f6b3a] px-3.5 text-sm font-medium text-white transition-[background-color,transform] duration-150 hover:bg-[#19562e] active:scale-[0.985] sm:px-5 sm:text-base cursor-pointer"
                >
                  Report an item
                </button>
              )}
            </>
          )}

          <div className="hidden border-l border-[var(--color-line)] pl-3 sm:flex">
            <DlsauSeal />
          </div>

          {currentUser && (
            <Tooltip
              side="bottom"
              text={mobileNavOpen ? 'Close menu' : 'Portal sections'}
              className="lg:hidden"
            >
              <button
                type="button"
                onClick={() => {
                  setNotifOpen(false);
                  setMobileNavOpen((v) => !v);
                }}
                aria-expanded={mobileNavOpen}
                aria-controls="mobile-portal-nav"
                aria-label={mobileNavOpen ? 'Close navigation menu' : 'Open navigation menu'}
                className={`grid h-11 w-11 shrink-0 place-items-center rounded-lg border transition-colors cursor-pointer ${mobileNavOpen
                    ? 'border-[#1f6b3a] bg-white text-[#1f6b3a]'
                    : 'border-[var(--color-line-strong)] bg-white text-[#0a0a0a] hover:bg-[#ecefe7]'
                  }`}
              >
                {mobileNavOpen ? (
                  <X className="h-[18px] w-[18px]" aria-hidden="true" />
                ) : (
                  <Menu className="h-[18px] w-[18px]" aria-hidden="true" />
                )}
              </button>
            </Tooltip>
          )}
        </div>
      </div>

      {currentUser && mobileNavOpen && (
        <nav
          id="mobile-portal-nav"
          data-popover-panel=""
          aria-label="Mobile portal sections"
          className="border-t border-[var(--color-line)] bg-white px-6 py-3 sm:px-12 lg:hidden"
        >
          <div className="grid gap-1">
            {portalLinks.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.end}
                viewTransition
                onPointerEnter={() => preloadRoute(link.to)}
                onClick={() => setMobileNavOpen(false)}
                className={navLinkClass}
              >
                {link.label}
              </NavLink>
            ))}
          </div>
        </nav>
      )}

      {currentUser && (
        <dialog
          ref={confirmDialogRef}
          onClose={() => setSignOutOpen(false)}
          onClick={(e) => {
            if (e.target === e.currentTarget) setSignOutOpen(false);
          }}
          aria-labelledby="signout-dlg-title"
          className="m-auto w-[min(100%-24px,420px)] flex-col overflow-hidden rounded-2xl border border-[var(--color-line-strong)] bg-white p-0 text-[#0a0a0a] shadow-[0_24px_48px_-12px_rgba(10,10,10,0.28)] open:flex backdrop:bg-[#0a0a0a]/50 backdrop:backdrop-blur-[2px]"
        >
          <div className="flex items-start justify-between gap-3 border-b border-[var(--color-line)] bg-[#f6f7f2] px-5 py-4">
            <div className="flex items-center gap-2.5">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#e7f3ea] text-[#1f6b3a]">
                <LogOut className="h-[18px] w-[18px]" aria-hidden="true" />
              </span>
              <h2 id="signout-dlg-title" className="text-[17px] font-semibold tracking-[-0.02em]">
                Sign out of LostLink?
              </h2>
            </div>
            <button
              type="button"
              onClick={() => setSignOutOpen(false)}
              aria-label="Close dialog"
              className="grid h-11 w-11 shrink-0 place-items-center rounded-lg text-[#454545] transition-colors hover:bg-black/[0.06] hover:text-[#0a0a0a] cursor-pointer"
            >
              <X className="h-[18px] w-[18px]" aria-hidden="true" />
            </button>
          </div>

          <p className="px-5 py-4 text-[14.5px] leading-relaxed text-[#454545]">
            Are you sure you want to sign out? You can sign back in anytime with your @dlsau.edu.ph account.
          </p>

          <div className="flex items-center justify-end gap-2 border-t border-[var(--color-line)] bg-[#f6f7f2] px-5 py-3.5">
            <button
              type="button"
              onClick={() => setSignOutOpen(false)}
              className="inline-flex h-11 items-center justify-center rounded-lg border border-[var(--color-line-strong)] bg-white px-4 text-sm font-medium text-[#0a0a0a] transition-colors hover:bg-[#ecefe7] cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmSignOut}
              className="inline-flex h-11 items-center justify-center rounded-lg bg-[#1f6b3a] px-4 text-sm font-medium text-white transition-colors hover:bg-[#19562e] cursor-pointer"
            >
              Yes, sign out
            </button>
          </div>
        </dialog>
      )}
      {syncError && (
        <div role="alert" className="border-t border-[#f5b5b5] bg-[#fef2f2] px-6 py-2 text-sm text-[#991b1b] sm:px-12 lg:px-20">
          <div className="mx-auto flex w-full max-w-[1280px] items-center justify-between gap-3">
            <span className="flex items-center gap-2 font-medium">
              <AlertCircle className="h-4 w-4 shrink-0 text-[#b91c1c]" aria-hidden="true" />
              <span>Sync failed: {syncError}</span>
            </span>
            <button
              type="button"
              onClick={clearSyncError}
              aria-label="Dismiss sync error"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-md text-[#991b1b] hover:bg-[#fee2e2] cursor-pointer"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
