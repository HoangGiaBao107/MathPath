-- Phase 5: Supabase Auth profiles and durable, owner-scoped exam attempts.
-- Apply to a disposable local Supabase project first. Never expose service-role credentials.
begin;

alter table public.attempts drop constraint if exists attempts_user_id_fkey;
alter table public.attempts add constraint attempts_user_id_fkey
  foreign key (user_id) references public.profiles(id) on delete cascade;

alter table public.attempts
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists submission_lock_at timestamptz,
  add constraint attempts_guest_hash_format check (
    guest_session_hash is null or guest_session_hash ~ '^[0-9a-f]{64}$'
  );

with ranked_active_attempts as (
  select id, row_number() over (
    partition by user_id, guest_session_hash, problem_set_id
    order by started_at desc, id desc
  ) as position
  from public.attempts
  where status = 'in_progress'
)
update public.attempts a set status = 'abandoned', updated_at = now()
from ranked_active_attempts r
where a.id = r.id and r.position > 1;

create unique index if not exists attempts_one_active_user_exam
  on public.attempts (user_id, problem_set_id)
  where user_id is not null and status = 'in_progress';
create unique index if not exists attempts_one_active_guest_exam
  on public.attempts (guest_session_hash, problem_set_id)
  where guest_session_hash is not null and status = 'in_progress';

-- RLS is retained. Browser clients can read only their own profile/attempt rows;
-- all mutations and guest-session access go through server-only service functions.
drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));
revoke update on public.profiles from public, anon, authenticated;
grant update (display_name, language, target_score) on public.profiles to authenticated;

create or replace function private.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_touch_updated_at before update on public.profiles
  for each row execute function private.touch_updated_at();
create trigger attempts_touch_updated_at before update on public.attempts
  for each row execute function private.touch_updated_at();

create or replace function private.create_profile_for_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, language, target_score)
  values (
    new.id,
    nullif(btrim(coalesce(new.raw_user_meta_data ->> 'display_name', '')), ''),
    case when new.raw_user_meta_data ->> 'language' = 'en' then 'en' else 'vi' end,
    case when coalesce(new.raw_user_meta_data ->> 'target_score', '') ~ '^([0-9]([.][0-9])?|10([.]0)?)$'
      then (new.raw_user_meta_data ->> 'target_score')::numeric else null end
  )
  on conflict (id) do update set
    display_name = coalesce(public.profiles.display_name, excluded.display_name),
    updated_at = now();
  return new;
end;
$$;
revoke all on function private.create_profile_for_auth_user() from public, anon, authenticated;
drop trigger if exists on_auth_user_created_mathpath on auth.users;
create trigger on_auth_user_created_mathpath after insert on auth.users
  for each row execute function private.create_profile_for_auth_user();

create or replace function private.assert_service_role()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service_role_required' using errcode = '42501';
  end if;
end;
$$;
revoke all on function private.assert_service_role() from public, anon, authenticated;

