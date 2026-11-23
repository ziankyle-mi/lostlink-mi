import { useMemo, useState } from 'react';
import { Footer } from '../components/Footer';
import { Header } from '../components/Header';
import { Tooltip } from '../components/InfoTip';
import { StatusPill } from '../components/StatusPill';
import { useLostLink } from '../lib/store';
import type { CollegeCode, UserRole } from '../types';

const COLLEGES: ('all' | CollegeCode)[] = ['all', 'CAST', 'CVMAS', 'CBMA', 'COED'];

export function AdminUsersPage() {
  const {
    currentUser,
    profiles,
    updateUserRole,
    toggleUserActive,
    issueTempPassword,
  } = useLostLink();

  const [college, setCollege] = useState<'all' | CollegeCode>('all');
  const [program, setProgram] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'suspended'>('all');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState(profiles[0]?.id ?? '');
  const [note, setNote] = useState('');
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [issuingPassword, setIssuingPassword] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return profiles.filter((u) => {
      if (college !== 'all' && u.college !== college) return false;
      if (program !== 'all' && u.program !== program) return false;
      if (statusFilter === 'active' && !u.active) return false;
      if (statusFilter === 'suspended' && u.active) return false;
      if (q && !`${u.fullName} ${u.email} ${u.studentId ?? ''} ${u.program}`.toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
  }, [profiles, college, program, statusFilter, search]);

  const selected = filtered.find((u) => u.id === selectedId) ?? filtered[0] ?? null;
  const isSelf = selected?.id === currentUser?.id;

  const initialsOf = (name: string) =>
    name
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('');

  return (
    <div className="flex min-h-[100svh] flex-col bg-[#f6f7f2]">
      <Header />

      <main className="mx-auto w-full max-w-[1280px] flex-1 px-6 py-6 sm:px-12 lg:px-20 lg:py-8">
        <div className="grid gap-5">
          <div>
            <h1 className="text-[28px] font-semibold leading-tight tracking-[-0.025em] sm:text-[34px]">
              Campus Accounts Directory
            </h1>
            <p className="mt-1.5 text-[15px] text-[#454545]">
              Review verified @dlsau.edu.ph accounts across CAST, CVMAS, CBMA, and COED. Self-protection blocks downgrading your active admin session.
            </p>
          </div>

          <section
            aria-label="Filter campus accounts"
            className="grid gap-4 rounded-xl border border-[var(--color-line-strong)] bg-white p-4"
          >
            <div className="flex flex-wrap gap-2" role="group" aria-label="College filter">
              {COLLEGES.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-pressed={college === c}
                  onClick={() => setCollege(c)}
                  className={`min-h-[44px] rounded-lg border px-4 text-sm font-medium cursor-pointer ${
                    college === c
                      ? 'border-[#1f6b3a] bg-[#1f6b3a] text-white'
                      : 'border-[var(--color-line-strong)] bg-white text-[#0a0a0a]'
                  }`}
                >
                  {c === 'all' ? 'All colleges' : c}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_auto]">
              <div className="grid gap-1.5">
                <label htmlFor="dir-search" className="text-[13px] font-medium text-[#454545]">
                  Search name, Student ID, or email
                </label>
                <input
                  id="dir-search"
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="2024-00-012480 or @dlsau.edu.ph"
                  className="h-[44px] w-full rounded-lg border border-[var(--color-line-strong)] bg-white px-3 text-base"
                />
              </div>

              <div className="grid gap-1.5">
                <label htmlFor="dir-prog" className="text-[13px] font-medium text-[#454545]">
                  Degree program
                </label>
                <select
                  id="dir-prog"
                  value={program}
                  onChange={(e) => setProgram(e.target.value)}
                  className="h-[44px] w-full rounded-lg border border-[var(--color-line-strong)] bg-white px-3 text-base"
                >
                  <option value="all">All programs</option>
                  {['BSCS', 'BSCpE', 'BSBio', 'DVM', 'BSA', 'BSBA', 'BSAcc', 'BSEd', 'BEEd'].map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-1.5">
                <label htmlFor="dir-status" className="text-[13px] font-medium text-[#454545]">
                  Account status
                </label>
                <select
                  id="dir-status"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'suspended')}
                  className="h-[44px] w-full rounded-lg border border-[var(--color-line-strong)] bg-white px-3 text-base"
                >
                  <option value="all">All statuses</option>
                  <option value="active">Active</option>
                  <option value="suspended">Suspended</option>
                </select>
              </div>

              <button
                type="button"
                onClick={() => {
                  setCollege('all');
                  setProgram('all');
                  setStatusFilter('all');
                  setSearch('');
                }}
                className="h-[44px] rounded-lg border border-[var(--color-line-strong)] bg-white px-4 text-sm font-medium hover:bg-[#f6f7f2] cursor-pointer"
              >
                Reset
              </button>
            </div>
          </section>

          <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[5fr_7fr]">
            <section className="overflow-hidden rounded-xl border border-[var(--color-line-strong)] bg-white">
              <div className="flex items-center justify-between border-b border-[var(--color-line)] px-5 py-4">
                <h2 className="text-base font-semibold">Registered accounts</h2>
                <span className="font-mono text-xs text-[#454545]">
                  Showing {filtered.length} of {profiles.length}
                </span>
              </div>
              <div className="divide-y divide-[var(--color-line)]">
                {filtered.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => {
                      setSelectedId(u.id);
                      setNote('');
                      setTempPassword(null);
                    }}
                    aria-current={selected?.id === u.id ? 'true' : 'false'}
                    className={`grid w-full grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-3 px-5 py-3.5 text-left cursor-pointer ${
                      selected?.id === u.id ? 'bg-[#eaf1e9]' : 'bg-white hover:bg-[#f6f7f2]'
                    }`}
                  >
                    <span className="grid h-11 w-11 place-items-center rounded-lg border border-[var(--color-line)] bg-[#f6f7f2] font-mono text-[13px] font-medium text-[#1f6b3a]">
                      {initialsOf(u.fullName)}
                    </span>
                    <div className="min-w-0">
                      <div className="truncate text-[15px] font-semibold">{u.fullName}</div>
                      <div className="truncate text-sm text-[#454545]">
                        {u.program} · {u.college} · <span className="font-mono text-xs">{u.studentId ?? 'Staff'}</span>
                      </div>
                    </div>
                    <StatusPill tone={u.active ? 'green' : 'red'} label={u.active ? 'Active' : 'Suspended'} />
                  </button>
                ))}
              </div>
            </section>

            <aside className="overflow-hidden rounded-xl border border-[var(--color-line-strong)] bg-white">
              <div className="flex items-center justify-between border-b border-[var(--color-line)] px-5 py-4">
                <h2 className="text-base font-semibold">Account inspector</h2>
                {selected && (
                  <StatusPill
                    tone={selected.active ? 'green' : 'red'}
                    label={selected.active ? 'Active' : 'Suspended'}
                  />
                )}
              </div>

              {selected ? (
                <div className="grid gap-5 p-5">
                  <div className="flex items-center gap-3">
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg border border-[var(--color-line)] bg-[#f6f7f2] font-mono text-sm font-medium text-[#1f6b3a]">
                      {initialsOf(selected.fullName)}
                    </span>
                    <div>
                      <h3 className="text-[22px] font-semibold leading-tight">{selected.fullName}</h3>
                      <p className="text-sm text-[#454545]">{selected.email}</p>
                    </div>
                  </div>

                  <dl className="divide-y divide-[var(--color-line)] border-y border-[var(--color-line)] text-sm">
                    <div className="flex justify-between py-2.5">
                      <dt className="text-[#454545]">College</dt>
                      <dd className="font-medium">{selected.college}</dd>
                    </div>
                    <div className="flex justify-between py-2.5">
                      <dt className="text-[#454545]">Degree program</dt>
                      <dd className="font-medium">{selected.program}</dd>
                    </div>
                    <div className="flex justify-between py-2.5">
                      <dt className="text-[#454545]">Student / Staff ID</dt>
                      <dd className="font-mono font-medium">{selected.studentId ?? 'Staff'}</dd>
                    </div>
                    <div className="flex justify-between py-2.5">
                      <dt className="text-[#454545]">Standing</dt>
                      <dd className="font-medium">{selected.yearLevel ?? 'Faculty / Admin'}</dd>
                    </div>
                  </dl>

                  {isSelf && (
                    <p className="rounded-lg border border-[var(--color-line)] bg-[#f6f7f2] p-3 text-sm text-[#454545]">
                      Self-protection active: you cannot suspend, deactivate, or downgrade your own signed-in DO Admin account.
                    </p>
                  )}

                  <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-2">
                    <div className="grid gap-1.5">
                      <label htmlFor="acc-role" className="text-[13px] font-medium text-[#454545]">
                        Assigned role
                      </label>
                      <select
                        id="acc-role"
                        disabled={isSelf}
                        value={selected.role}
                        onChange={(e) => {
                          updateUserRole(selected.id, e.target.value as UserRole);
                          setNote(`Updated ${selected.fullName} role.`);
                        }}
                        className="h-[44px] w-full rounded-lg border border-[var(--color-line-strong)] bg-white px-3 text-base disabled:opacity-50"
                      >
                        <option value="user">Student / Faculty</option>
                        <option value="admin">DO Admin</option>
                      </select>
                    </div>

                    <Tooltip
                      text={
                        isSelf
                          ? 'Self-protection: you cannot suspend your active DO Admin session'
                          : selected.active
                            ? 'Blocks portal sign-in until reactivated by a DO Admin'
                            : 'Restores portal sign-in for this @dlsau.edu.ph account'
                      }
                      className="w-full"
                    >
                      <button
                        type="button"
                        disabled={isSelf}
                        onClick={() => {
                          toggleUserActive(selected.id);
                          setNote(`${selected.fullName} status updated.`);
                        }}
                        className="h-[44px] w-full rounded-lg border border-[#ef9a9a] bg-white px-4 text-sm font-medium text-[#991b1b] hover:bg-[#fef2f2] disabled:opacity-50 cursor-pointer"
                      >
                        {selected.active ? 'Suspend account' : 'Reactivate account'}
                      </button>
                    </Tooltip>
                  </div>

                  <div className="grid gap-3">
                    <div>
                      <Tooltip
                        text={
                          isSelf
                            ? 'Self-protection: ask another DO Admin to reset your own password'
                            : 'Generates a one-time password and forces a password change at next login'
                        }
                      >
                        <button
                          type="button"
                          disabled={isSelf || issuingPassword}
                          onClick={async () => {
                            setIssuingPassword(true);
                            setTempPassword(null);
                            setNote('');
                            const res = await issueTempPassword(selected.id);
                            setIssuingPassword(false);
                            if (!res.ok) {
                              setNote(res.error ?? 'Could not issue temporary password.');
                              return;
                            }
                            if (res.tempPassword) {
                              setTempPassword(res.tempPassword);
                            }
                            setNote(`Temporary password issued for ${selected.email}.`);
                          }}
                          className="inline-flex h-[44px] items-center rounded-lg bg-[#1f6b3a] px-4 text-sm font-medium text-white hover:bg-[#19562e] disabled:opacity-50 cursor-pointer"
                        >
                          {issuingPassword ? 'Issuing password…' : 'Issue temporary password'}
                        </button>
                      </Tooltip>
                    </div>
                    {tempPassword && (
                      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#c2dec9] bg-[#e7f3ea] px-3.5 py-2.5 text-sm text-[#15522b]">
                        <span>
                          One-time password:{' '}
                          <strong className="font-mono text-[#0a0a0a]">{tempPassword}</strong>
                        </span>
                        <button
                          type="button"
                          onClick={() => void navigator.clipboard?.writeText(tempPassword)}
                          className="min-h-[36px] rounded-md border border-[#b7d9c2] bg-white px-2.5 text-xs font-medium text-[#0a0a0a] hover:bg-[#f6f7f2] cursor-pointer"
                        >
                          Copy
                        </button>
                      </div>
                    )}
                  </div>

                  {note && (
                    <p role="status" className="text-sm font-medium text-[#1f6b3a]">
                      {note}
                    </p>
                  )}
                </div>
              ) : (
                <p className="p-5 text-sm text-[#454545]">No account selected.</p>
              )}
            </aside>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
