# MathPath original bank — checkpoint 2026-10-23

## Release preparation — 2026-10-24

- Vercel login confirmed: team `hgb4`, project `math-path`, production domain `mathpath.com.vn`, configured Git production branch `main`. Previous live deployment: `dpl_HUtTdSLkYCrMpRvTHPwHEQ3wnA5b` (commit `0440e55`).
- Created task branch `codex/mathpath-original-bank`; staged only task code/assets/scripts, excluding unrelated auth/payment changes and NBV tooling. Deployment excludes private local data/backups via `.vercelignore`.
- Exact staged snapshot lint/build passed. Current bank QA: 19/634/57, 0 errors, 3 template-distribution warnings. Earlier UI/flow tests and 18 related tests passed.
- Fresh production backup: `tmp/mathpath-backups/production-20261024/database.dump`, SHA-256 `dcdbef93f3a66ef6435697bea066a16b646a85712d5d8fe79f2d42155f852d33`. Restored to independent loopback database, activation/rollback rehearsal passed again; all 48 attempts remain readable. Production preflight: 12 active sets, 336 questions, 25 users, 48 attempts, 0 Vault secrets and 0 Storage objects.
- Live existing AI chat smoke check returned HTTP 200, nonempty answer and guest remaining credit 4. New per-attempt hint/chat integration still requires post-deploy validation.
- This entry records preparation only; use subsequent release evidence to establish actual push/deployment/activation.

## Compact result hub and dedicated detail pages

- Owner requested small entry cards instead of displaying every panel initially. Overview now renders only score/counts and three links: review, analysis, study.
- Dedicated routes: `/progress/attempts/[attemptId]/[view]` and Local `/dev/exam-lab/[attemptId]/[view]`, where view is `review`, `analysis` or `study`. Each request retains server-side ownership and submitted-result checks; unknown views return 404. Detail navigation and back-to-overview links preserve the attempt ID.
- Updated `student-attempt-result.tsx`, `result-question-review.tsx`, Local result page, `result-design-copy.ts`, `globals.css`, browser test; added both detail route pages and `src/lib/analytics/result-view.ts`.
- Lint/typecheck/build passed. Related Vitest tests: 18/18. Browser cases THI_01/OTC_04_01 at 1440/390px passed: compact initial content, three-card navigation, analysis, review/hints, separate study/chat, reload, return to overview, denial to a different anonymous session. AI remains HTTP-mocked in these tests.
- Visual screenshots reviewed: `result-hub-THI_01-1440.png`, `result-hub-THI_01-390.png`, `result-chat-THI_01-1440.png` in `tmp/mathpath-new`. No production deployment or bank changes.

## Latest UI refinement (owner screenshots)

- Local bank now has responsive exam cards, title/code search and all/mock/topic filters. Client props include catalog metadata only; no answer keys.
- Result heading uses separate rows for back navigation, eyebrow, title and date to fix overlapping inline text.
- Review AI has a section-grouped question sidebar, an explicit eight-question limit, draft prompt suggestions, a styled composer and a mobile stacked layout. The picker now matches its description by including only missed/partial/unanswered questions with review content.
- Changed files: `src/app/dev/mathpath-bank/page.tsx`, `src/components/exams/bank-preview-catalog.tsx`, `src/components/analytics/result-question-review.tsx`, `src/lib/i18n/result-design-copy.ts`, `src/app/globals.css`, `scripts/mathpath-bank-e2e.cjs`, this checkpoint.
- Lint, typecheck and production build passed after this UI change. Related tests: 18 passed across four files. Browser flow: THI_01/OTC_04_01 at 1440/390px passed, including hints/chat with HTTP test doubles; catalog count/filter/search and no horizontal overflow passed at both sizes. No live AI-provider claim. The missing legacy `Đề thi.docx` suite was not included in this focused test run.
- Screenshots: `tmp/mathpath-new/catalog-{width}.png`, `result-chat-{exam}-{width}.png`, `result-heading-{exam}-{width}.png`. Local server runs separately at 127.0.0.1:3211 with remote database credentials blanked. No deployment or production-bank mutation for this UI refinement.

