-- FoodRescue: repair SQL for an EXISTING project.
-- Run this file if the core tables/functions already exist.
-- It does not create a new project and does not require dropping the schema.

drop trigger if exists on_auth_user_created on auth.users;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  requested_role text;
begin
  requested_role := lower(coalesce(new.raw_user_meta_data ->> 'requested_role', 'recipient'));

  if requested_role not in ('recipient','donor','volunteer') then
    requested_role := 'recipient';
  end if;

  insert into public.profiles (id, email, full_name, role, status)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    requested_role::public.foodrescue_role,
    'active'
  )
  on conflict (id) do nothing;

  return new;
end;
$function$;

revoke all on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.organization_documents enable row level security;
alter table public.food_listings enable row level security;
alter table public.saved_food enable row level security;
alter table public.claims enable row level security;
alter table public.pickup_requests enable row level security;
alter table public.volunteer_profiles enable row level security;
alter table public.volunteer_pickups enable row level security;
alter table public.notifications enable row level security;
alter table public.reports enable row level security;
alter table public.audit_logs enable row level security;
alter table public.platform_settings enable row level security;

-- RPCs that perform cross-table writes must run with the function owner's
-- privileges; each function still performs its own role/ownership checks.
alter function public.claim_food(uuid) security definer set search_path = pg_catalog, public;
alter function public.create_food_listing(text,text,text,numeric,text,timestamptz,timestamptz,text,text,text,text) security definer set search_path = pg_catalog, public;
alter function public.respond_to_claim(uuid,text) security definer set search_path = pg_catalog, public;
alter function public.offer_pickup(uuid) security definer set search_path = pg_catalog, public;
alter function public.verify_pickup(text,uuid) security definer set search_path = pg_catalog, public;
alter function public.volunteer_update_pickup(uuid,public.pickup_status) security definer set search_path = pg_catalog, public;
alter function public.admin_set_organization_status(uuid,public.verification_status) security definer set search_path = pg_catalog, public;
alter function public.admin_set_listing_status(uuid,public.listing_status) security definer set search_path = pg_catalog, public;
alter function public.admin_set_report_status(uuid,public.report_status) security definer set search_path = pg_catalog, public;
alter function public.admin_set_user_status(uuid,text) security definer set search_path = pg_catalog, public;

grant usage on schema public to anon, authenticated;
grant select on public.food_listings to anon;
grant select, insert, update, delete on public.profiles, public.organizations, public.organization_documents,
  public.food_listings, public.saved_food, public.claims, public.pickup_requests,
  public.volunteer_profiles, public.volunteer_pickups, public.notifications, public.reports,
  public.audit_logs, public.platform_settings to authenticated;

grant execute on function public.claim_food(uuid) to authenticated;
grant execute on function public.toggle_saved_food(uuid) to authenticated;
grant execute on function public.create_food_listing(text,text,text,numeric,text,timestamptz,timestamptz,text,text,text,text) to authenticated;
grant execute on function public.update_food_listing(uuid,text,text,text,numeric,text,timestamptz,text,text,text,text) to authenticated;
grant execute on function public.delete_food_listing(uuid) to authenticated;
grant execute on function public.respond_to_claim(uuid,text) to authenticated;
grant execute on function public.offer_pickup(uuid) to authenticated;
grant execute on function public.volunteer_update_pickup(uuid,public.pickup_status) to authenticated;
grant execute on function public.verify_pickup(text,uuid) to authenticated;
grant execute on function public.create_report(uuid,uuid,text,text) to authenticated;
grant execute on function public.mark_notifications_read(uuid[]) to authenticated;
grant execute on function public.admin_set_organization_status(uuid,public.verification_status) to authenticated;
grant execute on function public.admin_set_listing_status(uuid,public.listing_status) to authenticated;
grant execute on function public.admin_set_report_status(uuid,public.report_status) to authenticated;
grant execute on function public.admin_set_user_status(uuid,text) to authenticated;
grant execute on function public.update_my_profile(text,text,text,text) to authenticated;

create or replace function public.admin_set_user_role(p_user_id uuid, p_role public.foodrescue_role)
returns public.profiles
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare v public.profiles;
begin
  if not private.is_admin() then raise exception 'Admin only'; end if;
  if p_role = 'admin' then raise exception 'Admin role cannot be assigned from this screen'; end if;
  update public.profiles set role = p_role where id = p_user_id returning * into v;
  if v.id is null then raise exception 'User not found'; end if;
  insert into public.audit_logs(actor_id,action,record_type,record_id,metadata)
  values ((select auth.uid()),'user_role_changed','profile',p_user_id,jsonb_build_object('role',p_role));
  return v;
