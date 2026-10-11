-- Repair authenticated legacy users whose public profile row is missing.
-- This is not a role-change endpoint: existing profiles are returned unchanged.
-- Only the three public community roles are allowed; Admin remains owner-provisioned.
CREATE OR REPLACE FUNCTION public.ensure_my_profile(p_requested_role text)
RETURNS public.profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_user uuid := (SELECT auth.uid());
  v_email text;
  v_metadata jsonb;
  v_full_name text;
  v_role public.foodrescue_role;
  v_profile public.profiles;
  v_requested text := lower(trim(coalesce(p_requested_role, '')));
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Sign in before initializing a FoodRescue profile';
  END IF;

  SELECT p.* INTO v_profile
  FROM public.profiles AS p
  WHERE p.id = v_user;

  IF v_profile.id IS NOT NULL THEN
    RETURN v_profile;
  END IF;

  IF v_requested NOT IN ('recipient', 'donor', 'volunteer') THEN
    RAISE EXCEPTION 'Only Recipient, Donor, or Volunteer profiles can be initialized';
  END IF;

  SELECT u.email, u.raw_user_meta_data
  INTO v_email, v_metadata
  FROM auth.users AS u
  WHERE u.id = v_user;

  IF v_email IS NULL THEN
    RAISE EXCEPTION 'An email/password Auth account is required';
  END IF;

  v_full_name := COALESCE(
    NULLIF(trim(coalesce(v_metadata->>'full_name', '')), ''),
    split_part(v_email, '@', 1),
    'FoodRescue user'
  );
  v_role := v_requested::public.foodrescue_role;

  INSERT INTO public.profiles(id, email, full_name, role, status)
  VALUES (v_user, v_email, v_full_name, v_role, 'active')
  ON CONFLICT (id) DO NOTHING;

  SELECT p.* INTO v_profile
  FROM public.profiles AS p
  WHERE p.id = v_user;

  IF v_profile.id IS NULL THEN
    RAISE EXCEPTION 'FoodRescue profile could not be initialized';
  END IF;

  RETURN v_profile;
END;
$function$;

REVOKE ALL ON FUNCTION public.ensure_my_profile(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ensure_my_profile(text) TO authenticated;

COMMENT ON FUNCTION public.ensure_my_profile(text) IS
  'Creates a missing community profile for the current authenticated email user only; never creates Admin or mutates an existing profile.';

NOTIFY pgrst, 'reload schema';
