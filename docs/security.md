# Security (`LostLink`)

Part of **LostLink** (`../AGENTS.md`, `schema.sql`, `rules.md`).

## Must-Haves
- **Auth:** Server-side DLSAU domain check (`ALLOWED_EMAIL_DOMAIN`, `DEMO_ALLOWED_EMAILS` exception), `HttpOnly; Secure; SameSite=Lax` cookies, and server-side guards on all `/admin` routes/Actions.
- **Data & Input:** Strict Zod validation on all inputs (reject unknown fields), parameterized queries, escaped output (no raw HTML), generic client errors, and server-only `service_role` secret.
- **Uploads:** JPG/PNG/WebP (`≤ 5 MB`), randomized names, private bucket with admin-only signed URLs for hidden photos.
- **Headers & Bots:** `CSP`, `HSTS`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, `frame-ancestors 'none'` in `middleware.ts`; Turnstile on login/report forms.
- **Privacy (RA 10173):** Minimal data only, hide reporter contacts publicly, show privacy notice at first login + footer.

## RLS (Step 3)
- **`items`:** Read `approved`, own, or admin. Insert own (`pending`). Owner updates content (`pending`/`rejected`) & deletes (`pending`). Admin updates `status`.
- **`claims`:** Read/insert own (approved found items not reported by user); withdraw while `pending`. Admin reads/updates all.
- **`notifications` / `profiles` / `admin_log`:** Users read own notifications/profiles; admins read all profiles/logs; server writes notifications & audit logs.

## Pre-Deploy Checklist
- [ ] Test RLS & routes as **user**, **admin**, and **logged-out** (block cross-user pending reads, `/admin` access, unauth `/profile` & `/report`, non-DLSAU logins, invalid/oversized payloads).
- [ ] Verify `service_role` key is absent from client build and `.env` is gitignored/uncommitted.
- [ ] Pin dependencies and run `npm audit`.
