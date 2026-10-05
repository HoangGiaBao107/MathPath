-- Count JSON object keys with PostgreSQL's supported jsonb_object_keys function.
-- The previous validator called jsonb_object_length, which is unavailable and
-- prevented all true/false answer-key inserts.
begin;

create or replace function private.validate_problem_answer_key()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  question_type public.problem_question_type;
  item_count integer;
  statement_count integer;
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
    select count(*) into statement_count
    from jsonb_object_keys(new.correct_answer -> 'statements');
    if item_count > 0 or statement_count <>
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

commit;
