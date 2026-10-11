-- FoodRescue backend foundation
-- IMPORTANT: This file is ONLY SQL for the user's separate Supabase project.
-- It does not connect to or modify any live Supabase project from ChatGPT.

create extension if not exists pgcrypto;

create type public.foodrescue_role as enum ('recipient','donor','volunteer','admin');
create type public.verification_status as enum ('pending','verified','rejected');
create type public.listing_status as enum ('draft','available','claimed','picked_up','expired','hidden');
create type public.claim_status as enum ('pending','approved','rejected','picked_up','cancelled');
create type public.pickup_status as enum ('requested','accepted','in_progress','completed','cancelled');
create type public.report_status as enum ('open','resolved','dismissed','escalated');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role public.foodrescue_role not null default 'recipient',
  full_name text,
  email text,
  phone text,
  neighborhood text,
  avatar_url text,
  status text not null default 'active' check (status in ('active','suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  organization_type text not null,
  contact_person text,
  phone text,
  neighborhood text,
  about text,
  verification_status public.verification_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organization_documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  storage_path text not null,
  document_type text,
  uploaded_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.food_listings (
  id uuid primary key default gen_random_uuid(),
  donor_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(title) between 2 and 70),
  description text,
  category text not null check (category in ('Meals','Bakery','Produce','Packaged')),
  quantity numeric not null check (quantity > 0),
  unit text not null default 'Portions',
  available_from timestamptz,
  pickup_deadline timestamptz not null,
  allergens text,
  storage_notes text,
  pickup_area text not null,
  image_url text,
  status public.listing_status not null default 'available',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.saved_food (
  user_id uuid not null references public.profiles(id) on delete cascade,
  listing_id uuid not null references public.food_listings(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, listing_id)
);

create table public.claims (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.food_listings(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  status public.claim_status not null default 'pending',
  pickup_token uuid not null default gen_random_uuid(),
  pickup_code text not null unique default lpad((floor(random()*1000000))::text, 6, '0'),
  claimed_at timestamptz not null default now(),
  approved_at timestamptz,
  verified_at timestamptz,
  unique (listing_id, recipient_id)
);

create table public.pickup_requests (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid not null unique references public.claims(id) on delete cascade,
  donor_id uuid not null references public.profiles(id),
  recipient_id uuid not null references public.profiles(id),
  status public.pickup_status not null default 'requested',
  requested_at timestamptz not null default now(),
  responded_at timestamptz
);

create table public.volunteer_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  verification_status public.verification_status not null default 'pending',
  available boolean not null default true,
  service_area text,
  updated_at timestamptz not null default now()
);

create table public.volunteer_pickups (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid not null unique references public.claims(id) on delete cascade,
  volunteer_id uuid not null references public.profiles(id) on delete cascade,
  status public.pickup_status not null default 'requested',
  accepted_at timestamptz,
  picked_up_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null default 'activity',
  title text not null,
  body text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id),
  listing_id uuid references public.food_listings(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete cascade,
  reason text not null,
  description text,
  status public.report_status not null default 'open',
  resolved_by uuid references public.profiles(id),
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  check (listing_id is not null or organization_id is not null)
);

create table public.platform_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now()
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id),
  action text not null,
  record_type text,
  record_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index food_listings_donor_idx on public.food_listings(donor_id);
create index food_listings_status_idx on public.food_listings(status);
create index food_listings_deadline_idx on public.food_listings(pickup_deadline);
create index claims_recipient_idx on public.claims(recipient_id);
create index claims_listing_idx on public.claims(listing_id);
create index pickup_requests_donor_idx on public.pickup_requests(donor_id);
create index volunteer_pickups_volunteer_idx on public.volunteer_pickups(volunteer_id);
create index notifications_user_idx on public.notifications(user_id, created_at desc);
create index reports_status_idx on public.reports(status);
create index audit_logs_created_idx on public.audit_logs(created_at desc);

drop trigger if exists on_auth_user_created on auth.users;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare requested_role text;
begin
  requested_role := lower(coalesce(new.raw_user_meta_data ->> 'role', 'recipient'));
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
$$;

revoke all on function public.handle_new_user() from public;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

create trigger profiles_touch before update on public.profiles for each row execute function public.touch_updated_at();
create trigger organizations_touch before update on public.organizations for each row execute function public.touch_updated_at();
create trigger listings_touch before update on public.food_listings for each row execute function public.touch_updated_at();

create schema if not exists private;
create or replace function private.is_admin()
returns boolean language sql stable security definer set search_path=pg_catalog,public,private as $$
  select exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='admin' and p.status='active');
