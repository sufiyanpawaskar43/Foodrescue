-- Admin review actions: explicit role checks, immutable audit context, and owner notifications.
CREATE OR REPLACE FUNCTION public.admin_review_organization(
  p_organization_id uuid, p_status public.verification_status, p_note text DEFAULT NULL
) RETURNS public.organizations
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'pg_catalog','public' AS $function$
DECLARE v public.organizations; v_title text; v_message text; v_note text := NULLIF(trim(COALESCE(p_note,'')), '');
BEGIN
  IF NOT private.is_admin() THEN RAISE EXCEPTION 'Admin only'; END IF;
  IF p_status NOT IN ('pending'::public.verification_status,'verified'::public.verification_status,'rejected'::public.verification_status) THEN RAISE EXCEPTION 'Invalid organization verification status'; END IF;
  UPDATE public.organizations SET verification_status=p_status,updated_at=pg_catalog.now() WHERE id=p_organization_id RETURNING * INTO v;
  IF v.id IS NULL THEN RAISE EXCEPTION 'Organization not found'; END IF;
  v_title := CASE p_status WHEN 'verified'::public.verification_status THEN 'Organization verified' WHEN 'rejected'::public.verification_status THEN 'Verification request declined' ELSE 'Additional information requested' END;
  v_message := CASE p_status WHEN 'verified'::public.verification_status THEN 'Your organization verification is complete.' WHEN 'rejected'::public.verification_status THEN 'Your verification request was declined. Review the note and contact support if you need clarification.' ELSE 'The platform team needs more information before completing verification.' END;
  IF v_note IS NOT NULL THEN v_message := v_message || E'\n\nReview note: ' || v_note; END IF;
  INSERT INTO public.notifications(user_id,title,body,type) VALUES(v.owner_id,v_title,v_message,'verification');
  INSERT INTO public.audit_logs(actor_id,action,record_type,record_id,metadata) VALUES((SELECT auth.uid()),'organization_reviewed','organization',v.id,jsonb_build_object('status',p_status,'note',v_note));
  RETURN v;
