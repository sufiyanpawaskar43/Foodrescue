-- FoodRescue API contract for the React frontend.
-- Organization verification remains admin-controlled: updates never modify verification_status.

CREATE OR REPLACE FUNCTION public.upsert_my_organization(
  p_name text,
  p_organization_type text,
  p_contact_person text,
  p_phone text,
  p_neighborhood text,
  p_about text
)
RETURNS public.organizations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_user uuid := (SELECT auth.uid());
  v_role public.foodrescue_role;
  v public.organizations;
  v_action text;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Sign in to save an organization profile';
  END IF;

  SELECT p.role INTO v_role
  FROM public.profiles AS p
  WHERE p.id = v_user AND p.status = 'active';

  IF v_role IS NULL OR v_role NOT IN ('donor'::public.foodrescue_role, 'recipient'::public.foodrescue_role) THEN
    RAISE EXCEPTION 'Only active donor or recipient accounts can manage an organization profile';
  END IF;

  IF nullif(trim(coalesce(p_name, '')), '') IS NULL OR char_length(trim(p_name)) > 150 THEN
    RAISE EXCEPTION 'Organization name is required and must be 150 characters or fewer';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_user::text, 0));

  SELECT o.* INTO v
  FROM public.organizations AS o
  WHERE o.owner_id = v_user
  ORDER BY o.created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF v.id IS NULL THEN
    INSERT INTO public.organizations (
      owner_id, name, organization_type, contact_person, phone, neighborhood, about
    )
    VALUES (
      v_user, trim(p_name),
      coalesce(nullif(trim(coalesce(p_organization_type, '')), ''), v_role::text),
      nullif(trim(coalesce(p_contact_person, '')), ''),
      nullif(trim(coalesce(p_phone, '')), ''),
      nullif(trim(coalesce(p_neighborhood, '')), ''),
      nullif(trim(coalesce(p_about, '')), '')
    )
    RETURNING * INTO v;
    v_action := 'organization_created';
  ELSE
    UPDATE public.organizations
    SET name = trim(p_name),
        organization_type = coalesce(nullif(trim(coalesce(p_organization_type, '')), ''), v.organization_type),
        contact_person = nullif(trim(coalesce(p_contact_person, '')), ''),
        phone = nullif(trim(coalesce(p_phone, '')), ''),
        neighborhood = nullif(trim(coalesce(p_neighborhood, '')), ''),
        about = nullif(trim(coalesce(p_about, '')), ''),
        updated_at = pg_catalog.now()
    WHERE id = v.id
    RETURNING * INTO v;
    v_action := 'organization_updated';
  END IF;

  INSERT INTO public.audit_logs(actor_id, action, record_type, record_id, metadata)
  VALUES (v_user, v_action, 'organization', v.id,
          jsonb_build_object('organization_type', v.organization_type));

  RETURN v;
END;
$function$;

REVOKE ALL ON FUNCTION public.upsert_my_organization(text, text, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.upsert_my_organization(text, text, text, text, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_set_platform_setting(p_key text, p_value jsonb)
RETURNS public.platform_settings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v public.platform_settings;
BEGIN
  IF NOT private.is_admin() THEN
    RAISE EXCEPTION 'Admin only';
  END IF;

  IF nullif(trim(coalesce(p_key, '')), '') IS NULL OR char_length(trim(p_key)) > 100 THEN
    RAISE EXCEPTION 'Setting key is required and must be 100 characters or fewer';
  END IF;

  INSERT INTO public.platform_settings(key, value, updated_by, updated_at)
  VALUES (trim(p_key), coalesce(p_value, '{}'::jsonb), (SELECT auth.uid()), pg_catalog.now())
  ON CONFLICT (key) DO UPDATE
    SET value = EXCLUDED.value,
        updated_by = EXCLUDED.updated_by,
        updated_at = EXCLUDED.updated_at
  RETURNING * INTO v;

  INSERT INTO public.audit_logs(actor_id, action, record_type, metadata)
  VALUES ((SELECT auth.uid()), 'platform_setting_updated', 'platform_setting',
          jsonb_build_object('key', v.key));

  RETURN v;
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_set_platform_setting(text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_platform_setting(text, jsonb) TO authenticated;

NOTIFY pgrst, 'reload schema';
