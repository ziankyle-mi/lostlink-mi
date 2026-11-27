import { useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { preloadRoute } from '../lib/routes';
import { useLostLink } from '../lib/store';

interface LandingPageProps {
  active?: boolean;
}

export function LandingPage({ active = true }: LandingPageProps) {
  const { currentUser } = useLostLink();
  const navigate = useNavigate();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const wasActiveRef = useRef(active);

  const syncAuthToIframe = useCallback(() => {
    const win = iframeRef.current?.contentWindow;
    if (!win) return;
    win.postMessage(
      {
        type: 'lostlink:auth',
        signedIn: Boolean(currentUser),
        portalPath: currentUser?.role === 'admin' ? '/admin' : '/feed',
        portalLabel: currentUser?.role === 'admin' ? 'DO Console' : 'Open portal',
      },
      window.location.origin
    );
  }, [currentUser]);

  useEffect(() => {
    syncAuthToIframe();
  }, [syncAuthToIframe]);

  // Warm common destination chunks while idle on `/` so leaving the landing page never flashes blank.
  useEffect(() => {
    if (!active) return;
    const timer = window.setTimeout(() => {
      preloadRoute('/feed');
      preloadRoute(currentUser ? (currentUser.role === 'admin' ? '/admin' : '/profile') : '/login');
    }, 600);
    return () => window.clearTimeout(timer);
  }, [active, currentUser]);

  // Intercept same-origin link clicks from the static landing iframe so they use
  // React Router instead of triggering a full target="_top" page reload.
  useEffect(() => {
    if (!active) return;
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      if (e.source !== iframeRef.current?.contentWindow) return;
      if (e.data?.type === 'lostlink:ready') {
        syncAuthToIframe();
        return;
      }
      if (e.data?.type !== 'lostlink:navigate') return;
      const to = e.data.to;
      if (typeof to !== 'string' || !to.startsWith('/') || to.startsWith('//')) return;
      preloadRoute(to);
      navigate(to, { viewTransition: true });
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [active, navigate, syncAuthToIframe]);

  // Reset scroll to top when returning to the kept-alive landing iframe.
  useEffect(() => {
    if (active && !wasActiveRef.current) {
      window.scrollTo(0, 0);
      try {
        iframeRef.current?.contentWindow?.scrollTo(0, 0);
      } catch {
        // Ignore if iframe is still initializing
      }
    }
    wasActiveRef.current = active;
  }, [active]);

  return (
    <iframe
      ref={iframeRef}
      src="/landing/index.html"
      onLoad={syncAuthToIframe}
      title="LostLink · Campus lost and found for DLSAU"
      hidden={!active}
      aria-hidden={!active}
      className={`${active ? 'vt-landing-frame block' : 'hidden'} h-[100dvh] w-full border-0 bg-[#f6f7f2]`}
    />
  );
}
