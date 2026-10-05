import { describe, expect, it } from "vitest";
import { mockExams } from "./demo-data.mock";
import { scoreExam } from "./scoring";
import type { ExamAnswer, ExamDefinition } from "./types";

const official = mockExams[0];
const practice = mockExams[1];

function allCorrectAnswers(exam: ExamDefinition): Record<string, ExamAnswer> {
  return Object.fromEntries(
    exam.questions.map((question) => [
      question.id,
      question.type === "multiple_choice"
        ? { type: "multiple_choice", optionKey: question.correctOptionKey }
        : question.type === "true_false"
          ? { type: "true_false", statements: question.correctStatements }
          : { type: "short_answer", raw: question.canonicalAnswer },
    ]),
  );
}

describe("server-side exam scoring", () => {
  it("awards configured MCQ points and gives zero for wrong or unanswered", () => {
    const question = official.questions[0];
    if (question.type !== "multiple_choice") throw new Error("Expected a multiple-choice question");
    expect(
      scoreExam(official, {
        [question.id]: { type: "multiple_choice", optionKey: question.correctOptionKey },
      }).score,
    ).toBe(0.25);
    expect(
      scoreExam(official, { [question.id]: { type: "multiple_choice", optionKey: "B" } }).score,
    ).toBe(0);
    expect(scoreExam(official, {}).unansweredCount).toBe(22);
  });

  it.each([
    [4, 1],
    [3, 0.5],
    [2, 0.25],
    [1, 0.1],
    [0, 0],
  ])("scores official true/false with %i correct statements as %f", (correctCount, expected) => {
    const question = official.questions.find((item) => item.type === "true_false");
    if (!question || question.type !== "true_false")
      throw new Error("Expected a true/false question");
    const statements = Object.fromEntries(
      question.statements.map((item, index) => [
        item.key,
        index < correctCount
          ? question.correctStatements[item.key]
          : !question.correctStatements[item.key],
      ]),
    );
    const result = scoreExam(official, {
      [question.id]: { type: "true_false", statements },
    });
    expect(result.score).toBe(expected);
  });

  it("uses 12×0.25 + 4×partial + 6×0.5 for a 10-point THPTQG configuration", () => {
    const result = scoreExam(official, allCorrectAnswers(official));
    expect(result).toMatchObject({
      score: 10,
      totalScore: 10,
      correctCount: 22,
      questionCount: 22,
    });
    expect(result.sectionOutcomes.map((section) => section.pointsEarned)).toEqual([3, 4, 3]);
  });

  it("scores 20 practice questions at 0.5 each and requires all T/F statements", () => {
    expect(practice.questions).toHaveLength(20);
    expect(scoreExam(practice, allCorrectAnswers(practice)).score).toBe(10);
    const tf = practice.questions.find((question) => question.type === "true_false");
    if (!tf || tf.type !== "true_false") throw new Error("Expected a true/false question");
    expect(
      scoreExam(practice, {
        [tf.id]: { type: "true_false", statements: { ...tf.correctStatements, a: false } },
      }).score,
    ).toBe(0);
  });

  it("honors custom school-exam section totals and per-question scoring", () => {
    const custom: ExamDefinition = {
      id: "custom-test",
      title: "Custom scoring test",
      description: "Fixture",
      mode: "school_mock",
      demo: true,
      timingMode: "elapsed",
      durationSeconds: null,
      totalScore: 2,
      sections: [
        { id: "s1", title: "A", description: "", maxScore: 0.75 },
        { id: "s2", title: "B", description: "", maxScore: 1.25 },
      ],
      questions: [
        {
          id: "q1",
          sectionId: "s1",
          number: "1",
          type: "multiple_choice",
          stem: "",
          options: [{ key: "x", text: "x" }],
          correctOptionKey: "x",
          points: 0.75,
        },
        {
          id: "q2",
          sectionId: "s2",
          number: "2",
          type: "short_answer",
          stem: "",
          canonicalAnswer: "4",
          points: 1.25,
        },
      ],
    };
    expect(
      scoreExam(custom, {
        q1: { type: "multiple_choice", optionKey: "x" },
        q2: { type: "short_answer", raw: "4" },
      }),
    ).toMatchObject({ score: 2, totalScore: 2 });
  });

  it("counts incorrect, partial, and blank answers by knowledge subtopic", () => {
    const question = official.questions[0];
    if (question.type !== "multiple_choice") throw new Error("Expected a multiple-choice question");
    const taggedExam: ExamDefinition = {
      ...official,
      questions: [
        { ...question, topic: "Hàm số", subtopic: "Đạo hàm" },
        { ...question, id: "q-tagged-2", number: "2", topic: "Hàm số", subtopic: "Đạo hàm" },
      ],
      sections: [
        { ...official.sections[0], maxScore: question.points * 2 },
      ],
    };
    const result = scoreExam(taggedExam, {
      [question.id]: { type: "multiple_choice", optionKey: "wrong-option" },
    });
    expect(result.knowledgeOutcomes).toEqual([
      {
        topic: "Hàm số",
        subtopic: "Đạo hàm",
        questionCount: 2,
        incorrectCount: 1,
        partialCount: 0,
        unansweredCount: 1,
      },
    ]);
  });
});
