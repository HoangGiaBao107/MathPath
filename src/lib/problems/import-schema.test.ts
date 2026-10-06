import { describe, expect, it } from "vitest";
import { validateProblemSetImport } from "./import-schema";

const setId = "29bc2ae7-4a2b-41df-8d0f-f29a1a6a30c6";

function importEnvelope(questions: unknown[]) {
  return {
    format_version: 1,
    problem_set: {
      id: setId,
      slug: "import-review-set",
      title: "Bộ đề đang chờ duyệt",
      description: null,
      language: "vi",
      category: "topic_review",
      source_type: "practice_book",
      source_year: null,
      timing_mode: "elapsed",
      time_limit_seconds: null,
      estimated_duration_seconds: 1800,
      exam_metadata: {},
      source_document: "review-source-only.docx",
      provenance_status: "pending_review",
      publication_rights_status: "pending_review",
      review_status: "needs_review",
      publication_status: "unpublished",
    },
    questions,
  };
}

function importedQuestion(overrides: Record<string, unknown> = {}) {
  return {
    id: "question-1",
    problem_set_id: setId,
    section: "Part I",
    question_number: "1",
    order_index: 0,
    statement: "Câu hỏi chỉ dùng để kiểm tra cấu trúc import.",
    question_type: "multiple_choice",
    options: [
      { key: "A", text: "Lựa chọn A", order_index: 0 },
      { key: "B", text: "Lựa chọn B", order_index: 1 },
    ],
    substatements: [],
    correct_answer: { type: "multiple_choice", option_key: "A" },
    explanation: null,
    topic: "Hàm số",
    difficulty: "medium",
    tags: ["minh-hoa"],
    source_document: "test-fixture-only.docx",
    source_page: 1,
    source_question_number: "1",
    source_type: "practice_book",
    provenance_status: "pending_review",
    publication_rights_status: "pending_review",
    review_status: "needs_review",
    publication_status: "unpublished",
    ...overrides,
  };
}

describe("problem set import validation", () => {
  it("accepts supported answer formats while requiring import review", () => {
    const result = validateProblemSetImport(
      importEnvelope([
        importedQuestion(),
        importedQuestion({
          id: "question-2",
          question_number: "2",
          order_index: 1,
          question_type: "true_false",
          options: [],
          substatements: [
            { key: "a", text: "Mệnh đề a", order_index: 0 },
            { key: "b", text: "Mệnh đề b", order_index: 1 },
          ],
          correct_answer: { type: "true_false", statements: { a: true, b: false } },
        }),
        importedQuestion({
          id: "question-3",
          question_number: "3",
          order_index: 2,
          question_type: "short_answer",
          options: [],
          correct_answer: {
            type: "short_answer",
            accepted_values: ["0.5"],
            case_sensitive: false,
            tolerance: 0.001,
          },
        }),
      ]),
    );

    expect(result.success).toBe(true);
  });

  it("does not invent an answer when the source key is missing", () => {
    const result = validateProblemSetImport(
      importEnvelope([importedQuestion({ correct_answer: null, review_status: "needs_review" })]),
    );

    expect(result.success).toBe(true);
  });

  it("rejects duplicate question identifiers, numbers, and ordering", () => {
    const result = validateProblemSetImport(
      importEnvelope([
        importedQuestion(),
        importedQuestion({ id: "question-1", question_number: "1", order_index: 0 }),
      ]),
    );

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues.length).toBeGreaterThanOrEqual(3);
  });

  it("rejects invalid answer references and automatic publication", () => {
    const result = validateProblemSetImport(
      importEnvelope([
        importedQuestion({
          correct_answer: { type: "multiple_choice", option_key: "Z" },
          content_review_status: "approved",
          publication_status: "published",
          publication_rights_status: "unknown",
        }),
      ]),
    );

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues.length).toBeGreaterThanOrEqual(2);
  });

  it("requires countdown mode to have a time limit and practice mode to have none", () => {
    const set = importEnvelope([importedQuestion()]);
    const payload = {
      ...set,
      problem_set: {
        ...set.problem_set,
        timing_mode: "countdown",
        time_limit_seconds: null,
      },
    };
    expect(validateProblemSetImport(payload).success).toBe(false);
  });

  it("requires real exam imports to use a 90-minute countdown", () => {
    const set = importEnvelope([importedQuestion()]);
    const exam = {
      ...set,
      problem_set: {
        ...set.problem_set,
        category: "mock_exam",
        source_type: "official_exam",
        timing_mode: "countdown",
        time_limit_seconds: 90 * 60,
        estimated_duration_seconds: null,
      },
    };
    expect(validateProblemSetImport(exam).success).toBe(true);
    expect(
      validateProblemSetImport({
        ...exam,
        problem_set: { ...exam.problem_set, time_limit_seconds: 60 * 60 },
      }).success,
    ).toBe(false);
  });
});
