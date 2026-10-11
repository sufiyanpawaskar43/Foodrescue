-- Ensure a missing JSON enabled field is rejected instead of yielding SQL NULL in IF.
CREATE OR REPLACE FUNCTION public.admin_set_platform_setting(
  p_key text,
  p_value jsonb
)
RETURNS public.platform_settings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_key text := trim(coalesce(p_key, ''));
  v public.platform_settings;
BEGIN
  IF NOT private.is_admin() THEN RAISE EXCEPTION 'Admin only'; END IF;
  IF v_key NOT IN ('require_org_verification','approximate_pickup_areas','volunteer_assistance','flag_expired_listings') THEN
    RAISE EXCEPTION 'Unsupported platform setting key';
  END IF;
  IF p_value IS NULL OR jsonb_typeof(p_value) <> 'object'
     OR jsonb_typeof(p_value->'enabled') IS DISTINCT FROM 'boolean' THEN
    RAISE EXCEPTION 'Platform setting value must be an object with a boolean enabled field';
  END IF;
  INSERT INTO public.platform_settings(key,value,updated_by,updated_at)
  VALUES(v_key,p_value,(SELECT auth.uid()),pg_catalog.now())
  ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value,updated_by=EXCLUDED.updated_by,updated_at=EXCLUDED.updated_at
  RETURNING * INTO v;
  INSERT INTO public.audit_logs(actor_id,action,record_type,metadata)
  VALUES((SELECT auth.uid()),'platform_setting_updated','platform_setting',jsonb_build_object('key',v.key,'enabled',v.value->'enabled'));
  RETURN v;
END;
$function$;
REVOKE ALL ON FUNCTION public.admin_set_platform_setting(text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_set_platform_setting(text,jsonb) TO authenticated;
NOTIFY pgrst,'reload schema';
