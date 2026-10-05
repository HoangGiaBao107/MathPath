import { validateMathContent } from "./math-content";
import { preservesDelimitedMath } from "./math-content";
import type { ImportedProblem } from "./import-schema";

export function hydrateDisplayLayers(question: ImportedProblem): ImportedProblem {
  const options = question.raw_options ?? question.options;
  const statements = question.raw_true_false_statements ?? question.substatements;
  const sourceStatement = question.statement || question.raw_statement || "";
  return {
    ...question,
    raw_statement: question.raw_statement ?? sourceStatement,
    display_statement_vi: question.display_statement_vi ?? sourceStatement,
    display_statement_en: question.display_statement_en ?? "",
    raw_options: options,
    display_options_vi: question.display_options_vi ?? question.options,
    display_options_en:
      question.display_options_en ?? options.map((item) => ({ ...item, text: "" })),
    raw_true_false_statements: statements,
    display_true_false_statements_vi:
      question.display_true_false_statements_vi ?? question.substatements,
    display_true_false_statements_en:
      question.display_true_false_statements_en ??
      statements.map((item) => ({ ...item, text: "" })),
    raw_short_answer_prompt: question.raw_short_answer_prompt ?? sourceStatement,
    display_short_answer_prompt_vi: question.display_short_answer_prompt_vi ?? sourceStatement,
    display_short_answer_prompt_en: question.display_short_answer_prompt_en ?? "",
    raw_explanation: question.raw_explanation ?? question.explanation,
    display_explanation_vi: question.display_explanation_vi ?? question.explanation,
    display_explanation_en: question.display_explanation_en ?? "",
    translation_status: question.translation_status ?? "not_started",
    content_review_status: question.content_review_status ?? "needs_review",
  };
}

type DisplayQuestion = Pick<
  ImportedProblem,
  | "question_type"
  | "correct_answer"
  | "display_statement_vi"
  | "statement"
  | "display_options_vi"
  | "options"
  | "display_true_false_statements_vi"
  | "substatements"
  | "display_short_answer_prompt_vi"
  | "display_explanation_vi"
  | "explanation"
>;

export function validateDisplayQuestion(question: DisplayQuestion) {
  const display: DisplayDraft = {
    statement: question.display_statement_vi ?? question.statement,
    options: question.display_options_vi ?? question.options,
    statements: question.display_true_false_statements_vi ?? question.substatements,
    shortAnswerPrompt: question.display_short_answer_prompt_vi ?? question.statement,
    explanation: question.display_explanation_vi ?? question.explanation,
  };
  return validateDisplayDraft(question, display);
}

export function validateDisplayDraft(question: DisplayQuestion, draft: DisplayDraft): string[] {
  const issues: string[] = [];
  if (!draft.statement.trim()) issues.push("Question statement is required.");
  if (question.question_type === "multiple_choice") {
    if (draft.options.length < 2) issues.push("Add at least two answer options.");
    if (draft.options.some((option) => !option.text.trim()))
      issues.push("Every answer option needs text.");
    if (new Set(draft.options.map((option) => option.key)).size !== draft.options.length)
      issues.push("Answer option labels must be unique.");
    const answer = question.correct_answer;
    if (
      answer?.type === "multiple_choice" &&
      !draft.options.some((option) => option.key === answer.option_key)
    ) {
      issues.push("The verified answer key must match one of the displayed options.");
    }
  } else if (question.question_type === "true_false") {
    if (!draft.statements.length) issues.push("Add the true/false statements.");
    if (draft.statements.some((item) => !item.text.trim()))
      issues.push("Every true/false statement needs text.");
    if (new Set(draft.statements.map((item) => item.key)).size !== draft.statements.length)
      issues.push("True/false labels must be unique.");
    if (question.correct_answer?.type === "true_false") {
      const expected = draft.statements.map((item) => item.key).sort();
      const answerKeys = Object.keys(question.correct_answer.statements).sort();
      if (
        expected.length !== answerKeys.length ||
        expected.some((key, index) => key !== answerKeys[index])
      ) {
        issues.push("The verified true/false key must match each displayed statement.");
      }
    }
  } else if (!draft.shortAnswerPrompt.trim()) {
    issues.push("The short-answer prompt is required.");
  }
  const fields = [
    draft.statement,
    ...draft.options.map((item) => item.text),
    ...draft.statements.map((item) => item.text),
    draft.shortAnswerPrompt,
    draft.explanation ?? "",
  ];
  fields.forEach((field) => {
    const validation = validateMathContent(field);
    issues.push(...validation.issues);
  });
  return [...new Set(issues)];
}

