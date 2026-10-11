-- Enforce configurable platform controls in database functions; UI controls alone are not security.

CREATE OR REPLACE FUNCTION public.list_available_food()
RETURNS TABLE(
  id uuid, title text, description text, category text, quantity numeric, unit text,
  available_from timestamptz, pickup_deadline timestamptz, allergens text, storage_notes text,
  pickup_area text, image_url text, status public.listing_status,
  created_at timestamptz, updated_at timestamptz, donor_name text
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $function$
  SELECT f.id, f.title, f.description, f.category, f.quantity, f.unit,
    f.available_from, f.pickup_deadline, f.allergens, f.storage_notes,
    CASE WHEN COALESCE((
      SELECT NULLIF(ps.value->>'enabled', '')::boolean
      FROM public.platform_settings AS ps WHERE ps.key='approximate_pickup_areas'
    ), true) THEN f.pickup_area ELSE 'Shared after confirmation'::text END,
    f.image_url, f.status, f.created_at, f.updated_at,
    COALESCE(NULLIF(org.name, ''), 'Community donor')
  FROM public.food_listings AS f
  LEFT JOIN LATERAL (
    SELECT o.name FROM public.organizations AS o
    WHERE o.owner_id=f.donor_id
      AND o.verification_status='verified'::public.verification_status
    ORDER BY o.created_at DESC LIMIT 1
  ) AS org ON TRUE
  WHERE f.status='available'::public.listing_status
    AND f.pickup_deadline>pg_catalog.now()
    AND (f.available_from IS NULL OR f.available_from<=pg_catalog.now())
  ORDER BY f.created_at DESC;
$function$;
REVOKE ALL ON FUNCTION public.list_available_food() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_available_food() TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.claim_food(p_listing_id uuid)
RETURNS public.claims
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_claim public.claims;
  v_donor uuid;
  v_user uuid := (SELECT auth.uid());
  v_require_org_verification boolean;
BEGIN
  IF v_user IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.profiles AS p WHERE p.id=v_user
      AND p.role='recipient'::public.foodrescue_role AND p.status='active'
  ) THEN RAISE EXCEPTION 'Only active recipients can claim food'; END IF;

  SELECT COALESCE((
    SELECT NULLIF(ps.value->>'enabled','')::boolean
    FROM public.platform_settings AS ps WHERE ps.key='require_org_verification'
  ), true) INTO v_require_org_verification;

  IF v_require_org_verification AND NOT EXISTS (
    SELECT 1 FROM public.organizations AS o
    WHERE o.owner_id=v_user AND o.verification_status='verified'::public.verification_status
  ) THEN
    RAISE EXCEPTION 'Your recipient organization must be verified before claiming food. Open Profile & verification to submit documents.';
  END IF;

  SELECT f.donor_id INTO v_donor
  FROM public.food_listings AS f
  WHERE f.id=p_listing_id AND f.status='available'::public.listing_status
    AND f.pickup_deadline>pg_catalog.now()
    AND (f.available_from IS NULL OR f.available_from<=pg_catalog.now())
  FOR UPDATE;
  IF v_donor IS NULL THEN RAISE EXCEPTION 'Listing is not available'; END IF;

  IF EXISTS (
    SELECT 1 FROM public.claims AS c WHERE c.listing_id=p_listing_id
      AND c.status IN ('pending'::public.claim_status,'approved'::public.claim_status)
  ) THEN RAISE EXCEPTION 'This listing already has an active claim'; END IF;

  SELECT c.* INTO v_claim FROM public.claims AS c
  WHERE c.listing_id=p_listing_id AND c.recipient_id=v_user
  ORDER BY c.claimed_at DESC LIMIT 1 FOR UPDATE;

  IF v_claim.id IS NULL THEN
    INSERT INTO public.claims(listing_id,recipient_id,status)
    VALUES(p_listing_id,v_user,'pending'::public.claim_status) RETURNING * INTO v_claim;
  ELSE
    UPDATE public.claims SET status='pending'::public.claim_status,
      pickup_token=gen_random_uuid(), pickup_code=lpad((floor(random()*1000000))::text,6,'0'),
      claimed_at=pg_catalog.now(), approved_at=NULL, verified_at=NULL
    WHERE id=v_claim.id RETURNING * INTO v_claim;
  END IF;

  INSERT INTO public.pickup_requests(claim_id,donor_id,recipient_id,status,requested_at,responded_at)
  VALUES(v_claim.id,v_donor,v_user,'requested'::public.pickup_status,pg_catalog.now(),NULL)
  ON CONFLICT (claim_id) DO UPDATE SET donor_id=EXCLUDED.donor_id,
    recipient_id=EXCLUDED.recipient_id, status='requested'::public.pickup_status,
    requested_at=pg_catalog.now(), responded_at=NULL;

  UPDATE public.food_listings SET status='claimed'::public.listing_status WHERE id=p_listing_id;
  INSERT INTO public.notifications(user_id,title,body,type)
  VALUES(v_donor,'New food claim','A recipient requested one of your food listings.','claim');
  RETURN v_claim;