$$;
revoke all on function private.is_admin() from public;
grant execute on function private.is_admin() to authenticated;

create or replace function public.claim_food(p_listing_id uuid)
returns public.claims
language plpgsql security definer set search_path=pg_catalog,public
as $$
declare v_claim public.claims; v_donor uuid;
begin
  if not exists(select 1 from public.profiles where id=(select auth.uid()) and role='recipient' and status='active') then
    raise exception 'Only active recipients can claim food';
  end if;
  select donor_id into v_donor from public.food_listings where id=p_listing_id and status='available' and pickup_deadline>now() for update;
  if v_donor is null then raise exception 'Listing is not available'; end if;
  insert into public.claims(listing_id,recipient_id,status) values(p_listing_id,(select auth.uid()),'pending') returning * into v_claim;
  insert into public.pickup_requests(claim_id,donor_id,recipient_id) values(v_claim.id,v_donor,(select auth.uid()));
  insert into public.notifications(user_id,title,body,type) values(v_donor,'New food claim','A recipient requested one of your food listings.','claim');
  return v_claim;
end;
$$;

create or replace function public.toggle_saved_food(p_listing_id uuid)
returns boolean language plpgsql security invoker set search_path=public
as $$
declare v_exists boolean;
begin
  select exists(select 1 from public.saved_food where user_id=(select auth.uid()) and listing_id=p_listing_id) into v_exists;
  if v_exists then delete from public.saved_food where user_id=(select auth.uid()) and listing_id=p_listing_id; return false;
  else insert into public.saved_food(user_id,listing_id) values((select auth.uid()),p_listing_id); return true;
  end if;
end;
$$;

create or replace function public.create_food_listing(
  p_title text,p_description text,p_category text,p_quantity numeric,p_unit text,
  p_available_from timestamptz,p_pickup_deadline timestamptz,p_allergens text,
  p_storage_notes text,p_pickup_area text,p_image_url text default null
) returns public.food_listings
language plpgsql security invoker set search_path=public
as $$
declare v public.food_listings;
begin
  if not exists(select 1 from public.profiles where id=(select auth.uid()) and role='donor' and status='active') then raise exception 'Only active donors can create listings'; end if;
  insert into public.food_listings(donor_id,title,description,category,quantity,unit,available_from,pickup_deadline,allergens,storage_notes,pickup_area,image_url)
  values((select auth.uid()),p_title,p_description,p_category,p_quantity,p_unit,p_available_from,p_pickup_deadline,p_allergens,p_storage_notes,p_pickup_area,p_image_url)
  returning * into v;
  insert into public.audit_logs(actor_id,action,record_type,record_id) values((select auth.uid()),'listing_created','food_listing',v.id);
  return v;
end;
$$;

create or replace function public.update_food_listing(p_listing_id uuid,p_title text,p_description text,p_category text,p_quantity numeric,p_unit text,p_pickup_deadline timestamptz,p_allergens text,p_storage_notes text,p_pickup_area text,p_image_url text)
returns public.food_listings language plpgsql security invoker set search_path=public as $$
declare v public.food_listings;
begin
 update public.food_listings set title=p_title,description=p_description,category=p_category,quantity=p_quantity,unit=p_unit,pickup_deadline=p_pickup_deadline,allergens=p_allergens,storage_notes=p_storage_notes,pickup_area=p_pickup_area,image_url=p_image_url where id=p_listing_id and donor_id=(select auth.uid()) returning * into v;
 if v.id is null then raise exception 'Listing not found or not owned by donor'; end if; return v;
