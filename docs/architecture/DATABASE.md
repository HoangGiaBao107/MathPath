# Database architecture (Phase 5)

Supabase PostgreSQL is the durable store. `problem_sets`, normalized problems/options/substatements/sections, and `private.problem_answer_keys` remain the canonical exam content model. `attempts` owns lifecycle/timing/result summaries; `attempt_questions` snapshots ordered membership and points/scoring; `attempt_answers` stores raw submitted values and review flags with an upsert key `(attempt_id, problem_id)`. Final detailed results live in `private.exam_attempt_results`.

The profile row is created by a restricted `auth.users` trigger. A user may read their own profile and update only `display_name`, `language`, and `target_score`; role changes remain server/admin controlled. Existing content publication, provenance, and answer-key separation rules are preserved.

Migration `20261003000300_auth_persistent_attempts.sql` adds profile lifecycle support and service-only SQL functions for runtime exam loading, transactional attempt creation, state saves, final submission, guest ownership transfer, and demo seeding. The functions require a `service_role` JWT and have execute permission revoked from `anon` and `authenticated`. The service-role key is only used by server-only modules.

RLS remains enabled for user-readable data. Authenticated clients can select their own profiles and attempts/answers/questions; there are no browser DML policies for attempts, answer keys, or result payloads. Guest rows have no anonymous client policies: the server verifies the random HTTP-only guest cookie, hashes it, and uses service-only repository functions. Server code separately enforces the exact owner tuple before every read or write.

## Demo fixture

`npm run supabase:seed:demo` sends the same generated definitions from `src/lib/exams/demo-data.mock.ts` to the restricted seed function. It upserts the two synthetic demo sets and answer keys; the fixtures are marked DEMO / MOCK and NOT OFFICIAL. It does not read or ingest source documents. Run only against a local/disposable Supabase project.

## Apply status

The migration is authored but has not been applied or tested against a PostgreSQL/Supabase instance in this environment. Apply it to local Supabase first, then seed and verify before using a shared environment.
