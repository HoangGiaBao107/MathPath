-- Separate immutable extraction evidence from editable Vietnamese and English display content.
-- Apply only after reviewing against a local/disposable Supabase project.
begin;

create type public.problem_translation_status as enum (
  'not_started', 'machine_draft', 'manually_reviewed', 'approved'
);

alter table public.problems
  add column display_stem_vi text,
  add column display_stem_en text,
  add column content_review_status public.problem_review_status not null default 'needs_review',
  add column translation_status public.problem_translation_status not null default 'not_started',
  add column translation_approved_at timestamptz,
  add column translation_approved_by uuid references public.profiles (id) on delete set null,
  add column edited_at timestamptz,
  add column edited_by uuid references public.profiles (id) on delete set null,
  add column content_approved_at timestamptz,
  add column content_approved_by uuid references public.profiles (id) on delete set null,
  add constraint problem_display_content_status_check check (
    content_review_status <> 'approved' or nullif(btrim(display_stem_vi), '') is not null
  );

update public.problems
set display_stem_vi = stem
where display_stem_vi is null;

create table private.problem_content_source (
  problem_id uuid primary key references public.problems (id) on delete cascade,
  raw_stem text not null,
  source_reference text,
  preserved_at timestamptz not null default now()
);
alter table private.problem_content_source enable row level security;
revoke all on table private.problem_content_source from public, anon, authenticated;
insert into private.problem_content_source (problem_id, raw_stem, source_reference)
select id, stem, source_reference from public.problems
on conflict (problem_id) do nothing;

create or replace function private.protect_raw_problem_evidence()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_table_name = 'problems' and row(new.stem, new.source_reference)
       is distinct from row(old.stem, old.source_reference) then
    raise exception 'Raw question evidence is immutable; edit display fields instead';
  elsif tg_table_name = 'problem_options' and new.option_text is distinct from old.option_text then
    raise exception 'Raw option evidence is immutable; edit display fields instead';
  elsif tg_table_name = 'problem_substatements' and new.statement_text is distinct from old.statement_text then
    raise exception 'Raw statement evidence is immutable; edit display fields instead';
  elsif tg_table_name = 'problem_explanations' and new.explanation is distinct from old.explanation then
    raise exception 'Raw explanation evidence is immutable; edit display fields instead';
  end if;
  return new;
end;
$$;
revoke all on function private.protect_raw_problem_evidence() from public, anon, authenticated;
create trigger problem_raw_evidence_immutable before update on public.problems
for each row execute function private.protect_raw_problem_evidence();
create trigger problem_option_raw_immutable before update on public.problem_options
for each row execute function private.protect_raw_problem_evidence();
create trigger problem_substatement_raw_immutable before update on public.problem_substatements
for each row execute function private.protect_raw_problem_evidence();
create trigger problem_explanation_raw_immutable before update on private.problem_explanations
for each row execute function private.protect_raw_problem_evidence();

alter table public.problem_options
  add column display_text_vi text,
  add column display_text_en text;
update public.problem_options
set display_text_vi = option_text
where display_text_vi is null;

alter table public.problem_substatements
  add column display_text_vi text,
  add column display_text_en text;
update public.problem_substatements
set display_text_vi = statement_text
where display_text_vi is null;

alter table private.problem_explanations
  add column display_explanation_vi text,
  add column display_explanation_en text,
  add column translation_status public.problem_translation_status not null default 'not_started',
  add column translation_approved_at timestamptz,
  add column translation_approved_by uuid references public.profiles (id) on delete set null,
  add column edited_at timestamptz,
  add column edited_by uuid references public.profiles (id) on delete set null;
update private.problem_explanations
set display_explanation_vi = explanation
where display_explanation_vi is null;

-- Raw stems/options/statements remain accessible to privileged server review only.
revoke select on public.problems, public.problem_options, public.problem_substatements
  from anon, authenticated;
