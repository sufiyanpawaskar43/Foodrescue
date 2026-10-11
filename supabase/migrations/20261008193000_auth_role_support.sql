-- Role security hardening. Roles are assigned by the auth trigger from allowed signup metadata
-- and are never editable by the signed-in user after account creation.
do $acl$
begin
  if to_regprocedure('public.set_my_role(public.foodrescue_role)') is not null then
    execute 'revoke all on function public.set_my_role(public.foodrescue_role) from public, anon, authenticated';
    execute 'drop function public.set_my_role(public.foodrescue_role)';
  end if;
end
$acl$;

grant execute on function public.admin_set_user_status(uuid,text) to authenticated;
grant execute on function public.update_my_profile(text,text,text,text) to authenticated;
