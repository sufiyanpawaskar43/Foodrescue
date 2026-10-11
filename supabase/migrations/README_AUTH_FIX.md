Run order:
1. 20261008190000_foodrescue_core.sql
2. 20261008193000_auth_role_support.sql
3. 20261008194000_fix_auth_signup_trigger.sql

The third migration fixes Supabase Auth HTTP 500 errors caused by the auth.users
trigger running as SECURITY INVOKER and failing to insert into public.profiles.
