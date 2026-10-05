import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { problemSetImportSchema } from "./import-schema";
import {
  hydrateDisplayLayers,
  isStudentQuestionPublishable,
  mergeDisplayDraft,
  selectStudentDisplay,
  validateDisplayQuestion,
  validateDisplayDraft,
} from "./display-content";
import type { ImportedProblem } from "./import-schema";

const d10 = JSON.parse(
  readFileSync(
    path.join(process.cwd(), "content/extracted/demo-ingestion-fixture/questions.json"),
    "utf8",
  ),
);
const baseQuestion = problemSetImportSchema.parse(d10).questions[0];
const d10Questions = problemSetImportSchema.parse(d10).questions;
const topicData = JSON.parse(
  readFileSync(
    path.join(process.cwd(), "content/extracted/demo-ingestion-fixture/questions.json"),
    "utf8",
  ),
);
const topicQuestions = problemSetImportSchema.parse(topicData).questions;

describe("editable question display layers", () => {
  it("keeps the raw source and answer unchanged while Vietnamese display text is edited", () => {
    const question = hydrateDisplayLayers(baseQuestion);
    const raw = {
      statement: question.raw_statement,
      options: structuredClone(question.raw_options),
      answer: structuredClone(question.correct_answer),
    };
    const display = {
      statement: "Câu 1: Cho hàm số f(x).",
      options: question.display_options_vi!,
      statements: question.display_true_false_statements_vi!,
      shortAnswerPrompt: question.display_short_answer_prompt_vi!,
      explanation: question.display_explanation_vi!,
    };
    const saved = mergeDisplayDraft(question, "vi", display, "2026-10-04T00:00:00.000Z");
    expect(saved.display_statement_vi).toBe(display.statement);
    expect(saved.raw_statement).toBe(raw.statement);
    expect(saved.raw_options).toEqual(raw.options);
    expect(saved.correct_answer).toEqual(raw.answer);
    expect(question.display_statement_vi).not.toBe(display.statement);
    expect(saved.content_review_status).toBe("needs_review");
  });

  it("allows each option and true/false statement display value to be edited independently", () => {
    const question = hydrateDisplayLayers(baseQuestion);
    const options = question.display_options_vi!.map((item) => ({ ...item }));
    options[0] = { ...options[0], text: "Chỉnh riêng lựa chọn A: $x^2$." };
    const saved = mergeDisplayDraft(
      question,
      "vi",
      {
        statement: question.display_statement_vi!,
        options,
        statements: question.display_true_false_statements_vi!,
        shortAnswerPrompt: question.display_short_answer_prompt_vi!,
        explanation: question.display_explanation_vi!,
      },
      "2026-10-04T00:00:00.000Z",
    );
    expect(saved.display_options_vi?.[0].text).toBe("Chỉnh riêng lựa chọn A: $x^2$.");
    expect(saved.display_options_vi?.[1].text).toBe(question.display_options_vi?.[1].text);
    expect(saved.options).toEqual(question.options);
  });

  it("keeps true/false statements grouped and edits each statement independently", () => {
    const question = hydrateDisplayLayers(
      d10Questions.find((item) => item.question_type === "true_false")!,
    );
    const statements = question.display_true_false_statements_vi!.map((item) => ({ ...item }));
    statements[0] = { ...statements[0], text: "Mệnh đề a đã được đối chiếu." };
    const saved = mergeDisplayDraft(
      question,
      "vi",
      {
        statement: question.display_statement_vi!,
        options: [],
        statements,
        shortAnswerPrompt: question.display_short_answer_prompt_vi!,
        explanation: question.display_explanation_vi!,
      },
      "2026-10-04T00:00:00.000Z",
    );
    expect(saved.display_true_false_statements_vi?.[0].text).toBe("Mệnh đề a đã được đối chiếu.");
    expect(saved.display_true_false_statements_vi?.[1].text).toBe(
      question.display_true_false_statements_vi?.[1].text,
    );
    expect(saved.correct_answer).toEqual(question.correct_answer);
  });

  it("keeps short-answer prompt separate from its extracted raw statement and key", () => {
    const question = hydrateDisplayLayers(
      topicQuestions.find((item) => item.question_type === "short_answer")!,
    );
    const saved = mergeDisplayDraft(
      question,
      "vi",
      {
        statement: question.display_statement_vi!,
        options: [],
        statements: [],
        shortAnswerPrompt: "Tính nguyên hàm đã được biên tập riêng.",
        explanation: question.display_explanation_vi!,
      },
      "2026-10-04T00:00:00.000Z",
    );
    expect(saved.display_short_answer_prompt_vi).toBe("Tính nguyên hàm đã được biên tập riêng.");
    expect(saved.raw_short_answer_prompt).toBe(question.raw_short_answer_prompt);
    expect(saved.correct_answer).toEqual(question.correct_answer);
  });

  it("loads damaged extraction questions for repair but refuses content approval until repaired", () => {
    const damaged = hydrateDisplayLayers(
      topicQuestions.find((item) => item.question_type === "multiple_choice")!,
    );
    damaged.options = [];
    damaged.raw_options = [];
    damaged.display_options_vi = [];
    const incomplete = {
      statement: damaged.display_statement_vi!,
      options: damaged.display_options_vi!,
      statements: [],
      shortAnswerPrompt: "",
      explanation: null,
    };
    expect(validateDisplayDraft(damaged, incomplete)).toContain("Add at least two answer options.");
    const repaired = validateDisplayDraft(damaged, {
      ...incomplete,
      options: [
        { key: "A", text: "Lựa chọn A", order_index: 0 },
        { key: "B", text: "Lựa chọn B", order_index: 1 },
      ],
    });
    expect(repaired).toEqual([]);
  });

  it("keeps English hidden until approved, then selects the reviewed English fields", () => {
    const question = hydrateDisplayLayers(baseQuestion);
    const english = selectStudentDisplay(
      {
        ...question,
        display_statement_en: "Reviewed English statement",
        translation_status: "manually_reviewed",
      },
      "en",
    );
    expect(english.locale).toBe("vi");
    expect(english.statement).toBe(question.display_statement_vi);
    const approved = selectStudentDisplay(
      {
        ...question,
        display_statement_en: "Approved English statement",
        translation_status: "approved",
      },
      "en",
    );
    expect(approved.locale).toBe("en");
    expect(approved.statement).toBe("Approved English statement");
  });

  it("requires exact math-token preservation before marking an English draft reviewed", () => {
    const question = {
      ...hydrateDisplayLayers(baseQuestion),
      content_review_status: "approved" as const,
      display_statement_vi: String.raw`Cho vectơ $\vec{a}=(1;2;3)$.`,
    };
    const draft = {
      statement: String.raw`Let vector $\vec{a}=(1;2;3)$.`,
      options: question.display_options_vi!.map((item) => ({
        ...item,
        text: `Option ${item.key}`,
      })),
      statements: question.display_true_false_statements_vi!,
      shortAnswerPrompt: question.display_short_answer_prompt_vi!,
      explanation: question.display_explanation_vi!,
    };
    expect(
      mergeDisplayDraft(question, "en", draft, "2026-10-04T00:00:00.000Z").translation_status,
    ).toBe("manually_reviewed");
    expect(() =>
      mergeDisplayDraft(
        question,
        "en",
        { ...draft, statement: "Let vector $a=(1;2;3)." },
        "2026-10-04T00:00:00.000Z",
      ),
    ).toThrow("math_translation_mismatch");
  });

  it("keeps invalid English math as an unapproved draft", () => {
    const question = {
      ...hydrateDisplayLayers(baseQuestion),
      content_review_status: "approved" as const,
      display_statement_vi: "$x^$",
    };
    const saved = mergeDisplayDraft(
      question,
      "en",
      {
        statement: "$x^$",
        options: question.display_options_vi!.map((item) => ({
          ...item,
          text: `Option ${item.key}`,
        })),
        statements: [],
        shortAnswerPrompt: "",
        explanation: null,
      },
      "2026-10-04T00:00:00.000Z",
    );
    expect(saved.translation_status).toBe("manually_reviewed");
    expect(selectStudentDisplay(saved, "en").locale).toBe("vi");
  });

  it("marks malformed notation as needing review and keeps drafts outside the student gate", () => {
    const question = hydrateDisplayLayers(baseQuestion);
    expect(
      validateDisplayQuestion({ ...question, display_statement_vi: "$\\frac{1}{2$" }),
    ).not.toHaveLength(0);
    expect(isStudentQuestionPublishable(question)).toBe(false);
    expect(
      isStudentQuestionPublishable({
        ...question,
        review_status: "approved",
        content_review_status: "approved",
        publication_status: "published",
        publication_rights_status: "approved_for_publication",
        provenance_status: "verified",
        correct_answer: question.correct_answer,
        display_statement_vi: "Reviewed, valid question.",
      } as ImportedProblem),
    ).toBe(true);
  });
});
