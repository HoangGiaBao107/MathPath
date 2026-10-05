-- Phase 8 analytics. Result payloads remain private; only safe owner-scoped
-- progress DTOs and admin aggregates are returned by service-role RPCs.
begin;

create index if not exists attempts_submitted_at_idx
  on public.attempts (submitted_at desc)
  where status in ('submitted', 'auto_submitted') and submitted_at is not null;
create index if not exists attempt_answers_updated_at_idx
  on public.attempt_answers (updated_at desc)
  where selected_answer is not null;

create or replace function public.get_student_progress(
  p_user_id uuid,
  p_history_limit integer default 10,
  p_history_offset integer default 0
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  safe_limit integer := least(greatest(coalesce(p_history_limit, 10), 1), 50);
  safe_offset integer := greatest(coalesce(p_history_offset, 0), 0);
begin
  perform private.assert_service_role();
  if p_user_id is null or not exists (select 1 from public.profiles where id = p_user_id) then
    raise exception 'student_not_found' using errcode = 'P0002';
  end if;

  return jsonb_build_object(
    'targetScore', (select target_score from public.profiles where id = p_user_id),
    'totalAttempts', (
      select count(*) from public.attempts a
      join private.exam_attempt_results r on r.attempt_id = a.id
      where a.user_id = p_user_id and a.status in ('submitted', 'auto_submitted') and a.score is not null
    ),
    'averageScore', (
      select round(avg(
        (a.score * 10) / nullif(coalesce(
          (r.result_payload ->> 'totalScore')::numeric,
          (a.exam_configuration_snapshot ->> 'totalScore')::numeric,
          10
        ), 0)
      ), 2)
      from public.attempts a
      join private.exam_attempt_results r on r.attempt_id = a.id
      where a.user_id = p_user_id and a.status in ('submitted', 'auto_submitted') and a.score is not null
    ),
    'questionsAttempted', (
      select count(*) from public.attempts a
      join private.exam_attempt_results r on r.attempt_id = a.id
      cross join lateral jsonb_array_elements(coalesce(r.result_payload -> 'questionOutcomes', '[]'::jsonb)) q(outcome)
      where a.user_id = p_user_id and a.status in ('submitted', 'auto_submitted')
        and q.outcome ->> 'state' <> 'unanswered'
    ),
    'correctCount', (
      select count(*) from public.attempts a
      join private.exam_attempt_results r on r.attempt_id = a.id
      cross join lateral jsonb_array_elements(coalesce(r.result_payload -> 'questionOutcomes', '[]'::jsonb)) q(outcome)
      where a.user_id = p_user_id and a.status in ('submitted', 'auto_submitted')
        and q.outcome ->> 'state' = 'correct'
    ),
    'partialCount', (
      select count(*) from public.attempts a
      join private.exam_attempt_results r on r.attempt_id = a.id
      cross join lateral jsonb_array_elements(coalesce(r.result_payload -> 'questionOutcomes', '[]'::jsonb)) q(outcome)
      where a.user_id = p_user_id and a.status in ('submitted', 'auto_submitted')
        and q.outcome ->> 'state' = 'partially_correct'
    ),
    'incorrectCount', (
      select count(*) from public.attempts a
      join private.exam_attempt_results r on r.attempt_id = a.id
      cross join lateral jsonb_array_elements(coalesce(r.result_payload -> 'questionOutcomes', '[]'::jsonb)) q(outcome)
      where a.user_id = p_user_id and a.status in ('submitted', 'auto_submitted')
        and q.outcome ->> 'state' = 'incorrect'
    ),
    'trend', coalesce((
      select jsonb_agg(jsonb_build_object(
        'attemptId', a.id,
        'examTitle', coalesce(s.title, 'Bộ đề đã lưu'),
        'submittedAt', a.submitted_at,
        'score', round((a.score * 10) / nullif(coalesce(
          (r.result_payload ->> 'totalScore')::numeric,
          (a.exam_configuration_snapshot ->> 'totalScore')::numeric,
          10
        ), 0), 2)
      ) order by a.submitted_at asc, a.id asc)
      from public.attempts a
      join private.exam_attempt_results r on r.attempt_id = a.id
      left join public.problem_sets s on s.id = a.problem_set_id
      where a.user_id = p_user_id and a.status in ('submitted', 'auto_submitted') and a.score is not null
    ), '[]'::jsonb),
    'topics', coalesce((
      select jsonb_agg(jsonb_build_object(
        'topic', topic,
        'questionCount', question_count,
        'correctCount', correct_count,
        'partialCount', partial_count,
        'incorrectCount', incorrect_count,
        'unansweredCount', unanswered_count,
        'accuracy', case when question_count = 0 then null
          else round(correct_count::numeric * 100 / question_count, 1) end
      ) order by topic asc)
      from (
        select q.outcome ->> 'topic' as topic,
          count(*) filter (where q.outcome ->> 'state' <> 'unanswered') as question_count,
          count(*) filter (where q.outcome ->> 'state' = 'correct') as correct_count,
          count(*) filter (where q.outcome ->> 'state' = 'partially_correct') as partial_count,
          count(*) filter (where q.outcome ->> 'state' = 'incorrect') as incorrect_count,
          count(*) filter (where q.outcome ->> 'state' = 'unanswered') as unanswered_count
        from public.attempts a
        join private.exam_attempt_results r on r.attempt_id = a.id
        cross join lateral jsonb_array_elements(coalesce(r.result_payload -> 'questionOutcomes', '[]'::jsonb)) q(outcome)
        where a.user_id = p_user_id and a.status in ('submitted', 'auto_submitted')
          and nullif(btrim(q.outcome ->> 'topic'), '') is not null
        group by q.outcome ->> 'topic'
      ) topic_rows
    ), '[]'::jsonb),
    'historyTotal', (
      select count(*) from public.attempts a
      join private.exam_attempt_results r on r.attempt_id = a.id
      where a.user_id = p_user_id and a.status in ('submitted', 'auto_submitted') and a.score is not null
    ),
    'history', coalesce((
      select jsonb_agg(row_data order by submitted_at desc, attempt_id desc)
      from (
        select a.id as attempt_id, a.submitted_at, jsonb_build_object(
          'attemptId', a.id,
          'examSlug', s.slug,
          'examTitle', coalesce(s.title, 'Bộ đề đã lưu'),
          'submittedAt', a.submitted_at,
          'status', a.status::text,
          'score', round((a.score * 10) / nullif(coalesce(
            (r.result_payload ->> 'totalScore')::numeric,
            (a.exam_configuration_snapshot ->> 'totalScore')::numeric,
            10
          ), 0), 2),
          'rawScore', a.score,
          'totalScore', coalesce((r.result_payload ->> 'totalScore')::numeric, 10),
          'correctCount', coalesce((r.result_payload ->> 'correctCount')::integer, a.correct_count),
          'partialCount', coalesce((r.result_payload ->> 'partialCount')::integer, 0),
          'incorrectCount', coalesce((r.result_payload ->> 'incorrectCount')::integer, a.wrong_count),
          'unansweredCount', coalesce((r.result_payload ->> 'unansweredCount')::integer, a.blank_count),
          'questionCount', coalesce(jsonb_array_length(r.result_payload -> 'questionOutcomes'), 0),
          'durationSeconds', a.duration_seconds
        ) as row_data
        from public.attempts a
        join private.exam_attempt_results r on r.attempt_id = a.id
        left join public.problem_sets s on s.id = a.problem_set_id
        where a.user_id = p_user_id and a.status in ('submitted', 'auto_submitted') and a.score is not null
        order by a.submitted_at desc, a.id desc
        limit safe_limit offset safe_offset
      ) page_rows
    ), '[]'::jsonb)
  );
end;
$$;

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
    'result', r.result_payload
  ) into payload
  from public.attempts a
  join private.exam_attempt_results r on r.attempt_id = a.id
  left join public.problem_sets s on s.id = a.problem_set_id
  where a.id = p_attempt_id and a.user_id = p_user_id
    and a.status in ('submitted', 'auto_submitted');
  return payload;
