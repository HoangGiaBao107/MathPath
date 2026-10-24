import { describe, expect, it } from "vitest";
import { buildAttemptAiContext } from "./attempt-ai-context";
import type { StudentAttemptResult } from "./types";

const attempt: StudentAttemptResult = {
  attemptId: "f19c83f5-a9e7-42f3-a2cf-69e65edfe8ba",
  examSlug: "sample-exam",
  examTitle: "Đề mẫu",
  submittedAt: "2026-10-20T08:00:00.000Z",
  durationSeconds: 600,
  status: "submitted",
  result: {
    score: 0.25,
    totalScore: 1,
    correctCount: 0,
    partialCount: 0,
    incorrectCount: 1,
    unansweredCount: 0,
    questionCount: 1,
    percentage: 25,
    sectionOutcomes: [],
    knowledgeOutcomes: [],
    questionOutcomes: [
      {
        questionId: "sample-q1",
        sectionId: "section-1",
        questionNumber: "1",
        topic: "Hàm số",
        subtopic: null,
        state: "incorrect",
        pointsEarned: 0,
        pointsPossible: 1,
        review: {
          questionType: "multiple_choice",
          statement: "Tính $1+1$.",
          options: [
            { key: "A", text: "1" },
            { key: "B", text: "2" },
          ],
          substatements: [],
          assets: [],
          selectedAnswer: { optionKey: "A" },
          correctAnswer: { option_key: "B" },
          explanation: "Cộng hai số hạng.",
        },
      },
    ],
  },
};

describe("buildAttemptAiContext", () => {
  it("uses only missed questions from the requested submitted attempt", () => {
    const context = buildAttemptAiContext(attempt, ["sample-q1"]);
    expect(context).not.toBeNull();
    const parsed = JSON.parse(context as string) as {
      examTitle: string;
      questions: { questionId: string; verifiedCorrectAnswer: Record<string, unknown> | null }[];
    };
    expect(parsed.examTitle).toBe("Đề mẫu");
    expect(parsed.questions).toEqual([
      expect.objectContaining({
        questionId: "sample-q1",
        verifiedCorrectAnswer: { option_key: "B" },
      }),
    ]);
  });

  it("rejects question IDs outside the attempt and duplicate IDs", () => {
    expect(buildAttemptAiContext(attempt, ["another-attempt-q1"])).toBeNull();
    expect(buildAttemptAiContext(attempt, ["sample-q1", "sample-q1"])).toBeNull();
  });

  it("allows hints for correct questions when explicitly requested", () => {
    const completed = structuredClone(attempt);
    completed.result.questionOutcomes[0].state = "correct";
    expect(buildAttemptAiContext(completed, ["sample-q1"])).toBeNull();
    expect(buildAttemptAiContext(completed, ["sample-q1"], true)).not.toBeNull();
  });

  it("does not invent an answer when the key is unverified", () => {
    const unverified = structuredClone(attempt);
    unverified.result.questionOutcomes[0].review!.correctAnswer = null;
    const context = buildAttemptAiContext(unverified, ["sample-q1"]);
    expect(context).toContain('"verifiedCorrectAnswer": null');
  });
});
