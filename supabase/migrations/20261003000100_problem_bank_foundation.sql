-- Problem Bank schema foundation. Apply to a disposable/local Supabase project first.
-- No source exam files or question content are imported by this migration.
begin;

create type public.problem_question_type as enum ('multiple_choice', 'true_false', 'short_answer');
create type public.problem_review_status as enum ('draft', 'needs_review', 'approved');
create type public.problem_publication_status as enum ('unpublished', 'published', 'archived');
create type public.problem_publication_rights_status as enum (
  'unknown', 'pending_review', 'approved_for_internal', 'approved_for_publication', 'restricted'
);
create type public.problem_provenance_status as enum ('unknown', 'pending_review', 'verified');
create type public.problem_set_category as enum (
  'mock_exam', 'chapter_review', 'topic_review', 'comprehensive'
);
create type public.problem_set_timing_mode as enum ('countdown', 'elapsed');
create type public.problem_tag_kind as enum ('content', 'similar_practice');

-- Replace permissive-era catalog policies before changing columns and table schemas.
drop policy if exists "problem_sets_read_published" on public.problem_sets;
drop policy if exists "problem_sets_admin_all" on public.problem_sets;
drop policy if exists "problems_read_published" on public.problems;
drop policy if exists "problems_admin_all" on public.problems;
drop policy if exists "answer_keys_admin_all" on public.problem_answer_keys;

-- Move answer keys out of the PostgREST-exposed public schema and revoke inherited grants.
alter table public.problem_answer_keys set schema private;
revoke all on table private.problem_answer_keys from public, anon, authenticated;
alter table private.problem_answer_keys
  add constraint problem_answer_keys_object_check check (jsonb_typeof(correct_answer) = 'object');

