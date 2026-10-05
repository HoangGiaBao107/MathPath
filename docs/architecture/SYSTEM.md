# System architecture

## Runtime

- Next.js App Router with React and strict TypeScript.
- Next.js route handlers are the sole application backend for the initial deployment.
- Supabase Auth and PostgreSQL are the intended managed identity and persistence services.
- AI, payment, and email integrations are server-only provider ports. Phase 0 defines contracts only.
- No process-memory or local-file persistence is used for application data.

## Boundaries

- `src/app`: routes, layouts, metadata, and future route handlers.
- `src/components`: presentation components, introduced in Phase 1 onward.
- `src/lib`: domain types, validation, authorization, and provider ports.
- `supabase/migrations`: versioned PostgreSQL schema and policies.
- `docs/architecture`: route map, service boundaries, and operational decisions.

Route handlers authenticate first, validate input, enforce authorization and quotas, call a domain service, then serialize a stable response. Secrets remain in server environment variables. Database reads/writes use user-scoped access where possible; privileged access is isolated to server code and reviewed operations.

## Problem Bank

The Problem Bank uses a repository port for server-side, paginated public-set reads. The Phase 3 page injects a demo-only adapter; it does not connect to Supabase. PostgreSQL stores sets, ordered sections, typed questions, options, true/false substatements, topic/tag relations, source documents, review state, rights state, and timing mode. The database is authoritative for publication eligibility.

Official answer keys and explanations live in the non-PostgREST `private` schema. There are no `anon` or `authenticated` grants/policies for those records. Public roles can read only question statements/options from approved, published, rights-cleared content. Future scoring and post-submission explanation endpoints must run server-side; the client must not submit a correct answer or score as trusted data.

The import validator rejects duplicate identifiers/question numbers/order, mismatched answer formats, unresolved answer keys marked as approved, and any attempt to publish on import. It preserves page/question provenance and rights review. Import-to-database execution is not implemented.

Future topic-practice sessions persist ordered question IDs in `practice_session_questions` and use an idempotency key. The future repository contract must return an existing session on refresh instead of silently selecting another set. The 20-question random session flow is not implemented.

Timed exams use `countdown` plus a fixed `time_limit_seconds` (the 90-minute exam rule). Practice sets use `elapsed` plus an optional estimated duration. The schema and Problem Bank preview distinguish these modes; an active timer/exam engine belongs to Phase 4.

## Authentication and authorization

Supabase Auth owns credentials and sessions; the app never stores passwords. The target methods are email/password, Google OAuth, and phone OTP. Sessions use the Supabase SSR cookie pattern. Only email/password is in the first planned authentication phase; OAuth and SMS require provider setup and are explicitly deferred. A profile role (`student` or `admin`) is checked on the server for every admin operation. Client-side route hiding is not an authorization control.

## AI and credits

`AIProvider` defines text solve, image solve, and similar-problem generation. Provider implementations are intentionally absent. AI responses are validated against a structured schema. `CreditService` defines reserve, commit, and release operations. Production implementations must perform reservations and ledger writes atomically in PostgreSQL, use request idempotency keys, and apply Vietnam calendar-day VIP resets on the server. If generation fails before a usable response, the reservation is released according to a deterministic policy.

## Payments

`PaymentProvider` defines order creation, webhook verification, and transaction parsing. There is no provider implementation or payment endpoint in Phase 0. A future webhook must verify authenticity, validate amount and payment code, deduplicate provider transaction IDs, and activate an entitlement idempotently. No client-supplied status may grant VIP.

## Admin

Admin capabilities are separated by operation and are enforced server-side. PostgreSQL Row Level Security is enabled in the initial schema. Public content is readable only when active and cleared for publication; answer keys have no public read policy. Admin operations are expected to write audit records. Service-role credentials must never be used in browser code.

Problem-set/question edits and publication state require the `admin` profile role. Public client writes are revoked. Answer/explanation data is service-role/server-only and cannot be read directly by authenticated admins through PostgREST; a later server admin service must authorize and audit those changes.

## Current AI allowance configuration

- Guests receive 5 requests total.
- Registered Free accounts receive 5 requests per Vietnam calendar day.
- There is no signup bonus.
- Plus is 70,000 VND/month for 15 requests/day; Pro is 100,000 VND/month for 25/day; Pro Max is 125,000 VND/month for 50/day.
- `Asia/Ho_Chi_Minh` is the reset timezone.

The TypeScript policy and inactive plan configuration are not a running credit service. No AI generation, reservation, debit, reset job, or payment is wired to the app.

## Internationalization

Supported locales are `vi` and `en`. UI copy belongs in typed locale dictionaries; components should resolve strings through the i18n layer. The locale is a profile preference for signed-in users and a browser preference for guests. Solver requests carry the selected locale. Phase 0 establishes types and dictionaries only.
