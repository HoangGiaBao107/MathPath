# Supabase database workflow

This directory contains the PostgreSQL schema migrations for Supabase Auth and the MathPath database. The app has no configured production Supabase project and these migrations have not been applied to a shared or production database.

- Add every schema change as a new, timestamped SQL file in `migrations/`.
- Review RLS policies and run migrations against a disposable local project before any shared/production database.
- The repository does not currently include the Supabase CLI. SQL checks in this phase are structural/code-reviewed; no local PostgreSQL migration run is claimed.
- Never put service-role credentials in browser code.
- Do not import exam content until transcription, answer-key provenance, uncertainty, and publication rights have been reviewed.

The initial migration intentionally has no client write policies for scoring keys, attempts, balances, AI usage, payment events, feedback submissions, or audit logs. Phase 3 moves answer keys and explanations to the `private` schema, adds normalized question structures, and restricts catalog writes to admin-authorized/server boundaries. Phase 4 adds attempt timing/status snapshots, selected-question order, answer revisions, result payload storage, and owner read policies. Phase 5 adds profile triggers/RLS and server-only transactional functions. Set `MATHPATH_ATTEMPT_STORE=supabase` to use its durable adapter; otherwise local development can use the mock repository. Production never uses the mock.

Use `npm run supabase:seed:demo` only on a local/disposable project after applying migrations. The seed function accepts only entries explicitly marked `demo: true` and stores answer keys in `private.problem_answer_keys`. This seed uses generated arithmetic fixtures and does not import source PDFs.
