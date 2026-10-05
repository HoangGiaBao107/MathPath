-- Store extraction provenance and non-public draft state for local PDF ingestion.
-- Neither value verifies authorship, correctness, answer keys, rights, or publication eligibility.
alter type public.problem_provenance_status add value if not exists 'source_imported';
alter type public.problem_publication_status add value if not exists 'draft';
