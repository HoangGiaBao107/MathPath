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
      select jsonb_agg(case p.question_type
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
          'acceptedNormalizedAnswers', ak.correct_answer -> 'accepted_values'
        ) end order by p.order_index)
      from public.problems p
      left join lateral jsonb_array_elements(set_row.scoring_config -> 'questionScoring') qcfg
        on (qcfg ->> 'orderIndex')::integer = p.order_index
      left join private.problem_answer_keys ak on ak.problem_id = p.id
      where p.problem_set_id = set_row.id and p.review_status = 'approved'
        and p.publication_status = 'published' and p.content_review_status = 'approved'
        and ak.verification_status = 'verified'
    ), '[]'::jsonb)
  ) into exam_json;
  if jsonb_array_length(exam_json -> 'questions') = 0 then return null; end if;
  return exam_json;
end;
$$;

