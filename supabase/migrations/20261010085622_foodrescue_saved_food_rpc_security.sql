-- Saving food is a recipient-only operation and must act only on currently available listings.
CREATE OR REPLACE FUNCTION public.toggle_saved_food(p_listing_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_user uuid := (SELECT auth.uid());
  v_exists boolean;
BEGIN
  IF v_user IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.profiles AS p
    WHERE p.id = v_user
      AND p.status = 'active'
      AND p.role = 'recipient'::public.foodrescue_role
  ) THEN
    RAISE EXCEPTION 'Only active recipients can save food';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.food_listings AS f
    WHERE f.id = p_listing_id
      AND f.status = 'available'::public.listing_status
      AND f.pickup_deadline > pg_catalog.now()
  ) THEN
    RAISE EXCEPTION 'This food listing is not available to save';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.saved_food
    WHERE user_id = v_user AND listing_id = p_listing_id
  ) INTO v_exists;

  IF v_exists THEN
    DELETE FROM public.saved_food
    WHERE user_id = v_user AND listing_id = p_listing_id;
    RETURN false;
  END IF;

  INSERT INTO public.saved_food(user_id, listing_id)
  VALUES (v_user, p_listing_id);
  RETURN true;
END;
$function$;

REVOKE ALL ON FUNCTION public.toggle_saved_food(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.toggle_saved_food(uuid) TO authenticated;
NOTIFY pgrst, 'reload schema';
