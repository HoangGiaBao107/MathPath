-- Initial MathPath schema. Apply only to a disposable/local Supabase project until reviewed.
create extension if not exists pgcrypto;

create schema if not exists private;

create type public.app_role as enum ('student', 'admin');
create type public.content_rights_status as enum ('pending', 'cleared', 'restricted');
create type public.content_status as enum ('draft', 'review', 'published', 'archived');
create type public.attempt_status as enum ('in_progress', 'submitted', 'expired');
create type public.credit_bucket as enum ('guest_free', 'account_free', 'purchased', 'vip_daily');
create type public.credit_entry_kind as enum ('grant', 'reservation', 'commit', 'release', 'adjustment');
create type public.payment_status as enum ('pending', 'paid', 'expired', 'failed', 'refunded', 'manual_review');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  language text not null default 'vi' check (language in ('vi', 'en')),
  target_score numeric(3, 1) check (target_score between 0 and 10),
  role public.app_role not null default 'student',
  vip_started_at timestamptz,
  vip_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.problem_sets (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  description text,
  language text not null default 'vi' check (language in ('vi', 'en')),
  source_name text,
  source_type text not null check (source_type in ('official_exam', 'practice_book', 'generated')),
  source_year integer,
  duration_seconds integer not null check (duration_seconds > 0),
  difficulty text check (difficulty in ('easy', 'medium', 'hard', 'mixed')),
  topic text,
  content_status public.content_status not null default 'draft',
  publication_rights_status public.content_rights_status not null default 'pending',
  provenance_note text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.problems (
  id uuid primary key default gen_random_uuid(),
  problem_set_id uuid references public.problem_sets (id) on delete cascade,
  source_reference text,
  order_index integer not null check (order_index >= 0),
  section text,
  stem text not null,
  options jsonb not null default '[]'::jsonb check (jsonb_typeof(options) = 'array'),
  explanation text,
  topic text,
  subtopic text,
  difficulty text check (difficulty in ('easy', 'medium', 'hard')),
  tags text[] not null default '{}',
  similar_practice_tags text[] not null default '{}',
  source_page integer,
  provenance_note text,
  content_status public.content_status not null default 'draft',
  publication_rights_status public.content_rights_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (problem_set_id, order_index)
);

-- Answer keys are separate so the public problem-bank read policy cannot expose them.
create table public.problem_answer_keys (
  problem_id uuid primary key references public.problems (id) on delete cascade,
  correct_answer jsonb not null,
  verification_status text not null default 'unverified'
    check (verification_status in ('unverified', 'verified', 'uncertain')),
  verified_by uuid references public.profiles (id) on delete set null,
  verified_at timestamptz,
  provenance_note text,
  updated_at timestamptz not null default now()
);

create table public.attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete set null,
  guest_session_hash text,
  problem_set_id uuid references public.problem_sets (id) on delete set null,
  status public.attempt_status not null default 'in_progress',
  selected_problem_ids uuid[] not null default '{}',
  score numeric(5, 2),
  correct_count integer not null default 0 check (correct_count >= 0),
  wrong_count integer not null default 0 check (wrong_count >= 0),
  blank_count integer not null default 0 check (blank_count >= 0),
  duration_seconds integer,
  started_at timestamptz not null default now(),
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  check ((user_id is null) <> (guest_session_hash is null))
);

create table public.attempt_answers (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.attempts (id) on delete cascade,
  problem_id uuid not null references public.problems (id) on delete restrict,
  selected_answer jsonb,
  is_correct boolean,
  marked_for_review boolean not null default false,
  answered_at timestamptz,
  unique (attempt_id, problem_id)
);

create table public.credit_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete cascade,
  guest_session_hash text,
  guest_free_balance integer not null default 5 check (guest_free_balance >= 0),
  account_free_granted integer not null default 0 check (account_free_granted >= 0),
  purchased_balance integer not null default 0 check (purchased_balance >= 0),
  vip_daily_limit integer not null default 15 check (vip_daily_limit >= 0),
  vip_daily_used integer not null default 0 check (vip_daily_used >= 0),
  vip_daily_reset_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((user_id is null) <> (guest_session_hash is null))
);

create unique index credit_accounts_user_unique on public.credit_accounts (user_id) where user_id is not null;
create unique index credit_accounts_guest_unique on public.credit_accounts (guest_session_hash) where guest_session_hash is not null;

create table public.credit_reservations (
  id uuid primary key default gen_random_uuid(),
  credit_account_id uuid not null references public.credit_accounts (id) on delete cascade,
  request_id text not null,
  bucket public.credit_bucket not null,
  status text not null default 'reserved' check (status in ('reserved', 'committed', 'released')),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (credit_account_id, request_id)
);

