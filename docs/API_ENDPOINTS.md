# FoodRescue — Frontend / Supabase contract

This document describes the current code contract. The frontend is a Vite/React SPA with separate `services/auth.js` and `services/backend.js` modules. Each request sends the Supabase public key in `apikey`; only an actual user's access token is sent in `Authorization: Bearer ...`. Access/refresh credentials remain in the browser's local session storage entry. Do not use a service-role key in the frontend.

## Environment

```dotenv
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_YOUR_PUBLIC_KEY
```

Legacy compatibility: `VITE_SUPABASE_ANON_KEY` is used only when the publishable key variable is absent.

## Auth and role policy

| Flow | Endpoint | Important rule |
|---|---|---|
| Sign up | `POST /auth/v1/signup` | Metadata uses `requested_role`; database trigger allows Recipient/Donor/Volunteer only. |
| Sign in | `POST /auth/v1/token?grant_type=password` | Fetch the user's profile; `profiles.role` is authoritative. |
| Refresh | `POST /auth/v1/token?grant_type=refresh_token` | Retry a data request once after a 401. Transient failures do not erase the saved refresh token. |
| Current user | `GET /auth/v1/user` | Access token required. |
| Sign out | `POST /auth/v1/logout` | Local credentials are cleared even if remote sign-out is unavailable. |

Admin cannot self-register; `/admin/login` is the separate login surface but uses the same Supabase Auth provider and verifies `profiles.role='admin'`. Role-specific paths redirect to the role loaded from the database. URL paths cannot upgrade an authenticated user's role.

## Read APIs

| Purpose | Endpoint / operation | Access |
|---|---|---|
| Public food feed | `POST /rest/v1/rpc/list_available_food` | Public projection only; available, unexpired listings from verified donor organizations. |
| Public listing detail | `POST /rest/v1/rpc/get_available_food_listing` with `p_listing_id` | Public projection; no profile IDs/contact details. |
| Verified organization choices | `POST /rest/v1/rpc/list_verified_organizations_public` | ID, display name, type, and neighborhood only. |
| Claims and pickups | `POST /rest/v1/rpc/list_foodrescue_claims` | Requires auth; returns only records associated with the recipient/donor/assigned volunteer/admin. A recipient account UUID is not exposed to volunteers browsing or accepting pickups. QR token/code is projected only to eligible participants and only for approved claims. |
| Signed-in user's profile | `GET /rest/v1/profiles?select=*&id=eq.<uid>&limit=1` | Authenticated; RLS permits own profile, admin can view platform records. |
| Saved-food IDs | `GET /rest/v1/saved_food?select=listing_id` | Own rows only. |
| Own donor listings | `GET /rest/v1/food_listings?select=*&donor_id=eq.<uid>&order=created_at.desc` | RLS/ownership-limited. |
| Admin listing queue | `GET /rest/v1/food_listings?select=*&order=created_at.desc` | Admin role + RLS. |
| Pickup requests | `GET /rest/v1/pickup_requests?select=*&order=requested_at.desc` | Participant/admin RLS. |
| Volunteer assignments | `POST /rest/v1/rpc/list_my_volunteer_pickups` with `{}` | Authenticated, role/relationship-scoped RPC; avoids a nested RLS permission failure on `claims`. |
| Organizations | `GET /rest/v1/organizations?select=*&order=created_at.desc` | Own organization(s), admin platform access. |
| Verification document metadata | `GET /rest/v1/organization_documents?select=*&organization_id=eq.<id>` | Owner/admin RLS. Private file data is never public. |
| Admin directories | `GET /rest/v1/reports`, `/profiles`, `/audit_logs`, `/notifications`, `/platform_settings` | Admin access for platform-wide queries; notifications are still user-scoped by RLS. |

The app does not query `claims` directly: authenticated direct-table SELECT is intentionally revoked, and the claim RPC is the only frontend read path for claim details.

## Mutations (RPCs)

