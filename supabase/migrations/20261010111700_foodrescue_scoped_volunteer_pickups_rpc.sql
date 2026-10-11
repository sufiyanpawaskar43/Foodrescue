-- Avoid direct SELECT on volunteer_pickups from the browser.
-- The table's participant RLS policy joins claims, whose SELECT grant is intentionally
-- revoked from authenticated users. This security-definer RPC performs the join safely
-- and explicitly scopes rows to the authenticated user's role and relationships.
CREATE OR REPLACE FUNCTION public.list_my_volunteer_pickups()
RETURNS TABLE(
  id uuid,
  claim_id uuid,
  volunteer_id uuid,
  status public.pickup_status,
  accepted_at timestamptz,
  picked_up_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_user uuid := (SELECT auth.uid());
  v_role public.foodrescue_role;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Sign in to view pickup assignments';
  END IF;

  SELECT p.role INTO v_role
  FROM public.profiles AS p
  WHERE p.id = v_user AND p.status = 'active';

  IF v_role IS NULL THEN
    RAISE EXCEPTION 'An active FoodRescue profile is required';
  END IF;

  IF v_role = 'admin'::public.foodrescue_role THEN
    RETURN QUERY
    SELECT vp.id, vp.claim_id, vp.volunteer_id, vp.status,
           vp.accepted_at, vp.picked_up_at, vp.delivered_at, vp.created_at
    FROM public.volunteer_pickups AS vp
    ORDER BY vp.created_at DESC;
    RETURN;
  END IF;

  RETURN QUERY
  SELECT vp.id, vp.claim_id, vp.volunteer_id, vp.status,
         vp.accepted_at, vp.picked_up_at, vp.delivered_at, vp.created_at
  FROM public.volunteer_pickups AS vp
  WHERE vp.volunteer_id = v_user
     OR EXISTS (
       SELECT 1
       FROM public.claims AS c
       JOIN public.food_listings AS f ON f.id = c.listing_id
       WHERE c.id = vp.claim_id
         AND (c.recipient_id = v_user OR f.donor_id = v_user)
     )
  ORDER BY vp.created_at DESC;
END;
$function$;

REVOKE ALL ON FUNCTION public.list_my_volunteer_pickups() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_my_volunteer_pickups() TO authenticated;

COMMENT ON FUNCTION public.list_my_volunteer_pickups() IS
  'Returns only volunteer pickup rows visible to the authenticated volunteer, donor, recipient, or administrator; safely scopes the cross-table lookup.';

NOTIFY pgrst, 'reload schema';
