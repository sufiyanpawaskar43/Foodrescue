# Supabase migrations

This folder includes the FoodRescue schema/repair SQL and incremental API/security migrations. The frontend expects RLS and least-privilege SQL grants to stay enabled.

## Important

- For the existing FoodRescue project used in this work, the latest incremental functions have already been applied and verified through the Supabase project API.
- Do not run `REPAIR_EXISTING_PROJECT.sql` automatically or repeatedly against the live project. It is a repair script, not a seed script.
- The migration folder's early baseline/repair scripts predate some historical manual migrations made while repairing the existing project. A brand-new Supabase project must be tested from an empty database before being treated as reproducible solely from this directory; compare its applied history with the live project and resolve any missing historical changes first.
- Never place a service-role key in frontend environment variables.

## Incremental endpoint migrations

- `20261010085125_foodrescue_frontend_api_contract.sql`: owner-scoped organization upsert and admin settings writer.
- `20261010085622_foodrescue_saved_food_rpc_security.sql`: recipient-only, active-listing saved-food toggle.
- `20261010090341_foodrescue_public_detail_and_profile_guards.sql`: safe public listing detail, profile update restrictions, admin status functions.
- `20261010091827_foodrescue_setting_enforcement.sql`: server-side enforcement of verification/area/expiry settings and QR pickup completion.
- `20261010093556_foodrescue_public_reporting_catalog.sql`: verified organizations public projection for report selection.
- `20261010094434_foodrescue_admin_review_workflows.sql`: role-checked organization/listing/report moderation, member role/status workflows, notifications and audit records.
- `20261010094451_foodrescue_claim_recipient_display.sql`: role-filtered claim results and recipient display field; direct `claims` SELECT remains revoked.
- `20261010094745_foodrescue_workflow_integrity_fixes.sql`: restrict public feed to verified donor organizations, prevent unsafe listing approval, support safe pickup reassignment, and require the verification endpoint for completion.
- `20261010095600_foodrescue_claim_area_after_confirmation.sql`: preserve private pickup-area visibility for eligible participants after a claim and ensure admins do not receive one-time pickup credentials.

- `20261010102946_foodrescue_platform_setting_validation.sql` and `20261010103357_foodrescue_setting_enabled_null_guard.sql`: validate the supported admin setting keys and require a JSON boolean.
- `20261010103221_foodrescue_legacy_admin_rpc_lockdown.sql`: revoke stale admin writer grants and harden pickup verification against missing/suspended profiles.
- `20261010103905_foodrescue_claim_identity_privacy.sql`: return a recipient's internal user UUID only to the recipient, listing donor, or admin.
- `20261010110839_foodrescue_missing_profile_autorepair.sql`: repairs a missing Recipient/Donor/Volunteer profile for the authenticated user only; never creates Admin or changes an existing profile.