## Scope

Use only `MATHPATH_19_DE_MOI_634_CAU_CODEX.zip`. Do not resume NBV extraction.
Canonical edited input: `content/extracted/mathpath-new-20261022/questions.json`.
The original manifest is preserved; the derivative manifest is written separately.
No individual teacher review is asserted. Automatic checks and sampled agent visual review are separate evidence.

## Results

- Independent PostgreSQL Local: 19 sets, 634 questions, 634 keys, 634 solutions, 57 assets.
- First import: THI_01, 22 questions. Repeated import: no duplicate rows.
- Different content with an existing stable ID is rejected, rather than silently ignored.
- Actual SQL attempt functions: all 19 exams submitted, graded 10/10 with correct answers, solutions returned; historical results remain readable after archiving sets.
- Anonymous access to private keys denied; unpublished questions invisible.
- 324 multiple-choice option/key equivalence checks pass; all 282 short keys parse safely. Official 4-character input and true/false score curve retained.
- 3,760 math blocks pass strict KaTeX; 57 PNG assets decode and map by source question ID.
- Visual sample: 62 questions covering 47 subtopics and all 19 exams; 57 image thumbnails inspected. This is not individual manual certification of all 634 questions.
- Browser: THI_01 and OTC_04_01 at 1440px and 390px; answer hiding, saving, submission, result, math and image loading pass. Three hint levels and chat render using explicit HTTP test doubles.
- AI credit reservation, refund and exhausted-credit rejection tested with mocked RPC/provider boundaries. Live provider calls are not verified.
- Fixed passive quota fetch creating competing guest cookies; regression test added.
- Lint, typecheck and production build pass. Full test run: 206 tests pass; the old Word-import suite cannot start because `Đề thi.docx` is missing. Do not describe the whole suite as passing.

## Data repairs

- 3 impossible class sizes corrected: OTC_02_02_C38, OTC_02_03_C38, OTC_02_03_C39. Answers unchanged.
- 10 solutions corrected to use the names in their questions.
- 17 solutions use `\text{đáy}` instead of Unicode inside `\mathrm`.
- 174 questions received derivative superscript / plain-text emphasis formatting fixes (228 fields). Answer keys unchanged.
- Per-exam JSON and Markdown editions synchronized with canonical JSON.
- No old question bank records were replaced or deleted.

## Resume locally

1. Keep the ZIP and edited extracted directory. Install JS dependencies with `npm ci`; Python requirements are in `scripts/mathpath-requirements.txt`.
2. `python scripts/check-mathpath-package.py`
3. `python scripts/repair-mathpath-bank.py` and `python scripts/format-mathpath-bank.py` are repeatable repairs; they do not regenerate the bank.
4. `python scripts/check-mathpath-symbolic.py`, then `npm run mathpath:qa`.
5. `npm run mathpath:local-db` creates a disposable PGlite PostgreSQL database with the repository migrations. Auth functions are stubbed in this independent database only.
6. `npx vitest run scripts/mathpath-bank.test.mjs src/lib/ai/reservation-flow.test.ts --maxWorkers=1`.
7. `npm run mathpath:local-server`, then `node scripts/mathpath-bank-e2e.cjs` using a Playwright installation and Chrome. The launcher explicitly blanks Supabase credentials so `.env.local` cannot connect the test server to production.
8. Local page: `http://127.0.0.1:3211/dev/mathpath-bank`.

On this Windows sandbox, set TEMP and TMP to the existing `.codex-test-temp` directory before Vitest; the default sandbox temporary cache caused unrelated ENOENT failures. Do not suppress actual test failures.

## Evidence and release status

Local reports and screenshots: `tmp/mathpath-new/` (ignored by Git). Important files: `validation.json`, `symbolic.json`, `package-integrity.json`, `local-db.json`, `local-flow.json`, `browser-e2e.json`, `tests.json`, `visual-sample-plan.json`.

