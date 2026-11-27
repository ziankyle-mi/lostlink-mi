import { Link } from 'react-router-dom';
import { preloadRoute } from '../lib/routes';
import { useLostLink } from '../lib/store';

const FOOTER_LINK =
  'inline-flex min-h-[44px] items-center hover:text-[#0a0a0a] hover:underline underline-offset-4';

export function Footer() {
  const { currentUser } = useLostLink();

  return (
    <footer data-site-footer="" className="border-t border-[var(--color-line)] bg-[#f6f7f2]">
      <div className="mx-auto flex w-full max-w-[1280px] flex-wrap items-center justify-between gap-4 px-6 py-5 text-sm text-[#454545] sm:px-12 lg:px-20">
        <span>LostLink · De La Salle Araneta University · Life Science Building Room 102</span>
        <nav className="flex flex-wrap items-center gap-5" aria-label="Portal links">
          <Link
            to="/feed"
            viewTransition
            onPointerEnter={() => preloadRoute('/feed')}
            onFocus={() => preloadRoute('/feed')}
            className={FOOTER_LINK}
          >
            Campus Feed
          </Link>
          {currentUser && (
            <Link
              to="/profile"
              viewTransition
              onPointerEnter={() => preloadRoute('/profile')}
              onFocus={() => preloadRoute('/profile')}
              className={FOOTER_LINK}
            >
              My Activity
            </Link>
          )}
          <Link
            to="/privacy"
            viewTransition
            onPointerEnter={() => preloadRoute('/privacy')}
            onFocus={() => preloadRoute('/privacy')}
            className={FOOTER_LINK}
          >
            Privacy Policy
          </Link>
          <Link
            to="/terms"
            viewTransition
            onPointerEnter={() => preloadRoute('/terms')}
            onFocus={() => preloadRoute('/terms')}
            className={FOOTER_LINK}
          >
            Terms of Use
          </Link>
        </nav>
      </div>
    </footer>
  );
}
