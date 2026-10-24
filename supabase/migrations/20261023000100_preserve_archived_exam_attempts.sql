begin;
-- Archived content remains accessible only after the existing attempt owner check.
create or replace function private.get_exam_runtime_internal(p_slug text, p_allow_archived boolean)
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
  where slug = p_slug and review_status = 'approved' and (publication_status = 'published' or (p_allow_archived and publication_status = 'archived'))
    and rights_status = 'approved_for_publication';
  if not found then return null; end if;

  select jsonb_build_object(
    'id', set_row.slug,
    'title', set_row.title,
    'description', coalesce(set_row.description, ''),
    'mode', set_row.scoring_config ->> 'examMode',
    'demo', coalesce(set_row.exam_metadata ->> 'demo' = 'true', false),
    'timingMode', set_row.timing_mode::text,
    'durationSeconds', set_row.time_limit_seconds,
    'totalScore', (set_row.scoring_config ->> 'totalScore')::numeric,
    'sections', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', s.id::text, 'title', s.title,
        'description', coalesce(cfg ->> 'description', ''),
        'maxScore', (cfg ->> 'maxScore')::numeric
      ) order by s.order_index)
      from public.problem_set_sections s
      left join lateral jsonb_array_elements(set_row.scoring_config -> 'sections') cfg
        on cfg ->> 'key' = s.section_key
      where s.problem_set_id = set_row.id
    ), '[]'::jsonb),
    'questions', coalesce((
      select jsonb_agg((case p.question_type
        when 'multiple_choice' then jsonb_build_object(
          'id', p.id::text, 'sectionId', p.section_id::text, 'number', p.question_number,
          'type', p.question_type::text, 'stem', p.display_stem_vi,
          'displayStemVi', p.display_stem_vi,
          'displayStemEn', case when p.translation_status = 'approved' then p.display_stem_en else null end,
          'topic', p.topic, 'subtopic', p.subtopic,
          'options', coalesce((select jsonb_agg(jsonb_build_object(
            'key', o.option_key, 'text', o.display_text_vi,
            'displayTextEn', case when p.translation_status = 'approved' then o.display_text_en else null end)
            order by o.order_index) from public.problem_options o where o.problem_id = p.id), '[]'::jsonb),
          'points', (qcfg ->> 'points')::numeric,
          'correctOptionKey', ak.correct_answer ->> 'option_key'
        )
        when 'true_false' then jsonb_build_object(
          'id', p.id::text, 'sectionId', p.section_id::text, 'number', p.question_number,
          'type', p.question_type::text, 'stem', p.display_stem_vi,
          'displayStemVi', p.display_stem_vi,
          'displayStemEn', case when p.translation_status = 'approved' then p.display_stem_en else null end,
          'topic', p.topic, 'subtopic', p.subtopic,
          'statements', coalesce((select jsonb_agg(jsonb_build_object(
            'key', s.statement_key, 'text', s.display_text_vi,
            'displayTextEn', case when p.translation_status = 'approved' then s.display_text_en else null end)
            order by s.order_index) from public.problem_substatements s where s.problem_id = p.id), '[]'::jsonb),
          'points', (qcfg ->> 'points')::numeric,
          'correctStatements', ak.correct_answer -> 'statements',
          'scoring', coalesce(nullif(ak.correct_answer -> 'scoring', 'null'::jsonb), nullif(qcfg -> 'scoring', 'null'::jsonb), '{"kind":"all_or_nothing"}'::jsonb)
        )
        else jsonb_build_object(
          'id', p.id::text, 'sectionId', p.section_id::text, 'number', p.question_number,
          'type', p.question_type::text, 'stem', p.display_stem_vi,
          'displayStemVi', p.display_stem_vi,
          'displayStemEn', case when p.translation_status = 'approved' then p.display_stem_en else null end,
          'topic', p.topic, 'subtopic', p.subtopic,
          'points', (qcfg ->> 'points')::numeric,
          'canonicalAnswer', ak.correct_answer ->> 'canonical_answer',
          'acceptedNormalizedAnswers', ak.correct_answer -> 'accepted_values',
          'inputPolicy', case when set_row.scoring_config ->> 'examMode' = 'official_thptqg'
            then '{"kind":"thptqg_numeric"}'::jsonb
            else coalesce(ak.correct_answer -> 'input_policy', '{"kind":"thptqg_numeric"}'::jsonb) end
        ) end) || jsonb_build_object('figures', coalesce((select jsonb_agg(jsonb_build_object('url', asset.asset_path, 'alt', asset.alt_text_vi) order by asset.order_index) from public.problem_assets asset where asset.problem_id=p.id and asset.review_status='approved'), '[]'::jsonb)) order by p.order_index)
      from public.problems p
      left join lateral jsonb_array_elements(set_row.scoring_config -> 'questionScoring') qcfg
        on (qcfg ->> 'orderIndex')::integer = p.order_index
      left join private.problem_answer_keys ak on ak.problem_id = p.id
      where p.problem_set_id = set_row.id and p.review_status = 'approved'
        and (p.publication_status = 'published' or (p_allow_archived and p.publication_status = 'archived')) and p.content_review_status = 'approved'
        and ak.verification_status = 'verified'
    ), '[]'::jsonb)
  ) into exam_json;
  if jsonb_array_length(exam_json -> 'questions') = 0 then return null; end if;
  return exam_json;
end;
$$;

revoke all on function private.get_exam_runtime_internal(text, boolean) from public, anon, authenticated;
create or replace function public.get_exam_runtime(p_slug text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select private.get_exam_runtime_internal(p_slug, false);
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
  select private.get_exam_runtime_internal(s.slug, true) into exam_json
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


commit;
