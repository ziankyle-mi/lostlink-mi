import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Footer } from '../components/Footer';
import { Header } from '../components/Header';
import { Tooltip } from '../components/InfoTip';
import { PhotoSlider } from '../components/PhotoSlider';
import { StatusPill, type StatusTone } from '../components/StatusPill';
import { ValidationBubble } from '../components/ValidationBubble';
import { useLostLink } from '../lib/store';
import type { BroadcastTier } from '../types';

type AdminTab = 'claims' | 'intake' | 'unclaimed' | 'broadcasts' | 'audit';

const ACTION_META: Record<string, { label: string; tone: StatusTone }> = {
  confirm_intake: { label: 'Intake confirmed', tone: 'green' },
  reject_intake: { label: 'Intake rejected', tone: 'red' },
  delete_item: { label: 'Item deleted', tone: 'red' },
  toggle_photo_shield: { label: 'Photo shield', tone: 'amber' },
  verify_claim: { label: 'Claim verified', tone: 'green' },
  deny_claim: { label: 'Claim denied', tone: 'red' },
  extend_custody: { label: 'Hold extended', tone: 'amber' },
  donation_turnover: { label: 'Donation turnover', tone: 'green' },
  publish_broadcast: { label: 'Broadcast posted', tone: 'green' },
  remove_broadcast: { label: 'Broadcast removed', tone: 'amber' },
  update_user_role: { label: 'Role updated', tone: 'amber' },
  toggle_user_active: { label: 'Account status', tone: 'amber' },
  issue_temp_password: { label: 'Temp password', tone: 'amber' },
};

function daysSince(iso: string): number {
  const parsed = Date.parse(iso);
  if (Number.isNaN(parsed)) return 0;
  return Math.max(0, Math.floor((Date.now() - parsed) / 86_400_000));
}

function ItemThumb({ src, alt }: { src?: string; alt: string }) {
  return (
    <div className="h-14 w-[76px] shrink-0 overflow-hidden rounded-lg border border-[var(--color-line)] bg-[#ecefe7]">
      {src ? (
        <img src={src} alt={alt} className="h-full w-full object-cover" />
      ) : (
        <div className="grid h-full w-full place-items-center font-mono text-[10px] text-[#454545]">
          No img
        </div>
      )}
    </div>
  );
}

