-- FoodRescue: fix Supabase Auth signup 500
-- Run AFTER the core FoodRescue migration.
-- This migration does not connect to any Supabase project.

-- The previous trigger used SECURITY INVOKER. Supabase Auth creates auth.users
-- under supabase_auth_admin, so the trigger could fail when inserting into
-- public.profiles (especially with RLS), causing /auth/v1/signup to return 500.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text;
  v_requested_role text;
  v_role public.foodrescue_role;
begin
  v_name := coalesce(
    new.raw_user_meta_data ->> 'full_name',
    split_part(coalesce(new.email, ''), '@', 1),
    'User'
  );

  v_requested_role := lower(coalesce(new.raw_user_meta_data ->> 'requested_role', 'recipient'));

  -- Never allow signup metadata to create an admin profile.
  if v_requested_role in ('recipient', 'donor', 'volunteer') then
    v_role := v_requested_role::public.foodrescue_role;
  else
    v_role := 'recipient'::public.foodrescue_role;
  end if;

  insert into public.profiles (
    id,
    email,
    full_name,
    role
  )
  values (
    new.id,
    new.email,
    v_name,
    v_role
  )
  on conflict (id) do update
    set email = excluded.email,
        full_name = coalesce(public.profiles.full_name, excluded.full_name);

  return new;
end;
$$;

-- A trigger function should not be callable as a public RPC endpoint.
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- Recreate the trigger safely in case the old one exists.
drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user();
