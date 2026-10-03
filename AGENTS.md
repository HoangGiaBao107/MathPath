# MathPath — Codex project instructions

Read these files before making changes:
1. PROJECT_SPEC_V2.md — authoritative product/technical specification.
2. MATHPATH_CONTENT_INGESTION_V1.md — rules for importing the current problem-bank source files.
3. reference/mathpath-logo-reference.png — visual reference for the current MathPath logo concept.

Start with Phase 0, then Phase 1, then Phase 2 unless the owner explicitly requests another phase.
Do not implement payment, production AI, or full content ingestion before the core architecture and UI shell are stable.

Important content rule:
- The four PDFs in content/source-pdfs are source materials only.
- Do not silently invent missing answer keys.
- The Phan Dang Luu PDF currently has no visible answer-key section in the supplied file, so do not fabricate an official answer key for it.
- The current supplied Da Nang PDF is an exam file, not the promised "book for the Hàm số chapter". Do not treat it as the Hàm số practice book.
- When official problem-bank data is later imported, preserve source ordering and mark uncertainty instead of guessing.

Before finishing any implementation task:
- run typecheck
- run lint
- run tests where available
- run production build
- fix errors
- summarize changed files and validation results

Never expose API keys or service credentials in client code or source control.
