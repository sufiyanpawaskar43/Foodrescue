-- Fix a 403 caused by the volunteer_pickups RLS policy querying public.claims directly.
-- Direct SELECT on claims is intentionally revoked, so the policy must not require it.

CREATE OR REPLACE FUNCTION private.is_claim_recipient(p_claim_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.claims AS c
    WHERE c.id = p_claim_id
      AND c.recipient_id = (SELECT auth.uid())
  );
$function$;

REVOKE ALL ON FUNCTION private.is_claim_recipient(uuid) FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA private TO authenticated;
GRANT EXECUTE ON FUNCTION private.is_claim_recipient(uuid) TO authenticated;

DROP POLICY IF EXISTS volunteer_pickups_participant_select ON public.volunteer_pickups;

CREATE POLICY volunteer_pickups_participant_select
ON public.volunteer_pickups
FOR SELECT
TO authenticated
USING (
  volunteer_id = (SELECT auth.uid())
  OR private.is_claim_recipient(claim_id)
  OR private.is_admin()
);

COMMENT ON FUNCTION private.is_claim_recipient(uuid) IS
  'RLS helper; checks the current authenticated user against the recipient of a claim without requiring direct claims table SELECT privileges.';

NOTIFY pgrst, 'reload schema';
