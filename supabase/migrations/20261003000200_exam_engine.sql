-- Phase 4 exam attempt persistence. Apply only after review on a disposable Supabase project.
-- Exam definitions snapshot scoring/timing at start; all writes stay server-side.
begin;

create type public.exam_attempt_status as enum (
  'not_started', 'in_progress', 'submitted', 'auto_submitted', 'expired', 'abandoned'
);

alter table public.attempts alter column status drop default;
alter table public.attempts
  alter column status type public.exam_attempt_status
    using (case status::text
      when 'submitted' then 'submitted'::public.exam_attempt_status
      when 'expired' then 'expired'::public.exam_attempt_status
      else 'in_progress'::public.exam_attempt_status
    end),
  alter column status set default 'in_progress';

-- Legacy attempts allowed a submitted/expired status without a completion timestamp.
update public.attempts
set submitted_at = coalesce(submitted_at, now())
where status in ('submitted', 'expired');

alter table public.problem_sets
  add column scoring_config jsonb not null default '{}'::jsonb
    check (jsonb_typeof(scoring_config) = 'object');

alter table public.attempts
  add column exam_mode text not null default 'school_mock'
    check (exam_mode in ('official_thptqg', 'practice', 'school_mock')),
  add column timing_mode public.problem_set_timing_mode not null default 'elapsed',
  add column time_limit_seconds integer,
  add column deadline_at timestamptz,
  add column idempotency_key uuid not null default gen_random_uuid(),
  add column submission_request_id uuid,
  add column submission_reason text check (submission_reason in ('manual', 'auto')),
  add column exam_configuration_snapshot jsonb not null default '{}'::jsonb
    check (jsonb_typeof(exam_configuration_snapshot) = 'object'),
  add column last_activity_at timestamptz not null default now(),
  add constraint attempts_timing_consistency check (
    (timing_mode = 'countdown' and time_limit_seconds > 0 and deadline_at is not null)
    or (timing_mode = 'elapsed' and time_limit_seconds is null and deadline_at is null)
  ),
  add constraint attempts_submission_consistency check (
    (status in ('submitted', 'auto_submitted', 'expired') and submitted_at is not null)
    or (status in ('not_started', 'in_progress', 'abandoned') and submitted_at is null)
  );

create unique index attempts_user_start_idempotency_unique
  on public.attempts (user_id, problem_set_id, idempotency_key) where user_id is not null;
create unique index attempts_guest_start_idempotency_unique
  on public.attempts (guest_session_hash, problem_set_id, idempotency_key)
  where guest_session_hash is not null;

alter table public.attempt_answers
  add column updated_at timestamptz not null default now(),
  add column revision integer not null default 1 check (revision > 0);

create table public.attempt_questions (
  attempt_id uuid not null references public.attempts (id) on delete cascade,
  problem_id uuid not null references public.problems (id) on delete restrict,
  section_id uuid references public.problem_set_sections (id) on delete restrict,
  order_index integer not null check (order_index >= 0),
  points numeric(6, 3) not null check (points >= 0),
  scoring_rule jsonb not null default '{}'::jsonb check (jsonb_typeof(scoring_rule) = 'object'),
  primary key (attempt_id, problem_id),
  unique (attempt_id, order_index)
);

create table private.exam_attempt_results (
  attempt_id uuid primary key references public.attempts (id) on delete cascade,
  result_payload jsonb not null check (jsonb_typeof(result_payload) = 'object'),
  created_at timestamptz not null default now()
);
alter table private.exam_attempt_results enable row level security;
revoke all on table private.exam_attempt_results from public, anon, authenticated;

alter table public.attempt_questions enable row level security;
create policy "attempt_questions_read_owner_or_admin" on public.attempt_questions for select to authenticated
  using (exists (
    select 1 from public.attempts a where a.id = attempt_id
      and (a.user_id = (select auth.uid()) or (select private.is_admin()))
  ));

-- Attempt status, answer writes, and result payload are changed only by trusted server services.
revoke insert, update, delete, truncate, references, trigger on
  public.attempts, public.attempt_answers, public.attempt_questions from anon, authenticated;
grant select on public.attempts, public.attempt_answers, public.attempt_questions to authenticated;

create index attempts_owner_exam_started_idx
  on public.attempts (user_id, problem_set_id, started_at desc) where user_id is not null;
create index attempts_guest_exam_started_idx
  on public.attempts (guest_session_hash, problem_set_id, started_at desc)
  where guest_session_hash is not null;
create index attempt_questions_order_idx on public.attempt_questions (attempt_id, order_index);
create index attempt_answers_updated_idx on public.attempt_answers (attempt_id, updated_at desc);

commit;