create table public.credit_ledger (
  id uuid primary key default gen_random_uuid(),
  credit_account_id uuid not null references public.credit_accounts (id) on delete cascade,
  kind public.credit_entry_kind not null,
  bucket public.credit_bucket not null,
  amount integer not null check (amount > 0),
  request_id text,
  reservation_id uuid references public.credit_reservations (id) on delete set null,
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create unique index credit_ledger_request_unique on public.credit_ledger (request_id, kind)
  where request_id is not null;

create table public.ai_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete set null,
  guest_session_hash text,
  request_id text not null unique,
  request_type text not null check (request_type in ('solve_text', 'solve_image', 'similar_problem')),
  input_type text not null check (input_type in ('text', 'image', 'mixed')),
  provider text,
  model text,
  status text not null check (status in ('reserved', 'succeeded', 'failed', 'released')),
  input_tokens integer,
  output_tokens integer,
  duration_ms integer,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table public.plans (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  amount_vnd integer check (amount_vnd is null or amount_vnd >= 0),
  billing_interval text check (billing_interval in ('month', 'one_time')),
  credits integer check (credits is null or credits >= 0),
  daily_ai_limit integer check (daily_ai_limit is null or daily_ai_limit >= 0),
  active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.payment_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete restrict,
  plan_id uuid not null references public.plans (id) on delete restrict,
  amount_vnd integer not null check (amount_vnd >= 0),
  currency text not null default 'VND' check (currency = 'VND'),
  payment_code text not null unique,
  status public.payment_status not null default 'pending',
  provider text not null,
  provider_transaction_id text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  paid_at timestamptz
);

create unique index payment_orders_provider_transaction_unique
  on public.payment_orders (provider, provider_transaction_id)
  where provider_transaction_id is not null;

create table public.payment_events (
  id uuid primary key default gen_random_uuid(),
  payment_order_id uuid references public.payment_orders (id) on delete set null,
  provider text not null,
  provider_event_id text,
  event_type text not null,
  signature_valid boolean not null default false,
  payload_digest text not null,
  received_at timestamptz not null default now(),
  unique (provider, provider_event_id)
);

create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete set null,
  name text,
  email text,
  category text,
  message text not null,
  status text not null default 'new' check (status in ('new', 'reviewing', 'resolved', 'spam')),
  created_at timestamptz not null default now()
);

create table public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references public.profiles (id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index problems_topic_idx on public.problems (topic, subtopic, difficulty);
create index problems_set_order_idx on public.problems (problem_set_id, order_index);
create index attempts_user_created_idx on public.attempts (user_id, created_at desc);
create index ai_usage_user_created_idx on public.ai_usage (user_id, created_at desc);
create index payment_orders_user_created_idx on public.payment_orders (user_id, created_at desc);
create index feedback_status_created_idx on public.feedback (status, created_at desc);

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'admin'
  );
$$;

revoke all on function private.is_admin() from public;
grant usage on schema private to authenticated;
grant execute on function private.is_admin() to authenticated;

alter table public.profiles enable row level security;
alter table public.problem_sets enable row level security;
alter table public.problems enable row level security;
alter table public.problem_answer_keys enable row level security;
alter table public.attempts enable row level security;
alter table public.attempt_answers enable row level security;
alter table public.credit_accounts enable row level security;
alter table public.credit_reservations enable row level security;
alter table public.credit_ledger enable row level security;
alter table public.ai_usage enable row level security;
alter table public.plans enable row level security;
alter table public.payment_orders enable row level security;
alter table public.payment_events enable row level security;
alter table public.feedback enable row level security;
alter table public.admin_audit_log enable row level security;

create policy "profiles_select_self_or_admin" on public.profiles for select to authenticated
  using ((select auth.uid()) = id or (select private.is_admin()));
-- Profile changes go through server validation so a user cannot edit their own role.
create policy "profiles_admin_update" on public.profiles for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

create policy "problem_sets_read_published" on public.problem_sets for select to anon, authenticated
  using (content_status = 'published' and publication_rights_status = 'cleared');
create policy "problem_sets_admin_all" on public.problem_sets for all to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

create policy "problems_read_published" on public.problems for select to anon, authenticated
  using (
    content_status = 'published' and publication_rights_status = 'cleared'
    and (problem_set_id is null or exists (
      select 1 from public.problem_sets s where s.id = problem_set_id
        and s.content_status = 'published' and s.publication_rights_status = 'cleared'
    ))
  );
create policy "problems_admin_all" on public.problems for all to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "answer_keys_admin_all" on public.problem_answer_keys for all to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

create policy "attempts_read_owner_or_admin" on public.attempts for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_admin()));
create policy "attempt_answers_read_owner_or_admin" on public.attempt_answers for select to authenticated
  using (exists (
    select 1 from public.attempts a where a.id = attempt_id
      and (a.user_id = (select auth.uid()) or (select private.is_admin()))
  ));

create policy "credit_accounts_read_owner_or_admin" on public.credit_accounts for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_admin()));
create policy "credit_ledger_read_owner_or_admin" on public.credit_ledger for select to authenticated
  using (exists (
    select 1 from public.credit_accounts c where c.id = credit_account_id
      and (c.user_id = (select auth.uid()) or (select private.is_admin()))
  ));
create policy "credit_reservations_read_owner_or_admin" on public.credit_reservations for select to authenticated
  using (exists (
    select 1 from public.credit_accounts c where c.id = credit_account_id
      and (c.user_id = (select auth.uid()) or (select private.is_admin()))
  ));
create policy "ai_usage_read_owner_or_admin" on public.ai_usage for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_admin()));

create policy "active_plans_read" on public.plans for select to anon, authenticated
  using (active);
create policy "plans_admin_all" on public.plans for all to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

create policy "payment_orders_read_owner_or_admin" on public.payment_orders for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_admin()));
create policy "payment_events_admin_read" on public.payment_events for select to authenticated
  using ((select private.is_admin()));
create policy "feedback_admin_read" on public.feedback for select to authenticated
  using ((select private.is_admin()));
create policy "feedback_admin_update" on public.feedback for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "admin_audit_admin_read" on public.admin_audit_log for select to authenticated
  using ((select private.is_admin()));

-- Intentionally no client-side insert/update policies for answer keys, attempts,
-- credits, AI usage, payments, feedback, or audit events. Server APIs own writes.