Production backup now exists at `tmp/mathpath-backups/production-20261023/database.dump`, with role definitions and SHA-256 manifest. Portable PostgreSQL 17.11 was obtained from the official EDB binary distribution because Docker/Podman is absent. `pg_dump --role=postgres` completed with no errors. The private temporary connection plan was removed after backup. Managed backups were unavailable and PITR disabled.

Restore rehearsal passed on independent PostgreSQL at 127.0.0.1:54329: 12 sets, 336 questions, 25 users, 48 attempts. Managed Vault is excluded from the Windows restore because that extension is unavailable; production Vault contains 0 secret rows. Production Storage contains 0 buckets/objects. The original archive remains intact, including its Vault entries. Local role grantors were adapted; production roles were not changed.

Migration/activation/rollback rehearsal passed: 12/336 old bank → 19/634 new bank → 12/336 old bank. Full row fingerprints of users, profiles, attempts, submitted answers and results remained identical. All 48 old attempts remained readable. Evidence: `tmp/mathpath-new/release-rehearsal.json`. New migration `20261023000100_preserve_archived_exam_attempts.sql` allows archived runtime only after the existing owner check; fresh attempts still require published exams.

Production migration inventory was read only. It lacks the new result/input-policy/figure migrations, and also lacks `20261008000300_enable_published_exam_runtime.sql`. Apply only reviewed task migrations after backup; do not blindly push unrelated pending payment migrations.

Earlier local browser runs inherited the shared Supabase environment: passive `/api/ai/quota` calls may have created guest credit-account rows. Exam attempts were stored locally and bank records were not modified. The isolated launcher replaces that setup. Do not claim that every earlier request was isolated from production.

Production deploy is pending: `npx vercel whoami` reports Logged out; no linked Vercel project configuration was found. Production branch must be confirmed. Remote default is main, but the current task started on `codex/vietqr-quicklink-preview`, which contains additional commits. Do not assume the Vercel production branch from the remote default. Working tree includes unrelated auth/payment changes; select task changes explicitly, including only relevant CSS/package hunks. Production URL recorded in the repository: `https://mathpath.com.vn`; the new bank is not published there.

Next release steps: confirm Vercel login/project/production branch; finish separate task commit validation; refresh the production backup immediately before live changes; deploy reviewed code/assets and apply only task migrations/import/activation in the coordinated release; run real authenticated post-deploy checks including AI. Prepared SQL: `activate.sql`, `rollback.sql` under `tmp/mathpath-new`, generated by `scripts/prepare-mathpath-release.mjs`. These scripts never apply changes remotely. Keep student accounts and historical references intact.

## Latest execution checkpoint

- User reports the live website works again; no new-bank production deployment has been performed by this task.
- Latest lint and typecheck passed. The earlier production build passed; the latest build after the archived-attempt change compiled and typechecked, then failed during prerender with sandbox `EPERM` creating `.next/server/app/_not-found.segments/_not-found`. It must be rerun successfully before release.
- Updated bank integration tests pass (3 tests), including archived owned-attempt access, denial to a different owner and exclusion of archived sets from new runtime lookup. AI credit tests previously pass (4 tests).
- Creating branch `codex/mathpath-original-bank` was NOT executed: automatic approval review could not complete due to its usage limit. This was a review infrastructure failure, not a safety rejection. The subsequent elevated build call in the same orchestration was not executed either. Do not bypass that review failure.
- No files were staged and no commit/push was performed. Current branch remains the original `codex/vietqr-quicklink-preview` unless changed externally.
- A pending question asks the user to log in with `npx vercel login` and identify the Vercel project and production branch. Their report that the website works is not evidence that CLI authentication or project linkage is configured.
- When selective staging becomes available: exclude auth/payment files, `src/lib/problems/database.types.ts` payment RPC change, payment-only CSS lines, and the unrelated `nbv:qa` package-script addition. Preserve all of those working-tree changes. Include task result/AI/exam changes, four task migrations, new-bank scripts and the 57 new assets. Do not stage private backups or raw connection plans.