export function selectStudentDisplay(question: ImportedProblem, locale: "vi" | "en") {
  const englishApproved = locale === "en" && question.translation_status === "approved";
  const english = (candidate: string | null | undefined, fallback: string | null) =>
    englishApproved && candidate?.trim() ? candidate : fallback;
  const useEnglish = englishApproved && Boolean(question.display_statement_en?.trim());
  return {
    locale: useEnglish ? "en" : "vi",
    statement: english(
      question.display_statement_en,
      question.display_statement_vi ?? question.statement,
    ),
    options: question.options.map((item, index) => ({
      ...item,
      text: english(
        question.display_options_en?.[index]?.text,
        question.display_options_vi?.[index]?.text ?? item.text,
      ),
    })),
    trueFalseStatements: question.substatements.map((item, index) => ({
      ...item,
      text: english(
        question.display_true_false_statements_en?.[index]?.text,
        question.display_true_false_statements_vi?.[index]?.text ?? item.text,
      ),
    })),
    shortAnswerPrompt: english(
      question.display_short_answer_prompt_en,
      question.display_short_answer_prompt_vi ?? question.statement,
    ),
    explanation: english(
      question.display_explanation_en,
      question.display_explanation_vi ?? question.explanation,
    ),
  };
}

export function isStudentQuestionPublishable(question: ImportedProblem): boolean {
  const visualsAreReady = ["not_required", "present"].includes(
    question.illustration_status ?? "not_required",
  );
  return (
    question.content_review_status === "approved" &&
    question.review_status === "approved" &&
    question.publication_status === "published" &&
    question.publication_rights_status === "approved_for_publication" &&
    question.provenance_status === "verified" &&
    question.correct_answer !== null &&
    visualsAreReady &&
    validateDisplayQuestion(question).length === 0
  );
}

export type DisplayDraft = {
  statement: string;
  options: NonNullable<ImportedProblem["options"]>;
  statements: NonNullable<ImportedProblem["substatements"]>;
  shortAnswerPrompt: string;
  explanation: string | null;
};

export function mergeDisplayDraft(
  question: ImportedProblem,
  locale: "vi" | "en",
  draft: DisplayDraft,
  editedAt: string,
): ImportedProblem {
  if (!draft.statement.trim()) throw new Error("display_statement_required");
  if (locale === "vi") {
    return {
      ...question,
      display_statement_vi: draft.statement,
      display_options_vi: draft.options,
      display_true_false_statements_vi: draft.statements,
      display_short_answer_prompt_vi: draft.shortAnswerPrompt,
      display_explanation_vi: draft.explanation,
      content_review_status: "needs_review",
      content_approved_at: null,
      translation_status:
        question.translation_status === "not_started" ? "not_started" : "machine_draft",
      translation_approved_at: null,
      translation_approved_by: null,
      local_review_status: "needs_review",
      edited_at: editedAt,
      edited_by: null,
    };
  }
  if (question.content_review_status !== "approved")
    throw new Error("vietnamese_content_not_approved");
  const vi = {
    statement: question.display_statement_vi ?? question.statement,
    options: question.display_options_vi ?? question.options,
    statements: question.display_true_false_statements_vi ?? question.substatements,
    prompt: question.display_short_answer_prompt_vi ?? question.statement,
    explanation: question.display_explanation_vi ?? question.explanation,
  };
  const translationIncomplete =
    !draft.statement.trim() ||
    draft.options.some((item) => !item.text.trim()) ||
    draft.statements.some((item) => !item.text.trim()) ||
    (question.question_type === "short_answer" && !draft.shortAnswerPrompt.trim()) ||
    (vi.explanation !== null && !draft.explanation?.trim());
  if (translationIncomplete) throw new Error("english_translation_incomplete");
  const pairs: Array<[string, string]> = [
    [vi.statement, draft.statement],
    ...vi.options.map(
      (item, index) => [item.text, draft.options[index]?.text ?? ""] as [string, string],
    ),
    ...vi.statements.map(
      (item, index) => [item.text, draft.statements[index]?.text ?? ""] as [string, string],
    ),
    [vi.prompt, draft.shortAnswerPrompt],
    ...(vi.explanation ? [[vi.explanation, draft.explanation ?? ""] as [string, string]] : []),
  ];
  if (pairs.some(([source, translation]) => !preservesDelimitedMath(source, translation))) {
    throw new Error("math_translation_mismatch");
  }
  return {
    ...question,
    display_statement_en: draft.statement,
    display_options_en: draft.options,
    display_true_false_statements_en: draft.statements,
    display_short_answer_prompt_en: draft.shortAnswerPrompt,
    display_explanation_en: draft.explanation,
    translation_status: "manually_reviewed",
    translation_approved_at: null,
    translation_approved_by: null,
    edited_at: editedAt,
    edited_by: null,
  };
}