END; $function$;
REVOKE ALL ON FUNCTION public.admin_review_organization(uuid,public.verification_status,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_review_organization(uuid,public.verification_status,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_review_listing(
  p_listing_id uuid, p_action text, p_note text DEFAULT NULL
) RETURNS public.food_listings
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'pg_catalog','public' AS $function$
DECLARE v public.food_listings; v_status public.listing_status; v_title text; v_message text; v_note text := NULLIF(trim(COALESCE(p_note,'')), '');
BEGIN
  IF NOT private.is_admin() THEN RAISE EXCEPTION 'Admin only'; END IF;
  IF p_action NOT IN ('approve','request_edit','hide') THEN RAISE EXCEPTION 'Unsupported listing review action'; END IF;
  SELECT * INTO v FROM public.food_listings WHERE id=p_listing_id FOR UPDATE;
  IF v.id IS NULL THEN RAISE EXCEPTION 'Food listing not found'; END IF;
  IF v.status IN ('claimed'::public.listing_status,'picked_up'::public.listing_status) THEN RAISE EXCEPTION 'This listing has an active or completed claim and cannot be changed by moderation'; END IF;
  IF p_action='approve' THEN
    IF v.pickup_deadline<=pg_catalog.now() THEN RAISE EXCEPTION 'An expired food listing cannot be approved'; END IF;
    v_status := 'available'::public.listing_status; v_title := 'Food listing approved'; v_message := 'Your food listing is now available in the community feed.';
  ELSIF p_action='request_edit' THEN
    v_status := 'draft'::public.listing_status; v_title := 'Changes requested for your food listing'; v_message := 'The platform team has requested an update before this listing can be published.';
  ELSE
    v_status := 'hidden'::public.listing_status; v_title := 'Food listing hidden'; v_message := 'Your food listing has been hidden by platform moderation. Review the note or contact support if you have questions.';
  END IF;
  UPDATE public.food_listings SET status=v_status,updated_at=pg_catalog.now() WHERE id=p_listing_id RETURNING * INTO v;
  IF v_note IS NOT NULL THEN v_message := v_message || E'\n\nReview note: ' || v_note; END IF;
  INSERT INTO public.notifications(user_id,title,body,type) VALUES(v.donor_id,v_title,v_message,'listing');
  INSERT INTO public.audit_logs(actor_id,action,record_type,record_id,metadata) VALUES((SELECT auth.uid()),'listing_'||p_action,'food_listing',v.id,jsonb_build_object('status',v_status,'note',v_note));
  RETURN v;
END; $function$;
REVOKE ALL ON FUNCTION public.admin_review_listing(uuid,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_review_listing(uuid,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_review_report(
  p_report_id uuid, p_status public.report_status, p_note text DEFAULT NULL
) RETURNS public.reports
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'pg_catalog','public' AS $function$
DECLARE v public.reports; v_title text; v_message text; v_note text := NULLIF(trim(COALESCE(p_note,'')), '');
BEGIN
  IF NOT private.is_admin() THEN RAISE EXCEPTION 'Admin only'; END IF;
  IF p_status NOT IN ('open'::public.report_status,'resolved'::public.report_status,'dismissed'::public.report_status,'escalated'::public.report_status) THEN RAISE EXCEPTION 'Invalid report status'; END IF;
  UPDATE public.reports SET status=p_status,resolved_by=(SELECT auth.uid()),resolved_at=CASE WHEN p_status IN ('resolved'::public.report_status,'dismissed'::public.report_status) THEN pg_catalog.now() ELSE NULL END WHERE id=p_report_id RETURNING * INTO v;
  IF v.id IS NULL THEN RAISE EXCEPTION 'Report not found'; END IF;
  v_title := CASE p_status WHEN 'resolved'::public.report_status THEN 'Your report was resolved' WHEN 'dismissed'::public.report_status THEN 'Your report was reviewed' WHEN 'escalated'::public.report_status THEN 'Your report was escalated' ELSE 'Your report is being reviewed' END;
  v_message := CASE p_status WHEN 'resolved'::public.report_status THEN 'The platform team has marked your report as resolved.' WHEN 'dismissed'::public.report_status THEN 'The platform team reviewed and dismissed your report.' WHEN 'escalated'::public.report_status THEN 'The platform team has escalated your report for further review.' ELSE 'The platform team reopened your report for review.' END;
  IF v_note IS NOT NULL THEN v_message := v_message || E'\n\nReview note: ' || v_note; END IF;
  INSERT INTO public.notifications(user_id,title,body,type) VALUES(v.reporter_id,v_title,v_message,'report');
  INSERT INTO public.audit_logs(actor_id,action,record_type,record_id,metadata) VALUES((SELECT auth.uid()),'report_reviewed','report',v.id,jsonb_build_object('status',p_status,'note',v_note));
  RETURN v;
END; $function$;
REVOKE ALL ON FUNCTION public.admin_review_report(uuid,public.report_status,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_review_report(uuid,public.report_status,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_set_user_role_with_note(
  p_user_id uuid, p_role public.foodrescue_role, p_note text DEFAULT NULL
) RETURNS public.profiles
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'pg_catalog','public' AS $function$
DECLARE v public.profiles; v_note text := NULLIF(trim(COALESCE(p_note,'')), '');
BEGIN
  IF NOT private.is_admin() THEN RAISE EXCEPTION 'Admin only'; END IF;
  IF p_user_id=(SELECT auth.uid()) THEN RAISE EXCEPTION 'You cannot change your own role from this screen'; END IF;
  IF p_role='admin'::public.foodrescue_role THEN RAISE EXCEPTION 'Admin role cannot be assigned from this screen'; END IF;
  UPDATE public.profiles SET role=p_role,updated_at=pg_catalog.now() WHERE id=p_user_id RETURNING * INTO v;
  IF v.id IS NULL THEN RAISE EXCEPTION 'User not found'; END IF;
  INSERT INTO public.notifications(user_id,title,body,type) VALUES(v.id,'Your FoodRescue role changed','Your account role was updated to '||p_role::text||'. Sign out and sign in again to refresh your workspace.'||CASE WHEN v_note IS NULL THEN '' ELSE E'\n\nReview note: '||v_note END,'account');
  INSERT INTO public.audit_logs(actor_id,action,record_type,record_id,metadata) VALUES((SELECT auth.uid()),'user_role_changed','profile',v.id,jsonb_build_object('role',p_role,'note',v_note));
  RETURN v;
END; $function$;
REVOKE ALL ON FUNCTION public.admin_set_user_role_with_note(uuid,public.foodrescue_role,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_set_user_role_with_note(uuid,public.foodrescue_role,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_set_user_status_with_note(
  p_user_id uuid, p_status text, p_note text DEFAULT NULL
) RETURNS public.profiles
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'pg_catalog','public' AS $function$
DECLARE v public.profiles; v_note text := NULLIF(trim(COALESCE(p_note,'')), '');
BEGIN
  IF NOT private.is_admin() THEN RAISE EXCEPTION 'Admin only'; END IF;
  IF p_user_id=(SELECT auth.uid()) AND p_status='suspended' THEN RAISE EXCEPTION 'You cannot suspend your own account from this screen'; END IF;
  IF p_status NOT IN ('active','suspended') THEN RAISE EXCEPTION 'Invalid user status'; END IF;
  UPDATE public.profiles SET status=p_status,updated_at=pg_catalog.now() WHERE id=p_user_id RETURNING * INTO v;
  IF v.id IS NULL THEN RAISE EXCEPTION 'User not found'; END IF;
  INSERT INTO public.notifications(user_id,title,body,type) VALUES(v.id,CASE p_status WHEN 'suspended' THEN 'FoodRescue account suspended' ELSE 'FoodRescue account restored' END,(CASE p_status WHEN 'suspended' THEN 'Your account has been suspended. Contact platform support if you need clarification.' ELSE 'Your FoodRescue account has been restored.' END)||CASE WHEN v_note IS NULL THEN '' ELSE E'\n\nReview note: '||v_note END,'account');
  INSERT INTO public.audit_logs(actor_id,action,record_type,record_id,metadata) VALUES((SELECT auth.uid()),'user_status_changed','profile',v.id,jsonb_build_object('status',p_status,'note',v_note));
  RETURN v;
END; $function$;
REVOKE ALL ON FUNCTION public.admin_set_user_status_with_note(uuid,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_set_user_status_with_note(uuid,text,text) TO authenticated;