end; $$;

create or replace function public.delete_food_listing(p_listing_id uuid)
returns boolean language plpgsql security invoker set search_path=public as $$
declare n integer;
begin delete from public.food_listings where id=p_listing_id and donor_id=(select auth.uid()) and not exists(select 1 from public.claims c where c.listing_id=p_listing_id and c.status in ('approved','picked_up')); get diagnostics n=row_count; return n=1; end; $$;

create or replace function public.respond_to_claim(p_claim_id uuid,p_action text)
returns public.claims language plpgsql security definer set search_path=pg_catalog,public as $$
declare v public.claims; v_donor uuid;
begin
 select c.* into v from public.claims c join public.food_listings f on f.id=c.listing_id where c.id=p_claim_id and f.donor_id=(select auth.uid()) for update;
 if v.id is null then raise exception 'Claim not found'; end if;
 if p_action='approve' then
   update public.claims set status='approved',approved_at=now() where id=v.id returning * into v;
   update public.food_listings set status='claimed' where id=v.listing_id;
   update public.pickup_requests set status='accepted',responded_at=now() where claim_id=v.id;
 elsif p_action='reject' then
   update public.claims set status='rejected' where id=v.id returning * into v;
   update public.pickup_requests set status='cancelled',responded_at=now() where claim_id=v.id;
 else raise exception 'Unsupported action'; end if;
 insert into public.notifications(user_id,title,body,type) values(v.recipient_id,case when p_action='approve' then 'Claim approved' else 'Claim declined' end,'Your food claim status was updated.','claim');
 return v;
end; $$;

create or replace function public.offer_pickup(p_claim_id uuid)
returns public.volunteer_pickups language plpgsql security definer set search_path=pg_catalog,public as $$
declare v public.volunteer_pickups;
begin
 if not exists(select 1 from public.profiles where id=(select auth.uid()) and role='volunteer' and status='active') then raise exception 'Only active volunteers can offer pickup help'; end if;
 insert into public.volunteer_pickups(claim_id,volunteer_id,status) values(p_claim_id,(select auth.uid()),'requested') returning * into v;
 return v;
end; $$;

create or replace function public.verify_pickup(p_code text,p_token uuid default null)
returns public.claims language plpgsql security definer set search_path=pg_catalog,public as $$
declare v public.claims;
begin
 if not exists(select 1 from public.profiles where id=(select auth.uid()) and role in ('donor','volunteer') and status='active') then raise exception 'Only active donors or volunteers can verify pickups'; end if;
 select c.* into v from public.claims c join public.food_listings f on f.id=c.listing_id where c.status='approved' and c.verified_at is null and ((p_token is not null and c.pickup_token=p_token) or (p_code is not null and c.pickup_code=p_code)) for update;
 if v.id is null then raise exception 'Invalid or already used pickup code'; end if;
 update public.claims set status='picked_up',verified_at=now() where id=v.id returning * into v;
 update public.food_listings set status='picked_up' where id=v.listing_id;
 update public.pickup_requests set status='completed',responded_at=now() where claim_id=v.id;
 return v;
end; $$;



create or replace function public.volunteer_update_pickup(p_pickup_id uuid,p_status public.pickup_status)
returns public.volunteer_pickups
language plpgsql security definer set search_path=pg_catalog,public
as $$
declare v public.volunteer_pickups;
begin
  if not exists(select 1 from public.profiles where id=(select auth.uid()) and role='volunteer' and status='active') then raise exception 'Only active volunteers can update pickups'; end if;
  update public.volunteer_pickups
  set status=p_status,
      accepted_at=case when p_status='accepted' then coalesce(accepted_at,now()) else accepted_at end,
      picked_up_at=case when p_status='in_progress' then coalesce(picked_up_at,now()) else picked_up_at end,
      delivered_at=case when p_status='completed' then coalesce(delivered_at,now()) else delivered_at end
  where id=p_pickup_id and volunteer_id=(select auth.uid())
  returning * into v;
  if v.id is null then raise exception 'Pickup not found or not assigned to volunteer'; end if;
  return v;
