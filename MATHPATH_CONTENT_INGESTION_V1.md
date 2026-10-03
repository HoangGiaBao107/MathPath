# MATHPATH — Content Ingestion V1

## Source files received in the current conversation

1. `de-thi-thu-tot-nghiep-thpt-2026-mon-toan-truong-thpt-phan-dang-luu-tp-hcm.pdf`
   - 3 pages
   - Exam paper (Phan Dang Luu, HCMC)
   - The supplied PDF contains the exam pages but no answer-key page was detected in the provided file.
   - Treat any answer subsequently derived by the assistant as independently verified, not as a source-provided key.

2. `de-thi-thu-tot-nghiep-thpt-2026-mon-toan-truong-thpt-nguyen-trung-truc-tp-hcm.pdf`
   - 7 pages
   - Exam + answer/reference section.
   - Part I key: 1D 2A 3C 4C 5C 6D 7C 8B 9C 10D 11D 12B.
   - Part II and Part III keys are present in the document and must be imported from the source.
   - The source states the answer section is supplied by AI Gemini Pro; preserve provenance in admin metadata.

3. `de-thi-thu-tn-thpt-2026-mon-toan-lan-2-truong-thpt-duong-quang-ham-hung-yen.pdf`
   - 17 pages
   - Exam + answer/reference + detailed solution section.
   - Part I key: 1A 2D 3A 4C 5A 6A 7A 8C 9D 10C 11D 12A.
   - Part II and Part III keys are present.
   - Detailed worked solutions are present and can be used as source material for concise student-facing explanations.
   - The source states the answer/solution section was produced by AI Gemini Pro; preserve provenance in admin metadata.

4. `de-thi-thu-tn-thpt-2026-mon-toan-lan-3-lien-truong-thpt-chuyen-da-nang.pdf`
   - 19 pages
   - Exam + answer/reference + detailed solution section.
   - Page 5 contains a compact key for code 1016; detailed solutions follow.
   - Preserve the source answer key exactly after validating transcription.
   - Detailed solutions can be used to produce concise student-facing explanations.

## Important mismatch to resolve

The user referred to the final uploaded file as a “sách ôn chương Hàm số”, but the fourth file currently present in the conversation is actually another **THPT 2026 Mathematics exam** from liên trường THPT chuyên Đà Nẵng. It is not a Hàm số review book.

Therefore:
- Do not treat file 4 as the Hàm số book.
- Wait for the actual Hàm số review-book PDF/images.
- Once the book is received, ingest its questions into a separate `topic = ham_so` question pool.

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
