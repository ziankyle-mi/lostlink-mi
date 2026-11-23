import { Link } from 'react-router-dom';
import { useLostLink } from '../lib/store';

export function Footer() {
  const { currentUser } = useLostLink();

  return (
    <footer className="border-t border-[var(--color-line)] bg-[#f6f7f2]">
      <div className="mx-auto flex w-full max-w-[1280px] flex-wrap items-center justify-between gap-4 px-6 py-5 text-sm text-[#454545] sm:px-12 lg:px-20">
        <span>LostLink · De La Salle Araneta University · Life Science Building Room 102</span>
        <nav className="flex flex-wrap items-center gap-5" aria-label="Portal links">
          {currentUser && (
            <>
              <Link to="/feed" className="inline-flex min-h-[44px] items-center hover:text-[#0a0a0a] hover:underline underline-offset-4">
                Campus Feed
              </Link>
              <Link to="/profile" className="inline-flex min-h-[44px] items-center hover:text-[#0a0a0a] hover:underline underline-offset-4">
                My Activity
              </Link>
            </>
          )}
          <Link to="/privacy" className="inline-flex min-h-[44px] items-center hover:text-[#0a0a0a] hover:underline underline-offset-4">
            Privacy Policy
          </Link>
          <Link to="/terms" className="inline-flex min-h-[44px] items-center hover:text-[#0a0a0a] hover:underline underline-offset-4">
            Terms of Use
          </Link>
        </nav>
      </div>
    </footer>
  );
}