create or replace function public.get_exam_runtime(p_slug text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  set_row public.problem_sets%rowtype;
  exam_json jsonb;
begin
  perform private.assert_service_role();
  select * into set_row from public.problem_sets
  where slug = p_slug and review_status = 'approved' and publication_status = 'published'
    and rights_status = 'approved_for_publication';
  if not found then return null; end if;

  select jsonb_build_object(
    'id', set_row.slug,
    'title', set_row.title,
    'description', coalesce(set_row.description, ''),
    'mode', set_row.scoring_config ->> 'examMode',
    'demo', true,
    'timingMode', set_row.timing_mode::text,
    'durationSeconds', set_row.time_limit_seconds,
    'totalScore', (set_row.scoring_config ->> 'totalScore')::numeric,
    'sections', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', s.id::text,
        'title', s.title,
        'description', coalesce(cfg ->> 'description', ''),
        'maxScore', (cfg ->> 'maxScore')::numeric
      ) order by s.order_index)
      from public.problem_set_sections s
      left join lateral jsonb_array_elements(set_row.scoring_config -> 'sections') cfg
        on cfg ->> 'key' = s.section_key
      where s.problem_set_id = set_row.id
    ), '[]'::jsonb),
    'questions', coalesce((
      select jsonb_agg(
        case p.question_type
          when 'multiple_choice' then jsonb_build_object(
            'id', p.id::text, 'sectionId', p.section_id::text, 'number', p.question_number,
            'type', p.question_type::text, 'stem', p.stem,
            'options', coalesce((select jsonb_agg(jsonb_build_object('key', o.option_key, 'text', o.option_text) order by o.order_index)
              from public.problem_options o where o.problem_id = p.id), '[]'::jsonb),
            'points', (qcfg ->> 'points')::numeric,
            'correctOptionKey', ak.correct_answer ->> 'option_key'
          )
          when 'true_false' then jsonb_build_object(
            'id', p.id::text, 'sectionId', p.section_id::text, 'number', p.question_number,
            'type', p.question_type::text, 'stem', p.stem,
            'statements', coalesce((select jsonb_agg(jsonb_build_object('key', s.statement_key, 'text', s.statement_text) order by s.order_index)
              from public.problem_substatements s where s.problem_id = p.id), '[]'::jsonb),
            'points', (qcfg ->> 'points')::numeric,
            'correctStatements', ak.correct_answer -> 'statements',
            'scoring', ak.correct_answer -> 'scoring'
          )
          else jsonb_build_object(
            'id', p.id::text, 'sectionId', p.section_id::text, 'number', p.question_number,
            'type', p.question_type::text, 'stem', p.stem,
            'points', (qcfg ->> 'points')::numeric,
            'canonicalAnswer', ak.correct_answer ->> 'canonical_answer',
            'acceptedNormalizedAnswers', ak.correct_answer -> 'accepted_values'
          )
        end order by p.order_index)
      from public.problems p
      left join lateral jsonb_array_elements(set_row.scoring_config -> 'questionScoring') qcfg
        on (qcfg ->> 'orderIndex')::integer = p.order_index
      left join private.problem_answer_keys ak on ak.problem_id = p.id
      where p.problem_set_id = set_row.id and p.review_status = 'approved'
        and p.publication_status = 'published'
        and ak.verification_status = 'verified'
    ), '[]'::jsonb)
  ) into exam_json;
  if jsonb_array_length(exam_json -> 'questions') = 0 then return null; end if;
  return exam_json;
end;
$$;