grant select (
  id, problem_set_id, order_index, topic, subtopic, difficulty, source_page,
  question_type, question_number, section_id, topic_id, source_document_id,
  source_question_number, provenance_status, review_status, publication_status,
  rights_status, display_stem_vi, display_stem_en, content_review_status,
  translation_status, created_at, updated_at
) on public.problems to anon, authenticated;
grant select (
  id, problem_id, option_key, display_text_vi, display_text_en, order_index, created_at
) on public.problem_options to anon, authenticated;
grant select (
  id, problem_id, statement_key, display_text_vi, display_text_en, order_index, created_at
) on public.problem_substatements to anon, authenticated;

create or replace function private.require_display_review_before_publish()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.publication_status = 'published' and (
    new.content_review_status <> 'approved'
    or nullif(btrim(new.display_stem_vi), '') is null
  ) then
    raise exception 'Vietnamese display content must be reviewed before publication';
  end if;
  if new.translation_status = 'approved' and nullif(btrim(new.display_stem_en), '') is null then
    raise exception 'Approved translation requires an English display statement';
  end if;
  if new.publication_status = 'published' and new.question_type = 'multiple_choice' and exists (
    select 1 from public.problem_options o where o.problem_id = new.id
      and nullif(btrim(o.display_text_vi), '') is null
  ) then raise exception 'Every option requires reviewed Vietnamese display text'; end if;
  if new.publication_status = 'published' and new.question_type = 'true_false' and exists (
    select 1 from public.problem_substatements s where s.problem_id = new.id
      and nullif(btrim(s.display_text_vi), '') is null
  ) then raise exception 'Every statement requires reviewed Vietnamese display text'; end if;
  if new.translation_status = 'approved' and new.question_type = 'multiple_choice' and exists (
    select 1 from public.problem_options o where o.problem_id = new.id
      and nullif(btrim(o.display_text_en), '') is null
  ) then raise exception 'Approved translation requires English text for every option'; end if;
  if new.translation_status = 'approved' and new.question_type = 'true_false' and exists (
    select 1 from public.problem_substatements s where s.problem_id = new.id
      and nullif(btrim(s.display_text_en), '') is null
  ) then raise exception 'Approved translation requires English text for every statement'; end if;
  return new;
end;
$$;
revoke all on function private.require_display_review_before_publish() from public, anon, authenticated;
create trigger problem_display_review_gate
before insert or update of publication_status, content_review_status, display_stem_vi, translation_status, display_stem_en
on public.problems for each row execute function private.require_display_review_before_publish();

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
          'options', coalesce((select jsonb_agg(jsonb_build_object(
            'key', o.option_key, 'text', o.display_text_vi,
            'displayTextEn', case when p.translation_status = 'approved' then o.display_text_en else null end
          ) order by o.order_index) from public.problem_options o where o.problem_id = p.id), '[]'::jsonb),
          'points', (qcfg ->> 'points')::numeric,
          'correctOptionKey', ak.correct_answer ->> 'option_key'
        )
        when 'true_false' then jsonb_build_object(
          'id', p.id::text, 'sectionId', p.section_id::text, 'number', p.question_number,
          'type', p.question_type::text, 'stem', p.display_stem_vi,
          'displayStemVi', p.display_stem_vi,
          'displayStemEn', case when p.translation_status = 'approved' then p.display_stem_en else null end,
          'statements', coalesce((select jsonb_agg(jsonb_build_object(
            'key', s.statement_key, 'text', s.display_text_vi,
            'displayTextEn', case when p.translation_status = 'approved' then s.display_text_en else null end
          ) order by s.order_index) from public.problem_substatements s where s.problem_id = p.id), '[]'::jsonb),
          'points', (qcfg ->> 'points')::numeric,
          'correctStatements', ak.correct_answer -> 'statements',
          'scoring', ak.correct_answer -> 'scoring'
        )
        else jsonb_build_object(
          'id', p.id::text, 'sectionId', p.section_id::text, 'number', p.question_number,
          'type', p.question_type::text, 'stem', p.display_stem_vi,
          'displayStemVi', p.display_stem_vi,
          'displayStemEn', case when p.translation_status = 'approved' then p.display_stem_en else null end,
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

commit;
