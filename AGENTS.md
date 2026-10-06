# MathPath — Codex project instructions

Read these files before making changes:
1. PROJECT_SPEC_V2.md — authoritative product/technical specification.
2. MATHPATH_CONTENT_INGESTION_V1.md — rules for importing the current problem-bank source files.
3. reference/mathpath-logo-reference.png — visual reference for the current MathPath logo concept.

Start with Phase 0, then Phase 1, then Phase 2 unless the owner explicitly requests another phase.
Do not implement payment, production AI, or full content ingestion before the core architecture and UI shell are stable.

Important content rule:
- The recognized exam sets are sourced from approved Word documents. Do not ingest or use PDFs for question content.
- Do not silently invent missing answer keys.
- Preserve source ordering and mark uncertainty instead of guessing.

Before finishing any implementation task:
- run typecheck
- run lint
- run tests where available
- run production build
- fix errors
- summarize changed files and validation results

Never expose API keys or service credentials in client code or source control.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
