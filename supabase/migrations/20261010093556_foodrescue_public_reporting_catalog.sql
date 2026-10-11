-- A public reporting catalog exposes only verified organization identity and approximate area.
-- Do not return private contact-person names, phone numbers, email addresses, or documents.
CREATE OR REPLACE FUNCTION public.list_verified_organizations_public()
RETURNS TABLE(id uuid,name text,organization_type text,neighborhood text)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $function$
  SELECT o.id,o.name,o.organization_type,o.neighborhood
  FROM public.organizations AS o
  WHERE o.verification_status='verified'::public.verification_status
  ORDER BY lower(o.name),o.created_at DESC;
$function$;
REVOKE ALL ON FUNCTION public.list_verified_organizations_public() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_verified_organizations_public() TO anon, authenticated;
NOTIFY pgrst, 'reload schema';
