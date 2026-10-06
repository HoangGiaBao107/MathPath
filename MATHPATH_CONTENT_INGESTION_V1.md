# MathPath — Content Ingestion V1

## Approved source format

- Use only owner-approved Word (`.docx`) documents for problem-bank question content.
- Do not ingest, parse, extract, transcribe, or publish questions from PDF files.
- The PDF ingestion scripts, fixtures, tests, and review workflow have been retired.

## Import safeguards

- Preserve the source ordering and exact source question numbers.
- Import only answer keys present in the approved Word source; never invent missing keys.
- Preserve answer and explanation provenance. Mark uncertainty for manual review rather than guessing.
- Keep source documents and private answer keys out of public/client bundles.
- Use the approved Word import scripts and existing review/validation workflow. Do not modify the question bank without explicit authorization.

## Problem-bank behavior

Official exam sets:
- Each exam is a fixed `ProblemSet`.
- Official answers are stored server-side.
- Exam scoring uses the stored answer key, not AI judgment.
- Each question stores a concise explanation.
- Where the source has a worked solution, derive the concise explanation from the source and preserve source provenance.

Hàm số practice pool:
- Store each question independently with topic/chapter metadata.
- When the student chooses “Ôn tập Hàm số”, randomly select 20 eligible questions from the pool.
- Do not repeat the same question within one generated 20-question session.
- Prefer a balanced sample by difficulty/subtopic when enough questions exist.
- Persist the selected question IDs for the attempt so refresh/reconnect does not silently regenerate the exam.
- Score against stored answers.
- After submission, allow explanation and AI similar-practice.

## Recommended schema additions

ProblemSet:
- id
- title
- source_name
- source_type (`official_exam`, `practice_book`)
- year
- subject
- language
- duration
- description
- provenance_note
- active

Problem:
- id
- problem_set_id nullable
- source_reference
- order_index
- section
- stem
- options
- correct_answer
- explanation
- topic
- subtopic
- difficulty
- tags
- source_page
- provenance_note
- is_active

PracticePool:
- topic
- subtopic
- difficulty
- problem_id

## Content QA requirements

Before publishing any imported question:
1. Verify transcription against the source image/page.
2. Verify answer key.
3. Verify mathematical notation.
4. Check option order.
5. Check images/diagrams.
6. Create concise explanation.
7. Check topic and difficulty tags.
8. Flag ambiguity instead of guessing.

## Public-site rights

Because these are real exam papers and the final Hàm số book may be copyrighted, the owner should confirm that they have the necessary permission/licensing to republish the full question content and images publicly on MathPath. The system should support an admin field for `publication_rights_status` and avoid automatically publishing content whose rights have not been confirmed.
