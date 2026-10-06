# Problem Bank foundation (Phase 3)

## Routes and current runtime

- `/problems` is the searchable, filterable, sortable Problem Bank preview.
- Header and homepage practice CTAs route to `/problems`.
- The page uses six interface-only catalogue cards in `demo-data.mock.ts`. Two links open generated practice data in the Phase 4 engine, clearly marked as demo/mock; they do not claim to be actual THPTQG questions. The other cards remain metadata-only previews.
- The preview adapter is server-initialized and disconnected from Supabase. Replace `DemoProblemSetRepository` with a server-side repository later; the public catalog contract includes bounded pagination/cursors.
- Public visitors do not see draft/unpublished items. The database and future admin service retain those states for authorized review.

## Database model

Migration `20261003000100_problem_bank_foundation.sql` extends the initial Phase 0 schema with:

- `problem_sets` categories, exam metadata, review/publication/rights state, and explicit timing mode.
- `problem_set_sections`, typed `problems`, `problem_options`, and `problem_substatements`.
- `problem_topics`, `problem_tags`, `problem_tag_assignments` and `problem_source_documents`.
- `private.problem_answer_keys` and `private.problem_explanations`.
- `practice_sessions` plus `practice_session_questions`, which persist the exact question IDs and order behind an owner-scoped idempotency key.

Question types:

- `multiple_choice`: answer key is a private object with one `option_key` that must exist for the same question.
- `true_false`: question uses ordered substatements; its private answer object must have exactly one boolean for each statement key.
- `short_answer`: private answer data carries accepted values, optional case sensitivity, and optional non-negative tolerance.

Every question carries an explicit `question_number`, section relation, global/per-section order, topic, difficulty, tags, source document/page/source question number, provenance state, rights state, review state, and publication state. Constraints and indexes protect duplicates, ordering, relationships, valid question types, and searchable catalog fields.

## Publication and answer security

Review state moves `draft → needs_review → approved`; publication is independently non-public until `published` (sets use `unpublished`; imported questions may use `draft` or `unpublished`). Phase 6A adds the question `draft` enum state for extraction output. Import records cannot enter as approved, published, or archived. PostgreSQL triggers prevent publication before review/rights/provenance and a verified type-valid official answer are in place. A set cannot publish empty or while one of its questions is ineligible.

Answer keys, explanations, internal provenance notes, and source-document records are in the non-PostgREST `private` schema or denied public table grants. The public query surface contains statement/option data only. Public RLS checks review approval, publication, and cleared rights; security-definer predicates expose only a boolean to enforce source-document clearance without granting clients access to document metadata. Client-side scoring is not authoritative and is not implemented in Phase 3.

Admin content writes have no `anon`/`authenticated` DML grants. Future route handlers must authenticate, validate input, check the admin role, perform server-side changes and write audit records. Service-role credentials must never reach client code.

## Import and provenance

`content/import/problem-set.schema.json` documents the v1 JSON payload; the executable validator is `src/lib/problems/import-schema.ts`. It checks required set/question/source fields, supported answer encodings, existing option/substatement references, duplicate identifiers/question numbers/order, time-mode validity, and review-only state. A missing official key remains `null` and requires `needs_review`; the importer does not infer keys. Import-to-database execution is deliberately absent.

Rights states are `unknown`, `pending_review`, `approved_for_internal`, `approved_for_publication`, and `restricted`. Provenance has its own `unknown`, `pending_review`, and `verified` state. Public publication requires explicit rights clearance. Student question content is imported from approved Word documents only; PDF ingestion is not supported.

## Hàm số sessions and timer semantics

The schema supports a topic relation and a transaction-oriented `PracticeSessionRepository` contract. The future adapter must select eligible random questions and insert the session plus position rows atomically; repeat requests with the same owner/idempotency key must return the original ordered selection. Phase 4 does not start from this empty catalogue or imply that a Hàm số source book has been ingested.

Problem sets store separate timing modes: real exam sets require `countdown` with `time_limit_seconds = 5400` (90 minutes); practice uses `elapsed` and can store only an estimated duration. Phase 3 shows this distinction in its preview and import contract. A session's elapsed practice time is derived from its persisted creation/start time. The running exam timer and live practice stopwatch are Phase 4 work.

## AI allowance and plans

The owner's latest rules are reflected only as configuration/schema foundation: guests 5 total, registered Free 5/day, no signup bonus; Plus 70,000 VND/month and 15/day; Pro 100,000 VND/month and 25/day; Pro Max 125,000 VND/month and 50/day. Daily policy uses `Asia/Ho_Chi_Minh`. Seeded plans remain inactive, and there is no credit enforcement, AI request, payment or purchase flow.

## Validation limits

The repository migration is versioned and code-reviewed but has not been applied to local or production Supabase. The Supabase CLI and PostgreSQL command-line client are not part of the repo environment. Do not report a database deploy or a successful local migration run.
