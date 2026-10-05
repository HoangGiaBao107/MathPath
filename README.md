# MathPath

MathPath is a bilingual math-learning platform for Vietnamese high-school students preparing for THPTQG Mathematics.

## Current content state

The student-facing Problem Bank currently uses eight exams imported from the owner-supplied `Đề thi.docx`, with 22 questions per exam. Cards use the generic titles “Đề thi thử số 1” through “Đề thi thử số 8”; school names are not shown. These are local, ungraded previews and are not yet persisted to Supabase or approved for production publication.

The Word file is the sole source for these eight exams. The previous generated PDF previews are removed from the student-facing app. Original PDFs and their extraction archives are retained as inactive historical/source backups and are not used by the Word import.

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

2. Copy `.env.example` to `.env.local`. By default, `MATHPATH_ATTEMPT_STORE=mock` uses the development-only in-memory repository. It clears when the server restarts.

3. Start the development server:

   ```bash
   npm run dev
   ```

4. Open <http://localhost:3000/problems>, choose one of the eight exams, and inspect its ungraded question preview.

### Refresh the Word exam import

Install the Word parser dependency once:

```bash
python -m pip install -r requirements-word-import.txt
```

Then regenerate the safe student preview and private answer/explanation records:

```bash
npm run import:word-exams
```

On Windows, set `MATHPATH_PYTHON` to a Python executable with `python-docx` installed if `python` does not resolve to it. This command reads only `Đề thi.docx`; it does not read the PDFs, connect to Supabase, or approve/publish questions. It preserves the original Word file unchanged.

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
3. Seed synthetic demo questions with `npm run supabase:seed:demo`. This helper uses Node's TypeScript stripping support (Node 22.6+; validated with Node 24). It requires `.env.local` and sends only generated DEMO/MOCK content.
4. Start the app with `npm run dev`. To verify connectivity, load `/exams/demo-practice-20`, start an attempt, save an answer, refresh, and confirm the same attempt resumes. Submit to check persisted result.

The Supabase migration/seed have not been applied or verified against a database in this environment. No production Supabase project is configured. Do not report durable Supabase persistence as active until you complete these setup steps.

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
See [PDF ingestion architecture](docs/architecture/PDF_INGESTION.md) for the synthetic fixture pipeline and local review screen.

### Legacy synthetic PDF ingestion (Phase 6A)

Install the local parser/rendering dependencies once:

```bash
python -m pip install -r requirements-pdf.txt
```

Then run the synthetic fixture pipeline:

```bash
npm run ingest:pdf -- content/fixtures/demo-ingestion-fixture.pdf
```

On Windows, if Python is not on `PATH`, set `MATHPATH_PYTHON` to the Python executable first. Outputs are written to `content/extracted/demo-ingestion-fixture/`. To inspect crops and locally review the generated records, run `npm run dev` and open <http://localhost:3000/admin/ingestion-review/demo-ingestion-fixture>. Local review changes stay in the extracted fixture JSON and never change database or publication state.

Run the full fixture-focused and existing test suites with `npm test`. Regenerate the committed synthetic PDF only when intentionally changing the test source with `npm run ingest:fixture:generate`.

### Legacy real-source PDF review ingestion (Phase 6B)

This PDF workflow is retained only for historical reference and is not the source for the current student-facing exams.

With the 12 owner-supplied PDFs in the repository root and Python dependencies installed from `requirements-pdf.txt`, run:

```bash
npm run ingest:real-sources
```

PDF ingestion is retained for the synthetic fixture only. The 12 recognized student exam sets come from the approved Word sources and their curated imports; removed PDF drafts are not part of the student bank. The local review tools remain available for future content work, but PDF fixture imports stay unpublished.

The local parser does not perform OCR or publish/import into Supabase. Scanned sources that have no extractable text, missing answers, uncertain visual classification, and other parser warnings remain flagged for human review. The master manifest reports conflicts as unchecked unless a dedicated source conflict review has been completed.

## Business rules (configuration only)

- Guest: 5 total AI requests.
- Registered Free: 5 AI requests per day.
- No one-time signup bonus.
- Plus: 70,000 VND/month and 15 requests/day.
- Pro: 100,000 VND/month and 25 requests/day.
- Pro Max: 125,000 VND/month and 50 requests/day.
- Future daily quota resets use `Asia/Ho_Chi_Minh`.

`src/lib/credits/types.ts` and the plan rows in the migration define configuration only; request enforcement, AI calls, payment processing, and credit transactions are not implemented here.

## Security and deployment status

- Never commit `.env.local`, API keys, service-role keys, webhook secrets, or provider credentials.
- Variables prefixed with `NEXT_PUBLIC_` are browser-visible and must not contain secrets.
- Official answer keys and explanations are moved to the non-API `private` schema and denied to `anon`/`authenticated` roles.
- Public RLS exposes only reviewed, published, rights-cleared questions and problem sets; client-side score calculation is not part of Phase 3.
- Real exam sets require a 90-minute countdown; practice sets use elapsed-time semantics with any displayed duration marked as an estimate.
- Supabase migrations are authored only. They have not been applied to local or production databases; production Supabase is not configured.
- Production attempt APIs require `MATHPATH_ATTEMPT_STORE=supabase`, `NEXT_PUBLIC_SUPABASE_URL`, a publishable key (or legacy anon key), and the server-only `SUPABASE_SERVICE_ROLE_KEY`; there is no in-memory production fallback.
- Local Supabase CLI validation requires installing/running the CLI separately. No migration deployment is performed by the app.
