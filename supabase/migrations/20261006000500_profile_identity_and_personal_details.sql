begin;

alter table public.profiles
  add column if not exists birth_date date,
  add column if not exists gender text,
  add column if not exists avatar_path text;

alter table public.profiles
  drop constraint if exists profiles_gender_check,
  add constraint profiles_gender_check
    check (gender is null or gender in ('female', 'male', 'non_binary', 'prefer_not_to_say')),
  drop constraint if exists profiles_birth_date_check,
  add constraint profiles_birth_date_check
    check (birth_date is null or birth_date <= current_date),
  drop constraint if exists profiles_avatar_path_check,
  add constraint profiles_avatar_path_check
    check (avatar_path is null or avatar_path = id::text || '/avatar');

-- A single canonical account name is used both for sign-in and display.
update public.profiles
set display_name = username,
    updated_at = now()
where username is not null and display_name is distinct from username;

revoke update on public.profiles from public, anon, authenticated;
grant update (display_name, username, language, target_score, birth_date, gender, avatar_path)
  on public.profiles to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'profile-avatars',
  'profile-avatars',
  false,
  2097152,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "profile_avatars_read_own" on storage.objects;
create policy "profile_avatars_read_own" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'profile-avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "profile_avatars_insert_own" on storage.objects;
create policy "profile_avatars_insert_own" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'profile-avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "profile_avatars_update_own" on storage.objects;
create policy "profile_avatars_update_own" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'profile-avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'profile-avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "profile_avatars_delete_own" on storage.objects;
create policy "profile_avatars_delete_own" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'profile-avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

commit;
