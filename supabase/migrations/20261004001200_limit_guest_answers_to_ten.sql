create table private.guest_question_usage (
  guest_session_hash text not null check (guest_session_hash ~ '^[0-9a-f]{64}$'),
  problem_id uuid not null references public.problems(id) on delete cascade,
  first_answered_at timestamptz not null default clock_timestamp(),
  primary key (guest_session_hash, problem_id)
);

revoke all on table private.guest_question_usage from public, anon, authenticated, service_role;

insert into private.guest_question_usage (guest_session_hash, problem_id, first_answered_at)
select a.guest_session_hash, answer.problem_id, min(coalesce(answer.answered_at, answer.updated_at))
from public.attempts a
join public.attempt_answers answer on answer.attempt_id = a.id
where a.guest_session_hash is not null and answer.selected_answer is not null
group by a.guest_session_hash, answer.problem_id
on conflict do nothing;

create or replace function public.get_guest_question_usage(p_guest_session_hash text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare used_count integer;
begin
  perform private.assert_service_role();
  if p_guest_session_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid_guest_session' using errcode = '22023';
  end if;
  select count(*)::integer into used_count
  from private.guest_question_usage
  where guest_session_hash = p_guest_session_hash;
  return coalesce(used_count, 0);
end;
$$;

create or replace function public.save_exam_attempt_state(
  p_attempt_id uuid, p_user_id uuid, p_guest_session_hash text,
  p_problem_id uuid, p_selected_answer jsonb, p_marked_for_review boolean
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  a public.attempts%rowtype;
  used_count integer;
begin
  perform private.assert_service_role();
  if (p_user_id is null) = (p_guest_session_hash is null) then
    raise exception 'invalid_owner' using errcode = '22023';
  end if;

  select * into a from public.attempts where id = p_attempt_id
    and ((p_user_id is not null and user_id = p_user_id)
      or (p_guest_session_hash is not null and guest_session_hash = p_guest_session_hash))
  for update;
  if not found then raise exception 'attempt_not_found' using errcode = 'P0002'; end if;
  if a.status <> 'in_progress' or a.submission_request_id is not null
     or (a.deadline_at is not null and a.deadline_at <= clock_timestamp()) then
    raise exception 'attempt_closed' using errcode = '55000';
  end if;
  if not exists (
    select 1 from public.attempt_questions
    where attempt_id = p_attempt_id and problem_id = p_problem_id
  ) then
    raise exception 'question_not_in_attempt' using errcode = '22023';
  end if;

  if a.user_id is null and p_selected_answer is not null then
    perform pg_advisory_xact_lock(hashtextextended(a.guest_session_hash, 0));
    if not exists (
      select 1 from private.guest_question_usage
      where guest_session_hash = a.guest_session_hash and problem_id = p_problem_id
    ) then
      select count(*)::integer into used_count
      from private.guest_question_usage
      where guest_session_hash = a.guest_session_hash;
      if used_count >= 10 then
        raise exception 'guest_question_limit_reached' using errcode = 'P0001';
      end if;
      insert into private.guest_question_usage (guest_session_hash, problem_id)
      values (a.guest_session_hash, p_problem_id)
      on conflict do nothing;
    end if;
  end if;

  insert into public.attempt_answers (attempt_id, problem_id, selected_answer, marked_for_review, answered_at, revision)
  values (p_attempt_id, p_problem_id, p_selected_answer, p_marked_for_review,
    case when p_selected_answer is null then null else clock_timestamp() end, 1)
  on conflict (attempt_id, problem_id) do update set
    selected_answer = excluded.selected_answer,
    marked_for_review = excluded.marked_for_review,
    answered_at = case when excluded.selected_answer is null then null else clock_timestamp() end,
    updated_at = clock_timestamp(), revision = public.attempt_answers.revision + 1;
  update public.attempts set last_activity_at = clock_timestamp() where id = p_attempt_id;
  return true;
end;
$$;

revoke all on function public.get_guest_question_usage(text) from public, anon, authenticated;
grant execute on function public.get_guest_question_usage(text) to service_role;
revoke all on function public.save_exam_attempt_state(uuid, uuid, text, uuid, jsonb, boolean)
  from public, anon, authenticated;
grant execute on function public.save_exam_attempt_state(uuid, uuid, text, uuid, jsonb, boolean)
  to service_role;
