# PDF ingestion pipeline — Phase 6A

## Scope and safety boundary

This phase tests extraction with `content/fixtures/demo-ingestion-fixture.pdf` only. The PDF is authored for tests and labels every page **DEMO INGESTION FIXTURE — NOT OFFICIAL**. The CLI rejects files located under `content/source-pdfs/`; no supplied source exam PDF was read, copied, or imported. The pipeline writes filesystem artifacts only and has no database adapter or publish command.

Every generated question starts with `provenance_status = source_imported`, `review_status = needs_review`, and `publication_status = draft`; its containing set remains `unpublished`. The additive `draft` publication state reflects the ingestion request while preserving the existing non-published boundary. The local review screen stores a separate `local_review_status`; its “reviewed” action never approves the import contract or changes publication state. Answers in this synthetic fixture are extracted from its own labelled key page, not inferred.

## Architecture

```text
Synthetic PDF
  -> Node CLI guard / Python runner
  -> pdfplumber text and layout extraction
  -> section + question segmentation
  -> source answer-key parsing
  -> one 180-DPI page render reused for all regions
  -> per-question crop and multi-page vertical composition
  -> structured import JSON + answer key + review report
  -> development-only local review route
```

- `scripts/ingest-pdf.mjs` validates the command and protects `content/source-pdfs/`, then calls the Python worker.
- `scripts/pdf_ingestion.py` uses `pdfplumber` for text lines and PDF vector/image objects. Section headings and `Câu n.` markers define section-local question numbers. Questions are emitted in source reading order with a separate global `order_index`.
- A question continues onto later pages until the next question or section heading. The crop combines those page regions top-to-bottom in page order. Pages are rendered once at 180 DPI and reused; only detected question regions are saved as PNG.
- Part I options on the same text line are separated by option markers. Part II `a/b/c/d` lines are kept inside one question. Answer keys are parsed only from the explicitly labelled answer-key section.
- Illustration checks count meaningful embedded-image/vector layout objects within the question's regions. A phrase that refers to a graph/figure without corresponding visual layout is marked `possibly_missing`. This is a review signal, not an image-generation step.
- Stable set/question IDs are derived from the source path and section/question identity. Re-running on the same input overwrites the same files rather than appending duplicate records; when the source hash is unchanged, local text/answer edits and review decisions are preserved. A changed source hash starts fresh review state.
- `src/lib/problems/import-schema.ts` remains the import validator. Its additive fields include multiple source pages, crop path, illustration/extraction state, local review state, and the `source_imported` provenance state. The corresponding Postgres enum migration is additive and has not been applied to any database.

## Outputs

For the synthetic fixture the CLI writes:

```text
content/extracted/demo-ingestion-fixture/
  questions/q01.png ... q07.png
  illustrations/q03.png
  answer-key.json
  extraction-report.json
  questions.json
```

The fixture currently has four pages and seven questions (Part I: 3, Part II: 2, Part III: 2). Question 3 spans pages 1–2; Part II question 2 explicitly refers to an intentionally absent graph. The report includes page/section/question/key/crop/illustration/review counts, warnings, pages rendered, approximate rendered memory, and elapsed processing time.

## Local review UI

`/admin/ingestion-review/[slug]` is available only while `NODE_ENV=development` and only for a valid generated output directory. It displays the crop, extracted statement, choices or substatements, extracted answer, source pages, extraction/illustration/review states. Review actions write only to `questions.json`; edited answer JSON is validated against the import contract. Every record remains `review_status=needs_review` and `publication_status=draft`. Local approve is only a review note; it is not an admin approval or publish action. Its API and image route return 404 in production.

## Commands and prerequisites

```bash
python -m pip install -r requirements-pdf.txt
npm run ingest:pdf -- content/fixtures/demo-ingestion-fixture.pdf
npm test
```

The fixture PDF is checked in. To regenerate it intentionally, use `npm run ingest:fixture:generate` with Python and ReportLab installed. If Python is not on `PATH`, set `MATHPATH_PYTHON` to the interpreter path for ingestion and ingestion tests.

## Future path and limitations

After explicit owner approval for Phase 6B, a future adapter can convert reviewed JSON into a database repository, preserving source order, provenance, rights state, and publication gates. Database writes and publishing are intentionally absent here.

This tested parser is a text-PDF/layout heuristic, not a general OCR system. Scanned-only PDFs, complicated multi-column layouts, unusual section labels, encrypted files, and complex diagram clipping need separate fixtures/QA and possibly OCR/layout tooling. `possibly_missing` is a heuristic: visual content drawn outside a detected question region or using text-only diagrams may need human review. No source answer is ever inferred when the key parser finds none.
