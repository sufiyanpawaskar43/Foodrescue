-- Claim list: only expose the recipient's internal auth UUID to the recipient,
-- the listing owner, or an administrator. Available/assigned volunteers use the
-- claim UUID to coordinate pickup and do not need another member's auth UUID.
CREATE OR REPLACE FUNCTION public.list_foodrescue_claims()
RETURNS TABLE(
  id uuid,
  listing_id uuid,
  recipient_id uuid,
  status public.claim_status,
  pickup_token uuid,
  pickup_code text,
  claimed_at timestamptz,
  approved_at timestamptz,
  verified_at timestamptz,
  title text,
  description text,
  category text,
  quantity numeric,
  unit text,
  pickup_deadline timestamptz,
  pickup_area text,
  image_url text,
  donor_id uuid,
  listing_status public.listing_status,
  donor_name text,
  recipient_name text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_user uuid := (SELECT auth.uid());
  v_role public.foodrescue_role;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Sign in to view claims'; END IF;
  SELECT p.role INTO v_role
  FROM public.profiles AS p
  WHERE p.id=v_user AND p.status='active';
  IF v_role IS NULL THEN RAISE EXCEPTION 'Active profile required'; END IF;

  RETURN QUERY
  SELECT
    c.id,
    c.listing_id,
    CASE
      WHEN c.recipient_id=v_user OR f.donor_id=v_user OR v_role='admin'::public.foodrescue_role
      THEN c.recipient_id ELSE NULL::uuid
    END,
    c.status,
    CASE WHEN c.status='approved'::public.claim_status AND (
      c.recipient_id=v_user OR f.donor_id=v_user OR v_role='admin'::public.foodrescue_role
      OR EXISTS (
        SELECT 1 FROM public.volunteer_pickups AS vp
        WHERE vp.claim_id=c.id AND vp.volunteer_id=v_user
          AND vp.status<>'cancelled'::public.pickup_status
      )
    ) THEN c.pickup_token ELSE NULL::uuid END,
    CASE WHEN c.status='approved'::public.claim_status AND (
      c.recipient_id=v_user OR f.donor_id=v_user OR v_role='admin'::public.foodrescue_role
      OR EXISTS (
        SELECT 1 FROM public.volunteer_pickups AS vp
        WHERE vp.claim_id=c.id AND vp.volunteer_id=v_user
          AND vp.status<>'cancelled'::public.pickup_status
      )
    ) THEN c.pickup_code ELSE NULL::text END,
    c.claimed_at,c.approved_at,c.verified_at,
    f.title,f.description,f.category,f.quantity,f.unit,
    f.pickup_deadline,
    CASE
      WHEN COALESCE((
        SELECT NULLIF(ps.value->>'enabled','')::boolean
        FROM public.platform_settings AS ps
        WHERE ps.key='approximate_pickup_areas'
      ),true)
        OR c.recipient_id=v_user OR f.donor_id=v_user
        OR v_role='admin'::public.foodrescue_role
        OR EXISTS (
          SELECT 1 FROM public.volunteer_pickups AS vp
          WHERE vp.claim_id=c.id AND vp.volunteer_id=v_user
            AND vp.status<>'cancelled'::public.pickup_status
        )
      THEN f.pickup_area ELSE 'Shared after confirmation'::text
    END,
    f.image_url,
    CASE
      WHEN c.recipient_id=v_user OR f.donor_id=v_user
        OR v_role='admin'::public.foodrescue_role
        OR EXISTS (
          SELECT 1 FROM public.volunteer_pickups AS vp
          WHERE vp.claim_id=c.id AND vp.volunteer_id=v_user
            AND vp.status<>'cancelled'::public.pickup_status
        )
      THEN f.donor_id ELSE NULL::uuid
    END,
    f.status,
    CASE
      WHEN c.recipient_id=v_user OR f.donor_id=v_user
        OR v_role='admin'::public.foodrescue_role
        OR EXISTS (
          SELECT 1 FROM public.volunteer_pickups AS vp
          WHERE vp.claim_id=c.id AND vp.volunteer_id=v_user
            AND vp.status<>'cancelled'::public.pickup_status
        )
      THEN COALESCE(dp.full_name,'Community donor')
      ELSE 'Community donor'
    END,
    CASE
      WHEN c.recipient_id=v_user OR f.donor_id=v_user
        OR v_role='admin'::public.foodrescue_role
      THEN COALESCE(rp.full_name,'Community recipient')
      ELSE 'Community recipient'
    END
  FROM public.claims AS c
  JOIN public.food_listings AS f ON f.id=c.listing_id
  LEFT JOIN public.profiles AS dp ON dp.id=f.donor_id
  LEFT JOIN public.profiles AS rp ON rp.id=c.recipient_id
  WHERE c.recipient_id=v_user OR f.donor_id=v_user
    OR v_role='admin'::public.foodrescue_role
    OR (v_role='volunteer'::public.foodrescue_role AND (
      EXISTS (
        SELECT 1 FROM public.volunteer_pickups AS vp
        WHERE vp.claim_id=c.id AND vp.volunteer_id=v_user
          AND vp.status<>'cancelled'::public.pickup_status
      )
      OR (c.status='approved'::public.claim_status AND NOT EXISTS (
        SELECT 1 FROM public.volunteer_pickups AS vp
        WHERE vp.claim_id=c.id AND vp.status<>'cancelled'::public.pickup_status
      ))
    ))
  ORDER BY c.claimed_at DESC;
END;
$function$;

REVOKE ALL ON FUNCTION public.list_foodrescue_claims() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_foodrescue_claims() TO authenticated;
NOTIFY pgrst, 'reload schema';
