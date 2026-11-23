import { useMemo, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, Eye, EyeOff } from 'lucide-react';
import { Footer } from '../components/Footer';
import { Header } from '../components/Header';
import { Tooltip } from '../components/InfoTip';
import { useFieldValidation, ValidationBubble } from '../components/ValidationBubble';
import { useLostLink } from '../lib/store';

export function ResetPasswordPage() {
  const { currentUser, completePasswordReset, signOut } = useLostLink();
  const navigate = useNavigate();

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const validators = useMemo(
    () => ({
      password: (v: string) => {
        if (!v) return 'Enter a new password.';
        if (v.length < 8) return 'New password must be at least 8 characters.';
        return null;
      },
      confirm: (v: string) => {
        if (!v) return 'Re-enter your new password to confirm.';
        if (v !== password) return 'Passwords do not match.';
        return null;
      },
    }),
    [password]
  );
  const validation = useFieldValidation(validators);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const ok = validation.validateAll(
      { password, confirm },
      { password: 'reset-password', confirm: 'reset-confirm' }
    );
    if (!ok) return;
    setBusy(true);
    const res = await completePasswordReset(password);
    setBusy(false);
    if (!res.ok) {
      setError(res.error ?? 'Could not update password.');
      return;
    }
    navigate(currentUser?.role === 'admin' ? '/admin' : '/feed', { replace: true });
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/login', { replace: true });
  };

  return (
    <div className="flex min-h-[100svh] flex-col bg-[#f6f7f2]">
      <Header variant="auth" />

      <main className="mx-auto grid w-full max-w-[1280px] flex-1 place-items-center px-6 py-8 sm:px-12 lg:px-20">
        <section
          aria-labelledby="reset-heading"
          className="w-full max-w-[448px] rounded-xl border border-[var(--color-line-strong)] bg-white p-6 sm:p-8"
        >
          <div className="border-b border-[var(--color-line)] pb-5">
            <h1 id="reset-heading" className="text-[26px] font-semibold leading-tight tracking-[-0.025em]">
              Set a new password
            </h1>
            <p className="mt-2 text-[15px] leading-normal text-[#454545]">
              A temporary password was issued for{' '}
              <span className="font-mono text-[13px] text-[#0a0a0a]">{currentUser?.email}</span>.
              Choose a new password before continuing to the campus portal.
            </p>
          </div>

          <form onSubmit={handleSubmit} noValidate className="mt-5 grid gap-4">
            <div className="grid gap-1.5">
              <label htmlFor="reset-password" className="text-sm font-medium">
                New password
              </label>
              <div className="relative flex items-center">
                <input
                  id="reset-password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => {
                    const next = e.target.value;
                    setPassword(next);
                    validation.handleChange('password', next);
                    if (validation.errors.confirm && confirm === next) {
                      validation.setFieldError('confirm', null);
                    }
                  }}
                  onBlur={() => validation.handleBlur('password', password)}
                  {...validation.ariaFor('password', 'reset-password-err')}
                  placeholder="At least 8 characters"
                  className="h-[46px] w-full rounded-lg border border-[var(--color-line-strong)] bg-white pl-3 pr-12 text-base"
                />
                <Tooltip
                  text={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-0.5"
                >
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'Hide new password' : 'Show new password'}
                    aria-pressed={showPassword}
                    className="grid h-[44px] w-[44px] place-items-center rounded-lg text-[#454545] hover:text-[#0a0a0a] cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
                  </button>
                </Tooltip>
              </div>
              <ValidationBubble id="reset-password-err" message={validation.errors.password} />
            </div>

            <div className="grid gap-1.5">
              <label htmlFor="reset-confirm" className="text-sm font-medium">
                Confirm new password
              </label>
              <div className="relative flex items-center">
                <input
                  id="reset-confirm"
                  name="confirm"
                  type={showConfirm ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  minLength={8}
                  value={confirm}
                  onChange={(e) => {
                    setConfirm(e.target.value);
                    validation.handleChange('confirm', e.target.value);
                  }}
                  onBlur={() => validation.handleBlur('confirm', confirm)}
                  {...validation.ariaFor('confirm', 'reset-confirm-err')}
                  placeholder="Re-enter your new password"
                  className="h-[46px] w-full rounded-lg border border-[var(--color-line-strong)] bg-white pl-3 pr-12 text-base"
                />
                <Tooltip
                  text={showConfirm ? 'Hide password' : 'Show password'}
                  className="absolute right-0.5"
                >
                  <button
                    type="button"
                    onClick={() => setShowConfirm((v) => !v)}
                    aria-label={showConfirm ? 'Hide confirm password' : 'Show confirm password'}
                    aria-pressed={showConfirm}
                    className="grid h-[44px] w-[44px] place-items-center rounded-lg text-[#454545] hover:text-[#0a0a0a] cursor-pointer"
                  >
                    {showConfirm ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
                  </button>
                </Tooltip>
              </div>
              <ValidationBubble id="reset-confirm-err" message={validation.errors.confirm} />
            </div>

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
              {busy ? 'Saving password…' : 'Update password & continue'}
            </button>
          </form>

          <div className="mt-5 flex items-center justify-between gap-2 border-t border-[var(--color-line)] pt-4 text-sm text-[#454545]">
            <span>Wrong account?</span>
            <button
              type="button"
              onClick={handleSignOut}
              className="inline-flex min-h-[44px] items-center font-medium text-[#1f6b3a] underline underline-offset-4 cursor-pointer"
            >
              Sign out
            </button>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