end;
$$;

create or replace function public.get_admin_analytics(p_actor_user_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.assert_service_role();
  if p_actor_user_id is null or not exists (
    select 1 from public.profiles p where p.id = p_actor_user_id and p.role = 'admin'
  ) then
    raise exception 'admin_required' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'totalAccounts', (select count(*) from auth.users),
    'totalVip', (
      select count(*) from public.profiles p
      where p.vip_started_at <= now() and (p.vip_expires_at is null or p.vip_expires_at > now())
    ),
    'totalAttempts', (select count(*) from public.attempts),
    'averageScore', (
      select round(avg((a.score * 10) / nullif(coalesce(
        (r.result_payload ->> 'totalScore')::numeric,
        (a.exam_configuration_snapshot ->> 'totalScore')::numeric,
        10
      ), 0)), 2)
      from public.attempts a join private.exam_attempt_results r on r.attempt_id = a.id
      where a.status in ('submitted', 'auto_submitted') and a.score is not null
    ),
    'completedAttempts', (
      select count(*) from public.attempts where status in ('submitted', 'auto_submitted')
    ),
    'submissionRate', (
      select case when count(*) = 0 then null else round(
        count(*) filter (where status in ('submitted', 'auto_submitted'))::numeric * 100 / count(*), 1
      ) end from public.attempts
    ),
    'averageAttemptsPerAccount', (
      select case when (select count(*) from auth.users) = 0 then null else round(
        (select count(*)::numeric from public.attempts) / (select count(*) from auth.users), 2
      ) end
    ),
    'subscriptions', coalesce((
      with active_vip as (
        select p.id, lower(coalesce(plan.slug, '')) as plan_slug
        from public.profiles p
        left join lateral (
          select pl.slug
          from public.payment_orders po join public.plans pl on pl.id = po.plan_id
          where po.user_id = p.id and po.status = 'paid'
          order by po.paid_at desc nulls last, po.created_at desc
          limit 1
        ) plan on true
        where p.vip_started_at <= now() and (p.vip_expires_at is null or p.vip_expires_at > now())
      )
      select jsonb_build_object(
        'free', greatest((select count(*) from auth.users) - (select count(*) from active_vip), 0),
        'plus', count(*) filter (where plan_slug like '%plus%'),
        'pro', count(*) filter (where plan_slug like '%pro%' and plan_slug not like '%max%'),
        'proMax', count(*) filter (where plan_slug like '%max%'),
        'otherVip', count(*) filter (where plan_slug not like '%plus%' and plan_slug not like '%pro%')
      ) from active_vip
    ), '{"free":0,"plus":0,"pro":0,"proMax":0,"otherVip":0}'::jsonb),
    'targetDistribution', (
      select jsonb_agg(jsonb_build_object('bucket', n, 'label',
        case when n = 10 then '10' else n::text || '–' || (n + 0.9)::numeric(3,1)::text end,
        'count', coalesce(b.bucket_count, 0)) order by n)
      from generate_series(0, 10) n
      left join (
        select least(floor(target_score)::integer, 10) as bucket, count(*) as bucket_count
        from public.profiles where target_score is not null group by 1
      ) b on b.bucket = n
    ),
    'dailyActivity', (
      with days as (
        select generate_series(
          (now() at time zone 'Asia/Ho_Chi_Minh')::date - 89,
          (now() at time zone 'Asia/Ho_Chi_Minh')::date,
          interval '1 day'
        )::date as day
      ), events as (
        select a.user_id, a.created_at as occurred_at, false as is_submission from public.attempts a where a.user_id is not null
        union all
        select a.user_id, a.submitted_at, true from public.attempts a
          where a.user_id is not null and a.submitted_at is not null and a.status in ('submitted','auto_submitted')
        union all
        select a.user_id, ans.updated_at, false from public.attempt_answers ans
          join public.attempts a on a.id = ans.attempt_id
          where a.user_id is not null and ans.selected_answer is not null
      ), activity as (
        select (occurred_at at time zone 'Asia/Ho_Chi_Minh')::date as day,
          count(distinct user_id) as active_users,
          count(*) filter (where is_submission) as submissions
        from events
        where occurred_at >= ((now() at time zone 'Asia/Ho_Chi_Minh')::date - 89)::timestamp at time zone 'Asia/Ho_Chi_Minh'
          and occurred_at < ((now() at time zone 'Asia/Ho_Chi_Minh')::date + 1)::timestamp at time zone 'Asia/Ho_Chi_Minh'
        group by 1
      )
      select jsonb_agg(jsonb_build_object('date', d.day,
        'activeUsers', coalesce(a.active_users, 0), 'submissions', coalesce(a.submissions, 0)) order by d.day)
      from days d left join activity a on a.day = d.day
    ),
    'scoreTrend', (
      with daily as (
        select (a.submitted_at at time zone 'Asia/Ho_Chi_Minh')::date as day,
          count(*) as submissions,
          avg((a.score * 10) / nullif(coalesce(
            (r.result_payload ->> 'totalScore')::numeric,
            (a.exam_configuration_snapshot ->> 'totalScore')::numeric,
            10
          ), 0)) as average_score
        from public.attempts a join private.exam_attempt_results r on r.attempt_id = a.id
        where a.status in ('submitted','auto_submitted')
          and a.submitted_at >= ((now() at time zone 'Asia/Ho_Chi_Minh')::date - 89)::timestamp at time zone 'Asia/Ho_Chi_Minh'
          and a.score is not null
        group by 1
      )
      select coalesce(jsonb_agg(jsonb_build_object('date', day, 'submissions', submissions,
        'averageScore', round(average_score, 2)) order by day), '[]'::jsonb) from daily
    ),
    'users', (
      with user_attempts as (
        select a.user_id, count(*) as attempts,
          avg((a.score * 10) / nullif(coalesce(
            (r.result_payload ->> 'totalScore')::numeric,
            (a.exam_configuration_snapshot ->> 'totalScore')::numeric,
            10
          ), 0)) filter (where a.status in ('submitted','auto_submitted') and a.score is not null) as average_score
        from public.attempts a
        left join private.exam_attempt_results r on r.attempt_id = a.id
        where a.user_id is not null
        group by a.user_id
      ), user_questions as (
        select a.user_id, count(*) as questions_attempted
        from public.attempt_answers ans
        join public.attempts a on a.id = ans.attempt_id
        where a.user_id is not null and ans.selected_answer is not null
        group by a.user_id
      ), per_user as (
        select u.id, u.email, coalesce(p.display_name, '') as display_name,
          coalesce(ua.attempts, 0) as attempts,
          coalesce(uq.questions_attempted, 0) as questions_attempted,
          ua.average_score
        from auth.users u
        left join public.profiles p on p.id = u.id
        left join user_attempts ua on ua.user_id = u.id
        left join user_questions uq on uq.user_id = u.id
      )
      select coalesce(jsonb_agg(jsonb_build_object('userId', id, 'email', email,
        'displayName', display_name, 'attempts', attempts,
        'questionsAttempted', questions_attempted,
        'averageScore', round(average_score, 2)) order by questions_attempted desc, attempts desc, id)
      , '[]'::jsonb)
      from (select * from per_user order by questions_attempted desc, attempts desc, id limit 100) ranked
    )
  );
end;
$$;

revoke all on function public.get_student_progress(uuid, integer, integer) from public, anon, authenticated;
revoke all on function public.get_student_attempt_result(uuid, uuid) from public, anon, authenticated;
revoke all on function public.get_admin_analytics(uuid) from public, anon, authenticated;
grant execute on function public.get_student_progress(uuid, integer, integer) to service_role;
grant execute on function public.get_student_attempt_result(uuid, uuid) to service_role;
grant execute on function public.get_admin_analytics(uuid) to service_role;

commit;
