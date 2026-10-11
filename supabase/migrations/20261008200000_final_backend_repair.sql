-- FoodRescue final backend repair for an EXISTING project.
-- Safe to run after the earlier FoodRescue migrations.

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

drop policy if exists listings_public_select on public.food_listings;
create policy listings_public_select
on public.food_listings
for select to anon, authenticated
using (
  status = 'available'
  or donor_id = (select auth.uid())
  or private.is_admin()
);

grant usage on schema public to anon, authenticated;
grant select on public.food_listings to anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text;
  v_name text;
begin
  v_role := lower(coalesce(new.raw_user_meta_data ->> 'requested_role', 'recipient'));
  if v_role not in ('recipient','donor','volunteer') then
    v_role := 'recipient';
  end if;
  v_name := coalesce(nullif(new.raw_user_meta_data ->> 'full_name',''), split_part(coalesce(new.email,''),'@',1), 'User');
  insert into public.profiles (id,email,full_name,role,status)
  values (new.id,new.email,v_name,v_role::public.foodrescue_role,'active')
  on conflict (id) do update
    set email = excluded.email,
        full_name = coalesce(nullif(public.profiles.full_name,''), excluded.full_name);
  return new;
end;
$$;
revoke all on function public.handle_new_user() from public, anon, authenticated;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

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

-- Prevent clients from changing authorization fields directly. All sensitive writes go through RPCs.
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

-- Volunteers may see only approved claims that are available for pickup assistance.
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

-- Organization document access and volunteer profile access.
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
grant select, insert, update on public.volunteer_profiles to authenticated;
grant select, insert, update on public.platform_settings to authenticated;
revoke update on public.organization_documents from authenticated;
revoke delete on public.platform_settings from authenticated;
