import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

interface LandingPageProps {
  active?: boolean;
}

export function LandingPage({ active = true }: LandingPageProps) {
  const navigate = useNavigate();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const wasActiveRef = useRef(active);

  // Intercept same-origin link clicks from the static landing iframe so they use
  // React Router instead of triggering a full target="_top" page reload.
  useEffect(() => {
    if (!active) return;
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      if (e.source !== iframeRef.current?.contentWindow) return;
      if (e.data?.type !== 'lostlink:navigate') return;
      const to = e.data.to;
      if (typeof to !== 'string' || !to.startsWith('/') || to.startsWith('//')) return;
      navigate(to);
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [active, navigate]);

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
      title="LostLink · Campus lost and found for DLSAU"
      hidden={!active}
      aria-hidden={!active}
      className={`${active ? 'block' : 'hidden'} h-[100dvh] w-full border-0 bg-[#f6f7f2]`}
    />
  );
}
