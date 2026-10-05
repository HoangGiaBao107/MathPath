import { describe, expect, it } from "vitest";
import { createImproveWithAiContext, deriveStudentPersonalization } from "./personalization";
import type { StudentProgress } from "./types";

const emptyProgress: StudentProgress = {
  targetScore: null,
  totalAttempts: 0,
  averageScore: null,
  questionsAttempted: 0,
  correctCount: 0,
  partialCount: 0,
  incorrectCount: 0,
  trend: [],
  topics: [],
  historyTotal: 0,
  history: [],
};

describe("student progress personalization", () => {
  it("reports no fabricated statistics when there are no submitted attempts", () => {
    const summary = deriveStudentPersonalization(emptyProgress);
    expect(summary.accuracyPercent).toBeNull();
    expect(summary.errorPercent).toBeNull();
    expect(summary.weakestTopic).toBeNull();
    expect(summary.strongestTopic).toBeNull();
    expect(summary.scoreTrend).toBe("insufficient_data");
    expect(summary.nextPracticeTopic).toBeNull();
  });

  it("calculates answer accuracy and error percentages including partial answers", () => {
    const summary = deriveStudentPersonalization({
      ...emptyProgress,
      questionsAttempted: 10,
      correctCount: 6,
      partialCount: 2,
      incorrectCount: 2,
    });
    expect(summary.accuracyPercent).toBe(60);
    expect(summary.errorPercent).toBe(40);
  });

  it("identifies weak and strong topics from real accuracy and favors larger samples on ties", () => {
    const summary = deriveStudentPersonalization({
      ...emptyProgress,
      topics: [
        {
          topic: "Đạo hàm",
          questionCount: 5,
          correctCount: 4,
          partialCount: 0,
          incorrectCount: 1,
          unansweredCount: 0,
          accuracy: 80,
        },
        {
          topic: "Nguyên hàm",
          questionCount: 10,
          correctCount: 6,
          partialCount: 2,
          incorrectCount: 2,
          unansweredCount: 1,
          accuracy: 60,
        },
        {
          topic: "Hàm số",
          questionCount: 4,
          correctCount: 3,
          partialCount: 0,
          incorrectCount: 1,
          unansweredCount: 0,
          accuracy: 75,
        },
      ],
    });
    expect(summary.weakestTopic?.topic).toBe("Nguyên hàm");
    expect(summary.strongestTopic?.topic).toBe("Đạo hàm");
    expect(summary.nextPracticeTopic).toBe("Nguyên hàm");
  });

  it("calculates target gap and caps progress at the target", () => {
    const behind = deriveStudentPersonalization({
      ...emptyProgress,
      targetScore: 8.5,
      averageScore: 7.4,
    });
    expect(behind.scoreGap).toBe(1.1);
    expect(behind.targetProgressPercent).toBe(87.1);
    const achieved = deriveStudentPersonalization({
      ...emptyProgress,
      targetScore: 8,
      averageScore: 9.2,
    });
    expect(achieved.scoreGap).toBe(-1.2);
    expect(achieved.targetProgressPercent).toBe(100);
  });

  it("detects recent score direction from chronologically ordered submitted attempts", () => {
    const improving = deriveStudentPersonalization({
      ...emptyProgress,
      trend: [1, 2, 3, 4].map((score, index) => ({
        attemptId: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
        examTitle: "Đề thi thử",
        submittedAt: new Date(Date.UTC(2026, 0, index + 1)).toISOString(),
        score: score + 4,
      })),
    });
    expect(improving.scoreTrend).toBe("improving");
  });

  it("creates a Phase 9 contract without invoking or inventing AI data", () => {
    const context = createImproveWithAiContext(emptyProgress, "vi");
    expect(context).toEqual({
      feature: "progress_weak_topic",
      weakTopic: null,
      accuracyPercent: null,
      targetScore: null,
      currentAverage: null,
      sourceAttemptCount: 0,
      locale: "vi",
    });
  });
});
