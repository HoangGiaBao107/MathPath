# MathPath content import boundary

This directory contains the versioned import contract only. There are no source documents, transcriptions, answer keys, or real question records here. Student question content is sourced from approved Word documents only.

- `problem-set.schema.json` describes the interchange format.
- `src/lib/problems/import-schema.ts` is the executable Zod validator. `validateProblemSetImport` reports malformed shapes, unsupported question/answer formats, missing provenance, duplicate IDs/numbers/order, invalid option references, and attempts to approve or publish on import.
- An import record carries its source document, page, source question number, provenance and rights status. Unknown or unresolved answers remain `null` and must stay `needs_review`; the importer never supplies or guesses a key.
- Accepted records remain in a draft/review state: review is `draft` or `needs_review`, and question publication state is `draft` or `unpublished`. Published/archived records are rejected. There is no import-to-database writer.

Before an approved Word import, preserve source order, independently verify answers against the source key, check rights, review symbols/diagrams, run the validator, and obtain explicit review approval. PDF content must not be imported.
