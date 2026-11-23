# LostLink — System Feature Specification

Living reference of implemented roles, workflows, and security boundaries in the DLSAU LostLink portal.

---

## 1. Authentication & Roles

| Role | Scope & Permissions | Enforcement |
| :--- | :--- | :--- |
| **Student / Faculty (`user`)** | Browse approved campus feed, file Lost/Found reports, submit claims on Found items, send sightings on Lost items, delete own `pending` reports, withdraw own `pending` claims, view own notifications. | `@dlsau.edu.ph` check in UI + `private.handle_new_user()` DB trigger; Postgres RLS on every table. |
| **DO Admin (`admin`)** | Everything above plus `/admin` DO Console (claims, intake, unclaimed custody, broadcasts, audit log), `/admin/users` directory, photo shield override/toggle, and temporary password issuance. | Route guard (`RequireAdmin`) + `private.is_admin()` RLS + `private.enforce_profile_guard()` blocking self-downgrade/suspension. |

- **Forced Password Reset (`/reset-password`)**: Accounts flagged `must_change_password = true` (after admin temp-password reset) are redirected by `RequireAuth` and `RequireAdmin` until a new 8+ character password is saved.

---

## 2. Campus Feed & Discovery (`/feed`)

- **Feeds**: Approved **Found** items held at Life Science Building Room 102 and **Lost** alerts reported by owners.
- **Filtering**: Search (item name, description, `LL-XXXXX` code), category, 17 campus buildings, and type tabs.
- **Inspect Modal (`ItemDialogs.tsx`)**: Multi-photo slider, building/category/date metadata, one-click reference code copy, and contextual form:
  - **Found items** → Private **Ownership Proof** claim (`>= 20` characters, visible only to claimant and DO admins).
  - **Lost items** → **Sighting / Turn-in Note** (`>= 20` characters) recorded in `public.sightings` and delivered as notifications to the owner and sender (no fake claim created).

---

## 3. Item Reporting & Photo Privacy

- **Found Item**: Starts as `pending` (`Pending physical drop-off at LSB Room 102`), requires 1–3 photos when connected to live Supabase, and generates an `LL-XXXXX` reference code.
- **Lost Item**: Publishes directly to `approved` (`Reported by owner · Awaiting turn-in`) with optional photos.
- **Image Validation & EXIF Stripping (`src/lib/validation.ts`)**: Magic-byte verification (PNG, JPG, WebP, max 5 MB) followed by client-side `<canvas>` re-encoding (max 1600px, WebP/JPEG) to strip EXIF GPS/camera metadata before upload.
- **ID Photo Shield**: Enabled automatically for `IDs, Cards & Wallets` (or manually via toggle). Non-admins see a redacted shield state and Storage RLS denies signed URL access; DO Admins can view shielded images and toggle the shield.

---

## 4. Student Activity (`/profile`)

- View own filed reports across all statuses (`pending`, `approved`, `rejected`, `resolved`).
- Two-step confirmation to delete own `pending` reports (cascades related claims).
- Track own submitted claims, view admin denial reasons (`denialReason`), withdraw `pending` claims, and review/clear notifications.

---

## 5. DO Console (`/admin`)

1. **Claims to verify**: Inspect claimant details, private proof text, and shielded item photos; **Approve & Release** (marks item `resolved`, denies competing pending claims) or **Deny** with an optional written reason.
2. **Waiting for intake**: Review pending found drop-offs; **Confirm physical custody**, **Reject** with reason, **Delete**, or toggle **ID Photo Shield**.
3. **Unclaimed custody**: Lists approved found items sorted oldest-first by days held; admins can **Extend hold (+14 days)** or **Mark donation turnover** (marks item `resolved`, closes pending claims).
4. **Broadcasts**: Publish or remove `Info`, `Warning`, and `Alert` notices synced live to the campus ticker.
5. **Audit log**: Admin-only history of intake decisions, claim verifications, custody actions, broadcasts, role/status updates, and password resets.

---

## 6. Campus Accounts Directory (`/admin/users`)

- Filter verified `@dlsau.edu.ph` accounts by college (`CAST`, `CVMAS`, `CBMA`, `COED`), degree program, active/suspended status, or search (name, Student ID `YYYY-00-XXXXXX`, email).
- Update role (`user` ↔ `admin`), suspend/reactivate accounts (with self-protection), and issue one-time CSPRNG temporary passwords (`LL-XXXX-XXXX-XXXX`) via the `admin-reset-password` Edge Function.

---

## 7. Security & Realtime

- **Row Level Security**: `ENABLE` + `FORCE ROW LEVEL SECURITY` on all 7 public tables; `0` Supabase Security Advisor warnings.
- **Private Storage**: `item-photos` bucket (`public = false`) served via single-batch signed URLs (`createSignedUrls`), never signing `hide_photo = true` paths for non-admins.
- **Realtime**: Postgres change subscriptions on `notifications` (filtered per user) and `broadcasts`.
- **Offline Demo Mode**: When Supabase env vars are absent, the app runs against in-memory/localStorage demo fixtures without writing live PII locally.
