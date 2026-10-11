-- The current frontend uses the audited *_with_note / admin_review_* functions.
-- Remove stale entry points so future clients cannot bypass the current workflow.
REVOKE EXECUTE ON FUNCTION public.admin_set_listing_status(uuid, public.listing_status) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_set_organization_status(uuid, public.verification_status) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_set_report_status(uuid, public.report_status) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_set_user_role(uuid, public.foodrescue_role) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_set_user_status(uuid, text) FROM PUBLIC, anon, authenticated;

-- Explicitly reject sessions with a missing/suspended profile before pickup lookup.
CREATE OR REPLACE FUNCTION public.verify_pickup(p_code text, p_token uuid DEFAULT NULL)
RETURNS public.claims
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v public.claims;
  v_role public.foodrescue_role;
BEGIN
  SELECT p.role INTO v_role
  FROM public.profiles AS p
  WHERE p.id=(SELECT auth.uid()) AND p.status='active';

  IF v_role IS NULL OR v_role NOT IN ('donor'::public.foodrescue_role,'volunteer'::public.foodrescue_role) THEN
    RAISE EXCEPTION 'Only active donors or volunteers can verify pickups';
  END IF;

  SELECT c.* INTO v
  FROM public.claims AS c
  JOIN public.food_listings AS f ON f.id=c.listing_id
  WHERE c.status='approved'::public.claim_status
    AND c.verified_at IS NULL
    AND f.pickup_deadline>pg_catalog.now()
    AND ((p_token IS NOT NULL AND c.pickup_token=p_token) OR (p_code IS NOT NULL AND c.pickup_code=p_code))
    AND (
      (v_role='donor'::public.foodrescue_role AND f.donor_id=(SELECT auth.uid()))
      OR
      (v_role='volunteer'::public.foodrescue_role AND EXISTS (
        SELECT 1 FROM public.volunteer_pickups AS vp
        WHERE vp.claim_id=c.id AND vp.volunteer_id=(SELECT auth.uid())
          AND vp.status IN ('accepted'::public.pickup_status,'in_progress'::public.pickup_status)
      ))
    )
  FOR UPDATE OF c;

  IF v.id IS NULL THEN
    RAISE EXCEPTION 'Invalid code, pickup expired, not assigned, or code already used';
  END IF;

  UPDATE public.claims SET status='picked_up'::public.claim_status, verified_at=pg_catalog.now()
  WHERE id=v.id RETURNING * INTO v;
  UPDATE public.food_listings SET status='picked_up'::public.listing_status WHERE id=v.listing_id;
  UPDATE public.pickup_requests SET status='completed'::public.pickup_status, responded_at=pg_catalog.now() WHERE claim_id=v.id;
  UPDATE public.volunteer_pickups SET status='completed'::public.pickup_status,
    delivered_at=COALESCE(delivered_at,pg_catalog.now())
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