end;
$function$;

grant execute on function public.admin_set_user_role(uuid,public.foodrescue_role) to authenticated;
do $acl$ begin if to_regprocedure('public.set_my_role(public.foodrescue_role)') is not null then execute 'revoke all on function public.set_my_role(public.foodrescue_role) from public, anon, authenticated'; end if; end $acl$;

alter function public.toggle_saved_food(uuid) security definer set search_path = pg_catalog, public;
alter function public.create_report(uuid,uuid,text,text) security definer set search_path = pg_catalog, public;
alter function public.mark_notifications_read(uuid[]) security definer set search_path = pg_catalog, public;
alter function public.update_my_profile(text,text,text,text) security definer set search_path = pg_catalog, public;

revoke insert, update, delete on public.profiles from authenticated;
grant select on public.profiles to authenticated;
revoke insert, update, delete on public.claims from authenticated;
grant select on public.claims to authenticated;
revoke insert, update, delete on public.pickup_requests from authenticated;
grant select on public.pickup_requests to authenticated;
revoke insert, update, delete on public.volunteer_pickups from authenticated;
grant select on public.volunteer_pickups to authenticated;
revoke insert, update, delete on public.notifications from authenticated;
grant select on public.notifications to authenticated;
revoke update, delete on public.audit_logs from authenticated;
grant select on public.audit_logs to authenticated;
revoke insert, update, delete on public.reports from authenticated;
grant select on public.reports to authenticated;
revoke insert, update, delete on public.food_listings from authenticated;
grant select on public.food_listings to anon, authenticated;
grant execute on function public.toggle_saved_food(uuid) to authenticated;
grant execute on function public.create_report(uuid,uuid,text,text) to authenticated;
grant execute on function public.mark_notifications_read(uuid[]) to authenticated;
grant execute on function public.update_my_profile(text,text,text,text) to authenticated;

drop policy if exists claims_volunteer_select on public.claims;
create policy claims_volunteer_select
on public.claims
for select to authenticated
using (
  status = 'approved'
  and exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid())
      and p.role = 'volunteer'
      and p.status = 'active'
  )
);

create or replace function public.offer_pickup(p_claim_id uuid)
returns public.volunteer_pickups
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare v public.volunteer_pickups;
begin
  if not exists(select 1 from public.profiles where id=(select auth.uid()) and role='volunteer' and status='active') then
    raise exception 'Only active volunteers can offer pickup help';
  end if;
  if not exists(select 1 from public.claims where id=p_claim_id and status='approved') then
    raise exception 'Only approved claims can be picked up';
  end if;
  if exists(select 1 from public.volunteer_pickups where claim_id=p_claim_id and status <> 'cancelled') then
    raise exception 'This pickup already has volunteer assistance';
  end if;
  insert into public.volunteer_pickups(claim_id,volunteer_id,status)
  values(p_claim_id,(select auth.uid()),'requested') returning * into v;
  return v;
end;
$function$;
grant execute on function public.offer_pickup(uuid) to authenticated;

drop policy if exists documents_owner_insert on public.organization_documents;
create policy documents_owner_insert
on public.organization_documents for insert to authenticated
with check (uploaded_by=(select auth.uid()) or private.is_admin());
drop policy if exists documents_owner_delete on public.organization_documents;
create policy documents_owner_delete
on public.organization_documents for delete to authenticated
using (uploaded_by=(select auth.uid()) or private.is_admin());

drop policy if exists volunteer_profile_self_select on public.volunteer_profiles;
create policy volunteer_profile_self_select
on public.volunteer_profiles for select to authenticated
using (user_id=(select auth.uid()) or private.is_admin());
drop policy if exists volunteer_profile_self_insert on public.volunteer_profiles;
create policy volunteer_profile_self_insert
on public.volunteer_profiles for insert to authenticated
with check (user_id=(select auth.uid()));
drop policy if exists volunteer_profile_self_update on public.volunteer_profiles;
create policy volunteer_profile_self_update
on public.volunteer_profiles for update to authenticated
using (user_id=(select auth.uid()) or private.is_admin())
with check (user_id=(select auth.uid()) or private.is_admin());
grant select, insert, delete on public.organization_documents to authenticated;
revoke insert, update, delete on public.volunteer_profiles from authenticated;
grant select on public.volunteer_profiles to authenticated;
revoke update on public.organizations from authenticated;
grant usage on schema private to anon, authenticated;
grant execute on function private.is_admin() to anon, authenticated;
grant select, insert, update on public.platform_settings to authenticated;
revoke update on public.organization_documents from authenticated;
revoke delete on public.platform_settings from authenticated;


