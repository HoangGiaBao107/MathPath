begin;

alter table public.profiles
  add column if not exists username text,
  add constraint profiles_username_format_check check (
    username is null or username ~ '^[A-Za-z0-9._-]{3,30}$'
  );

create unique index if not exists profiles_username_lower_unique
  on public.profiles (lower(username)) where username is not null;

create or replace function private.create_profile_for_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, username, language, target_score)
  values (
    new.id,
    nullif(btrim(coalesce(new.raw_user_meta_data ->> 'display_name', '')), ''),
    nullif(btrim(coalesce(new.raw_user_meta_data ->> 'username', '')), ''),
    case when new.raw_user_meta_data ->> 'language' = 'en' then 'en' else 'vi' end,
    case when coalesce(new.raw_user_meta_data ->> 'target_score', '') ~ '^([0-9]([.][0-9])?|10([.]0)?)$'
      then (new.raw_user_meta_data ->> 'target_score')::numeric else null end
  )
  on conflict (id) do update set
    display_name = coalesce(public.profiles.display_name, excluded.display_name),
    username = coalesce(public.profiles.username, excluded.username),
    updated_at = now();
  return new;
end;
$$;
revoke all on function private.create_profile_for_auth_user() from public, anon, authenticated;

commit;
