create or replace function private.enforce_problem_publication()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  option_count integer;
  statement_count integer;
  answer_statement_count integer;
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
    if jsonb_typeof(answer_payload -> 'statements') is distinct from 'object' then
      raise exception 'The verified true/false key must cover every substatement';
    end if;
    select count(*) into answer_statement_count from jsonb_object_keys(answer_payload -> 'statements');
    if answer_statement_count <> statement_count or exists (
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
