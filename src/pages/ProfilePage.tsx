import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ClipboardList, PackageCheck, ShieldCheck } from 'lucide-react';
import { Footer } from '../components/Footer';
import { Header } from '../components/Header';
import { PhotoSlider } from '../components/PhotoSlider';
import { useLostLink } from '../lib/store';
import type { Claim, Item } from '../types';

type InboxFilter = 'all' | 'claim' | 'report';

interface ActivityEntry {
  id: string;
  kind: 'claim' | 'report';
  claimId?: string;
  item?: Item;
  name: string;
  refCode: string;
  location: string;
  date: string;
  statusLabel: string;
  dotClass: string;
  ready: boolean;
  canWithdraw: boolean;
  step: 1 | 2 | 3;
  steps: readonly [string, string, string];
  note: string;
  nextAction: string;
}

const CLAIM_STEPS = ['Proof sent', 'Security review', 'LSB 102 pickup'] as const;
const REPORT_STEPS = ['Logged', 'Campus feed', 'Custody'] as const;

function claimToEntry(claim: Claim, item?: Item): ActivityEntry {
  const isVerified = claim.status === 'verified';
  const isDenied = claim.status === 'denied';
  return {
    id: `claim:${claim.id}`,
    kind: 'claim',
    claimId: claim.id,
    item,
    name: item?.name ?? 'Campus item',
    refCode: item?.referenceCode ?? 'LL-0000',
    location: item?.location ?? 'Campus',
    date: claim.createdAt.slice(0, 10),
    statusLabel: isVerified ? 'Ready at LSB 102' : isDenied ? 'Denied' : 'In review',
    dotClass: isVerified ? 'bg-[#1f6b3a]' : isDenied ? 'bg-[#b91c1c]' : 'bg-[#d97706]',
    ready: isVerified,
    canWithdraw: claim.status === 'pending',
    step: isVerified ? 3 : 2,
    steps: CLAIM_STEPS,
    note: claim.proofDescription,
    nextAction: isVerified
      ? 'Bring your DLSAU ID to Life Science Building Room 102 (Mon–Fri, 8:00 AM–5:00 PM) to release this item.'
      : isDenied
        ? claim.denialReason
          ? `Denied: ${claim.denialReason}`
          : 'Visit LSB Room 102 with additional ownership proof.'
        : 'DLSAU Security is reviewing your ownership proof at LSB Room 102.',
  };
}

function itemToEntry(item: Item): ActivityEntry {
  const isResolved = item.status === 'resolved';
  const isPending = item.status === 'pending';
  const isFound = item.type === 'found';

  let statusLabel = 'Lost alert live';
  let dotClass = 'bg-[#0a0a0a]';
  let step: 1 | 2 | 3 = 2;
  let nextAction = 'Active on Campus Feed · Awaiting sighting or turn-in at LSB Room 102.';

  if (isResolved) {
    statusLabel = 'Returned';
    dotClass = 'bg-[#1f6b3a]';
    step = 3;
    nextAction = item.donationTurnover
      ? 'Closed as campus donation turnover.'
      : 'Item released to its verified owner.';
  } else if (item.status === 'rejected') {
    statusLabel = 'Rejected';
    dotClass = 'bg-[#b91c1c]';
    step = 1;
    nextAction = item.rejectReason
      ? `Rejected by Security Office: ${item.rejectReason}`
      : 'Rejected by Security Office.';
  } else if (isPending) {
    statusLabel = 'Pending intake';
    dotClass = 'bg-[#d97706]';
    step = 1;
    nextAction = `Turn this item in at LSB Room 102 with reference tag ${item.referenceCode}.`;
  } else if (isFound) {
    statusLabel = 'In custody';
    dotClass = 'bg-[#134e3a]';
    step = 3;
    nextAction = item.custodyNote || 'Held in Security Office custody at LSB Room 102.';
  }

  return {
    id: `item:${item.id}`,
    kind: 'report',
    item,
    name: item.name,
    refCode: item.referenceCode,
    location: item.location,
    date: item.eventDate,
    statusLabel,
    dotClass,
    ready: false,
    canWithdraw: false,
    step,
    steps: REPORT_STEPS,
    note: item.description,
    nextAction,
  };
}

