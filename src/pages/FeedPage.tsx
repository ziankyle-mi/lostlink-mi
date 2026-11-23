import { useMemo, useState } from 'react';
import { Footer } from '../components/Footer';
import { Header } from '../components/Header';
import { InspectDialog, ReportDialog } from '../components/ItemDialogs';
import { PhotoSlider } from '../components/PhotoSlider';
import { StatusPill } from '../components/StatusPill';
import { CAMPUS_BUILDINGS, ITEM_CATEGORIES, useLostLink } from '../lib/store';
import type { Item, ItemType } from '../types';

type FeedFilter = 'all' | 'found' | 'lost' | 'shield';

const HOTSPOTS = ['Library 2F', 'Gate 2', 'DVM Building', '2nd Cafeteria'] as const;

export function FeedPage() {
  const { currentUser, items, broadcasts } = useLostLink();
  const isAdmin = currentUser?.role === 'admin';

  const [typeFilter, setTypeFilter] = useState<FeedFilter>('all');
  const [search, setSearch] = useState('');
  const [building, setBuilding] = useState('all');
  const [category, setCategory] = useState('all');

  const [inspectedItem, setInspectedItem] = useState<Item | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportDefaultType, setReportDefaultType] = useState<ItemType>('found');

  const approvedItems = useMemo(
    () => items.filter((item) => item.status === 'approved'),
    [items]
  );

  const visibleItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    return approvedItems.filter((item) => {
      if (typeFilter === 'found' && item.type !== 'found') return false;
      if (typeFilter === 'lost' && item.type !== 'lost') return false;
      if (typeFilter === 'shield' && !item.hidePhoto) return false;
      if (building !== 'all' && item.location !== building) return false;
      if (category !== 'all' && item.category !== category) return false;
      if (q) {
        const hay = `${item.referenceCode} ${item.name} ${item.location} ${item.category} ${item.description}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [approvedItems, typeFilter, building, category, search]);

  const spotlightItem = useMemo(
    () =>
      approvedItems.find((i) => i.type === 'found' && !i.hidePhoto && i.images.length > 0) ??
      approvedItems[0] ??
      null,
    [approvedItems]
  );

  const activeBroadcast = broadcasts.find((b) => b.active);

  const openReport = (kind: ItemType) => {
    setReportDefaultType(kind);
    setReportOpen(true);
  };

  const resetFilters = () => {
    setTypeFilter('all');
    setSearch('');
    setBuilding('all');
    setCategory('all');
  };

  return (
    <div className="flex min-h-[100svh] flex-col bg-[#f6f7f2]">
      {activeBroadcast && (
        <div className="bg-[#134e3a] px-4 py-2 text-[13px] text-[#f6f7f2]">
          <div className="mx-auto flex w-full max-w-[1280px] flex-wrap items-center justify-between gap-2 px-2 sm:px-8 lg:px-16">
            <span>
              <strong className="font-mono font-medium text-[#daef8a]">{activeBroadcast.tier}:</strong>{' '}
              {activeBroadcast.message}
            </span>
            <span className="font-mono text-xs text-[#d6e7dd]">Photo Shield active</span>
          </div>
        </div>
      )}

      <Header onOpenReport={() => openReport('found')} />

      <main className="mx-auto w-full max-w-[1280px] flex-1 px-6 py-6 sm:px-12 lg:px-20 lg:py-8">
        <div className="grid gap-5">
          {/* Masthead */}
          <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[var(--color-line)] pb-4">
            <div>
              <h1 className="text-[28px] font-semibold leading-tight tracking-[-0.03em] sm:text-[38px]">
                Campus Lost &amp; Found
              </h1>
              <p className="mt-2 max-w-[58ch] text-[15px] text-[#454545]">
                Browse verified items in custody at Life Science Building Room 102 or post a lost alert across 17 DLSAU buildings.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => openReport('found')}
                className="inline-flex min-h-[44px] items-center rounded-lg bg-[#1f6b3a] px-4 text-sm font-medium text-white hover:bg-[#19562e] cursor-pointer"
              >
                Report found item
              </button>
              <button
                type="button"
                onClick={() => openReport('lost')}
                className="inline-flex min-h-[44px] items-center rounded-lg border border-[#c2d96c] bg-[#daef8a] px-4 text-sm font-medium text-[#0a0a0a] hover:bg-[#cde472] cursor-pointer"
              >
                Report lost item
              </button>
            </div>
          </div>

          {/* 8/4 Spotlight + Custody Pulse Row */}
          <section className="grid grid-cols-1 gap-4 lg:grid-cols-12" aria-label="Featured custody item and campus hotspots">
            {spotlightItem && (
              <article className="grid grid-cols-1 overflow-hidden rounded-xl border border-[var(--color-line-strong)] bg-white sm:grid-cols-[1.15fr_1fr] lg:col-span-8">
                <div className="min-h-[240px] border-b border-[var(--color-line)] bg-[#f6f7f2] sm:border-r sm:border-b-0">
                  <PhotoSlider
                    images={spotlightItem.images}
                    alt={spotlightItem.name}
                    shielded={spotlightItem.hidePhoto}
                    adminUnlocked={isAdmin}
                  />
                </div>
                <div className="flex flex-col justify-between gap-4 p-6">
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center rounded-full border border-[#c2dec9] bg-[#e7f3ea] px-2.5 py-0.5 text-xs font-medium text-[#15522b]">
                        In custody · Latest intake
                      </span>
                      <span className="rounded-md border border-[var(--color-line)] bg-white px-2 py-0.5 font-mono text-xs">
                        {spotlightItem.referenceCode}
                      </span>
                    </div>
                    <h2 className="mt-3 text-[22px] font-semibold leading-tight">{spotlightItem.name}</h2>
                    <p className="mt-2 text-[15px] leading-relaxed text-[#454545]">{spotlightItem.description}</p>
                    <p className="mt-3 font-mono text-xs text-[#1f6b3a]">
                      {spotlightItem.location} · {spotlightItem.custodyNote}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setInspectedItem(spotlightItem)}
                    className="inline-flex min-h-[44px] w-full items-center justify-center rounded-lg border border-[var(--color-line-strong)] bg-white px-4 text-sm font-medium hover:bg-[#f6f7f2] cursor-pointer"
                  >
                    Inspect &amp; submit claim
                  </button>
                </div>
              </article>
            )}

            <aside className="flex flex-col justify-between gap-4 rounded-xl bg-[#134e3a] p-6 text-white lg:col-span-4">
              <div>
                <h2 className="text-lg font-semibold text-white">LSB Room 102 Desk</h2>
                <p className="mt-1 text-sm leading-relaxed text-[#d6e7dd]">
                  Open Mon–Fri, 8:00 AM–5:00 PM. IDs, Cards &amp; Wallets and user-shielded photos stay visible to DO Admins only.
                </p>
              </div>
              <div>
                <span className="font-mono text-xs text-[#daef8a]">Filter by active building</span>
                <div className="mt-2 flex flex-wrap gap-2">
                  {HOTSPOTS.map((spot) => {
                    const active = building === spot;
                    return (
                      <button
                        key={spot}
                        type="button"
                        aria-pressed={active}
                        onClick={() => setBuilding(active ? 'all' : spot)}
                        className={`min-h-[44px] rounded-lg border px-3 text-sm cursor-pointer ${
                          active
                            ? 'border-[#daef8a] bg-[#daef8a] font-medium text-[#0a0a0a]'
                            : 'border-white/25 bg-white/10 text-white hover:bg-white/15'
                        }`}
                      >
                        {spot}
                      </button>
                    );
                  })}
                </div>
              </div>
            </aside>
          </section>

          {/* Filter Bar */}
          <section
            aria-label="Filter campus gallery"
            className="grid grid-cols-1 items-end gap-3 rounded-xl border border-[var(--color-line-strong)] bg-white p-4 sm:grid-cols-2 lg:grid-cols-[auto_1.3fr_1fr_1fr_auto]"
          >
            <div className="flex flex-wrap gap-1.5 sm:col-span-2 lg:col-span-1" role="group" aria-label="Classification">
              {(
                [
                  ['all', 'All'],
                  ['found', 'Found'],
                  ['lost', 'Lost'],
                  ['shield', 'Shielded'],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  aria-pressed={typeFilter === key}
                  onClick={() => setTypeFilter(key)}
                  className={`min-h-[44px] rounded-lg border px-3 text-sm font-medium cursor-pointer ${
                    typeFilter === key
                      ? 'border-[#1f6b3a] bg-[#1f6b3a] text-white'
                      : 'border-[var(--color-line-strong)] bg-white text-[#0a0a0a]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="grid gap-1.5">
              <label htmlFor="feed-search" className="text-[13px] font-medium text-[#454545]">
                Search item or tag
              </label>
              <input
                id="feed-search"
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Wallet, LL-4821, Library…"
                className="h-[44px] w-full rounded-lg border border-[var(--color-line-strong)] bg-white px-3 text-base"
              />
            </div>

            <div className="grid gap-1.5">
              <label htmlFor="feed-building" className="text-[13px] font-medium text-[#454545]">
                Building
              </label>
              <select
                id="feed-building"
                value={building}
                onChange={(e) => setBuilding(e.target.value)}
                className="h-[44px] w-full rounded-lg border border-[var(--color-line-strong)] bg-white px-3 text-base"
              >
                <option value="all">All 17 buildings</option>
                {CAMPUS_BUILDINGS.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-1.5">
              <label htmlFor="feed-category" className="text-[13px] font-medium text-[#454545]">
                Category
              </label>
              <select
                id="feed-category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="h-[44px] w-full rounded-lg border border-[var(--color-line-strong)] bg-white px-3 text-base"
              >
                <option value="all">All categories</option>
                {ITEM_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={resetFilters}
              className="inline-flex h-[44px] items-center justify-center rounded-lg border border-[var(--color-line-strong)] bg-white px-4 text-sm font-medium hover:bg-[#f6f7f2] cursor-pointer"
            >
              Reset
            </button>
          </section>

          {/* Gallery Header */}
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-xl font-semibold">Campus gallery</h2>
            <span className="font-mono text-xs text-[#454545]">
              Showing {visibleItems.length} items · Click any photo to claim
            </span>
          </div>

          {/* Open 4:3 Photo Gallery */}
          {visibleItems.length === 0 ? (
            <div className="grid justify-items-center gap-3 rounded-xl border border-[var(--color-line-strong)] bg-white p-10 text-center">
              <p className="text-[#454545]">No campus items match your active search or building filters.</p>
              <button
                type="button"
                onClick={resetFilters}
                className="inline-flex min-h-[44px] items-center rounded-lg border border-[var(--color-line-strong)] px-4 text-sm font-medium hover:bg-[#f6f7f2] cursor-pointer"
              >
                Reset all filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
              {visibleItems.map((item) => (
                <article key={item.id}>
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => setInspectedItem(item)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setInspectedItem(item);
                      }
                    }}
                    className="group grid cursor-pointer gap-2.5 text-left"
                  >
                    <div className="relative aspect-[4/3] overflow-hidden rounded-xl border border-[var(--color-line-strong)] bg-[#ecefe7]">
                      <PhotoSlider
                        images={item.images}
                        alt={item.name}
                        shielded={item.hidePhoto}
                        adminUnlocked={isAdmin}
                        compact
                      />
                      <div className="pointer-events-none absolute inset-x-2.5 top-2.5 flex items-center justify-between gap-2">
                        <StatusPill
                          tone={item.type === 'found' ? 'green' : 'amber'}
                          label={item.type === 'found' ? 'In custody' : 'Lost report'}
                        />
                        <span className="rounded-md border border-[var(--color-line)] bg-white/95 px-2 py-0.5 font-mono text-xs text-[#0a0a0a]">
                          {item.referenceCode}
                        </span>
                      </div>
                    </div>

                    <div>
                      <h3 className="text-[17px] font-semibold leading-snug transition-colors group-hover:text-[#1f6b3a]">
                        {item.name}
                      </h3>
                      <p className="text-sm text-[#454545]">
                        {item.location} · {item.category} · {item.eventDate}
                      </p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </main>

      <InspectDialog item={inspectedItem} onClose={() => setInspectedItem(null)} />
      <ReportDialog
        open={reportOpen}
        defaultType={reportDefaultType}
        onClose={() => setReportOpen(false)}
        onCreated={resetFilters}
      />
      <Footer />
    </div>
  );
}
