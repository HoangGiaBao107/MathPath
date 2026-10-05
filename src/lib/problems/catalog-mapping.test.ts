import { describe, expect, it } from "vitest";
import type { ProblemSetRow } from "./database.types";
import { toPublicProblemSet } from "./catalog-mapping";

describe("Supabase problem set catalog mapping", () => {
  it("preserves published exam metadata and derives its visible question count", () => {
    const row: Pick<
      ProblemSetRow,
      | "id"
      | "slug"
      | "title"
      | "description"
      | "language"
      | "source_year"
      | "timing_mode"
      | "time_limit_seconds"
      | "estimated_duration_seconds"
      | "difficulty"
      | "topic"
      | "category"
      | "exam_metadata"
      | "created_at"
    > = {
      id: "set-1",
      slug: "exam-1",
      title: "Đề thi thử số 1",
      description: "Mô tả đã duyệt",
      language: "vi",
      source_year: 2027,
      timing_mode: "countdown",
      time_limit_seconds: 5400,
      estimated_duration_seconds: null,
      difficulty: "mixed",
      topic: "Toán THPT",
      category: "mock_exam",
      exam_metadata: { organization: "MathPath source", session: "Mã đề 01" },
      created_at: "2026-10-04T00:00:00.000Z",
    };

    const visible = toPublicProblemSet(row, 40);
    expect(visible).toMatchObject({
      id: "set-1",
      slug: "exam-1",
      title: "Đề thi thử số 1",
      description: "Mô tả đã duyệt",
      questionCount: 40,
      timingMode: "countdown",
      timeLimitMinutes: 90,
      examYear: 2027,
      examOrganization: "MathPath source",
      examSession: "Mã đề 01",
    });
    expect(JSON.stringify(visible)).not.toContain("correct_answer");
  });

  it("keeps elapsed practice timing without inventing a duration", () => {
    const row = {
      id: "set-2",
      slug: "practice-1",
      title: "Ôn tập Nguyên hàm số 1",
      description: null,
      language: "vi",
      source_year: null,
      timing_mode: "elapsed",
      time_limit_seconds: null,
      estimated_duration_seconds: null,
      difficulty: null,
      topic: "Nguyên hàm",
      category: "topic_review",
      exam_metadata: {},
      created_at: "2026-10-04T00:00:00.000Z",
    } as const satisfies Pick<
      ProblemSetRow,
      | "id"
      | "slug"
      | "title"
      | "description"
      | "language"
      | "source_year"
      | "timing_mode"
      | "time_limit_seconds"
      | "estimated_duration_seconds"
      | "difficulty"
      | "topic"
      | "category"
      | "exam_metadata"
      | "created_at"
    >;

    expect(toPublicProblemSet(row, 40)).toMatchObject({
      questionCount: 40,
      category: "topic_review",
      timingMode: "elapsed",
      timeLimitMinutes: null,
      estimatedDurationMinutes: null,
      difficulty: "mixed",
    });
  });
});
