# FoodRescue setup and verification

## Configure the frontend

Create `.env` from `.env.example` in the project root (the ZIP intentionally excludes the original `.env`):

```dotenv
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_YOUR_PUBLIC_KEY
```

Use only the public publishable key (or legacy `anon` key); never bundle a Supabase `service_role` or secret key into the browser app. The provided ZIP intentionally excludes `.env` and `node_modules`.

## Install and run

```bash
npm install
npm run dev
```

Production bundle check:

```bash
npm run build
npm run preview
```

## Existing connected project

The FoodRescue Supabase project configured for this work already has the core schema and role/security policies. Incremental migrations for the endpoint contract, saved-food guard, safe public details, configurable platform settings (including strict boolean/key validation), public organization catalog, admin review workflows, claim display, workflow integrity, legacy admin-RPC lockdown, strict setting validation, claim-identity privacy, and scoped volunteer-pickup reads are included under `supabase/migrations/`.

Do **not** blindly rerun `supabase/REPAIR_EXISTING_PROJECT.sql` against the live database. That file is for a reviewed repair of an existing schema, not a routine startup step. Before applying SQL to any other database, inspect the full migration history and test on a separate development project.

## One-time first-admin bootstrap

The connected database currently has one active Recipient profile and **no Admin profile**. The app intentionally does not let users assign themselves the Admin role. To activate the admin workspace:

1. Create an account for the intended admin email after turning OFF Email provider → Confirm email (see the no-confirmation setup section below). Admin still requires a real email/password login and the database role must be provisioned by the project owner.
2. In the Supabase Dashboard SQL Editor for this exact project, replace the placeholder email below with that account's email and run this one-time statement as the project owner:

```sql
UPDATE public.profiles AS p
SET role = 'admin'::public.foodrescue_role,
    status = 'active',
    updated_at = now()
FROM auth.users AS u
WHERE p.id = u.id
  AND lower(u.email) = lower('REPLACE_WITH_ADMIN_EMAIL')
RETURNING p.id, p.role, p.status;
```

3. Confirm the result contains exactly the intended account, then sign out and sign back in through `/admin/login`. Do not run this for an unverified or untrusted email; the statement is deliberately not bundled as an automatic migration.

## Instant community sign-up (no email confirmation)

For Recipient, Donor, and Volunteer accounts to get a session immediately after sign-up, disable email confirmation in the hosted Supabase project. In the Supabase Dashboard for this project, open **Authentication → Sign In / Providers → Email → Confirm email** and switch it **OFF**, then save. This is a project-level Auth setting, not a frontend code setting. The frontend detects the still-enabled state and displays the exact action instead of falsely saying the user should check email. The email field must still be in valid email format, and the password is still required; this is password authentication without the extra email-confirmation step.

Admin remains protected: there is no public Admin signup, non-admin RPCs cannot create an Admin profile, and `/admin/login` only opens the admin workspace when the database profile already has `role = 'admin'`. The frontend/server will never infer Admin from the email address.

This setting change removes proof-of-email ownership for all email/password signups, including any future Admin identity before it is provisioned. Use only for a project where that trade-off is intended.

The live Supabase security advisor reports leaked-password protection is disabled. In the Supabase Dashboard, open **Authentication → Settings / Password security** and enable leaked-password protection before production. See the [Supabase password security guide](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

## First-run checklist

1. Confirm `.env` values match the intended Supabase project.
2. Run `npm install`, `npm run dev`, and open the exact local URL printed by Vite.
3. Create a community account; if no `access_token` is returned, confirm that the Email provider's `Confirm email` setting is OFF. The frontend can repair an Auth user that lacks a `public.profiles` row (community roles only).
4. Create an organization profile; an admin must verify the organization before the donor can publish listings (and recipients must pass the configured verification rule before claiming).
5. Create a listing with a future pickup deadline and a permitted image type (JPEG, PNG, WebP; up to 5 MB).
6. Test recipient claim, donor approval/decline, volunteer assignment, and one-time QR/code verification with separate accounts.
7. Confirm report, admin moderation, settings, and audit-log actions in the live database.

If the database contains no demo records, a blank queue is an empty state rather than evidence of a failed endpoint. Use dedicated test accounts/data for end-to-end verification.
