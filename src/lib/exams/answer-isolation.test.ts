import { describe, expect, it } from "vitest";
import { toSafeQuestion } from "./demo-data.mock";

describe("server-to-student exam question projection", () => {
  it("never serializes the authoritative multiple-choice answer key", () => {
    const safe = toSafeQuestion({
      id: "question-1",
      sectionId: "section-1",
      number: "1",
      type: "multiple_choice",
      stem: "Tính $1+1$.",
      options: [
        { key: "A", text: "2" },
        { key: "B", text: "3" },
      ],
      points: 0.25,
      correctOptionKey: "A",
    });

    expect(safe).not.toHaveProperty("correctOptionKey");
    expect(JSON.stringify(safe)).not.toContain("correctOptionKey");
  });

  it("never serializes true-false keys or accepted short-answer values", () => {
    const trueFalse = toSafeQuestion({
      id: "question-2",
      sectionId: "section-1",
      number: "2",
      type: "true_false",
      stem: "Xét các mệnh đề.",
      statements: [{ key: "a", text: "Mệnh đề a." }],
      points: 0.5,
      correctStatements: { a: true },
      scoring: { kind: "all_or_nothing" },
    });
    const shortAnswer = toSafeQuestion({
      id: "question-3",
      sectionId: "section-1",
      number: "3",
      type: "short_answer",
      stem: "Tính $x$.",
      points: 0.25,
      canonicalAnswer: "42",
      acceptedNormalizedAnswers: ["42", "042"],
    });

    expect(JSON.stringify(trueFalse)).not.toContain("correctStatements");
    expect(JSON.stringify(trueFalse)).not.toContain("scoring");
    expect(JSON.stringify(shortAnswer)).not.toContain("canonicalAnswer");
    expect(JSON.stringify(shortAnswer)).not.toContain("acceptedNormalizedAnswers");
  });
});