-- Latest idempotent data API, claim workflow, and storage integration fixes.
-- FoodRescue live integration fixes. Safe to run after 20261008200000_final_backend_repair.sql.
-- Public listing reads expose only available, non-expired listings. Claim reads are scoped by role.

create or replace function public.list_available_food()
returns table (
  id uuid, title text, description text, category text, quantity numeric, unit text,
  available_from timestamptz, pickup_deadline timestamptz, allergens text, storage_notes text,
  pickup_area text, image_url text, status public.listing_status,
  created_at timestamptz, updated_at timestamptz, donor_name text
)
language sql stable security definer set search_path=pg_catalog, public
as $$
  select f.id, f.title, f.description, f.category, f.quantity, f.unit,
    f.available_from, f.pickup_deadline, f.allergens, f.storage_notes,
    f.pickup_area, f.image_url, f.status, f.created_at, f.updated_at,
    coalesce(nullif(o.name,''), nullif(p.full_name,''), 'Community donor')
  from public.food_listings f
  left join public.profiles p on p.id=f.donor_id
  left join lateral (
    select org.name from public.organizations org
    where org.owner_id=f.donor_id and org.verification_status='verified'::public.verification_status
    order by org.created_at desc limit 1
  ) o on true
  where f.status='available'::public.listing_status and f.pickup_deadline>now()
  order by f.created_at desc;
$$;
revoke all on function public.list_available_food() from public, anon, authenticated;
grant execute on function public.list_available_food() to anon, authenticated;

create or replace function public.list_foodrescue_claims()
returns table (
  id uuid, listing_id uuid, recipient_id uuid, status public.claim_status,
  pickup_token uuid, pickup_code text, claimed_at timestamptz, approved_at timestamptz, verified_at timestamptz,
  title text, description text, category text, quantity numeric, unit text, pickup_deadline timestamptz,
  pickup_area text, image_url text, donor_id uuid, listing_status public.listing_status, donor_name text
)
language plpgsql security definer set search_path=pg_catalog, public
as $$
declare v_user uuid := (select auth.uid()); v_role public.foodrescue_role;
begin
  if v_user is null then raise exception 'Sign in to view claims'; end if;
  select p.role into v_role from public.profiles p where p.id=v_user and p.status='active';
  if v_role is null then raise exception 'Active profile required'; end if;
  return query
  select c.id,c.listing_id,c.recipient_id,c.status,
    case when c.status='approved'::public.claim_status and (
      c.recipient_id=v_user or f.donor_id=v_user or v_role='admin'::public.foodrescue_role or
      exists(select 1 from public.volunteer_pickups vp where vp.claim_id=c.id and vp.volunteer_id=v_user and vp.status<>'cancelled'::public.pickup_status))
      then c.pickup_token else null::uuid end,
    case when c.status='approved'::public.claim_status and (
      c.recipient_id=v_user or f.donor_id=v_user or v_role='admin'::public.foodrescue_role or
      exists(select 1 from public.volunteer_pickups vp where vp.claim_id=c.id and vp.volunteer_id=v_user and vp.status<>'cancelled'::public.pickup_status))
      then c.pickup_code else null::text end,
    c.claimed_at,c.approved_at,c.verified_at,f.title,f.description,f.category,f.quantity,f.unit,
    f.pickup_deadline,f.pickup_area,f.image_url,f.donor_id,f.status,
    case when c.recipient_id=v_user or f.donor_id=v_user or v_role='admin'::public.foodrescue_role or
      exists(select 1 from public.volunteer_pickups vp where vp.claim_id=c.id and vp.volunteer_id=v_user and vp.status<>'cancelled'::public.pickup_status)
      then coalesce(dp.full_name,'Community donor') else 'Community donor' end
  from public.claims c join public.food_listings f on f.id=c.listing_id
  left join public.profiles dp on dp.id=f.donor_id
  where c.recipient_id=v_user or f.donor_id=v_user or v_role='admin'::public.foodrescue_role or
    (v_role='volunteer'::public.foodrescue_role and (
      exists(select 1 from public.volunteer_pickups vp where vp.claim_id=c.id and vp.volunteer_id=v_user and vp.status<>'cancelled'::public.pickup_status)
      or (c.status='approved'::public.claim_status and not exists(select 1 from public.volunteer_pickups vp where vp.claim_id=c.id and vp.status<>'cancelled'::public.pickup_status))
    ))
  order by c.claimed_at desc;