end;
$$;

create or replace function public.create_report(p_listing_id uuid,p_organization_id uuid,p_reason text,p_description text)
returns public.reports language plpgsql security invoker set search_path=public as $$
declare v public.reports;
begin
 insert into public.reports(reporter_id,listing_id,organization_id,reason,description) values((select auth.uid()),p_listing_id,p_organization_id,p_reason,p_description) returning * into v;
 return v;
end; $$;

create or replace function public.mark_notifications_read(p_notification_ids uuid[] default null)
returns integer language plpgsql security invoker set search_path=public as $$
declare n integer;
begin
 if p_notification_ids is null then update public.notifications set read_at=coalesce(read_at,now()) where user_id=(select auth.uid());
 else update public.notifications set read_at=coalesce(read_at,now()) where user_id=(select auth.uid()) and id=any(p_notification_ids); end if;
 get diagnostics n=row_count; return n;
end; $$;

create or replace function public.admin_set_organization_status(p_organization_id uuid,p_status public.verification_status)
returns public.organizations language plpgsql security definer set search_path=pg_catalog,public as $$
declare v public.organizations;
begin if not private.is_admin() then raise exception 'Admin only'; end if; update public.organizations set verification_status=p_status where id=p_organization_id returning * into v; insert into public.audit_logs(actor_id,action,record_type,record_id,metadata) values((select auth.uid()),'organization_status_changed','organization',p_organization_id,jsonb_build_object('status',p_status)); return v; end; $$;

create or replace function public.admin_set_listing_status(p_listing_id uuid,p_status public.listing_status)
returns public.food_listings language plpgsql security definer set search_path=pg_catalog,public as $$
declare v public.food_listings;
begin if not private.is_admin() then raise exception 'Admin only'; end if; update public.food_listings set status=p_status where id=p_listing_id returning * into v; insert into public.audit_logs(actor_id,action,record_type,record_id,metadata) values((select auth.uid()),'listing_status_changed','food_listing',p_listing_id,jsonb_build_object('status',p_status)); return v; end; $$;

create or replace function public.admin_set_report_status(p_report_id uuid,p_status public.report_status)
returns public.reports language plpgsql security definer set search_path=pg_catalog,public as $$
declare v public.reports;
begin if not private.is_admin() then raise exception 'Admin only'; end if; update public.reports set status=p_status,resolved_by=(select auth.uid()),resolved_at=case when p_status in ('resolved','dismissed') then now() else null end where id=p_report_id returning * into v; insert into public.audit_logs(actor_id,action,record_type,record_id,metadata) values((select auth.uid()),'report_status_changed','report',p_report_id,jsonb_build_object('status',p_status)); return v; end; $$;

create or replace function public.admin_set_user_status(p_user_id uuid,p_status text)
returns public.profiles language plpgsql security definer set search_path=pg_catalog,public as $$
declare v public.profiles;
begin if not private.is_admin() then raise exception 'Admin only'; end if; if p_status not in ('active','suspended') then raise exception 'Invalid user status'; end if; update public.profiles set status=p_status where id=p_user_id returning * into v; insert into public.audit_logs(actor_id,action,record_type,record_id,metadata) values((select auth.uid()),'user_status_changed','profile',p_user_id,jsonb_build_object('status',p_status)); return v; end; $$;

create or replace function public.update_my_profile(p_full_name text,p_phone text,p_neighborhood text,p_avatar_url text default null)
returns public.profiles language plpgsql security invoker set search_path=public as $$
declare v public.profiles;
begin update public.profiles set full_name=p_full_name,phone=p_phone,neighborhood=p_neighborhood,avatar_url=coalesce(p_avatar_url,avatar_url) where id=(select auth.uid()) returning * into v; return v; end; $$;

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

