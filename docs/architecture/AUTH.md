# Authentication architecture (Phase 5)

Supabase Auth owns credentials and sessions. MathPath implements email/password sign-up, sign-in, sign-out, password recovery/update, and a Google OAuth redirect/callback. Phone OTP is intentionally not exposed until an SMS provider and Supabase phone provider are configured; there is no simulated phone flow.

`src/lib/supabase/browser.ts` exposes only the public URL and anon key. `server.ts` uses `@supabase/ssr` and Next.js cookies; the Next.js 16 `proxy.ts` refreshes auth cookies. `admin.ts` requires `SUPABASE_SERVICE_ROLE_KEY`, is marked server-only, and is used only for persistence operations that must support guest ownership and atomic database functions. Do not import it into a client component.

After signup/auth callback, the server derives the current guest identity from its HTTP-only random cookie and calls the ownership-transfer repository method. The browser cannot nominate a guest hash or user ID. The database transfers only rows bearing that cookie hash. If the same account already has an active attempt for the set, the transferred guest attempt is retained as abandoned instead of violating the one-active-attempt constraint.

The `/account` route requires a verified Supabase session and reads its profile through the user's RLS-scoped server client. Profile creation is trigger-driven; passwords are never stored in `profiles`.

Configure Email and Google providers, email confirmation/recovery URLs, and the Google callback URL in the Supabase dashboard. OAuth cannot complete until those provider settings are enabled. Phone OTP remains later work.
