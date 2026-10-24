begin;

create table public.problem_assets (
  id uuid primary key default gen_random_uuid(),
  problem_id uuid not null references public.problems (id) on delete cascade,
  asset_path text not null check (
    asset_path ~ '^/problem-assets/[A-Za-z0-9._/-]+$'
    and asset_path !~ '(^|/)\.\.(/|$)'
  ),
  alt_text_vi text not null check (nullif(btrim(alt_text_vi), '') is not null),
  placement text not null default 'stem' check (placement in ('stem')),
  order_index integer not null default 0 check (order_index >= 0),
  review_status public.problem_review_status not null default 'needs_review',
  created_at timestamptz not null default now(),
  unique (problem_id, order_index),
  unique (problem_id, asset_path)
);

alter table public.problem_assets enable row level security;
revoke all on table public.problem_assets from public, anon, authenticated;

create or replace function private.require_approved_problem_assets_before_publish()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.publication_status = 'published' and exists (
    select 1
    from public.problem_assets asset
    where asset.problem_id = new.id
      and asset.review_status <> 'approved'
  ) then
    raise exception 'Every problem image asset must be reviewed before publication';
  end if;
  return new;
end;
$$;
revoke all on function private.require_approved_problem_assets_before_publish() from public, anon, authenticated;
create trigger problem_assets_review_gate
before insert or update on public.problems
for each row execute function private.require_approved_problem_assets_before_publish();

create or replace function private.require_reviewed_asset_for_published_problem()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.review_status <> 'approved' and exists (
    select 1 from public.problems problem
    where problem.id = new.problem_id and problem.publication_status = 'published'
  ) then
    raise exception 'Images attached to a published problem must be reviewed';
  end if;
  return new;
end;
$$;
revoke all on function private.require_reviewed_asset_for_published_problem() from public, anon, authenticated;
create trigger problem_asset_reviewed_for_published_problem
before insert or update on public.problem_assets
for each row execute function private.require_reviewed_asset_for_published_problem();

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
    'durationSeconds', a.duration_seconds,
    'status', a.status::text,
    'result', jsonb_set(
      r.result_payload,
      '{questionOutcomes}',
      coalesce((
        select jsonb_agg(
          outcome || jsonb_build_object(
            'review', case when p.id is null then null else jsonb_build_object(
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
              'assets', coalesce((
                select jsonb_agg(jsonb_build_object(
                  'path', asset.asset_path,
                  'altText', asset.alt_text_vi,
                  'placement', asset.placement
                ) order by asset.order_index)
                from public.problem_assets asset
                where asset.problem_id = p.id and asset.review_status = 'approved'
              ), '[]'::jsonb),
              'selectedAnswer', ans.selected_answer,
              'correctAnswer', case when ak.verification_status = 'verified' then ak.correct_answer else null end,
              'explanation', coalesce(ex.display_explanation_vi, ex.explanation)
            ) end
          ) order by ordinality
        )
        from jsonb_array_elements(coalesce(r.result_payload -> 'questionOutcomes', '[]'::jsonb)) with ordinality as q(outcome, ordinality)
        left join public.problems p on p.id::text = (q.outcome ->> 'questionId')
        left join public.attempt_answers ans on ans.attempt_id = a.id and ans.problem_id = p.id
        left join private.problem_answer_keys ak on ak.problem_id = p.id
        left join private.problem_explanations ex on ex.problem_id = p.id
      ), '[]'::jsonb),
      true
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