create or replace function public.find_current_exam_attempt(
  p_user_id uuid, p_guest_session_hash text, p_slug text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare result_id uuid;
begin
  perform private.assert_service_role();
  if (p_user_id is null) = (p_guest_session_hash is null) then
    raise exception 'invalid_owner' using errcode = '22023';
  end if;
  select a.id into result_id
  from public.attempts a join public.problem_sets s on s.id = a.problem_set_id
  where s.slug = p_slug and a.status = 'in_progress'
    and ((p_user_id is not null and a.user_id = p_user_id)
      or (p_guest_session_hash is not null and a.guest_session_hash = p_guest_session_hash))
  order by a.started_at desc limit 1;
  return result_id;
end;
$$;

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
  attempt_status public.exam_attempt_status;
  item jsonb;
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
      runtime ->> 'timingMode', (runtime ->> 'durationSeconds')::integer,
      deadline_value, p_idempotency_key,
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
    values (
      attempt_id, (item ->> 'id')::uuid, (item ->> 'sectionId')::uuid,
      (item ->> 'number')::integer - 1, (item ->> 'points')::numeric,
      coalesce(item -> 'scoring', '{"kind":"exact"}'::jsonb)
    );
    insert into public.attempt_answers (attempt_id, problem_id)
    values (attempt_id, (item ->> 'id')::uuid);
  end loop;
  return attempt_id;
end;
$$;

create or replace function public.get_exam_attempt(
  p_attempt_id uuid, p_user_id uuid, p_guest_session_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare a public.attempts%rowtype; exam_json jsonb; answers_json jsonb; result_json jsonb;
begin
  perform private.assert_service_role();
  if (p_user_id is null) = (p_guest_session_hash is null) then
    raise exception 'invalid_owner' using errcode = '22023';
  end if;
  select * into a from public.attempts where id = p_attempt_id
    and ((p_user_id is not null and user_id = p_user_id)
      or (p_guest_session_hash is not null and guest_session_hash = p_guest_session_hash));
  if not found then return null; end if;
  select public.get_exam_runtime(s.slug) into exam_json
    from public.problem_sets s where s.id = a.problem_set_id;
  if not found then return null; end if;
  select coalesce(jsonb_object_agg(problem_id::text, jsonb_build_object(
    'answer', selected_answer, 'markedForReview', marked_for_review, 'updatedAt', updated_at
  )), '{}'::jsonb) into answers_json
  from public.attempt_answers where attempt_id = p_attempt_id;
  select result_payload into result_json from private.exam_attempt_results where attempt_id = p_attempt_id;
  return jsonb_build_object(
    'attempt', jsonb_build_object(
      'id', a.id, 'examId', exam_json ->> 'id', 'status', a.status::text,
      'questionIdsInOrder', to_jsonb(a.selected_problem_ids), 'answers', answers_json,
      'startedAt', a.started_at, 'deadlineAt', a.deadline_at,
      'submittedAt', a.submitted_at, 'durationSeconds', a.duration_seconds,
      'submitRequestId', a.submission_request_id, 'result', result_json
    ),
    'exam', exam_json
  );
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
declare a public.attempts%rowtype;
begin
  perform private.assert_service_role();
  select * into a from public.attempts where id = p_attempt_id
    and ((p_user_id is not null and user_id = p_user_id)
      or (p_guest_session_hash is not null and guest_session_hash = p_guest_session_hash))
  for update;
  if not found then raise exception 'attempt_not_found' using errcode = 'P0002'; end if;
  if a.status <> 'in_progress' or a.submission_request_id is not null
     or (a.deadline_at is not null and a.deadline_at <= clock_timestamp()) then
    raise exception 'attempt_closed' using errcode = '55000';
  end if;
  if not exists (select 1 from public.attempt_questions where attempt_id = p_attempt_id and problem_id = p_problem_id) then
    raise exception 'question_not_in_attempt' using errcode = '22023';
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

create or replace function public.claim_exam_attempt_submission(
  p_attempt_id uuid, p_user_id uuid, p_guest_session_hash text,
  p_request_id uuid, p_reason text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare a public.attempts%rowtype; effective_reason text;
begin
  perform private.assert_service_role();
  select * into a from public.attempts where id = p_attempt_id
    and ((p_user_id is not null and user_id = p_user_id)
      or (p_guest_session_hash is not null and guest_session_hash = p_guest_session_hash))
  for update;
  if not found then raise exception 'attempt_not_found' using errcode = 'P0002'; end if;
  if a.status in ('submitted', 'auto_submitted', 'expired') then return true; end if;
  if a.status <> 'in_progress' or p_reason not in ('manual', 'auto') then
    raise exception 'attempt_closed' using errcode = '55000';
  end if;
  if a.submission_request_id is not null and a.submission_request_id <> p_request_id
     and a.submission_lock_at > clock_timestamp() - interval '2 minutes' then
    raise exception 'submission_in_progress' using errcode = '55P03';
  end if;
  effective_reason := case
    when a.deadline_at is not null and a.deadline_at <= clock_timestamp() then 'auto'
    else 'manual'
  end;
  update public.attempts set
    submission_request_id = p_request_id,
    submission_reason = effective_reason,
    submission_lock_at = clock_timestamp(),
    last_activity_at = clock_timestamp()
  where id = p_attempt_id;
  return true;
end;
$$;

create or replace function public.submit_exam_attempt(
  p_attempt_id uuid, p_user_id uuid, p_guest_session_hash text,
  p_request_id uuid, p_reason text, p_result_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare a public.attempts%rowtype; effective_reason text;
begin
  perform private.assert_service_role();
  select * into a from public.attempts where id = p_attempt_id
    and ((p_user_id is not null and user_id = p_user_id)
      or (p_guest_session_hash is not null and guest_session_hash = p_guest_session_hash))
  for update;
  if not found then raise exception 'attempt_not_found' using errcode = 'P0002'; end if;
  if a.status in ('submitted', 'auto_submitted', 'expired') then
    return (select result_payload from private.exam_attempt_results where attempt_id = p_attempt_id);
  end if;
  if a.status <> 'in_progress' then raise exception 'attempt_closed' using errcode = '55000'; end if;
  if a.submission_request_id is distinct from p_request_id or a.submission_lock_at is null then
    raise exception 'submission_in_progress' using errcode = '55P03';
  end if;
  if jsonb_typeof(p_result_payload) <> 'object' or p_reason not in ('manual', 'auto') then
    raise exception 'invalid_submission' using errcode = '22023';
  end if;
  effective_reason := case
    when a.deadline_at is not null and a.deadline_at <= clock_timestamp() then 'auto'
    else coalesce(a.submission_reason, 'manual')
  end;
  insert into private.exam_attempt_results (attempt_id, result_payload)
    values (p_attempt_id, p_result_payload)
    on conflict (attempt_id) do nothing;
  update public.attempts set
    status = case when effective_reason = 'auto' then 'auto_submitted'::public.exam_attempt_status else 'submitted'::public.exam_attempt_status end,
    submission_request_id = p_request_id,
    submission_reason = effective_reason,
    submission_lock_at = null,
    submitted_at = clock_timestamp(),
    duration_seconds = greatest(0, floor(extract(epoch from (clock_timestamp() - started_at)))::integer),
    score = (p_result_payload ->> 'score')::numeric,
    correct_count = (p_result_payload ->> 'correctCount')::integer,
    wrong_count = (p_result_payload ->> 'incorrectCount')::integer,
    blank_count = (p_result_payload ->> 'unansweredCount')::integer,
    last_activity_at = clock_timestamp()
  where id = p_attempt_id;
  return p_result_payload;
end;
$$;

create or replace function public.claim_guest_attempts(p_guest_session_hash text, p_user_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare changed_count integer;
begin
  perform private.assert_service_role();
  if p_guest_session_hash !~ '^[0-9a-f]{64}$' or not exists (select 1 from public.profiles where id = p_user_id) then
    raise exception 'invalid_guest_claim' using errcode = '22023';
  end if;
  update public.attempts a set
    user_id = p_user_id,
    guest_session_hash = null,
    status = case when a.status = 'in_progress' and exists (
      select 1 from public.attempts existing
      where existing.user_id = p_user_id and existing.problem_set_id = a.problem_set_id
        and existing.status = 'in_progress'
    ) then 'abandoned'::public.exam_attempt_status else a.status end
  where a.guest_session_hash = p_guest_session_hash;
  get diagnostics changed_count = row_count;
  return changed_count;
end;
$$;

-- Seed is sent through this function by `npm run supabase:seed:demo`.
create or replace function public.seed_demo_exams(p_exams jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  exam_item jsonb; section_item jsonb; question_item jsonb;
  set_id uuid; source_id uuid; v_section_id uuid; v_problem_id uuid;
  inserted_count integer := 0; question_order integer;
  question_config jsonb; section_config jsonb;
begin
  perform private.assert_service_role();
  if jsonb_typeof(p_exams) <> 'array' then raise exception 'invalid_seed_data' using errcode = '22023'; end if;
  for exam_item in select value from jsonb_array_elements(p_exams) loop
    if exam_item ->> 'demo' <> 'true' then raise exception 'only_demo_exams_may_be_seeded' using errcode = '22023'; end if;
    update public.problem_sets set publication_status = 'unpublished'
      where slug = exam_item ->> 'id';
    update public.problems set publication_status = 'unpublished'
      where problem_set_id = (select id from public.problem_sets where slug = exam_item ->> 'id');
    insert into public.problem_source_documents (
      document_name, source_type, source_year, provenance_status,
      publication_rights_status, provenance_note, source_fingerprint
    ) values (
      'MathPath generated demo fixture · ' || (exam_item ->> 'id'), 'generated', null,
      'verified', 'approved_for_publication', 'Synthetic development content, not sourced from exam papers.',
      'mathpath-generated-demo:' || (exam_item ->> 'id')
    ) on conflict (source_fingerprint) do update set
      document_name = excluded.document_name, provenance_status = excluded.provenance_status,
      publication_rights_status = excluded.publication_rights_status,
      provenance_note = excluded.provenance_note
    returning id into source_id;
    insert into public.problem_sets (
      slug, title, description, language, source_type, source_year, difficulty, topic,
      category, exam_metadata, scoring_config, timing_mode, time_limit_seconds,
      estimated_duration_seconds, review_status, publication_status, rights_status, source_document_id
    ) values (
      exam_item ->> 'id', exam_item ->> 'title', exam_item ->> 'description', 'vi', 'generated', null,
      'mixed', 'THPT Mathematics',
      case when exam_item ->> 'mode' = 'official_thptqg' then 'mock_exam'::public.problem_set_category
           when exam_item ->> 'mode' = 'practice' then 'comprehensive'::public.problem_set_category
           else 'mock_exam'::public.problem_set_category end,
      jsonb_build_object('demo', true, 'label', 'DEMO / MOCK — NOT OFFICIAL'),
      jsonb_build_object('demo', true, 'examMode', exam_item ->> 'mode', 'totalScore', exam_item -> 'totalScore',
        'sections', (select jsonb_agg(jsonb_build_object('key', s ->> 'id', 'description', s ->> 'description', 'maxScore', s -> 'maxScore')) from jsonb_array_elements(exam_item -> 'sections') s),
        'questionScoring', (select jsonb_agg(jsonb_build_object('orderIndex', (q ->> 'orderIndex')::integer, 'points', q -> 'points', 'scoring', q -> 'scoring')) from jsonb_array_elements(exam_item -> 'questions') q)),
      exam_item ->> 'timingMode', nullif(exam_item ->> 'durationSeconds', '')::integer,
      null,
      'approved', 'unpublished', 'approved_for_publication', source_id
    ) on conflict (slug) do update set
      title = excluded.title, description = excluded.description, category = excluded.category,
      scoring_config = excluded.scoring_config, timing_mode = excluded.timing_mode,
      time_limit_seconds = excluded.time_limit_seconds,
      estimated_duration_seconds = excluded.estimated_duration_seconds,
      review_status = excluded.review_status, publication_status = excluded.publication_status,
      rights_status = excluded.rights_status, source_document_id = excluded.source_document_id, updated_at = now();
    select id into set_id from public.problem_sets where slug = exam_item ->> 'id';

    for section_item in select value from jsonb_array_elements(exam_item -> 'sections') loop
      insert into public.problem_set_sections (problem_set_id, section_key, title, order_index)
      values (set_id, section_item ->> 'id', section_item ->> 'title', (section_item ->> 'orderIndex')::integer)
      on conflict (problem_set_id, section_key) do update set title = excluded.title, order_index = excluded.order_index
      returning id into v_section_id;
    end loop;

    for question_item in select value from jsonb_array_elements(exam_item -> 'questions') loop
      question_order := (question_item ->> 'orderIndex')::integer;
      select id into v_section_id from public.problem_set_sections
        where problem_set_id = set_id and section_key = question_item ->> 'sectionId';
      insert into public.problems (
        problem_set_id, order_index, stem, topic, difficulty, question_type, question_number, section_id,
        provenance_status, review_status, publication_status, rights_status, source_document_id, source_question_number
      ) values (
        set_id, question_order, question_item ->> 'stem', 'THPT Mathematics', 'medium',
        (question_item ->> 'type')::public.problem_question_type, question_item ->> 'number', v_section_id,
        'verified', 'approved', 'unpublished', 'approved_for_publication', source_id, question_item ->> 'number'
      ) on conflict (problem_set_id, order_index) do update set
        stem = excluded.stem, question_type = excluded.question_type,
        question_number = excluded.question_number, section_id = excluded.section_id,
        source_document_id = excluded.source_document_id, source_question_number = excluded.source_question_number,
        provenance_status = 'verified', review_status = 'approved', publication_status = 'unpublished',
        rights_status = 'approved_for_publication', updated_at = now()
      returning id into v_problem_id;

      delete from public.problem_options opt where opt.problem_id = v_problem_id;
      delete from public.problem_substatements sub where sub.problem_id = v_problem_id;
      if question_item ->> 'type' = 'multiple_choice' then
        insert into public.problem_options (problem_id, option_key, option_text, order_index)
        select v_problem_id, option_item ->> 'key', option_item ->> 'text', (option_item ->> 'orderIndex')::integer
        from jsonb_array_elements(question_item -> 'options') option_item;
      elsif question_item ->> 'type' = 'true_false' then
        insert into public.problem_substatements (problem_id, statement_key, statement_text, order_index)
        select v_problem_id, statement_item ->> 'key', statement_item ->> 'text', (statement_item ->> 'orderIndex')::integer
        from jsonb_array_elements(question_item -> 'statements') statement_item;
      end if;

      if question_item ->> 'type' = 'multiple_choice' then
        question_config := jsonb_build_object('option_key', question_item #>> '{answer,optionKey}');
      elsif question_item ->> 'type' = 'true_false' then
        question_config := jsonb_build_object('statements', question_item #> '{answer,statements}', 'scoring', question_item #> '{answer,scoring}');
      else
        question_config := jsonb_build_object('canonical_answer', question_item #>> '{answer,canonicalAnswer}', 'accepted_values', question_item #> '{answer,acceptedValues}');
      end if;
      insert into private.problem_answer_keys (problem_id, correct_answer, verification_status, provenance_note)
      values (v_problem_id, question_config, 'verified', 'Synthetic development fixture. Not an official exam.')
      on conflict (problem_id) do update set correct_answer = excluded.correct_answer,
        verification_status = 'verified', provenance_note = excluded.provenance_note, updated_at = now();
      update public.problems set publication_status = 'published', updated_at = now()
        where id = v_problem_id;
      inserted_count := inserted_count + 1;
    end loop;
    update public.problem_sets set publication_status = 'published', updated_at = now()
      where id = set_id;
  end loop;
  return inserted_count;
end;
$$;

revoke all on function public.get_exam_runtime(text) from public, anon, authenticated;
revoke all on function public.find_current_exam_attempt(uuid, text, text) from public, anon, authenticated;
revoke all on function public.start_exam_attempt(uuid, text, text, uuid) from public, anon, authenticated;
revoke all on function public.get_exam_attempt(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.save_exam_attempt_state(uuid, uuid, text, uuid, jsonb, boolean) from public, anon, authenticated;
revoke all on function public.submit_exam_attempt(uuid, uuid, text, uuid, text, jsonb) from public, anon, authenticated;
revoke all on function public.claim_exam_attempt_submission(uuid, uuid, text, uuid, text) from public, anon, authenticated;
revoke all on function public.claim_guest_attempts(text, uuid) from public, anon, authenticated;
revoke all on function public.seed_demo_exams(jsonb) from public, anon, authenticated;
grant execute on function public.get_exam_runtime(text) to service_role;
grant execute on function public.find_current_exam_attempt(uuid, text, text) to service_role;
grant execute on function public.start_exam_attempt(uuid, text, text, uuid) to service_role;
grant execute on function public.get_exam_attempt(uuid, uuid, text) to service_role;
grant execute on function public.save_exam_attempt_state(uuid, uuid, text, uuid, jsonb, boolean) to service_role;
grant execute on function public.submit_exam_attempt(uuid, uuid, text, uuid, text, jsonb) to service_role;
grant execute on function public.claim_exam_attempt_submission(uuid, uuid, text, uuid, text) to service_role;
grant execute on function public.claim_guest_attempts(text, uuid) to service_role;
grant execute on function public.seed_demo_exams(jsonb) to service_role;

commit;
