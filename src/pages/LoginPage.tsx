import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { AlertCircle, ArrowLeft } from 'lucide-react';
import { Footer } from '../components/Footer';
import { Header } from '../components/Header';
import { PasswordField } from '../components/PasswordField';
import { useFieldValidation, ValidationBubble } from '../components/ValidationBubble';
import { useLostLink } from '../lib/store';
import { describeNextIntent, isDlsauEmail, sanitizeNextPath } from '../lib/validation';

const LOGIN_VALIDATORS = {
  email: (v: string) => {
    const clean = v.trim();
    if (!clean) return 'Enter your @dlsau.edu.ph email address.';
    if (!isDlsauEmail(clean)) return 'Use a valid @dlsau.edu.ph email (e.g. name@dlsau.edu.ph).';
    return null;
  },
  password: (v: string) => {
    if (!v) return 'Enter your password.';
    if (v.length < 6) return 'Password must be at least 6 characters.';
    return null;
  },
};

export function LoginPage() {
  const { currentUser, authReady, signIn, signInDemoRole, isLiveBackend } = useLostLink();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const nextPath = sanitizeNextPath(searchParams.get('next'));
  const nextQuery = nextPath ? `?next=${encodeURIComponent(nextPath)}` : '';
  const intentLabel = describeNextIntent(nextPath);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showResetNote, setShowResetNote] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const validation = useFieldValidation(LOGIN_VALIDATORS);

  if (authReady && currentUser) {
    if (currentUser.mustChangePassword) {
      return <Navigate to={`/reset-password${nextQuery}`} replace />;
    }
    return (
      <Navigate
        to={nextPath ?? (currentUser.role === 'admin' ? '/admin' : '/feed')}
        replace
      />
    );
  }

  const finishAuth = (user?: { role: string; mustChangePassword?: boolean }) => {
    if (user?.mustChangePassword) {
      navigate(`/reset-password${nextQuery}`, { replace: true, viewTransition: true });
      return;
    }
    navigate(nextPath ?? (user?.role === 'admin' ? '/admin' : '/feed'), {
      replace: true,
      viewTransition: true,
    });
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setError(null);
    const ok = validation.validateAll(
      { email, password },
      { email: 'login-email', password: 'login-password' }
    );
    if (!ok) return;
    setBusy(true);
    const res = await signIn(email, password);
    setBusy(false);
    if (!res.ok) {
      setError(res.error ?? 'Could not sign in.');
      return;
    }
    finishAuth(res.user);
  };

  const handleQuickDemo = (role: 'student' | 'admin') => {
    finishAuth(signInDemoRole(role));
  };

  return (
    <div className="flex min-h-[100svh] flex-col bg-[#f6f7f2]">
      <Header variant="auth" />

      <main className="mx-auto grid w-full max-w-[1280px] flex-1 place-items-center px-6 py-8 sm:px-12 lg:px-20">
        <div className="flex w-full flex-col items-center gap-6">
          <section
            aria-labelledby="login-heading"
            className="w-full max-w-[448px] rounded-xl border border-[var(--color-line-strong)] bg-white p-6 sm:p-8"
          >
            <div className="border-b border-[var(--color-line)] pb-5">
              <div className="mb-3">
                <Link
                  to="/"
                  viewTransition
                  className="-ml-1 inline-flex min-h-[44px] items-center gap-1.5 rounded-md px-1 text-xs font-medium text-[#454545] transition-colors hover:text-[#1f6b3a]"
                >
                  <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Back to LostLink</span>
                </Link>
              </div>
              <h1 id="login-heading" className="text-[26px] font-semibold leading-tight tracking-[-0.025em]">
                Campus portal sign in
              </h1>
              <p className="mt-2 text-[15px] leading-normal text-[#454545]">
                Use your @dlsau.edu.ph account to view campus holdings, file reports, or verify a claim.
              </p>
              {intentLabel && (
                <p
                  role="status"
                  className="mt-3 rounded-lg border border-[#c2dec9] bg-[#e7f3ea] px-3 py-2 text-[13px] font-medium text-[#15522b]"
                >
                  After sign-in: {intentLabel}
                </p>
              )}
            </div>

            <form onSubmit={handleSubmit} noValidate className="mt-5 grid gap-4">
              <div className="grid gap-1.5">
                <label htmlFor="login-email" className="text-sm font-medium">
                  DLSAU Email
                </label>
                <input
                  id="login-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  autoCorrect="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  required
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (error) setError(null);
                    validation.handleChange('email', e.target.value);
                  }}
                  onBlur={() => validation.handleBlur('email', email)}
                  {...validation.ariaFor('email', 'login-email-err')}
                  placeholder="student.name@dlsau.edu.ph"
                  className="h-[46px] w-full rounded-lg border border-[var(--color-line-strong)] bg-white px-3 text-base"
                />
                <ValidationBubble id="login-email-err" message={validation.errors.email} />
              </div>

              <PasswordField
                id="login-password"
                name="password"
                label="Password"
                value={password}
                placeholder="Enter your password"
                autoComplete="current-password"
                minLength={6}
                visible={showPassword}
                errorId="login-password-err"
                error={validation.errors.password}
                ariaProps={validation.ariaFor('password', 'login-password-err')}
                onChange={(next) => {
                  setPassword(next);
                  if (error) setError(null);
                  validation.handleChange('password', next);
                }}
                onBlur={() => validation.handleBlur('password', password)}
                onToggleVisible={() => setShowPassword((v) => !v)}
              />

              <div className="flex items-center justify-end">
                <button
                  type="button"
                  onClick={() => setShowResetNote((v) => !v)}
                  aria-expanded={showResetNote}
                  className="inline-flex min-h-[44px] items-center text-sm font-medium text-[#1f6b3a] underline underline-offset-4 cursor-pointer"
                >
                  Reset password
                </button>
              </div>

              {showResetNote && (
                <p className="rounded-lg border border-[var(--color-line)] bg-[#f6f7f2] p-3 text-sm text-[#454545]">
                  Password resets are handled through DLSAU IT Services or in person with your campus ID at Life Science Building Room 102.
                </p>
              )}

              {error && (
                <p
                  role="alert"
                  className="flex items-start gap-2 rounded-lg border border-[#f5b5b5] bg-[#fef2f2] px-3 py-2.5 text-sm font-medium text-[#991b1b]"
                >
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#b91c1c]" aria-hidden="true" />
                  <span>{error}</span>
                </p>
              )}

              <button
                type="submit"
                disabled={busy}
                className="inline-flex h-[46px] w-full items-center justify-center rounded-lg bg-[#1f6b3a] text-base font-medium text-white transition-colors hover:bg-[#19562e] disabled:opacity-60 cursor-pointer"
              >
                {busy ? 'Signing in…' : 'Sign In'}
              </button>

              {!isLiveBackend && (
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs text-[#454545]">
                  <span>Quick preview:</span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleQuickDemo('student')}
                      className="min-h-[44px] rounded-md border border-[var(--color-line-strong)] px-3 font-medium text-[#0a0a0a] hover:bg-[#f6f7f2] cursor-pointer"
                    >
                      Student view
                    </button>
                    <button
                      type="button"
                      onClick={() => handleQuickDemo('admin')}
                      className="min-h-[44px] rounded-md border border-[var(--color-line-strong)] px-3 font-medium text-[#0a0a0a] hover:bg-[#f6f7f2] cursor-pointer"
                    >
                      DO Admin view
                    </button>
                  </div>
                </div>
              )}
            </form>

            <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--color-line)] pt-4 text-sm text-[#454545]">
              <span>Don't have an account yet?</span>
              <Link
                to={`/register${nextQuery}`}
                viewTransition
                className="inline-flex min-h-[44px] items-center font-medium text-[#1f6b3a] underline underline-offset-4"
              >
                Register @dlsau.edu.ph
              </Link>
            </div>
          </section>

          <section
            aria-label="Campus custody standards"
            className="grid w-full max-w-[760px] grid-cols-1 gap-5 border-t border-[var(--color-line)] pt-5 sm:grid-cols-3"
          >
            <div>
              <h2 className="font-mono text-[13px] font-medium text-[#1f6b3a]">LSB Room 102</h2>
              <p className="mt-1 text-sm leading-relaxed text-[#454545]">
                Physical custody desk open Mon–Fri, 8:00 AM–5:00 PM.
              </p>
            </div>
            <div>
              <h2 className="font-mono text-[13px] font-medium text-[#1f6b3a]">LL Reference Tags</h2>
              <p className="mt-1 text-sm leading-relaxed text-[#454545]">
                Track every submitted item across all 17 buildings.
              </p>
            </div>
            <div>
              <h2 className="font-mono text-[13px] font-medium text-[#1f6b3a]">ID Privacy Shield</h2>
              <p className="mt-1 text-sm leading-relaxed text-[#454545]">
                Student ID photos stay hidden on the public campus feed.
              </p>
            </div>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}
