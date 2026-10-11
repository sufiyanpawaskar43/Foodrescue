# FoodRescue code and backend review

**Review date:** 10 October 2026

## Scope

This review used the newly uploaded FoodRescue ZIP as the frontend source and checked the connected FoodRescue Supabase project `ghfgudjqfmreycicendy`. The project layout and existing visual direction were retained.

## Code changes included

- Added/verified the Vite React plugin configuration with the automatic JSX runtime; `Brand.jsx` and `Icon.jsx` also import React explicitly, so they no longer depend on a global `React` binding.
- Added a root render error boundary plus a page boundary, to display a recoverable error surface instead of a blank document when a component throws.
- Changed session restoration so a transient network/5xx failure does not wipe saved refresh credentials.
- Enforced profile role as the source of truth for signed-in routes and role actions; preview role switching is allowed only while signed out.
- Corrected direct-table/RLS mismatches: claims use `list_foodrescue_claims`; organization, volunteer profile, profile, listing, saved food, admin setting, claim and pickup writes use guarded RPCs as appropriate.
- Corrected record-detail routes to use actual IDs; removed “show the first record” fallbacks and fake table IDs/counts where found.
- Added real private verification-document signed URLs (five minutes), actual image uploads to `foodrescue-images`, and metadata writes for private document uploads.
- Added row actions for rejecting donor pickup requests and restoring a suspended member; restored members can now be opened from the user queue.
- Made configurable platform controls enforced in database functions, including organization verification, pickup-area visibility, volunteer assistance and expiration cleanup.
- Added admin moderation functions with server-side admin checks, owner notifications, and audit records. Listing approval requires an unexpired listing from a verified donor organization.
- Constrained volunteer pickup transitions so “completed” can only be reached through QR/code verification.
- Updated endpoint/setup/migration documentation to describe the current REST/RPC contract and avoid suggesting direct claim writes/reads.

## Live Supabase checks

- Confirmed the current project is active and its schema cache exposes the expected relation/RPC surface.
- Verified that direct claims table reads are intentionally denied and the claim RPC is executable by authenticated accounts.
- Verified the functions used by the frontend exist with matching argument types and the relevant anon/authenticated grants.
- Verified RLS on public data tables and the storage policy separation: public food images, private organization verification documents.
- Applied the incremental workflow/API fixes to the connected project and checked migration history afterward.
- Recent project log query returned no ERROR/FATAL/PANIC rows for 10 October 2026 at the time of review.

## Static checks completed

- 55 JavaScript/JSX/config source files parsed with Babel with zero syntax errors.
- No unresolved relative imports were found.
- No JSX file relying on a missing default React import was found.
- A static cross-check was performed between frontend `api.*` calls and the `api` method exports, and between routed page names and `PageRouter` cases.

## Verification limits / remaining operational work

- `npm run build` could not complete in this environment because dependency installation timed out and the inherited extracted `node_modules` contains Windows-native Rollup/esbuild binaries, not Linux binaries. Network DNS to the npm registry is unavailable here. The final ZIP therefore does **not** claim a successful production build; run `npm install` and `npm run build` on the target Windows machine.
- The live database currently has only one active Recipient profile and no Admin profile; it also has no listings, organizations, claims, reports or notifications at the last data check. Consequently the Admin login and multi-role flows cannot be fully exercised until you create/confirm test users, bootstrap one trusted Admin as described in `FINAL_SETUP.md`, verify a donor/recipient organization, and add test listings/claims/assignments. Do not treat an empty queue as a broken query without checking its backend error state.
- The Supabase security advisor still flags leaked-password protection as disabled. Enable this in Supabase Auth settings. It also reports `SECURITY DEFINER` RPC warnings; those are intentional where the functions perform multi-table writes but each privileged endpoint must retain explicit role/ownership checks. Re-review SQL changes before production deployment.
- Historical database repair steps were applied during the earlier debugging session through the Dashboard. The incremental migration files are included, but this folder should not be considered a verified, one-command bootstrap for an empty Supabase project until the full migration chain is replayed on a separate clean project.

## Targeted smoke test on the developer machine

1. Extract the ZIP into a new folder; copy `.env.example` to `.env` and add the project's public URL/publishable key.
2. Run `npm install`, `npm run dev`, and confirm the homepage and auth routes render without console exceptions.
3. Test one account per role and verify that changing the URL cannot change its role.
4. Save an organization as a donor, have admin verify it, publish a future-dated listing, claim it as a recipient, approve as donor, accept as a volunteer, then verify using QR/code.
5. Test hide/request-edit/approve moderation, report status change, user suspend/restore, settings persistence, private document viewing, and audit history.
6. For every failed request, check the response status/body and the live-data banner; distinguish a 401/403 from a legitimate empty result.

## Additional hardening from the continued audit

