import { describe, expect, it } from "vitest";
import { validateAnswerForQuestion } from "./answer-validation";
import { mockExams } from "./demo-data.mock";

describe("server answer validation", () => {
  const exam = mockExams[0];

  it("accepts only an option that belongs to this multiple-choice question", () => {
    const question = exam.questions.find((item) => item.type === "multiple_choice");
    if (!question || question.type !== "multiple_choice") throw new Error("Expected MCQ fixture");
    expect(
      validateAnswerForQuestion(question, { type: "multiple_choice", optionKey: "A" }).valid,
    ).toBe(true);
    expect(
      validateAnswerForQuestion(question, { type: "multiple_choice", optionKey: "Z" }),
    ).toEqual({
      valid: false,
      code: "invalid_option",
    });
  });

  it("accepts partial true/false maps but rejects unknown keys and non-booleans", () => {
    const question = exam.questions.find((item) => item.type === "true_false");
    if (!question || question.type !== "true_false") throw new Error("Expected T/F fixture");
    expect(
      validateAnswerForQuestion(question, { type: "true_false", statements: { a: true } }).valid,
    ).toBe(true);
    expect(
      validateAnswerForQuestion(question, { type: "true_false", statements: { z: true } }).valid,
    ).toBe(false);
    expect(
      validateAnswerForQuestion(question, { type: "true_false", statements: { a: "true" } }).valid,
    ).toBe(false);
  });

  it("accepts comma or dot decimals and rejects overlong short answers", () => {
    const question = exam.questions.find((item) => item.type === "short_answer");
    if (!question || question.type !== "short_answer")
      throw new Error("Expected short-answer fixture");
    expect(validateAnswerForQuestion(question, { type: "short_answer", raw: "0,7" }).valid).toBe(
      true,
    );
    expect(validateAnswerForQuestion(question, { type: "short_answer", raw: "-0.3" }).valid).toBe(
      true,
    );
    expect(validateAnswerForQuestion(question, { type: "short_answer", raw: "12345" }).valid).toBe(
      false,
    );
  });
});