create table public.problem_topics (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name_vi text not null,
  name_en text,
  parent_id uuid references public.problem_topics (id) on delete set null,
  is_active boolean not null default false,
  order_index integer not null default 0 check (order_index >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.problem_set_sections (
  id uuid primary key default gen_random_uuid(),
  problem_set_id uuid not null references public.problem_sets (id) on delete cascade,
  section_key text not null,
  title text not null,
  order_index integer not null check (order_index >= 0),
  created_at timestamptz not null default now(),
  unique (problem_set_id, section_key),
  unique (problem_set_id, order_index),
  unique (id, problem_set_id)
);

create table public.problem_options (
  id uuid primary key default gen_random_uuid(),
  problem_id uuid not null references public.problems (id) on delete cascade,
  option_key text not null,
  option_text text not null,
  order_index integer not null check (order_index >= 0),
  created_at timestamptz not null default now(),
  unique (problem_id, option_key),
  unique (problem_id, order_index)
);

create table public.problem_substatements (
  id uuid primary key default gen_random_uuid(),
  problem_id uuid not null references public.problems (id) on delete cascade,
  statement_key text not null,
  statement_text text not null,
  order_index integer not null check (order_index >= 0),
  created_at timestamptz not null default now(),
  unique (problem_id, statement_key),
  unique (problem_id, order_index)
);

create table public.problem_tags (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name_vi text not null,
  name_en text,
  created_at timestamptz not null default now()
);

create table public.problem_tag_assignments (
  problem_id uuid not null references public.problems (id) on delete cascade,
  tag_id uuid not null references public.problem_tags (id) on delete restrict,
  tag_kind public.problem_tag_kind not null default 'content',
  primary key (problem_id, tag_id, tag_kind)
);

create table public.problem_source_documents (
  id uuid primary key default gen_random_uuid(),
  document_name text not null,
  source_type text not null check (source_type in ('official_exam', 'practice_book', 'generated', 'other')),
  source_year integer check (source_year is null or source_year between 1900 and 2200),
  provenance_status public.problem_provenance_status not null default 'unknown',
  publication_rights_status public.problem_publication_rights_status not null default 'unknown',
  provenance_note text,
  source_fingerprint text,
  created_at timestamptz not null default now(),
  unique (source_fingerprint)
);

alter table public.problem_sets
  add column category public.problem_set_category not null default 'comprehensive',
  add column exam_metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(exam_metadata) = 'object'),
  add column timing_mode public.problem_set_timing_mode not null default 'elapsed',
  add column time_limit_seconds integer,
  add column estimated_duration_seconds integer,
  add column review_status public.problem_review_status not null default 'draft',
  add column publication_status public.problem_publication_status not null default 'unpublished',
  add column rights_status public.problem_publication_rights_status not null default 'pending_review',
  add column source_document_id uuid references public.problem_source_documents (id) on delete set null,
  add constraint problem_sets_publication_check check (
    publication_status <> 'published' or
    (review_status = 'approved' and rights_status = 'approved_for_publication')
  ),
  add constraint problem_sets_timing_check check (
    (timing_mode = 'countdown' and time_limit_seconds > 0
      and (estimated_duration_seconds is null or estimated_duration_seconds > 0))
    or (timing_mode = 'elapsed' and time_limit_seconds is null
      and (estimated_duration_seconds is null or estimated_duration_seconds > 0))
  ),
  add constraint problem_sets_exam_90_minute_check check (
    category <> 'mock_exam' or (timing_mode = 'countdown' and time_limit_seconds = 5400)
  );

-- Existing durations were ambiguous; treat them as estimates unless explicitly categorized as an exam.
update public.problem_sets
set timing_mode = case when category = 'mock_exam' then 'countdown'::public.problem_set_timing_mode else 'elapsed'::public.problem_set_timing_mode end,
    time_limit_seconds = case when category = 'mock_exam' then 5400 else null end,
    estimated_duration_seconds = case when category = 'mock_exam' then null else duration_seconds end;
alter table public.problem_sets drop column duration_seconds;

alter table public.problems
  add column question_type public.problem_question_type not null default 'multiple_choice',
  add column question_number text,
  add column section_id uuid,
  add column topic_id uuid references public.problem_topics (id) on delete set null,
  add column source_document_id uuid references public.problem_source_documents (id) on delete set null,
  add column source_question_number text,
  add column provenance_status public.problem_provenance_status not null default 'unknown',
  add column review_status public.problem_review_status not null default 'draft',
  add column publication_status public.problem_publication_status not null default 'unpublished',
  add column rights_status public.problem_publication_rights_status not null default 'pending_review',
  add constraint problems_publication_check check (
    publication_status <> 'published' or
    (review_status = 'approved' and rights_status = 'approved_for_publication')
  ),
  add constraint problems_section_set_fk foreign key (section_id, problem_set_id)
    references public.problem_set_sections (id, problem_set_id),
  add constraint problems_source_document_ref_check check (
    source_document_id is null or (source_page is not null and source_page > 0)
  );

-- Carry prior notes into non-API provenance records, never expose internal review notes.
create table private.problem_set_provenance_notes (
  problem_set_id uuid primary key references public.problem_sets (id) on delete cascade,
  provenance_note text not null,
  updated_at timestamptz not null default now()
);
create table private.problem_provenance_notes (
  problem_id uuid primary key references public.problems (id) on delete cascade,
  provenance_note text not null,
  updated_at timestamptz not null default now()
);
alter table private.problem_set_provenance_notes enable row level security;
alter table private.problem_provenance_notes enable row level security;
revoke all on table private.problem_set_provenance_notes, private.problem_provenance_notes
  from public, anon, authenticated;
insert into private.problem_set_provenance_notes (problem_set_id, provenance_note)
select id, provenance_note from public.problem_sets where nullif(btrim(provenance_note), '') is not null;
insert into private.problem_provenance_notes (problem_id, provenance_note)
select id, provenance_note from public.problems where nullif(btrim(provenance_note), '') is not null;

insert into public.problem_source_documents (
  document_name, source_type, source_year, provenance_status,
  publication_rights_status, provenance_note, source_fingerprint
)
select distinct s.source_name,
       case when s.source_type in ('official_exam', 'practice_book', 'generated') then s.source_type else 'other' end,
       s.source_year,
       'pending_review'::public.problem_provenance_status,
       'pending_review'::public.problem_publication_rights_status,
       null::text,
       'legacy-' || md5(s.source_name)
from public.problem_sets s
where nullif(btrim(s.source_name), '') is not null
on conflict (source_fingerprint) do nothing;

update public.problem_sets s
set source_document_id = d.id
from public.problem_source_documents d
where d.source_fingerprint = 'legacy-' || md5(s.source_name)
  and s.source_document_id is null;

update public.problems p
set source_document_id = s.source_document_id
from public.problem_sets s
where s.id = p.problem_set_id and p.source_document_id is null;

-- Preserve legacy option and topic metadata if a developer already has disposable local rows.
insert into public.problem_options (problem_id, option_key, option_text, order_index)
select p.id,
       coalesce(nullif(o.value ->> 'key', ''), nullif(o.value ->> 'label', ''), o.ordinality::text),
       coalesce(nullif(o.value ->> 'text', ''), nullif(o.value ->> 'content', ''),
         nullif(o.value ->> 'label', ''), o.value #>> '{}', o.value::text),
       (o.ordinality - 1)::integer
from public.problems p
cross join lateral jsonb_array_elements(p.options) with ordinality as o(value, ordinality)
where jsonb_typeof(p.options) = 'array' and jsonb_array_length(p.options) > 0;

insert into public.problem_topics (slug, name_vi, is_active)
select distinct 'legacy-' || md5(lower(btrim(p.topic))), btrim(p.topic), false
from public.problems p
where nullif(btrim(p.topic), '') is not null
on conflict (slug) do nothing;

update public.problems p
set topic_id = t.id
from public.problem_topics t
where t.slug = 'legacy-' || md5(lower(btrim(p.topic)))
  and p.topic_id is null;

insert into public.problem_set_sections (problem_set_id, section_key, title, order_index)
select p.problem_set_id, p.section, p.section, row_number() over (
  partition by p.problem_set_id order by min(p.order_index), p.section
)::integer - 1
from public.problems p
where p.problem_set_id is not null and nullif(btrim(p.section), '') is not null
group by p.problem_set_id, p.section
on conflict (problem_set_id, section_key) do nothing;

update public.problems p
set section_id = s.id
from public.problem_set_sections s
where s.problem_set_id = p.problem_set_id and s.section_key = p.section and p.section_id is null;

insert into public.problem_tags (slug, name_vi)
select distinct 'legacy-' || md5(lower(btrim(tag.value))), btrim(tag.value)
from public.problems p
cross join lateral unnest(p.tags) as tag(value)
where nullif(btrim(tag.value), '') is not null
union
select distinct 'similar-' || md5(lower(btrim(tag.value))), btrim(tag.value)
from public.problems p
cross join lateral unnest(p.similar_practice_tags) as tag(value)
where nullif(btrim(tag.value), '') is not null
on conflict (slug) do nothing;

insert into public.problem_tag_assignments (problem_id, tag_id, tag_kind)
select p.id, t.id, 'content'
from public.problems p
cross join lateral unnest(p.tags) as tag(value)
join public.problem_tags t on t.slug = 'legacy-' || md5(lower(btrim(tag.value)))
where nullif(btrim(tag.value), '') is not null
on conflict do nothing;

insert into public.problem_tag_assignments (problem_id, tag_id, tag_kind)
select p.id, t.id, 'similar_practice'
from public.problems p
cross join lateral unnest(p.similar_practice_tags) as tag(value)
join public.problem_tags t on t.slug = 'similar-' || md5(lower(btrim(tag.value)))
where nullif(btrim(tag.value), '') is not null
on conflict do nothing;

-- Explanations follow answer-review policy and therefore live outside the public API schema.
create table private.problem_explanations (
  problem_id uuid primary key references public.problems (id) on delete cascade,
  explanation text not null,
  review_status public.problem_review_status not null default 'needs_review',
  rights_status public.problem_publication_rights_status not null default 'pending_review',
  provenance_note text,
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  updated_at timestamptz not null default now()
);
alter table private.problem_explanations enable row level security;
revoke all on table private.problem_explanations from public, anon, authenticated;
insert into private.problem_explanations (problem_id, explanation, provenance_note)
select id, explanation, provenance_note from public.problems where nullif(btrim(explanation), '') is not null;

-- Supersede the old, less expressive lifecycle/rights columns.
alter table public.problem_sets
  drop column content_status,
  drop column publication_rights_status,
  drop column provenance_note;
alter table public.problems
  drop column options,
  drop column explanation,
  drop column section,
  drop column tags,
  drop column similar_practice_tags,
  drop column content_status,
  drop column publication_rights_status,
  drop column provenance_note;

-- Existing records, if any, return to review rather than inheriting a former publish flag.
update public.problem_sets set review_status = 'needs_review', publication_status = 'unpublished';
update public.problems set review_status = 'needs_review', publication_status = 'unpublished';

create or replace function private.validate_problem_answer_key()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  question_type public.problem_question_type;
  item_count integer;
begin
  if tg_op = 'UPDATE' and exists (
    select 1 from public.problems p where p.id = new.problem_id
      and p.publication_status = 'published'
  ) then
    raise exception 'Unpublish the problem set before editing a published question answer key';
  end if;
  select p.question_type into question_type
  from public.problems p where p.id = new.problem_id;

  if question_type = 'multiple_choice' then
    if jsonb_typeof(new.correct_answer -> 'option_key') is distinct from 'string'
       or not exists (
         select 1 from public.problem_options o
         where o.problem_id = new.problem_id and o.option_key = new.correct_answer ->> 'option_key'
       ) then
      raise exception 'Multiple-choice answer must reference an option on the same question';
    end if;
  elsif question_type = 'true_false' then
    if jsonb_typeof(new.correct_answer -> 'statements') is distinct from 'object' then
      raise exception 'True/false answer must map statement keys to booleans';
    end if;
    select count(*) into item_count from jsonb_each(new.correct_answer -> 'statements') a
      where jsonb_typeof(a.value) is distinct from 'boolean'
        or not exists (
          select 1 from public.problem_substatements s
          where s.problem_id = new.problem_id and s.statement_key = a.key
        );
    if item_count > 0 or jsonb_object_length(new.correct_answer -> 'statements') <>
       (select count(*) from public.problem_substatements s where s.problem_id = new.problem_id) then
      raise exception 'True/false answer must cover every substatement exactly once';
    end if;
  elsif question_type = 'short_answer' then
    if jsonb_typeof(new.correct_answer -> 'accepted_values') is distinct from 'array'
       or jsonb_array_length(coalesce(new.correct_answer -> 'accepted_values', '[]'::jsonb)) = 0
       or exists (
         select 1 from jsonb_array_elements(new.correct_answer -> 'accepted_values') v(value)
         where jsonb_typeof(v.value) is distinct from 'string' or nullif(btrim(v.value #>> '{}'), '') is null
       ) then
      raise exception 'Short-answer key requires one or more non-empty accepted values';
    end if;
    if new.correct_answer ? 'tolerance' and
       (jsonb_typeof(new.correct_answer -> 'tolerance') is distinct from 'number'
        or (new.correct_answer ->> 'tolerance')::numeric < 0) then
      raise exception 'Short-answer tolerance must be a non-negative number';
    end if;
  else
    raise exception 'Question type must be set before an answer key is created';
  end if;
  if exists (select 1 from public.problems p where p.id = new.problem_id
      and p.publication_status = 'published') and new.verification_status <> 'verified' then
    raise exception 'Unpublish the problem set before changing a published question answer key';
  end if;
  return new;
end;
$$;
revoke all on function private.validate_problem_answer_key() from public, anon, authenticated;
create trigger problem_answer_key_validate
before insert or update of correct_answer, verification_status on private.problem_answer_keys
for each row execute function private.validate_problem_answer_key();

create or replace function private.enforce_problem_publication()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  option_count integer;
  statement_count integer;
  answer_payload jsonb;
begin
  if new.publication_status <> 'published' then
    if tg_op = 'UPDATE' and old.publication_status = 'published'
       and new.problem_set_id is not null and exists (
         select 1 from public.problem_sets s where s.id = new.problem_set_id
           and s.publication_status = 'published'
       ) then
      raise exception 'Unpublish the problem set before changing a published question';
    end if;
    return new;
  end if;
  if new.review_status <> 'approved' or new.rights_status <> 'approved_for_publication'
     or new.provenance_status <> 'verified' then
    raise exception 'A published question must be reviewed, provenance-verified, and rights-cleared';
  end if;
  if not exists (
    select 1 from public.problem_source_documents d
    where d.id = new.source_document_id and d.provenance_status = 'verified'
      and d.publication_rights_status = 'approved_for_publication'
  ) then
    raise exception 'A published question must reference verified provenance and cleared source rights';
  end if;
  select k.correct_answer into answer_payload from private.problem_answer_keys k
  where k.problem_id = new.id and k.verification_status = 'verified';
  if answer_payload is null then
    raise exception 'A published question must have a verified official answer';
  end if;
  if new.question_type = 'multiple_choice' then
    select count(*) into option_count from public.problem_options o where o.problem_id = new.id;
    if option_count < 2 then raise exception 'A multiple-choice question requires at least two options'; end if;
    if jsonb_typeof(answer_payload -> 'option_key') is distinct from 'string' or not exists (
      select 1 from public.problem_options o where o.problem_id = new.id and o.option_key = answer_payload ->> 'option_key'
    ) then raise exception 'The verified answer must point to an option on this question'; end if;
  elsif new.question_type = 'true_false' then
    select count(*) into statement_count from public.problem_substatements s where s.problem_id = new.id;
    if statement_count < 1 then raise exception 'A true/false question requires substatements'; end if;
    if jsonb_typeof(answer_payload -> 'statements') is distinct from 'object'
       or jsonb_object_length(answer_payload -> 'statements') <> statement_count
       or exists (
         select 1 from jsonb_each(answer_payload -> 'statements') a
         where jsonb_typeof(a.value) is distinct from 'boolean' or not exists (
           select 1 from public.problem_substatements s
           where s.problem_id = new.id and s.statement_key = a.key
         )
       ) then raise exception 'The verified true/false key must cover every substatement'; end if;
  elsif new.question_type = 'short_answer' then
    if jsonb_typeof(answer_payload -> 'accepted_values') is distinct from 'array'
       or jsonb_array_length(coalesce(answer_payload -> 'accepted_values', '[]'::jsonb)) = 0 then
      raise exception 'A short-answer question requires verified accepted values';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function private.enforce_problem_publication() from public, anon, authenticated;
create trigger problem_publication_integrity
before insert or update of publication_status, review_status, rights_status, question_type
on public.problems for each row execute function private.enforce_problem_publication();

create or replace function private.protect_published_problem_content()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.publication_status = 'published' and
     row(new.problem_set_id, new.order_index, new.section_id, new.stem, new.topic_id,
         new.difficulty, new.question_type, new.source_document_id, new.source_page,
         new.source_question_number, new.provenance_status, new.rights_status)
       is distinct from
     row(old.problem_set_id, old.order_index, old.section_id, old.stem, old.topic_id,
         old.difficulty, old.question_type, old.source_document_id, old.source_page,
         old.source_question_number, old.provenance_status, old.rights_status) then
    raise exception 'Unpublish a question and its set before editing published content';
  end if;
  return new;
end;
$$;
revoke all on function private.protect_published_problem_content() from public, anon, authenticated;
create trigger problem_published_content_guard before update on public.problems
for each row execute function private.protect_published_problem_content();

create or replace function private.protect_published_question_parts()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  question_id uuid;
begin
  if tg_op = 'DELETE' then
    question_id := old.problem_id;
  else
    question_id := new.problem_id;
  end if;
  if exists (select 1 from public.problems p where p.id = question_id and p.publication_status = 'published') then
    raise exception 'Unpublish a question and its set before editing options or substatements';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
revoke all on function private.protect_published_question_parts() from public, anon, authenticated;
create trigger problem_options_published_guard before insert or update or delete on public.problem_options
for each row execute function private.protect_published_question_parts();
create trigger problem_substatements_published_guard before insert or update or delete on public.problem_substatements
for each row execute function private.protect_published_question_parts();

create or replace function private.enforce_problem_set_publication()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.publication_status = 'published' then
    if new.review_status <> 'approved' or new.rights_status <> 'approved_for_publication' then
      raise exception 'A published problem set must be approved and rights-cleared';
    end if;
    if not exists (select 1 from public.problems p where p.problem_set_id = new.id) then
      raise exception 'An empty problem set cannot be published';
    end if;
    if exists (
      select 1 from public.problems p where p.problem_set_id = new.id
        and (p.publication_status <> 'published' or p.review_status <> 'approved'
          or not private.problem_source_document_is_public(p.source_document_id))
    ) then
      raise exception 'Every question must be reviewed, published, and source-cleared before its set';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function private.enforce_problem_set_publication() from public, anon, authenticated;
create trigger problem_set_publication_integrity
before insert or update of publication_status, review_status, rights_status
on public.problem_sets for each row execute function private.enforce_problem_set_publication();

-- Persistent, ordered selection for future topic practice; no random-session endpoint exists yet.
create table public.practice_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete cascade,
  guest_session_hash text,
  topic_id uuid not null references public.problem_topics (id) on delete restrict,
  idempotency_key text not null,
  status public.attempt_status not null default 'in_progress',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((user_id is null) <> (guest_session_hash is null)),
  check (length(idempotency_key) between 8 and 160)
);
create unique index practice_sessions_user_idempotency_unique
  on public.practice_sessions (user_id, idempotency_key) where user_id is not null;
create unique index practice_sessions_guest_idempotency_unique
  on public.practice_sessions (guest_session_hash, idempotency_key) where guest_session_hash is not null;

create table public.practice_session_questions (
  session_id uuid not null references public.practice_sessions (id) on delete cascade,
  problem_id uuid not null references public.problems (id) on delete restrict,
  order_index integer not null check (order_index >= 0),
  selected_at timestamptz not null default now(),
  primary key (session_id, problem_id),
  unique (session_id, order_index)
);

alter table public.practice_sessions enable row level security;
alter table public.practice_session_questions enable row level security;
create policy "practice_sessions_read_owner_or_admin" on public.practice_sessions for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_admin()));
create policy "practice_session_questions_read_owner_or_admin" on public.practice_session_questions for select to authenticated
  using (exists (
    select 1 from public.practice_sessions s where s.id = session_id
      and (s.user_id = (select auth.uid()) or (select private.is_admin()))
  ));
-- No client writes: later server services create/reuse an idempotent session in one transaction.

create index problem_sets_public_category_idx
  on public.problem_sets (category, difficulty, updated_at desc)
  where review_status = 'approved' and publication_status = 'published'
    and rights_status = 'approved_for_publication';
create index problem_sets_search_idx on public.problem_sets using gin (
  to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(description, ''))
);
create index problems_public_topic_difficulty_order_idx
  on public.problems (topic_id, difficulty, order_index)
  where review_status = 'approved' and publication_status = 'published'
    and rights_status = 'approved_for_publication';
