export type ReviewAnswer = Record<string, unknown> | null | undefined;

export function isSelectedOption(answer: ReviewAnswer, key: string): boolean {
  return answer?.optionKey === key || answer?.option_key === key;
}

export function isCorrectOption(answer: ReviewAnswer, key: string): boolean {
  return answer?.option_key === key;
}

export function getTrueFalseAnswer(answer: ReviewAnswer, key: string): boolean | null {
  const statements = answer?.statements;
  if (!statements || typeof statements !== "object") return null;
  const value = (statements as Record<string, unknown>)[key];
  return typeof value === "boolean" ? value : null;
}

export function getShortAnswer(answer: ReviewAnswer): string | null {
  return typeof answer?.raw === "string" ? answer.raw : null;
}

export function getAcceptedAnswers(answer: ReviewAnswer): string[] {
  const values = answer?.accepted_values;
  return Array.isArray(values) ? values.filter((value): value is string => typeof value === "string") : [];
}
