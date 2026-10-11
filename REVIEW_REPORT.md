# FoodRescue review report

## Main prior failure pattern

The repeated `React is not defined` errors were not independent UI bugs: the extracted project lacked the Vite React plugin configuration and multiple JSX files assumed a global React binding. The blank screen was worsened by the absence of a root-level render error boundary. These are corrected in the packaged source.

## Integration defects found and addressed

- Several screens queried `claims` directly although live grants intentionally denied direct `claims` reads. Frontend now calls the role-filtered `list_foodrescue_claims` RPC.
- `organizations`, `volunteer_profiles`, `profiles`, `food_listings`, saved-food, claim/pickup workflow, and `platform_settings` mutations must follow the live grant/RLS model; write flows were routed through guarded RPCs rather than attempting forbidden direct writes.
- QR verification previously had an undefined app method; now it calls the backend verification RPC and refreshes claim state after success.
- Food images are uploaded to Supabase Storage rather than persisting temporary `blob:` URLs.
- Organization documents remain private; the view action requests an admin/owner-authorized signed URL.
- Detail pages use actual IDs instead of silently choosing the first available record.
- Admin and donor workflow transitions are enforced in the database and reflected in the UI; admin review actions generate notifications and audit records.

## Result

Static parse/import checks pass, and the current live backend has the expected role-guarded RPCs/tables/policies. Build and full interactive end-to-end testing remain unverified in the container due unavailable npm registry networking and near-empty backend data. Run the documented smoke test with `npm install` and test accounts before describing the project as production-ready.