create index problem_sections_set_order_idx on public.problem_set_sections (problem_set_id, order_index);
create index problem_options_problem_order_idx on public.problem_options (problem_id, order_index);
create index problem_substatements_problem_order_idx on public.problem_substatements (problem_id, order_index);
create index problem_tag_assignments_tag_idx on public.problem_tag_assignments (tag_id, problem_id);
create index problem_sessions_user_created_idx on public.practice_sessions (user_id, created_at desc);
create index problem_sessions_guest_created_idx on public.practice_sessions (guest_session_hash, created_at desc);
create index practice_session_questions_problem_idx on public.practice_session_questions (problem_id);
create index problem_source_docs_rights_idx on public.problem_source_documents (publication_rights_status, provenance_status);

create or replace function private.problem_source_document_is_public(document_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.problem_source_documents d
    where d.id = document_id and d.provenance_status = 'verified'
      and d.publication_rights_status = 'approved_for_publication'
  );
$$;
revoke all on function private.problem_source_document_is_public(uuid) from public;
grant usage on schema private to anon, authenticated;
grant execute on function private.problem_source_document_is_public(uuid) to anon, authenticated;

create or replace function private.problem_set_has_public_question(set_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.problems p
    where p.problem_set_id = set_id and p.review_status = 'approved'
      and p.publication_status = 'published' and p.rights_status = 'approved_for_publication'
      and private.problem_source_document_is_public(p.source_document_id)
  );
