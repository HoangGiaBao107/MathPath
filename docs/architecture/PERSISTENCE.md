# Attempt persistence (Phase 5)

`AttemptRepository` is the server service boundary used by all attempt routes. `DevelopmentAttemptRepository` wraps the Phase 4 in-memory repository for unit tests and explicitly selected local mock mode. `SupabaseAttemptRepository` is selected when `MATHPATH_ATTEMPT_STORE=supabase`; production refuses missing Supabase configuration and never falls back to memory.

Supabase mutations call restricted database functions. Attempt creation and its ordered question/answer-state rows are committed in one PostgreSQL transaction. Answer saves validate ownership, active status, question membership, and server deadline, then upsert on `(attempt_id, problem_id)`. Submission first claims a short server-side lock, preventing answer writes while the scoring service loads persisted answers and private keys. Finalization locks the attempt row; already-final attempts return their stored private result, so concurrent/retried submissions do not create a second result. If a server process stops mid-scoring, another request can resume after the two-minute claim lease. Clients never submit a score or correctness value.

The signed guest cookie contains a random UUID; only its SHA-256 hash is stored in the database. Guest attempt RPCs are unavailable to browser roles. Account ownership transfer is callable only by the server's service-role adapter and only for the currently issued cookie hash.

Countdown deadline and start time are set by PostgreSQL at attempt creation. Save and submit functions compare deadlines using the database clock. Practice duration is derived from server timestamps. Attempt question order and scoring points are copied into the attempt snapshot tables.

If `MATHPATH_ATTEMPT_STORE` is unset, local development/test uses the explicitly documented process-local mock. To exercise durable storage locally, set it to `supabase`, configure all three Supabase values, apply migrations, and run the demo seed. Without Supabase CLI credentials/database access, migrations remain unverified and the local mock remains active only when selected/defaulted in development.