end;
$$;
revoke all on function public.list_foodrescue_claims() from public, anon, authenticated;
grant execute on function public.list_foodrescue_claims() to authenticated;

create or replace function public.upsert_my_volunteer_profile(p_service_area text, p_available boolean)
returns public.volunteer_profiles
language plpgsql security definer set search_path=pg_catalog, public
as $$
declare v public.volunteer_profiles;
begin
  if not exists(select 1 from public.profiles where id=(select auth.uid()) and role='volunteer'::public.foodrescue_role and status='active') then
    raise exception 'Only active volunteers can update a volunteer profile';
  end if;
  insert into public.volunteer_profiles(user_id,service_area,available,verification_status)
  values((select auth.uid()),nullif(trim(coalesce(p_service_area,'')),''),coalesce(p_available,true),'pending'::public.verification_status)
  on conflict(user_id) do update set service_area=excluded.service_area,available=excluded.available,updated_at=now()
  returning * into v;
  return v;
end;
$$;
revoke all on function public.upsert_my_volunteer_profile(text,boolean) from public, anon, authenticated;
grant execute on function public.upsert_my_volunteer_profile(text,boolean) to authenticated;

-- Atomic claim + donor decision. Listing status prevents parallel claims.
create or replace function public.claim_food(p_listing_id uuid)
returns public.claims language plpgsql security definer set search_path=pg_catalog, public
as $$
declare v_claim public.claims; v_donor uuid; v_user uuid := (select auth.uid());
begin
  if v_user is null or not exists(select 1 from public.profiles p where p.id=v_user and p.role='recipient'::public.foodrescue_role and p.status='active') then
    raise exception 'Only active recipients can claim food';
  end if;
  select f.donor_id into v_donor from public.food_listings f where f.id=p_listing_id and f.status='available'::public.listing_status and f.pickup_deadline>now() for update;
  if v_donor is null then raise exception 'Listing is not available'; end if;
  if exists(select 1 from public.claims c where c.listing_id=p_listing_id and c.status in ('pending'::public.claim_status,'approved'::public.claim_status)) then
    raise exception 'This listing already has an active claim';
  end if;
  select c.* into v_claim from public.claims c where c.listing_id=p_listing_id and c.recipient_id=v_user for update;
  if v_claim.id is null then
    insert into public.claims(listing_id,recipient_id,status) values(p_listing_id,v_user,'pending'::public.claim_status) returning * into v_claim;
  else
    update public.claims set status='pending'::public.claim_status,pickup_token=gen_random_uuid(),pickup_code=lpad((floor(random()*1000000))::text,6,'0'),claimed_at=now(),approved_at=null,verified_at=null where id=v_claim.id returning * into v_claim;
  end if;
  insert into public.pickup_requests(claim_id,donor_id,recipient_id,status,requested_at,responded_at)
  values(v_claim.id,v_donor,v_user,'requested'::public.pickup_status,now(),null)
  on conflict(claim_id) do update set donor_id=excluded.donor_id,recipient_id=excluded.recipient_id,status='requested'::public.pickup_status,requested_at=now(),responded_at=null;
  update public.food_listings set status='claimed'::public.listing_status where id=p_listing_id;
  insert into public.notifications(user_id,title,body,type) values(v_donor,'New food claim','A recipient requested one of your food listings.','claim');
  return v_claim;
end;
$$;