$$;
revoke all on function private.problem_set_has_public_question(uuid) from public;
grant execute on function private.problem_set_has_public_question(uuid) to anon, authenticated;

alter table public.problem_topics enable row level security;
alter table public.problem_set_sections enable row level security;
alter table public.problem_options enable row level security;
alter table public.problem_substatements enable row level security;
alter table public.problem_tags enable row level security;
alter table public.problem_tag_assignments enable row level security;
alter table public.problem_source_documents enable row level security;

create policy "problem_sets_read_approved_public" on public.problem_sets for select to anon, authenticated
  using (review_status = 'approved' and publication_status = 'published'
    and rights_status = 'approved_for_publication'
    and private.problem_set_has_public_question(id));
create policy "problem_sets_admin_manage" on public.problem_sets for all to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

create policy "problems_read_approved_public" on public.problems for select to anon, authenticated
  using (review_status = 'approved' and publication_status = 'published'
    and rights_status = 'approved_for_publication'
    and private.problem_source_document_is_public(source_document_id)
    and (problem_set_id is null or exists (
      select 1 from public.problem_sets s where s.id = problem_set_id
        and s.review_status = 'approved' and s.publication_status = 'published'
        and s.rights_status = 'approved_for_publication'
        and private.problem_source_document_is_public(s.source_document_id)
    )));