create policy profiles_self_select on public.profiles for select to authenticated using (id=(select auth.uid()) or private.is_admin());
create policy profiles_self_update on public.profiles for update to authenticated using (id=(select auth.uid()) or private.is_admin()) with check (id=(select auth.uid()) or private.is_admin());
create policy organizations_owner_select on public.organizations for select to authenticated using (owner_id=(select auth.uid()) or private.is_admin());
create policy organizations_owner_insert on public.organizations for insert to authenticated with check (owner_id=(select auth.uid()));
create policy organizations_owner_update on public.organizations for update to authenticated using (owner_id=(select auth.uid()) or private.is_admin()) with check (owner_id=(select auth.uid()) or private.is_admin());
create policy documents_owner_or_admin on public.organization_documents for select to authenticated using (uploaded_by=(select auth.uid()) or private.is_admin());
create policy listings_public_select on public.food_listings for select to anon, authenticated using (status='available' or donor_id=(select auth.uid()) or private.is_admin());
create policy listings_donor_insert on public.food_listings for insert to authenticated with check (donor_id=(select auth.uid()));
create policy listings_donor_update on public.food_listings for update to authenticated using (donor_id=(select auth.uid()) or private.is_admin()) with check (donor_id=(select auth.uid()) or private.is_admin());
create policy listings_donor_delete on public.food_listings for delete to authenticated using (donor_id=(select auth.uid()) or private.is_admin());
create policy saved_food_owner_all on public.saved_food for all to authenticated using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()));
create policy claims_participant_select on public.claims for select to authenticated using (recipient_id=(select auth.uid()) or exists(select 1 from public.food_listings f where f.id=listing_id and f.donor_id=(select auth.uid())) or private.is_admin());
create policy pickup_requests_participant_select on public.pickup_requests for select to authenticated using (donor_id=(select auth.uid()) or recipient_id=(select auth.uid()) or private.is_admin());
create policy volunteer_pickups_participant_select on public.volunteer_pickups for select to authenticated using (volunteer_id=(select auth.uid()) or exists(select 1 from public.claims c where c.id=claim_id and c.recipient_id=(select auth.uid())) or private.is_admin());
create policy notifications_owner_select on public.notifications for select to authenticated using (user_id=(select auth.uid()) or private.is_admin());
create policy notifications_owner_update on public.notifications for update to authenticated using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()));
create policy reports_participant_select on public.reports for select to authenticated using (reporter_id=(select auth.uid()) or private.is_admin());
create policy reports_create on public.reports for insert to authenticated with check (reporter_id=(select auth.uid()));
create policy audit_admin_select on public.audit_logs for select to authenticated using (private.is_admin());
create policy settings_admin_all on public.platform_settings for all to authenticated using (private.is_admin()) with check (private.is_admin());

-- PostgREST table privileges. RLS remains the authorization boundary.
grant usage on schema public to anon, authenticated;
grant select on public.food_listings to anon;
grant select, insert, update, delete on public.profiles, public.organizations, public.organization_documents,
  public.food_listings, public.saved_food, public.claims, public.pickup_requests,
  public.volunteer_profiles, public.volunteer_pickups, public.notifications, public.reports,
  public.audit_logs, public.platform_settings to authenticated;

-- RPC grants. Frontend calls these through /rest/v1/rpc/<function_name>.
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


-- Private organization documents bucket. Actual file uploads are performed through Supabase Storage.
insert into storage.buckets (id,name,public) values ('foodrescue-documents','foodrescue-documents',false)
on conflict (id) do nothing;

create policy organization_documents_storage_select on storage.objects
for select to authenticated
using (bucket_id='foodrescue-documents' and (private.is_admin() or (storage.foldername(name))[1]=(select auth.uid())::text));

create policy organization_documents_storage_insert on storage.objects
for insert to authenticated
with check (bucket_id='foodrescue-documents' and (private.is_admin() or (storage.foldername(name))[1]=(select auth.uid())::text));

create policy organization_documents_storage_delete on storage.objects
for delete to authenticated
using (bucket_id='foodrescue-documents' and (private.is_admin() or (storage.foldername(name))[1]=(select auth.uid())::text));
