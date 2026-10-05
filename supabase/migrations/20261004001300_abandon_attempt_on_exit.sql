create or replace function public.abandon_exam_attempt(
  p_attempt_id uuid, p_user_id uuid, p_guest_session_hash text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.assert_service_role();
  if (p_user_id is null) = (p_guest_session_hash is null) then
    raise exception 'invalid_owner' using errcode = '22023';
  end if;
  update public.attempts
  set status = 'abandoned', last_activity_at = clock_timestamp()
  where id = p_attempt_id and status = 'in_progress'
    and ((p_user_id is not null and user_id = p_user_id)
      or (p_guest_session_hash is not null and guest_session_hash = p_guest_session_hash));
  return found;
end;
$$;

revoke all on function public.abandon_exam_attempt(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.abandon_exam_attempt(uuid, uuid, text) to service_role;