END;
$function$;
REVOKE ALL ON FUNCTION public.claim_food(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_food(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.offer_pickup(p_claim_id uuid)
RETURNS public.volunteer_pickups
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE v public.volunteer_pickups; v_volunteer_assistance boolean;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles AS p WHERE p.id=(SELECT auth.uid())
      AND p.role='volunteer'::public.foodrescue_role AND p.status='active'
  ) THEN RAISE EXCEPTION 'Only active volunteers can accept a pickup'; END IF;

  SELECT COALESCE((
    SELECT NULLIF(ps.value->>'enabled','')::boolean
    FROM public.platform_settings AS ps WHERE ps.key='volunteer_assistance'
  ), true) INTO v_volunteer_assistance;
  IF NOT v_volunteer_assistance THEN RAISE EXCEPTION 'Volunteer assistance is currently disabled by the platform'; END IF;

  PERFORM 1 FROM public.claims AS c
  WHERE c.id=p_claim_id AND c.status='approved'::public.claim_status FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Only approved claims can be picked up'; END IF;

  IF EXISTS (SELECT 1 FROM public.volunteer_pickups AS vp
    WHERE vp.claim_id=p_claim_id AND vp.status<>'cancelled'::public.pickup_status) THEN
    RAISE EXCEPTION 'This pickup already has volunteer assistance';
  END IF;

  INSERT INTO public.volunteer_pickups(claim_id,volunteer_id,status,accepted_at)
  VALUES(p_claim_id,(SELECT auth.uid()),'accepted'::public.pickup_status,pg_catalog.now())
  RETURNING * INTO v;
  RETURN v;
END;
$function$;
REVOKE ALL ON FUNCTION public.offer_pickup(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.offer_pickup(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_expire_stale_food_listings()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE v_enabled boolean; v_claim_ids uuid[]; v_listing_count integer := 0;
BEGIN
  IF NOT private.is_admin() THEN RAISE EXCEPTION 'Admin only'; END IF;
  SELECT COALESCE((
    SELECT NULLIF(ps.value->>'enabled','')::boolean
    FROM public.platform_settings AS ps WHERE ps.key='flag_expired_listings'
  ), true) INTO v_enabled;
  IF NOT v_enabled THEN RETURN 0; END IF;

  WITH cancelled AS (
    UPDATE public.claims AS c SET status='cancelled'::public.claim_status
    FROM public.food_listings AS f
    WHERE f.id=c.listing_id AND f.pickup_deadline<=pg_catalog.now()
      AND f.status IN ('available'::public.listing_status,'claimed'::public.listing_status)
      AND c.status IN ('pending'::public.claim_status,'approved'::public.claim_status)
    RETURNING c.id
  )
  SELECT COALESCE(pg_catalog.array_agg(id), ARRAY[]::uuid[]) INTO v_claim_ids FROM cancelled;

  IF pg_catalog.cardinality(v_claim_ids)>0 THEN
    UPDATE public.pickup_requests SET status='cancelled'::public.pickup_status, responded_at=pg_catalog.now()
    WHERE claim_id=ANY(v_claim_ids) AND status IN ('requested'::public.pickup_status,'accepted'::public.pickup_status,'in_progress'::public.pickup_status);
    UPDATE public.volunteer_pickups SET status='cancelled'::public.pickup_status
    WHERE claim_id=ANY(v_claim_ids) AND status NOT IN ('completed'::public.pickup_status,'cancelled'::public.pickup_status);
    INSERT INTO public.notifications(user_id,title,body,type)
    SELECT c.recipient_id,'Pickup request expired','The pickup deadline passed before the handover was completed.','pickup'
    FROM public.claims AS c WHERE c.id=ANY(v_claim_ids);
  END IF;

  UPDATE public.food_listings SET status='expired'::public.listing_status, updated_at=pg_catalog.now()
  WHERE pickup_deadline<=pg_catalog.now()
    AND status IN ('available'::public.listing_status,'claimed'::public.listing_status);
  GET DIAGNOSTICS v_listing_count = ROW_COUNT;

  IF v_listing_count>0 OR pg_catalog.cardinality(v_claim_ids)>0 THEN
    INSERT INTO public.audit_logs(actor_id,action,record_type,metadata)
    VALUES((SELECT auth.uid()),'expired_listings_flagged','food_listing',
      jsonb_build_object('listings_expired',v_listing_count,'claims_cancelled',pg_catalog.cardinality(v_claim_ids)));
  END IF;
  RETURN v_listing_count;
END;
$function$;
REVOKE ALL ON FUNCTION public.admin_expire_stale_food_listings() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_expire_stale_food_listings() TO authenticated;

CREATE OR REPLACE FUNCTION public.verify_pickup(p_code text, p_token uuid DEFAULT NULL)
RETURNS public.claims LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE v public.claims; v_role public.foodrescue_role;
BEGIN
  SELECT p.role INTO v_role FROM public.profiles AS p
  WHERE p.id=(SELECT auth.uid()) AND p.status='active';
  IF v_role IS NULL OR v_role NOT IN ('donor'::public.foodrescue_role,'volunteer'::public.foodrescue_role) THEN
    RAISE EXCEPTION 'Only active donors or volunteers can verify pickups';
  END IF;

  SELECT c.* INTO v FROM public.claims AS c
  JOIN public.food_listings AS f ON f.id=c.listing_id
  WHERE c.status='approved'::public.claim_status AND c.verified_at IS NULL
    AND f.pickup_deadline>pg_catalog.now()
    AND ((p_token IS NOT NULL AND c.pickup_token=p_token) OR (p_code IS NOT NULL AND c.pickup_code=p_code))
    AND (
      (v_role='donor'::public.foodrescue_role AND f.donor_id=(SELECT auth.uid()))
      OR (v_role='volunteer'::public.foodrescue_role AND EXISTS (
        SELECT 1 FROM public.volunteer_pickups AS vp
        WHERE vp.claim_id=c.id AND vp.volunteer_id=(SELECT auth.uid())
          AND vp.status IN ('accepted'::public.pickup_status,'in_progress'::public.pickup_status)
      ))
    )
  FOR UPDATE OF c;

  IF v.id IS NULL THEN RAISE EXCEPTION 'Invalid code, pickup expired, not assigned, or code already used'; END IF;
  UPDATE public.claims SET status='picked_up'::public.claim_status, verified_at=pg_catalog.now()
  WHERE id=v.id RETURNING * INTO v;
  UPDATE public.food_listings SET status='picked_up'::public.listing_status WHERE id=v.listing_id;
  UPDATE public.pickup_requests SET status='completed'::public.pickup_status, responded_at=pg_catalog.now() WHERE claim_id=v.id;
  UPDATE public.volunteer_pickups SET status='completed'::public.pickup_status, delivered_at=COALESCE(delivered_at,pg_catalog.now())
  WHERE claim_id=v.id AND status<>'cancelled'::public.pickup_status;
  INSERT INTO public.notifications(user_id,title,body,type)
  VALUES(v.recipient_id,'Pickup completed','Your food pickup has been verified.','pickup');
  INSERT INTO public.audit_logs(actor_id,action,record_type,record_id,metadata)
  VALUES((SELECT auth.uid()),'pickup_verified','claim',v.id,jsonb_build_object('listing_id',v.listing_id));
  RETURN v;
END;
$function$;
REVOKE ALL ON FUNCTION public.verify_pickup(text,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.verify_pickup(text,uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
