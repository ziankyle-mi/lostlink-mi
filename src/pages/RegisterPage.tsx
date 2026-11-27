import { useMemo, useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { AlertCircle, ArrowLeft } from 'lucide-react';
import { Footer } from '../components/Footer';
import { Header } from '../components/Header';
import { Toggletip } from '../components/InfoTip';
import { PasswordField } from '../components/PasswordField';
import { useFieldValidation, ValidationBubble } from '../components/ValidationBubble';
import { PROGRAMS_BY_COLLEGE, useLostLink } from '../lib/store';
import { describeNextIntent, isDlsauEmail, isStudentId, sanitizeNextPath } from '../lib/validation';
import type { AccountType } from '../types';

const COLLEGE_PROGRAM_GROUPS = Object.entries(PROGRAMS_BY_COLLEGE);
const YEAR_LEVELS = ['1st Year', '2nd Year', '3rd Year', '4th Year', '5th Year', '6th Year'] as const;

export function RegisterPage() {
  const { currentUser, authReady, registerAccount } = useLostLink();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const nextPath = sanitizeNextPath(searchParams.get('next'));
  const nextQuery = nextPath ? `?next=${encodeURIComponent(nextPath)}` : '';
  const intentLabel = describeNextIntent(nextPath);

  const [accountType, setAccountType] = useState<AccountType>('student');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [program, setProgram] = useState('BSCS');
  const [studentId, setStudentId] = useState('');
  const [yearLevel, setYearLevel] = useState('3rd Year');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmNotice, setConfirmNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const validators = useMemo(
    () => ({
      fullName: (v: string) =>
        v.trim().length < 2 ? 'Enter your full name (at least 2 characters).' : null,
      email: (v: string) => {
        const clean = v.trim();
        if (!clean) return 'Enter your @dlsau.edu.ph email address.';
        if (!isDlsauEmail(clean)) return 'Only @dlsau.edu.ph university email addresses are allowed.';
        return null;
      },
      studentId: (v: string) => {
        if (accountType !== 'student') return null;
        const clean = v.trim();
        if (!clean) return 'Enter your DLSAU Student ID (e.g. 2024-00-012345).';
        if (!isStudentId(clean)) return 'Match the DLSAU ID format: YYYY-00-XXXXXX.';
        return null;
      },
      password: (v: string) => {
        if (!v) return 'Create a password for your account.';
        if (v.length < 8) return 'Password must be at least 8 characters.';
        return null;
      },
      accepted: (v: string) =>
        v !== 'true' ? 'Accept the Privacy Policy and Terms of Use to register.' : null,
    }),
    [accountType]
  );
  const validation = useFieldValidation(validators);

  if (authReady && currentUser) {
    return (
      <Navigate
        to={nextPath ?? (currentUser.role === 'admin' ? '/admin' : '/feed')}
        replace
      />
    );
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setError(null);
    setConfirmNotice(null);
    const ok = validation.validateAll(
      {
        fullName,
        email,
        studentId,
        password,
        accepted: accepted ? 'true' : '',
      },
      {
        fullName: 'reg-name',
        email: 'reg-email',
        studentId: 'reg-sid',
        password: 'reg-pass',
        accepted: 'reg-accept',
      }
    );
    if (!ok) return;
    setBusy(true);
    const res = await registerAccount({
      fullName,
      email,
      password,
      accountType,
      program,
      studentId: accountType === 'student' ? studentId : null,
      yearLevel: accountType === 'student' ? yearLevel : null,
    });
    setBusy(false);
    if (!res.ok) {
      setError(res.error ?? 'Could not create account.');
      return;
    }
    if (res.needsEmailConfirm) {
      setConfirmNotice(
        `Account created for ${email.trim().toLowerCase()}. Check your @dlsau.edu.ph inbox to verify your email, then sign in.`
      );
      return;
    }
    navigate(nextPath ?? '/feed', { replace: true });
  };

  return (
    <div className="flex min-h-[100svh] flex-col bg-[#f6f7f2]">
      <Header variant="auth" />

      <main className="mx-auto grid w-full max-w-[1280px] flex-1 place-items-center px-6 py-8 sm:px-12 lg:px-20">
        <section
          aria-labelledby="reg-heading"
          className="w-full max-w-[496px] rounded-xl border border-[var(--color-line-strong)] bg-white p-6 sm:p-8"
        >
          <div className="border-b border-[var(--color-line)] pb-5">
            <Link
              to="/"
              className="mb-2 inline-flex min-h-[44px] items-center gap-1.5 text-xs font-medium text-[#454545] transition-colors hover:text-[#1f6b3a]"
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
              Back to LostLink
            </Link>
            {intentLabel && (
              <p className="mb-3 inline-flex items-center rounded-md border border-[#c2dec9] bg-[#e7f3ea] px-2.5 py-1 font-mono text-xs font-medium text-[#15522b]">
                Next: {intentLabel}
              </p>
            )}
            <h1 id="reg-heading" className="text-[26px] font-semibold leading-tight tracking-[-0.025em]">
              Create your DLSAU account
            </h1>
            <p className="mt-2 text-[15px] leading-normal text-[#454545]">
              Register with your @dlsau.edu.ph email to post lost or found items and submit custody claims.
            </p>
          </div>

          <form onSubmit={handleSubmit} noValidate className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="grid gap-2 sm:col-span-2">
              <span className="text-sm font-medium">Campus role</span>
              <div className="grid grid-cols-2 gap-2">
                {(['student', 'faculty'] as const).map((role) => (
                  <button
                    key={role}
                    type="button"
                    onClick={() => {
                      setAccountType(role);
                      if (role === 'faculty') validation.setFieldError('studentId', null);
                    }}
                    aria-pressed={accountType === role}
                    className={`min-h-[44px] rounded-lg border text-sm font-medium cursor-pointer ${
                      accountType === role
                        ? 'border-[#1f6b3a] bg-[#1f6b3a] text-white'
                        : 'border-[var(--color-line-strong)] bg-white text-[#0a0a0a]'
                    }`}
                  >
                    {role === 'student' ? 'Student' : 'Faculty / Staff'}
                  </button>
                ))}
              </div>
              <span className="text-xs text-[#454545]">
                Admin privileges are assigned exclusively by the Security Office at LSB Room 102.
              </span>
            </div>

            <div className="grid gap-1.5 sm:col-span-2">
              <label htmlFor="reg-name" className="text-sm font-medium">
                Full Name
              </label>
              <input
                id="reg-name"
                name="fullName"
                type="text"
                autoComplete="name"
                required
                value={fullName}
                onChange={(e) => {
                  setFullName(e.target.value);
                  validation.handleChange('fullName', e.target.value);
                }}
                onBlur={() => validation.handleBlur('fullName', fullName)}
                {...validation.ariaFor('fullName', 'reg-name-err')}
                placeholder="Renee De La Cruz"
                className="h-[46px] w-full rounded-lg border border-[var(--color-line-strong)] bg-white px-3 text-base"
              />
              <ValidationBubble id="reg-name-err" message={validation.errors.fullName} />
            </div>

            <div className="grid gap-1.5 sm:col-span-2">
              <label htmlFor="reg-email" className="text-sm font-medium">
                DLSAU Email
              </label>
              <input
                id="reg-email"
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
                  validation.handleChange('email', e.target.value);
                }}
                onBlur={() => validation.handleBlur('email', email)}
                {...validation.ariaFor('email', 'reg-email-err')}
                placeholder="renee.delacruz@dlsau.edu.ph"
                className="h-[46px] w-full rounded-lg border border-[var(--color-line-strong)] bg-white px-3 text-base"
              />
              <ValidationBubble id="reg-email-err" message={validation.errors.email} />
            </div>

            <div className="grid gap-1.5 sm:col-span-2">
              <label htmlFor="reg-program" className="text-sm font-medium">
                College &amp; Degree Program
              </label>
              <select
                id="reg-program"
                name="program"
                value={program}
                onChange={(e) => setProgram(e.target.value)}
                className="h-[46px] w-full rounded-lg border border-[var(--color-line-strong)] bg-white px-3 text-base"
              >
                {COLLEGE_PROGRAM_GROUPS.map(([college, list]) => (
                  <optgroup key={college} label={college}>
                    {list.map((code) => (
                      <option key={code} value={code}>
                        {code} ({college})
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>

            {accountType === 'student' && (
              <>
                <div className="grid content-start gap-1.5">
                  <div className="flex items-center justify-between gap-1">
                    <label htmlFor="reg-sid" className="text-sm font-medium">
                      Student ID
                    </label>
                    <Toggletip
                      label="About DLSAU Student ID format"
                      text="Use your official DLSAU Student ID format YYYY-00-XXXXXX (e.g. 2024-00-012345). Used by LSB Room 102 during claim verification."
                    />
                  </div>
                  <input
                    id="reg-sid"
                    name="studentId"
                    type="text"
                    autoCorrect="off"
                    autoCapitalize="none"
                    spellCheck={false}
                    required
                    value={studentId}
                    onChange={(e) => {
                      setStudentId(e.target.value);
                      validation.handleChange('studentId', e.target.value);
                    }}
                    onBlur={() => validation.handleBlur('studentId', studentId)}
                    {...validation.ariaFor('studentId', 'reg-sid-err')}
                    placeholder="2024-00-012345"
                    className="h-[46px] w-full rounded-lg border border-[var(--color-line-strong)] bg-white px-3 font-mono text-[15px]"
                  />
                  <ValidationBubble id="reg-sid-err" message={validation.errors.studentId} />
                </div>
                <div className="grid content-start gap-1.5">
                  <label htmlFor="reg-year" className="text-sm font-medium">
                    Year Level
                  </label>
                  <select
                    id="reg-year"
                    name="yearLevel"
                    value={yearLevel}
                    onChange={(e) => setYearLevel(e.target.value)}
                    className="h-[46px] w-full rounded-lg border border-[var(--color-line-strong)] bg-white px-3 text-base"
                  >
                    {YEAR_LEVELS.map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            )}

            <PasswordField
              id="reg-pass"
              name="password"
              label="Password"
              value={password}
              placeholder="Minimum 8 characters"
              autoComplete="new-password"
              minLength={8}
              visible={showPassword}
              errorId="reg-pass-err"
              error={validation.errors.password}
              className="sm:col-span-2"
              ariaProps={validation.ariaFor('password', 'reg-pass-err')}
              onChange={(next) => {
                setPassword(next);
                validation.handleChange('password', next);
              }}
              onBlur={() => validation.handleBlur('password', password)}
              onToggleVisible={() => setShowPassword((v) => !v)}
            />

            <div className="grid gap-1 sm:col-span-2">
              <label className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 text-sm text-[#454545]">
                <input
                  id="reg-accept"
                  type="checkbox"
                  checked={accepted}
                  onChange={(e) => {
                    setAccepted(e.target.checked);
                    validation.handleChange('accepted', e.target.checked ? 'true' : '');
                  }}
                  {...validation.ariaFor('accepted', 'reg-accept-err')}
                  className="h-4 w-4 rounded"
                />
                <span>
                  I accept the{' '}
                  <Link to="/privacy" className="text-[#1f6b3a] underline underline-offset-4">
                    Privacy Policy
                  </Link>{' '}
                  and{' '}
                  <Link to="/terms" className="text-[#1f6b3a] underline underline-offset-4">
                    Terms of Use
                  </Link>
                  .
                </span>
              </label>
              <ValidationBubble id="reg-accept-err" message={validation.errors.accepted} />
            </div>

            {error && (
              <p
                role="alert"
                className="flex items-start gap-2 rounded-lg border border-[#f5b5b5] bg-[#fef2f2] px-3 py-2.5 text-sm font-medium text-[#991b1b] sm:col-span-2"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#b91c1c]" aria-hidden="true" />
                <span>{error}</span>
              </p>
            )}

            {confirmNotice && (
              <p
                role="status"
                className="rounded-lg border border-[#c2dec9] bg-[#e7f3ea] p-3 text-sm font-medium text-[#15522b] sm:col-span-2"
              >
                {confirmNotice}
              </p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="inline-flex h-[46px] w-full items-center justify-center rounded-lg bg-[#1f6b3a] text-base font-medium text-white hover:bg-[#19562e] disabled:opacity-60 sm:col-span-2 cursor-pointer"
            >
              {busy ? 'Creating account…' : 'Create @dlsau.edu.ph account'}
            </button>
          </form>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--color-line)] pt-4 text-sm text-[#454545]">
            <span>Already registered?</span>
            <Link to={`/login${nextQuery}`} className="inline-flex min-h-[44px] items-center font-medium text-[#1f6b3a] underline underline-offset-4">
              Sign in to LostLink
            </Link>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
