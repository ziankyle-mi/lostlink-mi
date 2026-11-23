# LostLink — Things To Do Right Now (Pre-Supabase Plan)

> **Purpose:** Actionable implementation plan for the remaining non-Supabase features and fixes. Reference this file when ready to build all items or a specific item (e.g., *"implement task 1 and 2 from thingstodorn.md"*).

---

## Mandatory Agent Skills & Rules

Before writing code for any task in this file, load and apply:

1. **`ponytail`** (`.agents/skills/ponytail/SKILL.md`)
   - Ship the smallest complete change that solves the task.
   - Zero new npm dependencies; use native browser/platform APIs and existing codebase patterns.
   - Never cut security checks, role guards, accessibility, or edge-case handling.
2. **`design-taste-frontend` (Taste Skill)** (`.agents/skills/design-taste-frontend/SKILL.md`) — *when building or updating UI*
   - Match LostLink's institutional design tokens (`design/TOKENS.md`): `#f6f7f2` paper, `#ffffff` surface, `#0a0a0a` ink, `#1f6b3a` forest, `#134e3a` dark forest, `#daef8a` lime, `Outfit` + `DM Mono`.
   - Maintain `44×44px` minimum touch targets, zero horizontal overflow on `390px` viewports, and zero generic AI-slop styling.
3. **`lazydev-audit`** (`.agents/skills/lazydev-audit/SKILL.md`) — *pre-ship gate on every touched file*
   - Run the 4 pre-ship checks (Not Overdone, Fast & Efficient, Works Well With System, Readable & Clean).
   - Output the **Caveman Audit Table** for touched files and verify `npm run build` (`tsc -b && vite build`) passes with 0 errors.

---

## Implementation Plan

### [ ] 1. Mobile Navigation + DO Console Link
**Files:** `src/components/Header.tsx`
- Add a direct **`DO Console` (`/admin`)** link inside the portal nav when `currentUser?.role === 'admin'` so admins can navigate back from `/feed`, `/profile`, or `/admin/users`.
- Add a clean mobile navigation toggle/menu below `lg` (`<1024px`) exposing `Campus Feed`, `My Activity`, and (for admins) `DO Console` and `User Directory`.
- Close the mobile menu on route navigation, `Escape`, or viewport resize to `lg+`; keep all buttons at least `44×44px`.

### [ ] 2. Separate Lost-Item Sightings from Found-Item Claims
**Files:** `src/lib/store.tsx`, `src/components/ItemDialogs.tsx`
- Add `submitSighting(itemId: string, note: string)` to `LostLinkContext` (validates signed-in user, `note.trim().length >= 20`, item exists and is `type === 'lost'`, user is not the reporter).
- Deliver the sighting directly as a notification to the lost item's `reporterId` (plus confirmation to the sender) instead of inserting a fake `Claim` into the DO Admin claims queue.
- Update `InspectDialog` (`src/components/ItemDialogs.tsx`) to call `submitClaim` when `item.type === 'found'` and `submitSighting` when `item.type === 'lost'`.

### [ ] 3. Admin Reject/Delete, Claim Denial Reason & Student Pending Delete
**Files:** `src/types.ts`, `src/lib/store.tsx`, `src/pages/AdminPage.tsx`, `src/pages/ProfilePage.tsx`
- **Admin Intake (`AdminPage.tsx`):**
  - Add `rejectIntake(itemId: string, reason: string)` (admin-only): marks item `rejected`, stores `rejectReason`, and notifies the reporter with the reason.
  - Add `deleteItem(itemId: string)` (admin can delete any spam/invalid item; non-admin owner can delete only their own `pending` item).
- **Claim Denial (`AdminPage.tsx`):**
  - Extend `verifyClaim(claimId, decision, reason?)` so DO Admin can include a short denial reason that appears in the claimant's notification.
- **Student Self-Service (`ProfilePage.tsx`):**
  - When a user selects one of their own `pending` reports in `My Activity`, show a **Delete report** action with confirmation so they can remove accidental or duplicate submissions before intake.

### [ ] 4. Forced Password Reset Route (`/reset-password`)
**Files:** `src/pages/ResetPasswordPage.tsx`, `src/App.tsx`, `src/lib/store.tsx`, `src/pages/LoginPage.tsx`
- Create `ResetPasswordPage` matching the `LoginPage` / `RegisterPage` card layout (`Header variant="auth"`, `Footer`, password visibility toggle, min 8 characters + confirm password match).
- Add `completePasswordReset(newPassword: string)` in `store.tsx` that clears `mustChangePassword: false` on the current profile (and updates Supabase password when `supabase` is configured later).
- Enforce a route guard in `App.tsx`: if `currentUser?.mustChangePassword` is `true`, redirect `/feed`, `/profile`, `/admin`, and `/admin/users` to `/reset-password` until completed.
- Keep `LoginPage` redirecting flagged users cleanly to `/reset-password`.

### [ ] 6. Client-Side EXIF Stripping & Image Compression on Upload
**Files:** `src/lib/validation.ts`, `src/components/ItemDialogs.tsx`
- Keep existing MIME + magic-byte + 5 MB validation in `validateImageFile`.
- Add a small native `<canvas>` helper (e.g., `sanitizeImageToDataUrl(file)` — zero libraries) that decodes the validated image, caps max dimension (e.g., `1600px`), re-encodes as WebP/JPEG (`~0.82` quality), and returns the clean data URL.
- Strips GPS/camera EXIF metadata (privacy requirement in `docs/FEATURES.md`) and prevents multi-MB phone photos from hitting `localStorage` quota.
- Ensure any temporary object URLs are revoked (`URL.revokeObjectURL`) in `finally` to prevent memory leaks.

### [ ] 7. Admin Audit Log & Unclaimed Custody Tab
**Files:** `src/types.ts`, `src/lib/store.tsx`, `src/pages/AdminPage.tsx`
- **Audit Log:**
  - Add `AdminLogEntry` (`id`, `adminId`, `action`, `targetLabel`, `detail`, `createdAt`) to `PersistedState` (mirrors `admin_log` in `docs/schema.sql`).
  - Automatically append an immutable entry on admin actions: `confirmIntake`, `rejectIntake`, `toggleItemPhotoShield`, `verifyClaim`, `extendCustody`, `markDonationTurnover`, `publishBroadcast`, `removeBroadcast`, `updateUserRole`, `toggleUserActive`, `issueTempPassword`.
  - Add an **Audit Log** tab in `AdminPage.tsx` showing timestamp, admin, action pill, target, and detail.
- **Unclaimed Custody Review:**
  - Add optional `custodyExtendedUntil?: string | null` and `donationTurnover?: boolean` fields on `Item` (matching `docs/schema.sql`).
  - Add an **Unclaimed** tab in `AdminPage.tsx` listing approved `found` items with days-in-custody count and two admin actions: **Extend hold (+14 days)** and **Mark donation turnover** (closes item as `resolved` with custody note).

---

## Verification Checklist (Run After Implementation)

- [ ] `npm run build` (`tsc -b && vite build`) exits `0` with zero TypeScript or bundler errors.
- [ ] Mobile viewport (`390px`) has working nav menu and zero horizontal overflow.
- [ ] Non-admins still never receive `images` for `hidePhoto === true` items; DO Admins see them with the shield badge.
- [ ] All admin actions enforce `currentUser?.role === 'admin'` inside `store.tsx`, not just hidden buttons.
- [ ] `lazydev-audit` Caveman Audit Table completed for every modified file.