| Feature | RPC and payload fields | Guardrails |
|---|---|---|
| Claim listing | `claim_food(p_listing_id)` | Active Recipient, active listing, future deadline, configured organization verification, atomic request creation. |
| Save/unsave listing | `toggle_saved_food(p_listing_id)` | Active Recipient and currently available listing. |
| Create listing | `create_food_listing(p_title, p_description, p_category, p_quantity, p_unit, p_available_from, p_pickup_deadline, p_allergens, p_storage_notes, p_pickup_area, p_image_url)` | Active Donor, verified owner organization, validated title/quantity/deadline. |
| Update listing | `update_food_listing(p_listing_id, p_title, p_description, p_category, p_quantity, p_unit, p_pickup_deadline, p_allergens, p_storage_notes, p_pickup_area, p_image_url)` | Active Donor, own editable listing. |
| Delete listing | `delete_food_listing(p_listing_id)` | Active Donor; only own editable/unclaimed listing. |
| Donor decision | `respond_to_claim(p_claim_id, p_action)` | Active Donor must own the listing; only pending claims; transaction updates request/listing/notification/audit. |
| Volunteer assignment | `offer_pickup(p_claim_id)` | Active Volunteer, approved/unexpired claim, enabled feature, only one active assignment; cancelled assignment can be reassigned. |
| Pickup progress | `volunteer_update_pickup(p_pickup_id, p_status)` | Own assignment and valid state transition; cannot mark completed directly. |
| Verify pickup | `verify_pickup(p_code, p_token)` | Active Donor or assigned Volunteer, approved/unexpired claim, correct code/token; one-time verification marks completion. |
| Save profile | `update_my_profile(p_full_name, p_phone, p_neighborhood, p_avatar_url)` | Current user only; cannot update role/status. |
| Save org profile | `upsert_my_organization(p_name, p_organization_type, p_contact_person, p_phone, p_neighborhood, p_about)` | Current active Recipient/Donor only; never accepts a client-supplied verification status. |
| Volunteer profile | `upsert_my_volunteer_profile(p_service_area, p_available)` | Current active Volunteer only. |
| Create report | `create_report(p_listing_id, p_organization_id, p_reason, p_description)` | Current active user, actual listing/org IDs, non-empty reason. |
| Mark notifications read | `mark_notifications_read(p_notification_ids)` | Updates only current user's notifications. |
| Save platform setting | `admin_set_platform_setting(p_key, p_value)` | Admin-only server-side check; writes are not granted directly to the browser role. |
| Expire stale listings | `admin_expire_stale_food_listings()` | Admin-only; honors expiry setting and updates dependent requests/assignments. |

### Admin review functions

- `admin_review_organization(p_organization_id, p_status, p_note)` — pending/verified/rejected; sends a notification and audit record.
- `admin_review_listing(p_listing_id, p_action, p_note)` — approve/request_edit/hide; cannot approve an expired listing or publish an unverified donor organization; cannot override an active/completed claim.
- `admin_review_report(p_report_id, p_status, p_note)` — open/resolved/dismissed/escalated; sends a reporter notification and writes an audit event.
- `admin_set_user_role_with_note(p_user_id, p_role, p_note)` — admin only; cannot assign admin or change own role; sends notification/audit record.
- `admin_set_user_status_with_note(p_user_id, p_status, p_note)` — admin only; active/suspended; cannot suspend own account; sends notification/audit record.

### Authenticated profile bootstrap

- `POST /rest/v1/rpc/ensure_my_profile` with `{ "p_requested_role": "recipient" | "donor" | "volunteer" }` is only used after Auth has already issued a valid session and a profile lookup returns no row. It creates a profile for `auth.uid()` only; existing profile roles/status are returned unchanged and `admin` is rejected.

## Storage

- `foodrescue-images` is the public image bucket. Upload endpoint: `POST /storage/v1/object/foodrescue-images/<user-id>/<random-file-name>`. Accepts JPEG, PNG, WebP up to 5 MB. Listing data stores the public image URL.
- `foodrescue-documents` is private. Documents are JPEG, PNG, or PDF up to 10 MB. File upload is followed by an `organization_documents` metadata insert. Admin/owner file access uses `POST /storage/v1/object/sign/foodrescue-documents/<path>` and 300-second signed URLs.
- If file upload succeeds but metadata insertion fails, the UI reports the partial failure; the unreferenced object needs cleanup rather than silently claiming success.

## Platform settings

The database functions—not just the UI—enforce these flags:

- `require_org_verification.enabled`
- `approximate_pickup_areas.enabled`
- `volunteer_assistance.enabled`
- `flag_expired_listings.enabled`

A setting value is stored as JSON, for example `{"enabled": true}`.

## Empty states and errors

The UI should show empty states when there are no listings, organizations, claims, reports, notifications, or users. Failed reads are shown in the live-data banner and can be retried; failed mutations are surfaced to the caller/toast. A 401 can trigger one token refresh/retry; 403 should not be treated as an empty successful result.

## Location limitations

Distance filtering and nearest-first sorting require location coordinates. The current schema stores a donor-entered pickup-area string but does not store listing latitude/longitude, so the UI explicitly disables distance/radius filtering and provides area-based results instead of showing invented distance values or map pins.
