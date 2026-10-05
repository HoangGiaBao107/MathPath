import { validateShortAnswer } from "./short-answer";
import type { ExamAnswer, SafeExamQuestion } from "./types";

export type AnswerValidationResult =
  { valid: true; answer: ExamAnswer | null } | { valid: false; code: string };

export function validateAnswerForQuestion(
  question: SafeExamQuestion,
  candidate: unknown,
): AnswerValidationResult {
  if (candidate === null) return { valid: true, answer: null };
  if (!candidate || typeof candidate !== "object") return { valid: false, code: "invalid_answer" };

  if (question.type === "multiple_choice") {
    const value = candidate as Partial<Extract<ExamAnswer, { type: "multiple_choice" }>>;
    if (value.type !== "multiple_choice" || typeof value.optionKey !== "string") {
      return { valid: false, code: "invalid_answer" };
    }
    return question.options.some((option) => option.key === value.optionKey)
      ? { valid: true, answer: { type: "multiple_choice", optionKey: value.optionKey } }
      : { valid: false, code: "invalid_option" };
  }

  if (question.type === "true_false") {
    const value = candidate as Partial<Extract<ExamAnswer, { type: "true_false" }>>;
    if (value.type !== "true_false" || !value.statements || typeof value.statements !== "object") {
      return { valid: false, code: "invalid_answer" };
    }
    const entries = Object.entries(value.statements);
    if (
      entries.some(
        ([key, answer]) =>
          !question.statements.some((statement) => statement.key === key) ||
          typeof answer !== "boolean",
      )
    ) {
      return { valid: false, code: "invalid_answer" };
    }
    return { valid: true, answer: { type: "true_false", statements: Object.fromEntries(entries) } };
  }

  const value = candidate as Partial<Extract<ExamAnswer, { type: "short_answer" }>>;
  if (value.type !== "short_answer" || typeof value.raw !== "string") {
    return { valid: false, code: "invalid_answer" };
  }
  if (value.raw === "") return { valid: true, answer: null };
  const validation = validateShortAnswer(value.raw);
  return validation.valid
    ? { valid: true, answer: { type: "short_answer", raw: validation.raw } }
    : { valid: false, code: validation.reason };
}