export function AdminPage() {
  const {
    items,
    claims,
    profiles,
    broadcasts,
    adminLog,
    confirmIntake,
    rejectIntake,
    deleteItem,
    toggleItemPhotoShield,
    verifyClaim,
    extendCustody,
    markDonationTurnover,
    publishBroadcast,
    removeBroadcast,
  } = useLostLink();

  const [tab, setTab] = useState<AdminTab>('claims');
  const [selectedClaimId, setSelectedClaimId] = useState<string>(() => claims[0]?.id ?? '');
  const [bcTier, setBcTier] = useState<BroadcastTier>('Info');
  const [bcMessage, setBcMessage] = useState('');
  const [actionNote, setActionNote] = useState('');
  const [denialReason, setDenialReason] = useState('');
  const [rejectTargetId, setRejectTargetId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectError, setRejectError] = useState<string | null>(null);
  const [bcError, setBcError] = useState<string | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [turnoverTargetId, setTurnoverTargetId] = useState<string | null>(null);

  const itemMap = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const profileMap = useMemo(() => new Map(profiles.map((p) => [p.id, p])), [profiles]);

  const { pendingIntake, unclaimedFound, returnedCount } = useMemo(() => {
    const pending: typeof items = [];
    const unclaimed: typeof items = [];
    let returned = 0;
    for (const item of items) {
      if (item.status === 'resolved') returned += 1;
      else if (item.type === 'found' && item.status === 'pending') pending.push(item);
      else if (item.type === 'found' && item.status === 'approved') unclaimed.push(item);
    }
    unclaimed.sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
    return { pendingIntake: pending, unclaimedFound: unclaimed, returnedCount: returned };
  }, [items]);
  const custodyCount = unclaimedFound.length;

  const pendingClaimsCount = useMemo(
    () => claims.reduce((n, c) => n + (c.status === 'pending' ? 1 : 0), 0),
    [claims]
  );

  const activeClaim = useMemo(
    () => claims.find((c) => c.id === selectedClaimId) ?? claims[0] ?? null,
    [claims, selectedClaimId]
  );
  const activeClaimId = activeClaim?.id ?? '';
  const activeItem = activeClaim ? itemMap.get(activeClaim.itemId) : undefined;
  const activeClaimant = activeClaim ? profileMap.get(activeClaim.claimantId) : undefined;

  // Clear dossier draft inputs when the active claim changes (manual click or queue update).
  useEffect(() => {
    setActionNote('');
    setDenialReason('');
  }, [activeClaimId]);

  const selectTab = (next: AdminTab) => {
    setTab(next);
    setRejectTargetId(null);
    setRejectReason('');
    setRejectError(null);
    setDeleteTargetId(null);
    setTurnoverTargetId(null);
    setBcError(null);
  };

  const handleBroadcastSubmit = (e: FormEvent) => {
    e.preventDefault();
    const clean = bcMessage.trim();
    if (clean.length < 5) {
      setBcError('Enter a campus announcement (at least 5 characters).');
      document.getElementById('bc-msg')?.focus();
      return;
    }
    setBcError(null);
    publishBroadcast(bcTier, clean);
    setBcMessage('');
  };

  return (
    <div className="flex min-h-[100svh] flex-col bg-[#f6f7f2]">
      <Header />

      <main className="mx-auto w-full max-w-[1280px] flex-1 px-6 py-6 sm:px-12 lg:px-20 lg:py-8">
        <div className="grid gap-5">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-[28px] font-semibold leading-tight tracking-[-0.025em] sm:text-[34px]">
                Disciplinary Office Console
              </h1>
              <p className="mt-1.5 text-[15px] text-[#454545]">
                Verify physical ownership proofs at LSB Room 102, confirm student turn-ins, and manage campus notices.
              </p>
            </div>
            <Link
              to="/admin/users"
              viewTransition
              className="inline-flex min-h-[44px] items-center rounded-lg border border-[var(--color-line-strong)] bg-white px-4 text-sm font-medium hover:bg-[#f6f7f2]"
            >
              Manage {profiles.length} campus accounts
            </Link>
          </div>

          <section
            aria-label="Custody ledger summary"
            className="grid grid-cols-1 gap-px overflow-hidden rounded-xl border border-[var(--color-line-strong)] bg-[var(--color-line)] sm:grid-cols-2 lg:grid-cols-4"
          >
            {(
              [
                ['claims', 'Claims to verify', pendingClaimsCount, 'Awaiting DO verification'],
                ['intake', 'Waiting for intake', pendingIntake.length, 'Pending physical drop-off'],
                ['unclaimed', 'Items in custody', custodyCount, 'LSB Room 102 vault'],
              ] as const
            ).map(([id, label, value, sub]) => {
              const active = tab === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => selectTab(id)}
                  aria-pressed={active}
                  className={`grid gap-1 px-5 py-4 text-left transition-colors cursor-pointer ${
                    active ? 'bg-[#134e3a] text-white' : 'bg-white text-[#0a0a0a] hover:bg-[#f6f7f2]'
                  }`}
                >
                  <span className={`text-sm ${active ? 'text-white/85' : 'text-[#454545]'}`}>
                    {label}
                  </span>
                  <strong className="text-[30px] font-semibold leading-none tabular-nums">
                    {value}
                  </strong>
                  <span
                    className={`font-mono text-xs ${active ? 'text-[#daef8a]' : 'text-[#454545]'}`}
                  >
                    {sub}
                  </span>
                </button>
              );
            })}
            <div className="grid gap-1 bg-[#f6f7f2] px-5 py-4">
              <span className="text-sm text-[#454545]">Returned items</span>
              <strong className="text-[30px] font-semibold leading-none tabular-nums text-[#1f6b3a]">
                {returnedCount}
              </strong>
              <span className="font-mono text-xs text-[#454545]">Released to owners</span>
            </div>
          </section>

          <div className="flex flex-wrap gap-2" role="tablist" aria-label="Admin queues">
            {(
              [
                ['claims', `Claims to verify (${pendingClaimsCount})`],
                ['intake', `Waiting for intake (${pendingIntake.length})`],
                ['unclaimed', `Unclaimed (${unclaimedFound.length})`],
                ['broadcasts', `Broadcasts (${broadcasts.length})`],
                ['audit', `Audit log (${adminLog.length})`],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={tab === id}
                onClick={() => selectTab(id)}
                className={`min-h-[44px] rounded-lg border px-4 text-sm font-medium cursor-pointer ${tab === id
                    ? 'border-[#1f6b3a] bg-[#1f6b3a] text-white'
                    : 'border-[var(--color-line-strong)] bg-white text-[#0a0a0a]'
                  }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[7fr_5fr]">
            <div>
              {tab === 'claims' && (
                <section className="overflow-hidden rounded-xl border border-[var(--color-line-strong)] bg-white">
                  <div className="flex items-center justify-between border-b border-[var(--color-line)] px-5 py-4">
                    <h2 className="text-base font-semibold">Claims queue</h2>
                    <span className="font-mono text-xs text-[#454545]">Select a claim to verify</span>
                  </div>
                  <div className="divide-y divide-[var(--color-line)]">
                    {claims.length === 0 ? (
                      <p className="p-5 text-sm text-[#454545]">
                        No ownership claims have been submitted yet.
                      </p>
                    ) : (
                      claims.map((claim) => {
                        const item = itemMap.get(claim.itemId);
                        const claimant = profileMap.get(claim.claimantId);
                        const selected = activeClaim?.id === claim.id;
                        return (
                          <button
                            key={claim.id}
                            type="button"
                            onClick={() => setSelectedClaimId(claim.id)}
                            aria-current={selected ? 'true' : 'false'}
                            className={`grid w-full grid-cols-[1fr_auto] items-center gap-3 px-5 py-3.5 text-left sm:grid-cols-[1.3fr_1fr_auto] cursor-pointer ${selected ? 'bg-[#eaf1e9]' : 'bg-white hover:bg-[#f6f7f2]'
                              }`}
                          >
                            <div className="min-w-0">
                              <div className="truncate text-[15px] font-semibold">
                                {item?.name ?? 'Campus item'}
                              </div>
                              <div className="truncate text-sm text-[#454545]">
                                {item?.location ?? 'Campus'} ·{' '}
                                <span className="font-mono text-xs">{item?.referenceCode ?? '—'}</span>
                              </div>
                            </div>
                            <div className="hidden min-w-0 sm:block">
                              <div className="truncate text-[15px] font-semibold">
                                {claimant?.fullName ?? 'DLSAU Student'}
                              </div>
                              <div className="truncate font-mono text-xs text-[#454545]">
                                {claimant?.studentId ?? claimant?.email ?? '—'}
                              </div>
                            </div>
                            <StatusPill
                              tone={
                                claim.status === 'verified'
                                  ? 'green'
                                  : claim.status === 'denied' || claim.status === 'withdrawn'
                                    ? 'red'
                                    : 'amber'
                              }
                              label={claim.status}
                            />
                          </button>
                        );
                      })
                    )}
                  </div>
                </section>
              )}

              {tab === 'intake' && (
                <section className="overflow-hidden rounded-xl border border-[var(--color-line-strong)] bg-white">
                  <div className="flex items-center justify-between border-b border-[var(--color-line)] px-5 py-4">
                    <h2 className="text-base font-semibold">Waiting for physical drop-off</h2>
                    <span className="font-mono text-xs text-[#454545]">Confirm once item reaches LSB 102</span>
                  </div>
                  <div className="divide-y divide-[var(--color-line)]">
                    {pendingIntake.length === 0 ? (
                      <p className="p-5 text-sm text-[#454545]">
                        All submitted found items have been confirmed in LSB Room 102 custody.
                      </p>
                    ) : (
                      pendingIntake.map((item) => {
                        const isRejecting = rejectTargetId === item.id;
                        const isDeleting = deleteTargetId === item.id;
                        return (
                          <div key={item.id} className="grid gap-3 px-5 py-4">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <div className="flex min-w-0 items-center gap-3">
                                <ItemThumb src={item.images[0]} alt={item.name} />
                                <div className="min-w-0">
                                  <div className="truncate text-[15px] font-semibold">{item.name}</div>
                                  <div className="text-sm text-[#454545]">
                                    {item.location} · <span className="font-mono text-xs">{item.referenceCode}</span>
                                    {item.hidePhoto ? ' · Photo shielded' : ''}
                                  </div>
                                </div>
                              </div>
                              <div className="flex flex-wrap items-center gap-2">
                                <Tooltip
                                  text={
                                    item.hidePhoto
                                      ? 'Photos are hidden from students on the public feed. Click to make visible.'
                                      : 'Hide this item’s photos from students (DO Admin only).'
                                  }
                                >
                                  <button
                                    type="button"
                                    aria-pressed={item.hidePhoto}
                                    onClick={() => toggleItemPhotoShield(item.id)}
                                    className={`inline-flex min-h-[44px] items-center rounded-lg border px-3 text-sm font-medium transition-colors cursor-pointer ${item.hidePhoto
                                        ? 'border-[#b7d9c2] bg-[#e7f3ea] text-[#15522b] hover:bg-[#d8ecde]'
                                        : 'border-[var(--color-line-strong)] bg-white text-[#0a0a0a] hover:bg-[#f6f7f2]'
                                      }`}
                                  >
                                    {item.hidePhoto ? 'Photo shielded' : 'Shield photo'}
                                  </button>
                                </Tooltip>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setRejectTargetId(null);
                                    setDeleteTargetId(null);
                                    confirmIntake(item.id);
                                  }}
                                  className="inline-flex min-h-[44px] items-center rounded-lg bg-[#1f6b3a] px-4 text-sm font-medium text-white hover:bg-[#19562e] cursor-pointer"
                                >
                                  Confirm received
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setDeleteTargetId(null);
                                    setRejectTargetId(isRejecting ? null : item.id);
                                    setRejectReason('');
                                    setRejectError(null);
                                  }}
                                  className="inline-flex min-h-[44px] items-center rounded-lg border border-[#ef9a9a] bg-white px-3 text-sm font-medium text-[#991b1b] hover:bg-[#fef2f2] cursor-pointer"
                                >
                                  Reject
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setRejectTargetId(null);
                                    setDeleteTargetId(isDeleting ? null : item.id);
                                  }}
                                  className="inline-flex min-h-[44px] items-center rounded-lg border border-[var(--color-line-strong)] bg-white px-3 text-sm font-medium text-[#454545] hover:bg-[#f6f7f2] hover:text-[#0a0a0a] cursor-pointer"
                                >
                                  Delete
                                </button>
                              </div>
                            </div>

                            {isRejecting && (
                              <form
                                noValidate
                                onSubmit={(e) => {
                                  e.preventDefault();
                                  const cleanReason = rejectReason.trim();
                                  if (cleanReason.length < 5) {
                                    setRejectError('Enter a brief rejection reason (at least 5 characters) for the reporter.');
                                    document.getElementById(`reject-reason-${item.id}`)?.focus();
                                    return;
                                  }
                                  rejectIntake(item.id, cleanReason);
                                  setRejectTargetId(null);
                                  setRejectReason('');
                                  setRejectError(null);
                                }}
                                className="grid gap-2 rounded-lg border border-[var(--color-line)] bg-[#f6f7f2] p-3"
                              >
                                <div className="flex flex-wrap items-center gap-2">
                                  <label htmlFor={`reject-reason-${item.id}`} className="sr-only">
                                    Rejection reason
                                  </label>
                                  <input
                                    id={`reject-reason-${item.id}`}
                                    type="text"
                                    required
                                    value={rejectReason}
                                    onChange={(e) => {
                                      setRejectReason(e.target.value);
                                      if (rejectError && e.target.value.trim().length >= 5) setRejectError(null);
                                    }}
                                    aria-invalid={Boolean(rejectError)}
                                    aria-describedby={rejectError ? `reject-err-${item.id}` : undefined}
                                    placeholder="Reason for rejecting this report (notifies reporter)…"
                                    className="h-11 min-w-[200px] flex-1 rounded-lg border border-[var(--color-line-strong)] bg-white px-3 text-sm"
                                  />
                                  <button
                                    type="submit"
                                    className="inline-flex min-h-[44px] items-center rounded-lg bg-[#b91c1c] px-4 text-sm font-medium text-white hover:bg-[#991b1b] cursor-pointer"
                                  >
                                    Confirm reject
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setRejectTargetId(null);
                                      setRejectError(null);
                                    }}
                                    className="inline-flex min-h-[44px] items-center rounded-lg border border-[var(--color-line-strong)] bg-white px-3 text-sm font-medium text-[#0a0a0a] hover:bg-[#ecefe7] cursor-pointer"
                                  >
                                    Cancel
                                  </button>
                                </div>
                                <ValidationBubble id={`reject-err-${item.id}`} message={rejectError} />
                              </form>
                            )}

                            {isDeleting && (
                              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#fecaca] bg-[#fef2f2] p-3">
                                <span className="text-sm font-medium text-[#991b1b]">
                                  Permanently delete {item.referenceCode}?
                                </span>
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      deleteItem(item.id);
                                      setDeleteTargetId(null);
                                    }}
                                    className="inline-flex min-h-[44px] items-center rounded-lg bg-[#b91c1c] px-4 text-sm font-medium text-white hover:bg-[#991b1b] cursor-pointer"
                                  >
                                    Confirm delete
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setDeleteTargetId(null)}
                                    className="inline-flex min-h-[44px] items-center rounded-lg border border-[var(--color-line-strong)] bg-white px-3 text-sm font-medium text-[#0a0a0a] hover:bg-[#ecefe7] cursor-pointer"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </section>
              )}

              {tab === 'unclaimed' && (
                <section className="overflow-hidden rounded-xl border border-[var(--color-line-strong)] bg-white">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--color-line)] px-5 py-4">
                    <h2 className="text-base font-semibold">Unclaimed custody review</h2>
                    <span className="font-mono text-xs text-[#454545]">
                      Oldest vault holdings first
                    </span>
                  </div>
                  <div className="divide-y divide-[var(--color-line)]">
                    {unclaimedFound.length === 0 ? (
                      <p className="p-5 text-sm text-[#454545]">
                        No unclaimed found items currently held in LSB Room 102.
                      </p>
                    ) : (
                      unclaimedFound.map((item) => {
                        const heldDays = daysSince(item.createdAt);
                        const confirmingTurnover = turnoverTargetId === item.id;
                        return (
                          <div key={item.id} className="grid gap-3 px-5 py-4">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <div className="flex min-w-0 items-center gap-3">
                                <ItemThumb src={item.images[0]} alt={item.name} />
                                <div className="min-w-0">
                                  <div className="truncate text-[15px] font-semibold">{item.name}</div>
                                  <div className="text-sm text-[#454545]">
                                    {item.location} · <span className="font-mono text-xs">{item.referenceCode}</span>
                                  </div>
                                  <div className="mt-0.5 flex flex-wrap items-center gap-2 font-mono text-xs text-[#454545]">
                                    <span className={heldDays >= 30 ? 'font-medium text-[#991b1b]' : ''}>
                                      {heldDays} {heldDays === 1 ? 'day' : 'days'} in custody
                                    </span>
                                    {item.custodyExtendedUntil && (
                                      <span className="rounded bg-[#e7f3ea] px-1.5 py-0.5 text-[#15522b]">
                                        Extended to {item.custodyExtendedUntil.slice(0, 10)}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              <div className="flex flex-wrap items-center gap-2">
                                <Tooltip text="Add 14 days to the LSB Room 102 vault retention window and log the extension">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setTurnoverTargetId(null);
                                      extendCustody(item.id);
                                    }}
                                    className="inline-flex min-h-[44px] items-center rounded-lg border border-[var(--color-line-strong)] bg-white px-3.5 text-sm font-medium text-[#0a0a0a] hover:bg-[#f6f7f2] cursor-pointer"
                                  >
                                    Extend hold (+14 days)
                                  </button>
                                </Tooltip>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setTurnoverTargetId(confirmingTurnover ? null : item.id)
                                  }
                                  className="inline-flex min-h-[44px] items-center rounded-lg border border-[#b7d9c2] bg-[#e7f3ea] px-3.5 text-sm font-medium text-[#15522b] hover:bg-[#d8ecde] cursor-pointer"
                                >
                                  Mark donation turnover
                                </button>
                              </div>
                            </div>

                            {confirmingTurnover && (
                              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--color-line)] bg-[#f6f7f2] p-3">
                                <span className="text-sm text-[#0a0a0a]">
                                  Close <span className="font-mono">{item.referenceCode}</span> as campus donation turnover?
                                </span>
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      markDonationTurnover(item.id);
                                      setTurnoverTargetId(null);
                                    }}
                                    className="inline-flex min-h-[44px] items-center rounded-lg bg-[#1f6b3a] px-4 text-sm font-medium text-white hover:bg-[#19562e] cursor-pointer"
                                  >
                                    Confirm turnover
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setTurnoverTargetId(null)}
                                    className="inline-flex min-h-[44px] items-center rounded-lg border border-[var(--color-line-strong)] bg-white px-3 text-sm font-medium text-[#0a0a0a] hover:bg-[#ecefe7] cursor-pointer"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </section>
              )}

              {tab === 'broadcasts' && (
                <section className="overflow-hidden rounded-xl border border-[var(--color-line-strong)] bg-white">
                  <div className="flex items-center justify-between border-b border-[var(--color-line)] px-5 py-4">
                    <h2 className="text-base font-semibold">Active campus notices</h2>
                    <span className="font-mono text-xs text-[#454545]">Visible in student header ticker</span>
                  </div>
                  <div className="divide-y divide-[var(--color-line)]">
                    {broadcasts.length === 0 ? (
                      <p className="p-5 text-sm text-[#454545]">
                        No active campus notices. Publish one below to show in the student banner.
                      </p>
                    ) : (
                      broadcasts.map((b) => (
                        <div key={b.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                          <div className="grid gap-1">
                            <span className="w-fit rounded-full border border-[#bae6fd] bg-[#e0f2fe] px-2.5 py-0.5 text-xs font-medium text-[#075985]">
                              {b.tier}
                            </span>
                            <p className="text-sm">{b.message}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeBroadcast(b.id)}
                            className="min-h-[44px] rounded-lg border border-[var(--color-line-strong)] px-3 text-sm font-medium hover:bg-[#f6f7f2] cursor-pointer"
                          >
                            Remove
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                  <form onSubmit={handleBroadcastSubmit} noValidate className="grid gap-3 border-t border-[var(--color-line)] p-5">
                    <div className="grid gap-1.5">
                      <label htmlFor="bc-tier" className="text-sm font-medium">
                        Urgency tier
                      </label>
                      <select
                        id="bc-tier"
                        value={bcTier}
                        onChange={(e) => setBcTier(e.target.value as BroadcastTier)}
                        className="h-[44px] rounded-lg border border-[var(--color-line-strong)] bg-white px-3 text-base"
                      >
                        <option value="Info">Info · Normal campus notice</option>
                        <option value="Warning">Warning · Custody cutoff</option>
                        <option value="Alert">Alert · Urgent security notice</option>
                      </select>
                    </div>
                    <div className="grid gap-1.5">
                      <label htmlFor="bc-msg" className="text-sm font-medium">
                        Announcement message
                      </label>
                      <input
                        id="bc-msg"
                        type="text"
                        required
                        value={bcMessage}
                        onChange={(e) => {
                          setBcMessage(e.target.value);
                          if (bcError && e.target.value.trim().length >= 5) setBcError(null);
                        }}
                        aria-invalid={Boolean(bcError)}
                        aria-describedby={bcError ? 'bc-msg-err' : undefined}
                        placeholder="e.g. Semester unclaimed items window closes Friday 5:00 PM."
                        className="h-[44px] rounded-lg border border-[var(--color-line-strong)] bg-white px-3 text-base"
                      />
                      <ValidationBubble id="bc-msg-err" message={bcError} />
                    </div>
                    <button
                      type="submit"
                      className="inline-flex h-[46px] w-full items-center justify-center rounded-lg bg-[#1f6b3a] text-base font-medium text-white hover:bg-[#19562e] cursor-pointer"
                    >
                      Publish campus broadcast
                    </button>
                  </form>
                </section>
              )}

              {tab === 'audit' && (
                <section className="overflow-hidden rounded-xl border border-[var(--color-line-strong)] bg-white">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--color-line)] px-5 py-4">
                    <h2 className="text-base font-semibold">Admin audit log</h2>
                    <span className="font-mono text-xs text-[#454545]">
                      Immutable DO Admin trail
                    </span>
                  </div>
                  <div className="divide-y divide-[var(--color-line)]">
                    {adminLog.length === 0 ? (
                      <p className="p-5 text-sm text-[#454545]">No admin actions recorded yet.</p>
                    ) : (
                      adminLog.map((entry) => {
                        const admin = profileMap.get(entry.adminId);
                        const meta = ACTION_META[entry.action] ?? {
                          label: entry.action,
                          tone: 'amber' as StatusTone,
                        };
                        return (
                          <div key={entry.id} className="grid gap-1.5 px-5 py-3.5">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <StatusPill tone={meta.tone} label={meta.label} />
                                <span className="font-mono text-xs font-medium text-[#0a0a0a]">
                                  {entry.targetLabel}
                                </span>
                              </div>
                              <span className="font-mono text-xs text-[#454545]">
                                {entry.createdAt.replace('T', ' ').slice(0, 16)}
                              </span>
                            </div>
                            <p className="text-sm text-[#0a0a0a]">{entry.detail}</p>
                            <span className="text-xs text-[#454545]">
                              By {admin?.fullName ?? 'DO Admin'}
                            </span>
                          </div>
                        );
                      })
                    )}
                  </div>
                </section>
              )}
            </div>

            {/* Right: Claim Dossier */}
            <aside className="overflow-hidden rounded-xl border border-[var(--color-line-strong)] bg-white lg:sticky lg:top-[88px]">
              <div className="flex items-center justify-between border-b border-[var(--color-line)] px-5 py-4">
                <h2 className="text-base font-semibold">Claim dossier</h2>
                <span className="font-mono text-xs text-[#454545]">{activeItem?.referenceCode ?? '—'}</span>
              </div>
              {activeClaim && activeItem ? (
                <div className="grid gap-4 p-5">
                  <div className="aspect-video overflow-hidden rounded-lg border border-[var(--color-line)] bg-[#f6f7f2]">
                    {/* DO Admin view intentionally unshields photos for physical verification */}
                    <PhotoSlider
                      images={activeItem.images}
                      alt={activeItem.name}
                      shielded={activeItem.hidePhoto}
                      adminUnlocked
                    />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold leading-tight">{activeItem.name}</h3>
                    <p className="mt-1 text-sm text-[#454545]">
                      Found at {activeItem.location}
                      {activeItem.hidePhoto ? ' · Photo Shield unlocked for DO Admin' : ''}
                    </p>
                  </div>
                  <dl className="divide-y divide-[var(--color-line)] border-y border-[var(--color-line)] text-sm">
                    <div className="flex justify-between py-2">
                      <dt className="text-[#454545]">Claimant</dt>
                      <dd className="font-medium">{activeClaimant?.fullName ?? 'DLSAU Member'}</dd>
                    </div>
                    <div className="flex justify-between py-2">
                      <dt className="text-[#454545]">Student ID</dt>
                      <dd className="font-mono font-medium">{activeClaimant?.studentId ?? 'Faculty'}</dd>
                    </div>
                    <div className="flex justify-between py-2">
                      <dt className="text-[#454545]">University email</dt>
                      <dd className="font-medium">{activeClaimant?.email ?? '—'}</dd>
                    </div>
                    <div className="flex justify-between py-2">
                      <dt className="text-[#454545]">College &amp; program</dt>
                      <dd className="font-medium">
                        {activeClaimant ? `${activeClaimant.program} · ${activeClaimant.college}` : '—'}
                      </dd>
                    </div>
                  </dl>
                  <div className="grid gap-1.5 rounded-lg border border-[var(--color-line)] bg-[#f6f7f2] p-3">
                    <span className="font-mono text-xs text-[#1f6b3a]">Private claimant ownership proof</span>
                    <p className="text-sm leading-relaxed">{activeClaim.proofDescription}</p>
                  </div>
                  {activeClaim.status === 'pending' && (
                    <div className="grid gap-1.5">
                      <label htmlFor="claim-denial-reason" className="text-xs font-medium text-[#454545]">
                        Denial reason (sent to claimant if denied)
                      </label>
                      <input
                        id="claim-denial-reason"
                        type="text"
                        value={denialReason}
                        onChange={(e) => setDenialReason(e.target.value)}
                        placeholder="e.g. Serial number or inner marks did not match"
                        className="h-11 w-full rounded-lg border border-[var(--color-line-strong)] bg-white px-3 text-sm"
                      />
                    </div>
                  )}
                  {activeClaim.status === 'denied' && activeClaim.denialReason && (
                    <p className="rounded-lg border border-[#fecaca] bg-[#fef2f2] px-3 py-2 text-xs text-[#991b1b]">
                      Denial reason: {activeClaim.denialReason}
                    </p>
                  )}
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      disabled={activeClaim.status !== 'pending'}
                      onClick={() => {
                        verifyClaim(activeClaim.id, 'verified');
                        setDenialReason('');
                        setActionNote(`Approved ${activeItem.referenceCode} for release.`);
                      }}
                      className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-[#1f6b3a] px-3 text-sm font-medium text-white hover:bg-[#19562e] disabled:opacity-45 cursor-pointer"
                    >
                      Approve &amp; Release
                    </button>
                    <button
                      type="button"
                      disabled={activeClaim.status !== 'pending'}
                      onClick={() => {
                        verifyClaim(activeClaim.id, 'denied', denialReason.trim());
                        setDenialReason('');
                        setActionNote(`Denied claim on ${activeItem.referenceCode}.`);
                      }}
                      className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-[#ef9a9a] bg-white px-3 text-sm font-medium text-[#991b1b] hover:bg-[#fef2f2] disabled:opacity-45 cursor-pointer"
                    >
                      Deny Claim
                    </button>
                  </div>
                  {actionNote && (
                    <p role="status" className="text-sm font-medium text-[#1f6b3a]">
                      {actionNote}
                    </p>
                  )}
                </div>
              ) : (
                <p className="p-5 text-sm text-[#454545]">No claims in queue.</p>
              )}
            </aside>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