create policy "problems_admin_manage" on public.problems for all to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

create policy "problem_topics_read_used_by_public_content" on public.problem_topics for select to anon, authenticated
  using (exists (select 1 from public.problems p where p.topic_id = id));
create policy "problem_topics_admin_manage" on public.problem_topics for all to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "problem_sections_read_public_set" on public.problem_set_sections for select to anon, authenticated
  using (exists (select 1 from public.problem_sets s where s.id = problem_set_id
    and s.review_status = 'approved' and s.publication_status = 'published'
    and s.rights_status = 'approved_for_publication'
    and private.problem_set_has_public_question(s.id)));
create policy "problem_sections_admin_manage" on public.problem_set_sections for all to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "problem_options_read_public_question" on public.problem_options for select to anon, authenticated
  using (exists (select 1 from public.problems p where p.id = problem_id
    and p.review_status = 'approved' and p.publication_status = 'published'
    and p.rights_status = 'approved_for_publication'));
create policy "problem_options_admin_manage" on public.problem_options for all to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "problem_substatements_read_public_question" on public.problem_substatements for select to anon, authenticated
  using (exists (select 1 from public.problems p where p.id = problem_id
    and p.review_status = 'approved' and p.publication_status = 'published'
    and p.rights_status = 'approved_for_publication'));
