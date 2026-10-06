begin;

create or replace function public.get_student_attempt_result(p_user_id uuid, p_attempt_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare payload jsonb;
begin
  perform private.assert_service_role();
  if p_user_id is null or p_attempt_id is null then
    raise exception 'attempt_not_found' using errcode = 'P0002';
  end if;

  select jsonb_build_object(
    'attemptId', a.id,
    'examSlug', s.slug,
    'examTitle', coalesce(s.title, 'Bộ đề đã lưu'),
    'submittedAt', a.submitted_at,
    'status', a.status::text,
    'result', jsonb_set(
      r.result_payload,
      '{questionOutcomes}',
      coalesce((
        select jsonb_agg(
          case when outcome ->> 'state' in ('incorrect', 'partially_correct', 'unanswered') then
            outcome || jsonb_build_object('review', jsonb_build_object(
              'questionType', p.question_type::text,
              'statement', p.display_stem_vi,
              'options', coalesce((
                select jsonb_agg(jsonb_build_object('key', o.option_key, 'text', o.display_text_vi) order by o.order_index)
                from public.problem_options o where o.problem_id = p.id
              ), '[]'::jsonb),
              'substatements', coalesce((
                select jsonb_agg(jsonb_build_object('key', st.statement_key, 'text', st.display_text_vi) order by st.order_index)
                from public.problem_substatements st where st.problem_id = p.id
              ), '[]'::jsonb),
              'selectedAnswer', ans.selected_answer,
              'correctAnswer', case when ak.verification_status = 'verified' then ak.correct_answer else null end,
              'explanation', coalesce(ex.display_explanation_vi, ex.explanation)
            ))
          else outcome || jsonb_build_object('review', null)
          end order by ordinality
        ), '[]'::jsonb)
        from jsonb_array_elements(coalesce(r.result_payload -> 'questionOutcomes', '[]'::jsonb)) with ordinality as q(outcome, ordinality)
        left join public.problems p on p.id::text = (q.outcome ->> 'questionId')
        left join public.attempt_answers ans on ans.attempt_id = a.id and ans.problem_id = p.id
        left join private.problem_answer_keys ak on ak.problem_id = p.id
        left join private.problem_explanations ex on ex.problem_id = p.id
      ), true)
    )
  ) into payload
  from public.attempts a
  join private.exam_attempt_results r on r.attempt_id = a.id
  left join public.problem_sets s on s.id = a.problem_set_id
  where a.id = p_attempt_id and a.user_id = p_user_id
    and a.status in ('submitted', 'auto_submitted');
  return payload;
end;
$$;

revoke all on function public.get_student_attempt_result(uuid, uuid) from public, anon, authenticated;
grant execute on function public.get_student_attempt_result(uuid, uuid) to service_role;

commit;
