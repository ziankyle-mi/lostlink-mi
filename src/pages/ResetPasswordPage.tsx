import { useMemo, useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';
import { Footer } from '../components/Footer';
import { Header } from '../components/Header';
import { PasswordField } from '../components/PasswordField';
import { useFieldValidation } from '../components/ValidationBubble';
import { useLostLink } from '../lib/store';
import { sanitizeNextPath } from '../lib/validation';

export function ResetPasswordPage() {
  const { currentUser, completePasswordReset, signOut } = useLostLink();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const nextPath = sanitizeNextPath(searchParams.get('next'));

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
    if (busy) return;
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
    navigate(nextPath ?? (currentUser?.role === 'admin' ? '/admin' : '/feed'), { replace: true });
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
            <PasswordField
              id="reset-password"
              name="password"
              label="New password"
              value={password}
              placeholder="At least 8 characters"
              autoComplete="new-password"
              minLength={8}
              visible={showPassword}
              toggleLabel="new password"
              errorId="reset-password-err"
              error={validation.errors.password}
              ariaProps={validation.ariaFor('password', 'reset-password-err')}
              onChange={(next) => {
                setPassword(next);
                if (error) setError(null);
                validation.handleChange('password', next);
                if (validation.errors.confirm && confirm === next) {
                  validation.setFieldError('confirm', null);
                }
              }}
              onBlur={() => validation.handleBlur('password', password)}
              onToggleVisible={() => setShowPassword((v) => !v)}
            />

            <PasswordField
              id="reset-confirm"
              name="confirm"
              label="Confirm new password"
              value={confirm}
              placeholder="Re-enter your new password"
              autoComplete="new-password"
              minLength={8}
              visible={showConfirm}
              toggleLabel="confirm password"
              errorId="reset-confirm-err"
              error={validation.errors.confirm}
              ariaProps={validation.ariaFor('confirm', 'reset-confirm-err')}
              onChange={(next) => {
                setConfirm(next);
                if (error) setError(null);
                validation.handleChange('confirm', next);
              }}
              onBlur={() => validation.handleBlur('confirm', confirm)}
              onToggleVisible={() => setShowConfirm((v) => !v)}
            />

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