create policy "problem_substatements_admin_manage" on public.problem_substatements for all to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "problem_tags_read_public_question" on public.problem_tags for select to anon, authenticated
  using (exists (select 1 from public.problem_tag_assignments a
    join public.problems p on p.id = a.problem_id where a.tag_id = id
      and p.review_status = 'approved' and p.publication_status = 'published'
      and p.rights_status = 'approved_for_publication'));
create policy "problem_tags_admin_manage" on public.problem_tags for all to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "problem_tag_assignments_read_public_question" on public.problem_tag_assignments for select to anon, authenticated
  using (exists (select 1 from public.problems p where p.id = problem_id
    and p.review_status = 'approved' and p.publication_status = 'published'
    and p.rights_status = 'approved_for_publication'));
create policy "problem_tag_assignments_admin_manage" on public.problem_tag_assignments for all to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "problem_source_documents_admin_manage" on public.problem_source_documents for all to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

-- Public catalog data is read-only; sensitive fields were removed/moved before these grants.
grant select on public.problem_sets, public.problems, public.problem_topics,
  public.problem_set_sections, public.problem_options, public.problem_substatements,
  public.problem_tags, public.problem_tag_assignments to anon, authenticated;
revoke insert, update, delete, truncate, references, trigger on
  public.problem_sets, public.problems, public.problem_topics, public.problem_set_sections,
  public.problem_options, public.problem_substatements, public.problem_tags,
  public.problem_tag_assignments from anon, authenticated;
