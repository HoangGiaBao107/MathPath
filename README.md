# MathPath

MathPath is a bilingual math-learning platform for Vietnamese high-school students preparing for THPTQG Mathematics.

## Current content state

The production Problem Bank at `https://mathpath.com.vn/problems` contains 12 sets: eight comprehensive exams and four topic sets for derivatives and integrals. Student exam content is sourced from the approved Word documents. Draft review pages are restricted to administrators.

Approved Word documents are the sole source for student exams. PDF ingestion and its synthetic test fixture have been removed; the Word import does not read PDF files.

Word formulas stored as Office Math (OMML) are converted structurally to LaTeX and rendered with the existing KaTeX package. Answer keys, explanations, and source text are kept in `content/word-import/private-exam-solutions.json`, outside the browser bundle. The 21 image prompts and their output paths are indexed in `content/word-import/figure-generation-manifest.json`; each prompt adds a MathPath white/red/black visual direction, with red graph lines, black plotted points, and white backgrounds. Missing source content is flagged, not reconstructed. Two owner-requested option edits are recorded in the private file; they have not been written back to the original Word document. AI-generated figures remain pending until an image-generation tool is connected.

## Requirements

- Node.js 20.9 or newer
- npm 10 or newer
- Python 3.11 or newer and `python-docx` for the Word import

## Local development

1. Install packages:

   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env.local`. For development without Supabase, `MATHPATH_ATTEMPT_STORE=mock` uses the in-memory attempt repository and clears when the server restarts. Production uses durable Supabase storage.

3. Start the development server:

   ```bash
   npm run dev
   ```

4. Open <http://localhost:3000/problems> and review the problem bank. Configure a local Supabase project to persist attempts and profile data.

### Refresh the Word exam import

Install the Word parser dependency once:

```bash
python -m pip install -r requirements-word-import.txt
```

Then regenerate the safe student preview and private answer/explanation records:

```bash
npm run import:word-exams
```

On Windows, set `MATHPATH_PYTHON` to a Python executable with `python-docx` installed if `python` does not resolve to it. This command reads only `Đề thi.docx`; it does not connect to Supabase or approve/publish questions. It preserves the original Word file unchanged.

### Local Supabase mode

To use durable attempts locally, create a disposable Supabase project (or run the Supabase CLI locally), then set these in `.env.local`:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLIC_PUBLISHABLE_KEY
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVER_ONLY_SERVICE_ROLE_KEY
MATHPATH_ATTEMPT_STORE=supabase
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Never prefix the service-role key with `NEXT_PUBLIC_`. Then:

1. Apply `supabase/migrations/` in timestamp order using Supabase CLI (`supabase db push`) or the SQL editor on a disposable/local project.
2. Enable Email and Google providers in Supabase Auth. Add `http://localhost:3000/auth/callback` to allowed redirect URLs; configure Google credentials in Supabase before testing Google sign-in.
3. For isolated local engine checks only, seed generated practice fixtures with `npm run supabase:seed:demo`. Do not seed these fixtures into the production project.
4. Start the app with `npm run dev`. To verify connectivity, load `/exams/demo-practice-20`, start an attempt, save an answer, refresh, and confirm the same attempt resumes. Submit to check persisted result.

The production Supabase project is configured for MathPath. New migrations still need to be applied to that project before features that depend on those schema changes are available.

## Quality commands

```bash
npm run typecheck
npm run lint
npm run test
npm run format:check
npm run build
git diff --check
```

## Architecture map

- `src/app`: Next.js App Router pages and route-level loading/error states.
- `src/components`: reusable presentation and feature components.
- `src/lib/problems`: Problem Bank domain types, mock-only catalogue adapter, import validator, and database row types.
- `src/lib/exams`: server-side scoring, validation, repository boundary, Supabase adapter, demo fixtures, and development-only attempt store.
- `src/lib/supabase`: browser-safe, SSR-cookie, and server-only admin Supabase clients.
- `src/app/api/auth`: Supabase Auth route handlers; `src/app/auth`: login, registration, recovery, and callback routes.
- `content/word-import/private-exam-solutions.json`: private Word-derived answers, explanations, source text, and image prompts; never import this file from client code.
- `content/import`: versioned import schema and workflow documentation.
- `content/processed`: reserved for reviewed transcription drafts.
- `content/approved`: reserved for records that pass answer/provenance/rights review.
- `supabase/migrations`: versioned PostgreSQL schema and RLS changes.
- `docs/architecture`: route map, system boundaries, and Problem Bank security decisions.

See [Problem Bank architecture](docs/architecture/PROBLEM_BANK.md), [routes](docs/architecture/ROUTES.md), [system architecture](docs/architecture/SYSTEM.md), and [Supabase workflow](supabase/README.md).
See [Exam engine architecture](docs/architecture/EXAM_ENGINE.md) for attempt state, scoring and demo storage limits.
## Business rules (configuration only)

- Guest: 5 total AI requests.
- Registered Free: 5 AI requests per day.
- No one-time signup bonus.
- Plus: 70,000 VND/month and 15 requests/day.
- Pro: 100,000 VND/month and 25 requests/day.
- Pro Max: 125,000 VND/month and 50 requests/day.
- Future daily quota resets use `Asia/Ho_Chi_Minh`.

AI requests and quota enforcement are implemented. Subscription plan amounts are configuration only; payment processing is not implemented.

## Security and deployment status

- Never commit `.env.local`, API keys, service-role keys, webhook secrets, or provider credentials.
- Variables prefixed with `NEXT_PUBLIC_` are browser-visible and must not contain secrets.
- Official answer keys and explanations are moved to the non-API `private` schema and denied to `anon`/`authenticated` roles.
- Public RLS exposes only reviewed, published, rights-cleared questions and problem sets; client-side score calculation is not part of Phase 3.
- Real exam sets require a 90-minute countdown; practice sets use elapsed-time semantics with any displayed duration marked as an estimate.
- Supabase production is configured. Apply new timestamped migrations before relying on features that require them; verify the migration history after deployment.
- Production attempt APIs require `MATHPATH_ATTEMPT_STORE=supabase`, `NEXT_PUBLIC_SUPABASE_URL`, a publishable key (or legacy anon key), and the server-only `SUPABASE_SERVICE_ROLE_KEY`; there is no in-memory production fallback.
- Production migrations are not deployed by the Next.js app. Never seed generated practice fixtures into production.