create or replace function public.respond_to_claim(p_claim_id uuid,p_action text)
returns public.claims language plpgsql security definer set search_path=pg_catalog, public
as $$
declare v public.claims; v_listing public.food_listings; v_user uuid := (select auth.uid());
begin
  if p_action not in ('approve','reject') then raise exception 'Unsupported action'; end if;
  select c.* into v from public.claims c where c.id=p_claim_id for update;
  if v.id is null then raise exception 'Claim not found'; end if;
  if not exists(select 1 from public.food_listings f where f.id=v.listing_id and f.donor_id=v_user) then raise exception 'Claim not found or not owned by donor'; end if;
  if v.status<>'pending'::public.claim_status then raise exception 'This claim has already been handled'; end if;
  select * into v_listing from public.food_listings f where f.id=v.listing_id for update;
  if p_action='approve' then
    if v_listing.status not in ('claimed'::public.listing_status,'available'::public.listing_status) or v_listing.pickup_deadline<=now() then raise exception 'This listing is no longer available'; end if;
    if exists(select 1 from public.claims c where c.listing_id=v.listing_id and c.id<>v.id and c.status='approved'::public.claim_status) then raise exception 'Another claim has already been approved'; end if;
    update public.claims set status='approved'::public.claim_status,approved_at=now() where id=v.id returning * into v;
    update public.food_listings set status='claimed'::public.listing_status where id=v.listing_id;
    update public.pickup_requests set status='accepted'::public.pickup_status,responded_at=now() where claim_id=v.id;
  else
    update public.claims set status='rejected'::public.claim_status where id=v.id returning * into v;
    update public.pickup_requests set status='cancelled'::public.pickup_status,responded_at=now() where claim_id=v.id;
    if not exists(select 1 from public.claims c where c.listing_id=v.listing_id and c.id<>v.id and c.status in ('pending'::public.claim_status,'approved'::public.claim_status)) then
      update public.food_listings set status=case when pickup_deadline>now() then 'available'::public.listing_status else 'expired'::public.listing_status end where id=v.listing_id and status='claimed'::public.listing_status;
    end if;
  end if;
  insert into public.notifications(user_id,title,body,type) values(v.recipient_id,case when p_action='approve' then 'Claim approved' else 'Claim declined' end,'Your food claim status was updated.','claim');
  insert into public.audit_logs(actor_id,action,record_type,record_id,metadata) values(v_user,'claim_'||p_action,'claim',v.id,jsonb_build_object('listing_id',v.listing_id));
  return v;
end;
$$;

create or replace function public.offer_pickup(p_claim_id uuid)
returns public.volunteer_pickups language plpgsql security definer set search_path=pg_catalog, public
as $$
declare v public.volunteer_pickups;
begin
  if not exists(select 1 from public.profiles where id=(select auth.uid()) and role='volunteer'::public.foodrescue_role and status='active') then raise exception 'Only active volunteers can accept a pickup'; end if;
  perform 1 from public.claims where id=p_claim_id and status='approved'::public.claim_status for update;
  if not found then raise exception 'Only approved claims can be picked up'; end if;
  if exists(select 1 from public.volunteer_pickups where claim_id=p_claim_id and status<>'cancelled'::public.pickup_status) then raise exception 'This pickup already has volunteer assistance'; end if;
  insert into public.volunteer_pickups(claim_id,volunteer_id,status,accepted_at) values(p_claim_id,(select auth.uid()),'accepted'::public.pickup_status,now()) returning * into v;
  return v;
end;
$$;

create or replace function public.verify_pickup(p_code text,p_token uuid default null)
returns public.claims language plpgsql security definer set search_path=pg_catalog, public
as $$
declare v public.claims; v_role public.foodrescue_role;
begin
  select p.role into v_role from public.profiles p where p.id=(select auth.uid()) and p.status='active';
  if v_role not in ('donor'::public.foodrescue_role,'volunteer'::public.foodrescue_role) then raise exception 'Only active donors or volunteers can verify pickups'; end if;
  select c.* into v from public.claims c join public.food_listings f on f.id=c.listing_id
  where c.status='approved'::public.claim_status and c.verified_at is null
    and ((p_token is not null and c.pickup_token=p_token) or (p_code is not null and c.pickup_code=p_code))
    and ((v_role='donor'::public.foodrescue_role and f.donor_id=(select auth.uid())) or
      (v_role='volunteer'::public.foodrescue_role and exists(select 1 from public.volunteer_pickups vp where vp.claim_id=c.id and vp.volunteer_id=(select auth.uid()) and vp.status<>'cancelled'::public.pickup_status)))
  for update of c;
  if v.id is null then raise exception 'Invalid code, pickup not assigned, or code already used'; end if;
  update public.claims set status='picked_up'::public.claim_status,verified_at=now() where id=v.id returning * into v;
  update public.food_listings set status='picked_up'::public.listing_status where id=v.listing_id;
  update public.pickup_requests set status='completed'::public.pickup_status,responded_at=now() where claim_id=v.id;
  update public.volunteer_pickups set status='completed'::public.pickup_status,delivered_at=coalesce(delivered_at,now()) where claim_id=v.id and status<>'cancelled'::public.pickup_status;
  insert into public.notifications(user_id,title,body,type) values(v.recipient_id,'Pickup completed','Your food pickup has been verified.','pickup');
  return v;
