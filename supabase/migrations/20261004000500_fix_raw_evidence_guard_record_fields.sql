create or replace function private.protect_raw_problem_evidence()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_table_name = 'problems' then
    if row(new.stem, new.source_reference) is distinct from row(old.stem, old.source_reference) then
      raise exception 'Raw question evidence is immutable; edit display fields instead';
    end if;
  elsif tg_table_name = 'problem_options' then
    if new.option_text is distinct from old.option_text then
      raise exception 'Raw option evidence is immutable; edit display fields instead';
    end if;
  elsif tg_table_name = 'problem_substatements' then
    if new.statement_text is distinct from old.statement_text then
      raise exception 'Raw statement evidence is immutable; edit display fields instead';
    end if;
  elsif tg_table_name = 'problem_explanations' then
    if new.explanation is distinct from old.explanation then
      raise exception 'Raw explanation evidence is immutable; edit display fields instead';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function private.protect_raw_problem_evidence() from public, anon, authenticated;
