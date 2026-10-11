-- Public detail uses the safe public feed projection; it never reads private profile data.
CREATE OR REPLACE FUNCTION public.get_available_food_listing(p_listing_id uuid)
RETURNS TABLE(
  id uuid, title text, description text, category text, quantity numeric, unit text,
  available_from timestamptz, pickup_deadline timestamptz, allergens text, storage_notes text,
  pickup_area text, image_url text, status public.listing_status,
  created_at timestamptz, updated_at timestamptz, donor_name text
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO 'pg_catalog', 'public'
AS $function$
  SELECT f.*
  FROM public.list_available_food() AS f
  WHERE f.id = p_listing_id
  LIMIT 1;
$function$;
REVOKE ALL ON FUNCTION public.get_available_food_listing(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_available_food_listing(uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_available_food_listing(uuid) TO anon, authenticated;

-- Profile changes are self-only and never modify role or account status.
CREATE OR REPLACE FUNCTION public.update_my_profile(
  p_full_name text,
  p_phone text,
  p_neighborhood text,
  p_avatar_url text DEFAULT NULL
)
RETURNS public.profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_user uuid := (SELECT auth.uid());
  v public.profiles;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Sign in to update your profile'; END IF;

  UPDATE public.profiles
  SET full_name = COALESCE(NULLIF(trim(COALESCE(p_full_name, '')), ''), full_name),
      phone = CASE WHEN p_phone IS NULL THEN phone ELSE NULLIF(trim(p_phone), '') END,
      neighborhood = CASE WHEN p_neighborhood IS NULL THEN neighborhood ELSE NULLIF(trim(p_neighborhood), '') END,
      avatar_url = CASE WHEN p_avatar_url IS NULL THEN avatar_url ELSE NULLIF(trim(p_avatar_url), '') END,
      updated_at = pg_catalog.now()
  WHERE id = v_user AND status = 'active'
  RETURNING * INTO v;

  IF v.id IS NULL THEN RAISE EXCEPTION 'Active FoodRescue profile not found'; END IF;
  RETURN v;
END;
$function$;
REVOKE ALL ON FUNCTION public.update_my_profile(text, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_my_profile(text, text, text, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_my_profile(text, text, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_set_organization_status(
  p_organization_id uuid, p_status public.verification_status
)
RETURNS public.organizations
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE v public.organizations;
BEGIN
  IF NOT private.is_admin() THEN RAISE EXCEPTION 'Admin only'; END IF;
  UPDATE public.organizations SET verification_status=p_status, updated_at=pg_catalog.now()
  WHERE id=p_organization_id RETURNING * INTO v;
  IF v.id IS NULL THEN RAISE EXCEPTION 'Organization not found'; END IF;
  INSERT INTO public.audit_logs(actor_id,action,record_type,record_id,metadata)
  VALUES ((SELECT auth.uid()),'organization_status_changed','organization',v.id,jsonb_build_object('status',p_status));
  RETURN v;
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_set_listing_status(
  p_listing_id uuid, p_status public.listing_status
)
RETURNS public.food_listings
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE v public.food_listings;
BEGIN
  IF NOT private.is_admin() THEN RAISE EXCEPTION 'Admin only'; END IF;
  UPDATE public.food_listings SET status=p_status, updated_at=pg_catalog.now()
  WHERE id=p_listing_id RETURNING * INTO v;
  IF v.id IS NULL THEN RAISE EXCEPTION 'Food listing not found'; END IF;
  INSERT INTO public.audit_logs(actor_id,action,record_type,record_id,metadata)
  VALUES ((SELECT auth.uid()),'listing_status_changed','food_listing',v.id,jsonb_build_object('status',p_status));
  RETURN v;
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_set_report_status(
  p_report_id uuid, p_status public.report_status
)
RETURNS public.reports
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE v public.reports;
BEGIN
  IF NOT private.is_admin() THEN RAISE EXCEPTION 'Admin only'; END IF;
  UPDATE public.reports SET status=p_status, resolved_by=(SELECT auth.uid()),
    resolved_at=CASE WHEN p_status IN ('resolved'::public.report_status,'dismissed'::public.report_status)
      THEN pg_catalog.now() ELSE NULL END
  WHERE id=p_report_id RETURNING * INTO v;
  IF v.id IS NULL THEN RAISE EXCEPTION 'Report not found'; END IF;
  INSERT INTO public.audit_logs(actor_id,action,record_type,record_id,metadata)
  VALUES ((SELECT auth.uid()),'report_status_changed','report',v.id,jsonb_build_object('status',p_status));
  RETURN v;
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_set_user_status(p_user_id uuid, p_status text)
RETURNS public.profiles
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE v public.profiles;
BEGIN
  IF NOT private.is_admin() THEN RAISE EXCEPTION 'Admin only'; END IF;
  IF p_status NOT IN ('active','suspended') THEN RAISE EXCEPTION 'Invalid user status'; END IF;
  UPDATE public.profiles SET status=p_status, updated_at=pg_catalog.now()
  WHERE id=p_user_id RETURNING * INTO v;
  IF v.id IS NULL THEN RAISE EXCEPTION 'User not found'; END IF;
  INSERT INTO public.audit_logs(actor_id,action,record_type,record_id,metadata)
  VALUES ((SELECT auth.uid()),'user_status_changed','profile',v.id,jsonb_build_object('status',p_status));
  RETURN v;
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_set_organization_status(uuid, public.verification_status) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_organization_status(uuid, public.verification_status) TO authenticated;
REVOKE ALL ON FUNCTION public.admin_set_listing_status(uuid, public.listing_status) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_listing_status(uuid, public.listing_status) TO authenticated;
REVOKE ALL ON FUNCTION public.admin_set_report_status(uuid, public.report_status) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_report_status(uuid, public.report_status) TO authenticated;
REVOKE ALL ON FUNCTION public.admin_set_user_status(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_user_status(uuid, text) TO authenticated;

NOTIFY pgrst, 'reload schema';
