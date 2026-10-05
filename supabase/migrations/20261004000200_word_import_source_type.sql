begin;

alter table public.problem_sets
  drop constraint if exists problem_sets_source_type_check;

alter table public.problem_sets
  add constraint problem_sets_source_type_check
  check (source_type in ('official_exam', 'practice_book', 'generated', 'word_import'));

commit;
