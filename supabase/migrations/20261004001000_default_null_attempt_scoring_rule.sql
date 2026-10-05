create or replace function public.start_exam_attempt(
  p_user_id uuid, p_guest_session_hash text, p_slug text, p_idempotency_key uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  set_id uuid;
  runtime jsonb;
  attempt_id uuid;
  item jsonb;
  question_order integer := 0;
  started_at_value timestamptz := clock_timestamp();
  deadline_value timestamptz;
begin
  perform private.assert_service_role();
  if (p_user_id is null) = (p_guest_session_hash is null) then
    raise exception 'invalid_owner' using errcode = '22023';
  end if;
  runtime := public.get_exam_runtime(p_slug);
  if runtime is null then raise exception 'exam_not_found' using errcode = 'P0002'; end if;
  select id into set_id from public.problem_sets where slug = p_slug;
  select id into attempt_id from public.attempts where idempotency_key = p_idempotency_key
    and ((p_user_id is not null and user_id = p_user_id)
      or (p_guest_session_hash is not null and guest_session_hash = p_guest_session_hash));
  if attempt_id is not null then return attempt_id; end if;
  attempt_id := public.find_current_exam_attempt(p_user_id, p_guest_session_hash, p_slug);
  if attempt_id is not null then return attempt_id; end if;

  if p_user_id is not null and not exists (select 1 from public.profiles where id = p_user_id) then
    raise exception 'profile_not_found' using errcode = '23503';
  end if;
  if runtime ->> 'timingMode' = 'countdown' then
    deadline_value := started_at_value + ((runtime ->> 'durationSeconds')::integer * interval '1 second');
  end if;

  begin
    insert into public.attempts (
      user_id, guest_session_hash, problem_set_id, status, exam_mode, timing_mode,
      time_limit_seconds, deadline_at, idempotency_key, exam_configuration_snapshot,
      selected_problem_ids, started_at, last_activity_at, updated_at
    ) values (
      p_user_id, p_guest_session_hash, set_id, 'in_progress', runtime ->> 'mode',
      (runtime ->> 'timingMode')::public.problem_set_timing_mode,
      (runtime ->> 'durationSeconds')::integer, deadline_value, p_idempotency_key,
      runtime - 'questions',
      array(select (entry.question ->> 'id')::uuid
        from jsonb_array_elements(runtime -> 'questions') with ordinality as entry(question, ordinality)
        order by entry.ordinality),
      started_at_value, started_at_value, started_at_value
    ) returning id into attempt_id;
  exception when unique_violation then
    attempt_id := public.find_current_exam_attempt(p_user_id, p_guest_session_hash, p_slug);
    if attempt_id is null then
      select id into attempt_id from public.attempts where idempotency_key = p_idempotency_key
        and ((p_user_id is not null and user_id = p_user_id)
          or (p_guest_session_hash is not null and guest_session_hash = p_guest_session_hash));
    end if;
    if attempt_id is null then raise; end if;
    return attempt_id;
  end;

  for item in select value from jsonb_array_elements(runtime -> 'questions') loop
    insert into public.attempt_questions (attempt_id, problem_id, section_id, order_index, points, scoring_rule)
    values (attempt_id, (item ->> 'id')::uuid, (item ->> 'sectionId')::uuid,
      question_order, (item ->> 'points')::numeric,
      coalesce(nullif(item -> 'scoring', 'null'::jsonb), '{"kind":"exact"}'::jsonb));
    insert into public.attempt_answers (attempt_id, problem_id)
    values (attempt_id, (item ->> 'id')::uuid);
    question_order := question_order + 1;
  end loop;
  return attempt_id;
end;
$$;

