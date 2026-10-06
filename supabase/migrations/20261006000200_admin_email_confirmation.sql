-- Allow a password-authenticated admin to finish signing in without email confirmation.
-- The application calls this only after Supabase rejects the correct password solely
-- because the admin account has not confirmed its email.
create or replace function public.confirm_unconfirmed_admin_by_email(target_email text)
returns uuid
language sql
security definer
set search_path = pg_catalog, public, auth
as $$
  with eligible_admin as (
    select u.id
    from auth.users u
    join public.profiles p on p.id = u.id
    where lower(u.email) = lower(btrim(target_email))
      and u.email_confirmed_at is null
      and p.role = 'admin'
    limit 1
  )
  update auth.users u
  set email_confirmed_at = now(), updated_at = now()
  from eligible_admin a
  where u.id = a.id
  returning u.id;
$$;

revoke all on function public.confirm_unconfirmed_admin_by_email(text)
  from public, anon, authenticated;
grant execute on function public.confirm_unconfirmed_admin_by_email(text) to service_role;
