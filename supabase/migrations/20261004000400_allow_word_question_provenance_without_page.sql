-- Word files do not always have stable page numbers. The original question number
-- is an acceptable provenance locator when a page is unavailable.
alter table public.problems
  drop constraint problems_source_document_ref_check,
  add constraint problems_source_document_ref_check check (
    source_document_id is null
    or (source_page is not null and source_page > 0)
    or nullif(btrim(source_question_number), '') is not null
  );
