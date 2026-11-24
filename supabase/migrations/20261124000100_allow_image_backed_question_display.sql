begin;

-- Existing catalogue entries remain in the basic collection by default.
update public.problem_sets
set exam_metadata = exam_metadata || '{"curriculum_level":"basic"}'::jsonb
where exam_metadata ->> 'curriculum_level' is null;

-- The source PDF is the readable, selectable display layer for questions that
-- cannot be transcribed safely. The publication trigger below requires an
-- approved PDF or image asset before such a question can be published.
alter table public.problems
  drop constraint if exists problem_display_content_status_check;

-- Source scans may be the canonical display for questions whose formulas,
-- diagrams, and answer choices cannot be transcribed safely. Require an
-- approved figure before allowing any blank display field on a published item.
create or replace function private.require_display_review_before_publish()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  has_approved_image boolean;
begin
  select exists (
    select 1 from public.problem_assets asset
    where asset.problem_id = new.id and asset.review_status = 'approved'
  ) into has_approved_image;

  if new.publication_status = 'published' and new.content_review_status <> 'approved' then
    raise exception 'Vietnamese display content must be reviewed before publication';
  end if;
  if new.publication_status = 'published'
     and nullif(btrim(new.display_stem_vi), '') is null and not has_approved_image then
    raise exception 'A blank question display requires an approved source image';
  end if;
  if new.translation_status = 'approved' and nullif(btrim(new.display_stem_en), '') is null then
    raise exception 'Approved translation requires an English display statement';
  end if;
  if new.publication_status = 'published' and new.question_type = 'multiple_choice' and exists (
    select 1 from public.problem_options o where o.problem_id = new.id
      and nullif(btrim(o.display_text_vi), '') is null
  ) and not has_approved_image then
    raise exception 'Every option needs reviewed text or an approved source image';
  end if;
  if new.publication_status = 'published' and new.question_type = 'true_false' and exists (
    select 1 from public.problem_substatements s where s.problem_id = new.id
      and nullif(btrim(s.display_text_vi), '') is null
  ) and not has_approved_image then
    raise exception 'Every statement needs reviewed text or an approved source image';
  end if;
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

commit;
