-- Keep the public feed restricted to active, unexpired listings from verified organizations.
CREATE OR REPLACE FUNCTION public.list_available_food()
RETURNS TABLE(
  id uuid, title text, description text, category text, quantity numeric, unit text,
  available_from timestamptz, pickup_deadline timestamptz, allergens text, storage_notes text,
  pickup_area text, image_url text, status public.listing_status,
  created_at timestamptz, updated_at timestamptz, donor_name text
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'pg_catalog','public'
AS $function$
  SELECT f.id,f.title,f.description,f.category,f.quantity,f.unit,f.available_from,f.pickup_deadline,
    f.allergens,f.storage_notes,
    CASE WHEN COALESCE((SELECT NULLIF(ps.value->>'enabled','')::boolean FROM public.platform_settings ps WHERE ps.key='approximate_pickup_areas'),true)
      THEN f.pickup_area ELSE 'Shared after confirmation'::text END,
    f.image_url,f.status,f.created_at,f.updated_at,COALESCE(NULLIF(org.name,''),'Community donor')
  FROM public.food_listings f
  JOIN LATERAL (
    SELECT o.name FROM public.organizations o
    WHERE o.owner_id=f.donor_id AND o.verification_status='verified'::public.verification_status
    ORDER BY o.created_at DESC LIMIT 1
  ) org ON TRUE
  WHERE f.status='available'::public.listing_status AND f.pickup_deadline>pg_catalog.now()
    AND (f.available_from IS NULL OR f.available_from<=pg_catalog.now())
  ORDER BY f.created_at DESC;
$function$;
REVOKE ALL ON FUNCTION public.list_available_food() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_available_food() TO anon,authenticated;

-- Do not publish expired food or food from unverified organizations during admin review.
CREATE OR REPLACE FUNCTION public.admin_review_listing(p_listing_id uuid,p_action text,p_note text DEFAULT NULL)
RETURNS public.food_listings
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'pg_catalog','public'
AS $function$
DECLARE v public.food_listings; v_status public.listing_status; v_title text; v_message text; v_note text:=NULLIF(trim(COALESCE(p_note,'')),'');
BEGIN
  IF NOT private.is_admin() THEN RAISE EXCEPTION 'Admin only'; END IF;
  IF p_action NOT IN ('approve','request_edit','hide') THEN RAISE EXCEPTION 'Unsupported listing review action'; END IF;
  IF char_length(COALESCE(v_note,''))>2000 THEN RAISE EXCEPTION 'Review notes must be 2000 characters or fewer'; END IF;
  SELECT * INTO v FROM public.food_listings WHERE id=p_listing_id FOR UPDATE;
  IF v.id IS NULL THEN RAISE EXCEPTION 'Food listing not found'; END IF;
  IF v.status IN ('claimed'::public.listing_status,'picked_up'::public.listing_status) THEN RAISE EXCEPTION 'This listing has an active or completed claim and cannot be changed by moderation'; END IF;
  IF p_action='approve' THEN
    IF v.pickup_deadline<=pg_catalog.now() THEN RAISE EXCEPTION 'An expired food listing cannot be approved'; END IF;
    IF NOT EXISTS(SELECT 1 FROM public.organizations o WHERE o.owner_id=v.donor_id AND o.verification_status='verified'::public.verification_status) THEN
      RAISE EXCEPTION 'The donor organization must be verified before this listing can be published';
    END IF;
    v_status:='available'::public.listing_status; v_title:='Food listing approved'; v_message:='Your food listing is now available in the community feed.';
  ELSIF p_action='request_edit' THEN
    v_status:='draft'::public.listing_status; v_title:='Changes requested for your food listing'; v_message:='The platform team has requested an update before this listing can be published.';
  ELSE
    v_status:='hidden'::public.listing_status; v_title:='Food listing hidden'; v_message:='Your food listing has been hidden by platform moderation. Review the note or contact support if you have questions.';
  END IF;
  UPDATE public.food_listings SET status=v_status,updated_at=pg_catalog.now() WHERE id=p_listing_id RETURNING * INTO v;
  IF v_note IS NOT NULL THEN v_message:=v_message||E'\n\nReview note: '||v_note; END IF;
  INSERT INTO public.notifications(user_id,title,body,type) VALUES(v.donor_id,v_title,v_message,'listing');
  INSERT INTO public.audit_logs(actor_id,action,record_type,record_id,metadata) VALUES((SELECT auth.uid()),'listing_'||p_action,'food_listing',v.id,jsonb_build_object('status',v_status,'note',v_note));
  RETURN v;
END; $function$;
REVOKE ALL ON FUNCTION public.admin_review_listing(uuid,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_review_listing(uuid,text,text) TO authenticated;

-- Accept approved pickups safely and permit reassignment only after prior assignment cancellation.
CREATE OR REPLACE FUNCTION public.offer_pickup(p_claim_id uuid)
RETURNS public.volunteer_pickups
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'pg_catalog','public'
AS $function$
DECLARE v public.volunteer_pickups; v_enabled boolean;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=(SELECT auth.uid()) AND p.role='volunteer'::public.foodrescue_role AND p.status='active') THEN
    RAISE EXCEPTION 'Only active volunteers can accept a pickup';
  END IF;
  SELECT COALESCE((SELECT NULLIF(ps.value->>'enabled','')::boolean FROM public.platform_settings ps WHERE ps.key='volunteer_assistance'),true) INTO v_enabled;
  IF NOT v_enabled THEN RAISE EXCEPTION 'Volunteer assistance is currently disabled by the platform'; END IF;
  PERFORM 1 FROM public.claims c JOIN public.food_listings f ON f.id=c.listing_id
    WHERE c.id=p_claim_id AND c.status='approved'::public.claim_status AND f.pickup_deadline>pg_catalog.now() FOR UPDATE OF c,f;
  IF NOT FOUND THEN RAISE EXCEPTION 'Only approved, unexpired claims can be picked up'; END IF;
  IF EXISTS(SELECT 1 FROM public.volunteer_pickups vp WHERE vp.claim_id=p_claim_id AND vp.status<>'cancelled'::public.pickup_status) THEN
    RAISE EXCEPTION 'This pickup already has volunteer assistance';
  END IF;
  INSERT INTO public.volunteer_pickups(claim_id,volunteer_id,status,accepted_at,picked_up_at,delivered_at)
  VALUES(p_claim_id,(SELECT auth.uid()),'accepted'::public.pickup_status,pg_catalog.now(),NULL,NULL)
  ON CONFLICT(claim_id) DO UPDATE SET volunteer_id=EXCLUDED.volunteer_id,status='accepted'::public.pickup_status,
    accepted_at=pg_catalog.now(),picked_up_at=NULL,delivered_at=NULL,created_at=pg_catalog.now()
  WHERE public.volunteer_pickups.status='cancelled'::public.pickup_status
  RETURNING * INTO v;
  IF v.id IS NULL THEN RAISE EXCEPTION 'This pickup was assigned by another volunteer. Refresh and try again.'; END IF;
  INSERT INTO public.notifications(user_id,title,body,type) SELECT c.recipient_id,'Volunteer pickup accepted','A volunteer has accepted the pickup handover.','pickup' FROM public.claims c WHERE c.id=p_claim_id;
  INSERT INTO public.audit_logs(actor_id,action,record_type,record_id,metadata) VALUES((SELECT auth.uid()),'volunteer_pickup_accepted','volunteer_pickup',v.id,jsonb_build_object('claim_id',p_claim_id));
  RETURN v;
END; $function$;
REVOKE ALL ON FUNCTION public.offer_pickup(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.offer_pickup(uuid) TO authenticated;

-- Prevent completing a pickup by changing a status directly; one-time verification owns completion.
CREATE OR REPLACE FUNCTION public.volunteer_update_pickup(p_pickup_id uuid,p_status public.pickup_status)
RETURNS public.volunteer_pickups
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'pg_catalog','public'
AS $function$
DECLARE v public.volunteer_pickups; v_current public.pickup_status;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=(SELECT auth.uid()) AND p.role='volunteer'::public.foodrescue_role AND p.status='active') THEN
    RAISE EXCEPTION 'Only active volunteers can update pickups';
  END IF;
  IF p_status NOT IN ('accepted'::public.pickup_status,'in_progress'::public.pickup_status,'cancelled'::public.pickup_status) THEN
    RAISE EXCEPTION 'Use one-time QR/code verification to complete a pickup';
  END IF;
  SELECT vp.status INTO v_current FROM public.volunteer_pickups vp WHERE vp.id=p_pickup_id AND vp.volunteer_id=(SELECT auth.uid()) FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pickup not found or not assigned to volunteer'; END IF;
  IF v_current='requested'::public.pickup_status AND p_status NOT IN ('accepted'::public.pickup_status,'cancelled'::public.pickup_status) THEN
    RAISE EXCEPTION 'Accept the pickup before starting it';
  ELSIF v_current='accepted'::public.pickup_status AND p_status NOT IN ('in_progress'::public.pickup_status,'cancelled'::public.pickup_status) THEN
    RAISE EXCEPTION 'Pickup must be in progress or cancelled';
  ELSIF v_current='in_progress'::public.pickup_status AND p_status<>'cancelled'::public.pickup_status THEN
    RAISE EXCEPTION 'Use QR/code verification to complete an in-progress pickup';
  ELSIF v_current IN ('completed'::public.pickup_status,'cancelled'::public.pickup_status) THEN
    RAISE EXCEPTION 'This pickup is already closed';
  END IF;
  UPDATE public.volunteer_pickups SET status=p_status,
    accepted_at=CASE WHEN p_status='accepted'::public.pickup_status THEN COALESCE(accepted_at,pg_catalog.now()) ELSE accepted_at END,
    picked_up_at=CASE WHEN p_status='in_progress'::public.pickup_status THEN COALESCE(picked_up_at,pg_catalog.now()) ELSE picked_up_at END
    WHERE id=p_pickup_id RETURNING * INTO v;
  INSERT INTO public.audit_logs(actor_id,action,record_type,record_id,metadata) VALUES((SELECT auth.uid()),'volunteer_pickup_status_changed','volunteer_pickup',v.id,jsonb_build_object('status',v.status,'claim_id',v.claim_id));
  RETURN v;
END; $function$;
REVOKE ALL ON FUNCTION public.volunteer_update_pickup(uuid,public.pickup_status) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.volunteer_update_pickup(uuid,public.pickup_status) TO authenticated;
NOTIFY pgrst,'reload schema';