export function ProfilePage() {
  const { currentUser, items, claims, withdrawClaim, deleteItem } = useLostLink();
  const [filter, setFilter] = useState<InboxFilter>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const { entries, totalReports, activeReports, claimsSubmitted } = useMemo(() => {
    if (!currentUser) {
      return { entries: [], totalReports: 0, activeReports: 0, claimsSubmitted: 0 };
    }
    const itemMap = new Map<string, Item>();
    const reportEntries: ActivityEntry[] = [];
    let activeCount = 0;

    for (const item of items) {
      itemMap.set(item.id, item);
      if (item.reporterId === currentUser.id) {
        if (item.status !== 'resolved' && item.status !== 'rejected') activeCount += 1;
        reportEntries.push(itemToEntry(item));
      }
    }

    const claimEntries = claims
      .filter((c) => c.claimantId === currentUser.id && c.status !== 'withdrawn')
      .map((c) => claimToEntry(c, itemMap.get(c.itemId)));

    // Keep verified (ready for pickup) claims at the top of the inbox.
    claimEntries.sort((a, b) => Number(b.ready) - Number(a.ready));

    return {
      entries: [...claimEntries, ...reportEntries],
      totalReports: reportEntries.length,
      activeReports: activeCount,
      claimsSubmitted: claimEntries.length,
    };
  }, [currentUser, items, claims]);

  const visibleEntries = useMemo(
    () => (filter === 'all' ? entries : entries.filter((e) => e.kind === filter)),
    [entries, filter]
  );

  const selected = useMemo(
    () => visibleEntries.find((e) => e.id === selectedId) ?? visibleEntries[0] ?? null,
    [visibleEntries, selectedId]
  );
  const selectedItem = selected?.item;
  const selectedClaimId = selected?.claimId;
  const canDeleteSelectedReport =
    selected?.kind === 'report' &&
    selectedItem?.status === 'pending' &&
    selectedItem.reporterId === currentUser?.id;

  const initials = useMemo(
    () =>
      (currentUser?.fullName ?? 'DL')
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((p) => p[0]?.toUpperCase() ?? '')
        .join(''),
    [currentUser?.fullName]
  );

  const summaryStats = [
    { label: 'Items reported', value: totalReports, Icon: ClipboardList, accent: false },
    { label: 'Active reports', value: activeReports, Icon: PackageCheck, accent: true },
    { label: 'Claims submitted', value: claimsSubmitted, Icon: ShieldCheck, accent: false },
  ] as const;

  return (
    <div className="flex min-h-[100svh] flex-col bg-[#f6f7f2]">
      <Header />

      <main className="mx-auto w-full max-w-[1280px] flex-1 px-6 py-6 sm:px-12 lg:px-20 lg:py-8">
        <div className="grid gap-6">
          {/* Campus ID Pass + Activity Stats */}
          <section
            aria-label="Account summary"
            className="grid grid-cols-1 overflow-hidden rounded-2xl border border-[var(--color-line-strong)] bg-white lg:grid-cols-[1.35fr_1fr]"
          >
            <div className="flex flex-wrap items-center gap-4 bg-[#134e3a] px-6 py-5 text-white sm:px-7">
              <div
                aria-hidden="true"
                className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-[#daef8a] text-lg font-semibold tracking-tight text-[#0a0a0a]"
              >
                {initials}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2.5">
                  <h1 className="truncate text-[22px] font-semibold leading-tight tracking-[-0.025em] text-white sm:text-[26px]">
                    {currentUser?.fullName ?? 'Campus Account'}
                  </h1>
                  {currentUser?.studentId && (
                    <span className="rounded-md bg-white/12 px-2.5 py-0.5 font-mono text-xs text-[#daef8a] ring-1 ring-white/20">
                      ID {currentUser.studentId}
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm text-[#d6e7dd]">
                  {currentUser?.program}
                  {currentUser?.college ? ` (${currentUser.college})` : ''} ·{' '}
                  {currentUser?.yearLevel ?? 'Faculty'}
                </p>
                <p className="mt-0.5 truncate font-mono text-xs text-white/80">
                  {currentUser?.email}
                </p>
              </div>
            </div>

            <dl className="grid grid-cols-3 divide-x divide-[var(--color-line)] border-t border-[var(--color-line)] bg-white lg:border-t-0">
              {summaryStats.map(({ label, value, Icon, accent }) => (
                <div key={label} className="flex flex-col justify-between gap-2 px-4 py-4 sm:px-5 sm:py-5">
                  <div className="flex items-center justify-between gap-2">
                    <dt className="text-xs font-medium text-[#525252]">{label}</dt>
                    <Icon
                      className={`h-4 w-4 shrink-0 ${accent ? 'text-[#1f6b3a]' : 'text-[#737373]'}`}
                      aria-hidden="true"
                    />
                  </div>
                  <dd
                    className={`text-[28px] font-semibold leading-none tabular-nums ${
                      accent ? 'text-[#1f6b3a]' : 'text-[#0a0a0a]'
                    }`}
                  >
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
          </section>

          <div className="grid min-h-[580px] grid-cols-1 overflow-hidden rounded-2xl border border-[var(--color-line-strong)] bg-white lg:grid-cols-[370px_minmax(0,1fr)]">
            {/* Left Master List */}
            <aside className="flex flex-col border-b border-[var(--color-line)] bg-[#f6f7f2] lg:border-r lg:border-b-0">
              <div className="grid gap-3 border-b border-[var(--color-line)] px-5 pt-4 pb-3.5">
                <div className="flex items-baseline justify-between gap-2">
                  <h2 className="text-[17px] font-semibold tracking-[-0.02em] text-[#0a0a0a]">
                    My Activity
                  </h2>
                  <span className="font-mono text-[11.5px] text-[#525252]">
                    {visibleEntries.length} shown
                  </span>
                </div>

              <div
                className="grid grid-cols-3 gap-0.5 rounded-[9px] bg-[#ecefe7] p-0.5"
                role="group"
                aria-label="Filter activity"
              >
                {(
                  [
                    ['all', 'All'],
                    ['claim', 'Claims'],
                    ['report', 'Reports'],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    aria-pressed={filter === key}
                    onClick={() => {
                      setFilter(key);
                      setConfirmDeleteId(null);
                    }}
                    className={`min-h-[44px] rounded-[7px] text-[13px] font-medium transition-colors cursor-pointer ${
                      filter === key
                        ? 'bg-white text-[#0a0a0a] shadow-[0_1px_2px_rgba(10,10,10,0.08)]'
                        : 'text-[#525252] hover:text-[#0a0a0a]'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div
              role="listbox"
              aria-label="Activity items"
              className="grid flex-1 content-start gap-1 overflow-y-auto p-2 [scrollbar-color:rgba(10,10,10,0.22)_transparent] [scrollbar-width:thin]"
            >
              {visibleEntries.length === 0 ? (
                <p className="px-3 py-8 text-center text-sm text-[#525252]">
                  No items in this view.
                </p>
              ) : (
                visibleEntries.map((entry) => {
                  const isSelected = selected?.id === entry.id;
                  return (
                    <button
                      key={entry.id}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => {
                        setSelectedId(entry.id);
                        setConfirmDeleteId(null);
                      }}
                      className={`grid w-full gap-1.5 rounded-[10px] border px-3.5 py-3 text-left transition-colors cursor-pointer ${
                        isSelected
                          ? 'border-[var(--color-line-strong)] bg-white'
                          : 'border-transparent hover:bg-white/65'
                      }`}
                    >
                      <span className="truncate text-[15px] font-semibold text-[#0a0a0a]">
                        {entry.name}
                      </span>
                      <span className="flex items-center justify-between gap-2 text-xs text-[#525252]">
                        <span className="truncate">
                          {entry.location} ·{' '}
                          <span className="font-mono">{entry.refCode}</span>
                        </span>
                        <span className="inline-flex shrink-0 items-center gap-1.5 font-medium text-[#0a0a0a]">
                          <span
                            aria-hidden="true"
                            className={`h-2 w-2 rounded-full ${entry.dotClass}`}
                          />
                          {entry.statusLabel}
                        </span>
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </aside>

          {/* Right Serene Detail Pane */}
          <section
            aria-label="Selected item details"
            className="flex flex-col justify-between gap-6 bg-white p-6 sm:p-9"
          >
            {!selected ? (
              <div className="m-auto grid max-w-[36ch] justify-items-center gap-3 text-center">
                <p className="text-[15px] text-[#525252]">
                  Items you report or claim on LostLink will appear here.
                </p>
                <Link
                  to="/feed"
                  className="inline-flex min-h-[44px] items-center rounded-lg bg-[#1f6b3a] px-4 text-sm font-medium text-white transition-colors hover:bg-[#19562e]"
                >
                  Browse Campus Feed
                </Link>
              </div>
            ) : (
              <>
                <div className="grid gap-5">
                  <div className="aspect-video max-h-[290px] w-full overflow-hidden rounded-xl bg-[#ecefe7]">
                    <PhotoSlider
                      images={selected.item?.images ?? []}
                      alt={selected.name}
                      shielded={selected.item?.hidePhoto ?? false}
                      adminUnlocked={currentUser?.role === 'admin'}
                    />
                  </div>

                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="text-[22px] font-semibold leading-tight tracking-[-0.025em] text-[#0a0a0a] sm:text-[24px]">
                        {selected.name}
                      </h2>
                      <p className="mt-1 text-sm text-[#525252]">
                        {selected.location} · {selected.date} ·{' '}
                        <span className="font-mono">{selected.refCode}</span>
                      </p>
                    </div>

                    <span className="inline-flex items-center gap-2 rounded-full bg-[#f6f7f2] px-3 py-1.5 text-[13px] font-medium text-[#0a0a0a]">
                      <span
                        aria-hidden="true"
                        className={`h-2 w-2 rounded-full ${selected.dotClass}`}
                      />
                      {selected.statusLabel}
                    </span>
                  </div>

                  <ol
                    aria-label="Progress"
                    className="flex flex-wrap items-center gap-2.5 text-[13px] text-[#737373]"
                  >
                    {selected.steps.map((label, idx) => {
                      const n = idx + 1;
                      const isDone = n < selected.step || (selected.step === 3 && n === 3);
                      const isNow = !isDone && n === selected.step;
                      return (
                        <li key={label} className="inline-flex items-center gap-2.5">
                          <span
                            className={
                              isDone
                                ? 'font-medium text-[#15522b]'
                                : isNow
                                  ? 'font-semibold text-[#0a0a0a]'
                                  : ''
                            }
                          >
                            {label}
                          </span>
                          {idx < selected.steps.length - 1 && (
                            <span aria-hidden="true" className="h-px w-5 bg-[var(--color-line-strong)]" />
                          )}
                        </li>
                      );
                    })}
                  </ol>

                  <p className="max-w-[58ch] text-[15px] leading-relaxed text-[#525252]">
                    {selected.note}
                  </p>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--color-line)] pt-4">
                  <p
                    className={`text-[13.5px] ${
                      selected.ready ? 'font-medium text-[#15522b]' : 'text-[#525252]'
                    }`}
                  >
                    {selected.nextAction}
                  </p>

                  {selected.canWithdraw && selectedClaimId ? (
                    <button
                      type="button"
                      onClick={() => withdrawClaim(selectedClaimId)}
                      className="inline-flex min-h-[44px] shrink-0 items-center justify-center rounded-lg border border-[var(--color-line-strong)] bg-white px-4 text-sm font-medium text-[#0a0a0a] transition-colors hover:bg-[#ecefe7] cursor-pointer"
                    >
                      Withdraw claim
                    </button>
                  ) : canDeleteSelectedReport && selectedItem ? (
                    confirmDeleteId === selectedItem.id ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            deleteItem(selectedItem.id);
                            setConfirmDeleteId(null);
                            setSelectedId(null);
                          }}
                          className="inline-flex min-h-[44px] shrink-0 items-center justify-center rounded-lg bg-[#b91c1c] px-4 text-sm font-medium text-white transition-colors hover:bg-[#991b1b] cursor-pointer"
                        >
                          Confirm delete
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(null)}
                          className="inline-flex min-h-[44px] shrink-0 items-center justify-center rounded-lg border border-[var(--color-line-strong)] bg-white px-4 text-sm font-medium text-[#0a0a0a] transition-colors hover:bg-[#ecefe7] cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(selectedItem.id)}
                        className="inline-flex min-h-[44px] shrink-0 items-center justify-center rounded-lg border border-[#ef9a9a] bg-white px-4 text-sm font-medium text-[#991b1b] transition-colors hover:bg-[#fef2f2] cursor-pointer"
                      >
                        Delete report
                      </button>
                    )
                  ) : (
                    <Link
                      to="/feed"
                      className="inline-flex min-h-[44px] shrink-0 items-center text-sm font-medium text-[#1f6b3a] underline-offset-4 hover:underline"
                    >
                      Browse feed
                    </Link>
                  )}
                </div>
              </>
            )}
          </section>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