end;
$$;

create or replace function public.volunteer_update_pickup(p_pickup_id uuid,p_status public.pickup_status)
returns public.volunteer_pickups language plpgsql security definer set search_path=pg_catalog, public
as $$
declare v public.volunteer_pickups; v_current public.pickup_status;
begin
  if not exists(select 1 from public.profiles where id=(select auth.uid()) and role='volunteer'::public.foodrescue_role and status='active') then raise exception 'Only active volunteers can update pickups'; end if;
  if p_status not in ('accepted'::public.pickup_status,'in_progress'::public.pickup_status,'cancelled'::public.pickup_status) then raise exception 'Pickup completion must be verified using the one-time QR/code'; end if;
  select status into v_current from public.volunteer_pickups where id=p_pickup_id and volunteer_id=(select auth.uid()) for update;
  if not found then raise exception 'Pickup not found or not assigned to volunteer'; end if;
  if v_current='requested'::public.pickup_status and p_status not in ('accepted'::public.pickup_status,'cancelled'::public.pickup_status) then raise exception 'Accept the pickup before starting it';
  elsif v_current='accepted'::public.pickup_status and p_status not in ('in_progress'::public.pickup_status,'cancelled'::public.pickup_status) then raise exception 'Pickup must be in progress or cancelled';
  elsif v_current='in_progress'::public.pickup_status and p_status<>'cancelled'::public.pickup_status then raise exception 'Complete pickup only after QR/code verification';
  elsif v_current in ('completed'::public.pickup_status,'cancelled'::public.pickup_status) then raise exception 'This pickup is already closed'; end if;
  update public.volunteer_pickups set status=p_status,
    accepted_at=case when p_status='accepted'::public.pickup_status then coalesce(accepted_at,now()) else accepted_at end,
    picked_up_at=case when p_status='in_progress'::public.pickup_status then coalesce(picked_up_at,now()) else picked_up_at end
    where id=p_pickup_id returning * into v;
  return v;
end;
$$;

-- Food photos are public, while verification documents remain in their private bucket.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('foodrescue-images','foodrescue-images',true,10485760,array['image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=true,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
drop policy if exists food_images_owner_insert on storage.objects;
create policy food_images_owner_insert on storage.objects for insert to authenticated
with check(bucket_id='foodrescue-images' and (storage.foldername(name))[1]=(select auth.uid())::text);
drop policy if exists food_images_owner_update on storage.objects;
create policy food_images_owner_update on storage.objects for update to authenticated
using(bucket_id='foodrescue-images' and (storage.foldername(name))[1]=(select auth.uid())::text)
with check(bucket_id='foodrescue-images' and (storage.foldername(name))[1]=(select auth.uid())::text);
drop policy if exists food_images_owner_delete on storage.objects;
create policy food_images_owner_delete on storage.objects for delete to authenticated
using(bucket_id='foodrescue-images' and (storage.foldername(name))[1]=(select auth.uid())::text);

revoke all on function public.claim_food(uuid) from public, anon, authenticated;
revoke all on function public.respond_to_claim(uuid,text) from public, anon, authenticated;
revoke all on function public.offer_pickup(uuid) from public, anon, authenticated;
revoke all on function public.verify_pickup(text,uuid) from public, anon, authenticated;
revoke all on function public.volunteer_update_pickup(uuid,public.pickup_status) from public, anon, authenticated;
grant execute on function public.claim_food(uuid) to authenticated;
grant execute on function public.respond_to_claim(uuid,text) to authenticated;
grant execute on function public.offer_pickup(uuid) to authenticated;
grant execute on function public.verify_pickup(text,uuid) to authenticated;
grant execute on function public.volunteer_update_pickup(uuid,public.pickup_status) to authenticated;


-- Scoped volunteer-pickup list: do not grant direct SELECT on volunteer_pickups.
-- The frontend calls this RPC instead of GET /rest/v1/volunteer_pickups?select=*.
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
NOTIFY pgrst, 'reload schema';