- Expired-session refresh failures now surface as authentication errors instead of silently continuing a protected request as anonymous. Storage upload calls use the same refresh/retry path as API calls.
- QR verification guards against duplicate camera callbacks and stops the camera stream when the component unmounts or a pickup verifies successfully.
- Dashboard date-range controls now change the metrics. Quantity labels avoid adding unlike units such as kg, boxes, and portions into one misleading “portions” total.
- Distance filtering and “nearest first” are visibly unavailable while listing coordinates/geolocation are not part of the database schema. The map page explicitly explains that it is area-based rather than a coordinate map.
- Platform settings reject unsupported keys and non-boolean `enabled` values. Unused legacy admin-status RPC grants were removed; the frontend uses the audited `admin_review_*` and `*_with_note` entry points. Pickup verification explicitly rejects a missing/suspended role.
- API requests now prefer the freshest persisted access token when React still holds a pre-refresh token. Cancelled volunteer assignments no longer block a replacement volunteer from accepting the same still-available claim.
- The claims projection no longer exposes a recipient account UUID to volunteers who are merely browsing/assigned pickups; privileged claim identifiers and one-time credentials remain scoped by role/ownership.
- Live migrations also constrain platform setting JSON to a known key list and a real boolean `enabled` property.
- After the latest live checks, the database showed no ERROR/FATAL/PANIC log entries for 10 October 2026. The database still has one profile and no listing/organization/claim/report/notification data, so multi-role transactional testing still requires dedicated test accounts and seed records.

## Final static audit result

- 55 JavaScript/JSX/config files parse without syntax errors.
- No missing relative imports; no missing React bindings for JSX; no duplicate top-level bindings found by the static scan.
- 42 distinct `api.*` call names used by source code match methods exported by `src/services/backend.js` (43 methods are defined, including two compatibility helpers).
- All 33 static `routeByPage` entries have `PageRouter` cases. The eight extra page cases are the expected detail views derived from UUID-based URLs.
- The connected Supabase project exposes the expected role-guarded RPCs. Direct `claims` SELECT remains intentionally revoked; the frontend uses `list_foodrescue_claims`.
- A live network smoke test from this container could not reach the Supabase API because outbound networking is unavailable. The public RPCs were checked through database/schema tooling, but an authenticated end-to-end run was not possible from this environment.
- Database-level smoke checks did execute the public feed, verified-organization catalog, and public detail RPC under the `anon` role; all completed and returned zero rows because the current project has no seeded listings/organizations. A transaction-scoped check confirmed the platform-setting writer rejects a non-admin caller with `Admin only`. These are SQL/RPC checks, not browser E2E tests.
- The authenticated claims RPC also executed in a transaction-scoped recipient context and returned zero rows without an error; the live project has no claim records. Direct `claims` table SELECT remains denied to authenticated clients.


## Final login simplification (2026-10-10)

- Community signup expects an immediate Supabase session; if Supabase returns no session because email confirmation is enabled, the UI now clearly names the Dashboard toggle rather than instructing the user to check email.
- Added `api.ensureMyProfile` fallback for an existing Auth identity without a `public.profiles` row. The database RPC accepts only `recipient`, `donor`, or `volunteer`; it never creates or assigns `admin` and never changes an existing profile role or status.
- Admin login does not use profile repair; an Admin profile remains a privileged, owner-provisioned account.
- Hosted Supabase email confirmation must be disabled in **Authentication → Sign In / Providers → Email → Confirm email**; frontend code cannot change hosted Auth provider settings.


## 2026-10-10 follow-up: volunteer pickups 403

The client no longer queries `GET /rest/v1/volunteer_pickups?select=*` directly. It calls `POST /rest/v1/rpc/list_my_volunteer_pickups` instead. The RPC requires an authenticated active profile, returns all rows only to Admin, and otherwise filters assignments to the current volunteer or to a claim related to the current recipient/donor. This avoids evaluating the participant RLS policy's `claims` subquery under a browser role that has no direct `claims` SELECT grant. The migration is included under `supabase/migrations/20261010111700_foodrescue_scoped_volunteer_pickups_rpc.sql`.

## 2026-10-10 follow-up: live scanner console noise

- Changed pickup verification from `BrowserMultiFormatReader` to `BrowserQRCodeReader` because FoodRescue pickup passes are QR-only. This avoids testing unrelated barcode formats on every video frame.
- Treats ordinary QR-frame `NotFoundException`, checksum and format misses as expected retry conditions; they no longer produce app-level error messages. Camera access failures and unexpected decoder failures still show a recoverable message.
- A browser request for `GET /rest/v1/volunteer_pickups?select=*` after this source is loaded means the browser is running an older app bundle or another project folder: the current `api.listVolunteerPickups` uses `POST /rest/v1/rpc/list_my_volunteer_pickups`. The direct table grant intentionally remains restricted; do not open it just to hide a 403.