revoke all on table public.problem_source_documents from anon, authenticated;
revoke all on table public.practice_sessions, public.practice_session_questions from anon, authenticated;
grant select on public.practice_sessions, public.practice_session_questions to authenticated;
revoke all on table private.problem_answer_keys, private.problem_explanations,
  private.problem_set_provenance_notes, private.problem_provenance_notes from public, anon, authenticated;

-- Persist the owner's corrected, authoritative allowance and paid-plan configuration.
alter type public.credit_bucket rename value 'vip_daily' to 'plan_daily';
alter table public.credit_accounts
  drop column account_free_granted,
  drop column vip_daily_limit,
  drop column vip_daily_used,
  drop column vip_daily_reset_date,
  add column guest_total_limit integer not null default 5 check (guest_total_limit >= 0),
  add column guest_total_used integer not null default 0 check (guest_total_used >= 0 and guest_total_used <= guest_total_limit),
  add column account_daily_limit integer not null default 5 check (account_daily_limit >= 0),
  add column account_daily_used integer not null default 0 check (account_daily_used >= 0),
  add column plan_daily_used integer not null default 0 check (plan_daily_used >= 0),
  add column daily_reset_date date;

alter table public.credit_accounts
  add column paid_plan_slug text references public.plans (slug) on update cascade on delete set null;

insert into public.plans (slug, name, description, amount_vnd, billing_interval, credits, daily_ai_limit, active)
values
  ('plus', 'Plus', '15 AI requests per Vietnam calendar day', 70000, 'month', null, 15, false),
  ('pro', 'Pro', '25 AI requests per Vietnam calendar day', 100000, 'month', null, 25, false),
  ('pro_max', 'Pro Max', '50 AI requests per Vietnam calendar day', 125000, 'month', null, 50, false)
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  amount_vnd = excluded.amount_vnd,
  billing_interval = excluded.billing_interval,
  credits = excluded.credits,
  daily_ai_limit = excluded.daily_ai_limit,
  active = false,
  updated_at = now();

commit;
