# Exam engine (Phase 4)

## Demo routes and data

- `/exams/demo-thptqg-format` exercises the configurable THPTQG scoring preset with 22 generated questions: 12 multiple choice, 4 true/false questions with four statements each, and 6 short answers.
- `/exams/demo-practice-20` exercises exactly 20 generated questions at 0.5 points each. True/false questions use all-or-nothing scoring.
- Both are marked **DEMO / MOCK — NOT AN OFFICIAL EXAM**. They contain generated practice data only.
- The Problem Bank links to these two test sets. The other metadata-only cards remain unavailable.

## Scoring

`src/lib/exams/scoring.ts` is the single TypeScript scoring service used by the server-side attempt repository. Exam/section/question scoring rules live in typed `ExamDefinition` data, so school exams can use other section counts, question counts and score distributions.

The official-style preset is one configuration: Part I gives 0.25 per MCQ; Part II maps 0–4 correct statements to 0, 0.1, 0.25, 0.5 or 1 point per question; Part III gives 0.5 per short answer. Config totals 10. Practice is 20×0.5 and all-or-nothing for each true/false question.

The demo definitions include answer keys in server-only modules. API payloads use `toSafeQuestion`, which strips correct answers and scoring rules. The result payload includes scores and answer state only; explanations and official answer-key review are not implemented in this phase.

## Attempt lifecycle

1. The browser posts an idempotency key to `POST /api/attempts`.
2. The server establishes an opaque, HTTP-only guest cookie and hashes its token for owner scoping.
3. Starting again while an attempt is active returns that same attempt. The server fixes question IDs/order, start time and deadline once.
4. `PATCH /api/attempts/[attemptId]` validates ownership, question membership, answer shape, option keys and short-answer input before saving. Each valid answer and review flag is stored together.
5. `GET` restores the same attempt/order/answers. No new attempt is created on refresh.
6. Manual submission and timer expiry use one idempotent server transition. Scoring reads server-held answers/keys. Repeated submissions return the stored result.

Countdown display derives from the server-issued absolute deadline; a visibility change recalculates from the current clock. Every API mutation rechecks the server deadline, so editing the client clock cannot extend the attempt. Practice elapsed duration is derived from server start and submit timestamps; practice has no forced countdown.

Short answers preserve their submitted raw string, accept only up to four ASCII digits/minus/comma characters in a valid numeric form, and normalize the decimal comma only during exact answer comparison. Both the client and API enforce validation.

## Storage boundary (Phase 5)

`AttemptRepository` selects `DevelopmentAttemptRepository` for local mock mode or `SupabaseAttemptRepository` when `MATHPATH_ATTEMPT_STORE=supabase`. The mock remains available to tests and local development only. Production refuses missing Supabase settings and never falls back to process memory.

Migrations `20261003000200_exam_engine.sql` and `20261003000300_auth_persistent_attempts.sql` define persistent attempt/timing snapshots, ordered question rows, answer revisions, owner RLS, private results, and restricted transactional functions. `npm run supabase:seed:demo` seeds the current generated demo definitions. Neither migration nor seed has been applied or exercised against PostgreSQL in this environment.

The HTTP-only guest cookie establishes a random guest owner; only its SHA-256 hash reaches storage. Authenticated accounts use Supabase Auth. The server-side claim function can transfer attempts for the current guest cookie to that signed-in user; a guest attempt that collides with an existing active account attempt is retained as abandoned. This is not an anti-cheating guarantee.

## Phase boundary

The result card shows score counts and section totals only, as needed to exercise submission/scoring. Explanations, wrong-answer review, progress history/charts, production answer imports, login, and AI feedback are later phases.
