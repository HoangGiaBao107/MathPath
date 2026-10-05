import { z } from "zod";
import type {
  ProblemDifficulty,
  PublicationRightsStatus,
  QuestionType,
  ReviewStatus,
} from "./types";
import { REAL_EXAM_TIME_LIMIT_SECONDS } from "../config/exam";

const answerSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("multiple_choice"), option_key: z.string().min(1) }),
  z.object({ type: z.literal("true_false"), statements: z.record(z.string(), z.boolean()) }),
  z.object({
    type: z.literal("short_answer"),
    accepted_values: z.array(z.string().min(1)).min(1),
    case_sensitive: z.boolean().default(false),
    tolerance: z.number().nonnegative().optional(),
  }),
]);

const optionSchema = z.object({
  key: z.string().min(1),
  text: z.string(),
  order_index: z.number().int().nonnegative(),
});
const displayOptionSchema = optionSchema.extend({ text: z.string() });
const substatementSchema = z.object({
  key: z.string().min(1),
  text: z.string(),
  order_index: z.number().int().nonnegative(),
});
const displaySubstatementSchema = substatementSchema.extend({ text: z.string() });

const translationStatusSchema = z.enum([
  "not_started",
  "machine_draft",
  "manually_reviewed",
  "approved",
]);

const importedProblemSetSchema = z
  .object({
    id: z.string().uuid(),
    slug: z.string().min(1),
    title: z.string().min(1),
    description: z.string().nullable(),
    language: z.enum(["vi", "en"]),
    category: z.enum(["mock_exam", "chapter_review", "topic_review", "comprehensive"]),
    source_type: z.enum(["official_exam", "practice_book", "generated"]),
    source_year: z.number().int().min(1900).max(2200).nullable(),
    timing_mode: z.enum(["countdown", "elapsed"]),
    time_limit_seconds: z.number().int().positive().nullable(),
    estimated_duration_seconds: z.number().int().positive().nullable(),
    exam_metadata: z.record(z.string(), z.unknown()),
    source_document: z.string().nullable(),
    source_id: z.string().min(1).optional(),
    source_kind: z.enum(["exam", "topic_practice"]).optional(),
    topic: z.string().nullable().optional(),
    exact_source_filename: z.string().min(1).optional(),
    source_title: z.string().nullable().optional(),
    provenance_status: z.enum(["source_imported", "unknown", "pending_review", "verified"]),
    publication_rights_status: z.enum([
      "unknown",
      "pending_review",
      "approved_for_internal",
      "approved_for_publication",
      "restricted",
    ]),
    review_status: z.enum(["draft", "needs_review"]),
    publication_status: z.literal("unpublished"),
  })
  .superRefine((problemSet, context) => {
    if (problemSet.timing_mode === "countdown" && problemSet.time_limit_seconds === null) {
      context.addIssue({
        code: "custom",
        path: ["time_limit_seconds"],
        message: "Countdown exam sets require a time limit.",
      });
    }
    if (problemSet.timing_mode === "elapsed" && problemSet.time_limit_seconds !== null) {
      context.addIssue({
        code: "custom",
        path: ["time_limit_seconds"],
        message: "Practice sets use an elapsed timer, not a countdown limit.",
      });
    }
    if (
      problemSet.category === "mock_exam" &&
      (problemSet.timing_mode !== "countdown" ||
        problemSet.time_limit_seconds !== REAL_EXAM_TIME_LIMIT_SECONDS)
    ) {
      context.addIssue({
        code: "custom",
        path: ["time_limit_seconds"],
        message: "Real exam sets use a 90-minute countdown.",
      });
    }
    if (problemSet.publication_status !== "unpublished") {
      context.addIssue({
        code: "custom",
        path: ["publication_status"],
        message: "Imported sets must remain unpublished.",
      });
    }
  });

const importedQuestionSchema = z.object({
  id: z.string().min(1),
  problem_set_id: z.string().uuid(),
  section: z.string().min(1).nullable(),
  question_number: z.string().min(1),
  order_index: z.number().int().nonnegative(),
  statement: z.string(),
  raw_statement: z.string().optional(),
  display_statement_vi: z.string().optional(),
  display_statement_en: z.string().optional(),
  raw_options: z.array(optionSchema).optional(),
  display_options_vi: z.array(displayOptionSchema).optional(),
  display_options_en: z.array(displayOptionSchema).optional(),
  raw_true_false_statements: z.array(substatementSchema).optional(),
  display_true_false_statements_vi: z.array(displaySubstatementSchema).optional(),
  display_true_false_statements_en: z.array(displaySubstatementSchema).optional(),
  raw_short_answer_prompt: z.string().optional(),
  display_short_answer_prompt_vi: z.string().optional(),
  display_short_answer_prompt_en: z.string().optional(),
  raw_explanation: z.string().nullable().optional(),
  display_explanation_vi: z.string().nullable().optional(),
  display_explanation_en: z.string().nullable().optional(),
  translation_status: translationStatusSchema.default("not_started"),
  content_review_status: z.enum(["needs_review", "approved"]).default("needs_review"),
  edited_at: z.string().datetime().nullable().optional(),
  edited_by: z.string().nullable().optional(),
  content_approved_at: z.string().datetime().nullable().optional(),
  translation_approved_at: z.string().datetime().nullable().optional(),
  translation_approved_by: z.string().nullable().optional(),
  question_type: z.enum(["multiple_choice", "true_false", "short_answer"]),
  options: z.array(optionSchema),
  substatements: z.array(substatementSchema),
  correct_answer: answerSchema.nullable(),
  explanation: z.string().min(1).nullable(),
  explanation_provenance: z
    .enum(["source_solution", "ai_generated_source_solution", "unknown", "missing"])
    .nullable()
    .optional(),
  raw_answer: z.unknown().optional(),
  topic: z.string().min(1).nullable(),
  difficulty: z.enum(["easy", "medium", "hard"]).nullable(),
  tags: z.array(z.string().min(1)),
  source_document: z.string().min(1),
  source_file_hash: z
    .string()
    .regex(/^[a-f0-9]{64}$/i)
    .optional(),
  source_page: z.number().int().positive(),
  source_question_number: z.string().min(1),
  source_id: z.string().min(1).optional(),
  source_pages: z.array(z.number().int().positive()).min(1).optional(),
  source_page_images: z.array(z.string().min(1)).optional(),
  answer_provenance: z
    .enum([
      "source_answer_key",
      "source_answer",
      "source_solution",
      "ai_generated_source_solution",
      "source_editorial_correction",
      "manually_verified",
      "missing",
      "unknown",
    ])
    .optional(),
  image_path: z.string().min(1).optional(),
  illustration_prompt: z.string().nullable().optional(),
  editorial_notes: z.array(z.string()).optional(),
  illustration_status: z
    .enum(["not_required", "present", "possibly_missing", "missing", "needs_review"])
    .optional(),
  extraction_status: z.enum(["extracted", "needs_review", "error"]).optional(),
  extraction_warnings: z.array(z.string()).optional(),
  local_review_status: z.enum(["pending", "approved", "needs_review"]).optional(),
  source_type: z.enum(["official_exam", "practice_book", "generated"]),
  provenance_status: z.enum(["source_imported", "unknown", "pending_review", "verified"]),
  publication_rights_status: z.enum([
    "unknown",
    "pending_review",
    "approved_for_internal",
    "approved_for_publication",
    "restricted",
  ]),
  review_status: z.enum(["draft", "needs_review", "approved"]),
  publication_status: z.enum(["draft", "unpublished", "published", "archived"]),
});

export type ImportedProblem = z.infer<typeof importedQuestionSchema>;
export type ImportedProblemSet = z.infer<typeof importedProblemSetSchema>;
export type ProblemSetImport = {
  format_version: 1;
  problem_set: ImportedProblemSet;
  questions: ImportedProblem[];
};

const compatibleQuestionTypes: Record<QuestionType, string> = {
  multiple_choice: "multiple_choice",
  true_false: "true_false",
  short_answer: "short_answer",
};

export const problemSetImportSchema = z
  .object({
    format_version: z.literal(1),
    problem_set: importedProblemSetSchema,
    questions: z.array(importedQuestionSchema),
  })
  .superRefine((data, context) => {
    const identifiers = new Set<string>();
    const questionNumbers = new Set<string>();
    const ordering = new Set<string>();

    data.questions.forEach((question, index) => {
      const basePath = ["questions", index] as const;
      if (question.problem_set_id !== data.problem_set.id) {
        context.addIssue({
          code: "custom",
          path: [...basePath, "problem_set_id"],
          message: "Question must reference this import's problem set.",
        });
      }
      if (identifiers.has(question.id)) {
        context.addIssue({
          code: "custom",
          path: [...basePath, "id"],
          message: "Duplicate question identifier.",
        });
      }
      identifiers.add(question.id);

      const questionIdentity = `${question.problem_set_id}:${question.section ?? ""}:${question.question_number}`;
      if (questionNumbers.has(questionIdentity)) {
        context.addIssue({
          code: "custom",
          path: [...basePath, "question_number"],
          message: "Duplicate question number within the section.",
        });
      }
      questionNumbers.add(questionIdentity);

      const orderIdentity = `${question.problem_set_id}:${question.section ?? ""}:${question.order_index}`;
      if (ordering.has(orderIdentity)) {
        context.addIssue({
          code: "custom",
          path: [...basePath, "order_index"],
          message: "Duplicate order within the section.",
        });
      }
      ordering.add(orderIdentity);

      if (
        question.options.some(
          (option, optionIndex) =>
            question.options.findIndex((candidate) => candidate.key === option.key) !== optionIndex,
        )
      ) {
        context.addIssue({
          code: "custom",
          path: [...basePath, "options"],
          message: "Option keys must be unique within a question.",
        });
      }
      if (
        question.substatements.some(
          (statement, statementIndex) =>
            question.substatements.findIndex((candidate) => candidate.key === statement.key) !==
            statementIndex,
        )
      ) {
        context.addIssue({
          code: "custom",
          path: [...basePath, "substatements"],
          message: "Substatement keys must be unique within a question.",
        });
      }

      const displayOptions = question.display_options_vi ?? question.options;
      const displayStatements = question.display_true_false_statements_vi ?? question.substatements;
      const contentApproved = question.content_review_status === "approved";
      if (
        question.question_type === "multiple_choice" &&
        displayOptions.length < 2 &&
        (contentApproved || question.review_status === "approved")
      ) {
        context.addIssue({
          code: "custom",
          path: [...basePath, "options"],
          message: "Multiple-choice questions require at least two options.",
        });
      }
      if (
        question.question_type !== "multiple_choice" &&
        question.options.length > 0 &&
        (contentApproved || question.review_status === "approved")
      ) {
        context.addIssue({
          code: "custom",
          path: [...basePath, "options"],
          message: "Only multiple-choice questions may have options.",
        });
      }
      if (
        question.question_type === "true_false" &&
        displayStatements.length === 0 &&
        (contentApproved || question.review_status === "approved")
      ) {
        context.addIssue({
          code: "custom",
          path: [...basePath, "substatements"],
          message: "True/false questions require at least one substatement.",
        });
      }
      if (
        question.question_type !== "true_false" &&
        question.substatements.length > 0 &&
        (contentApproved || question.review_status === "approved")
      ) {
        context.addIssue({
          code: "custom",
          path: [...basePath, "substatements"],
          message: "Only true/false questions may have substatements.",
        });
      }

      if (
        question.correct_answer &&
        question.correct_answer.type !== compatibleQuestionTypes[question.question_type]
      ) {
        context.addIssue({
          code: "custom",
          path: [...basePath, "correct_answer"],
          message: "Answer format does not match the question type.",
        });
      }
      const multipleChoiceAnswer =
        question.correct_answer?.type === "multiple_choice" ? question.correct_answer : null;
      if (
        multipleChoiceAnswer &&
        !displayOptions.some((option) => option.key === multipleChoiceAnswer.option_key) &&
        (contentApproved || question.review_status === "approved")
      ) {
        context.addIssue({
          code: "custom",
          path: [...basePath, "correct_answer"],
          message: "Answer points to an option that does not exist.",
        });
      }
      if (question.correct_answer?.type === "true_false") {
        const keys = Object.keys(question.correct_answer.statements).sort();
        const expected = displayStatements.map((statement) => statement.key).sort();
        if (
          ((contentApproved || question.review_status === "approved") &&
            keys.length !== expected.length) ||
          ((contentApproved || question.review_status === "approved") &&
            keys.some((key, keyIndex) => key !== expected[keyIndex]))
        ) {
          context.addIssue({
            code: "custom",
            path: [...basePath, "correct_answer"],
            message: "True/false answers must cover each substatement exactly once.",
          });
        }
      }

      if (
        question.publication_status === "published" ||
        question.publication_status === "archived"
      ) {
        context.addIssue({
          code: "custom",
          path: [...basePath, "review_status"],
          message: "Imported records must enter review and cannot be published or archived.",
        });
      }
      if (!question.correct_answer && question.review_status !== "needs_review") {
        context.addIssue({
          code: "custom",
          path: [...basePath, "review_status"],
          message: "A question without a source-verified answer must remain needs_review.",
        });
      }
    });
  });

export type ProblemImportReviewFields = {
  review_status: ReviewStatus;
  publication_status: "draft" | "unpublished";
  publication_rights_status: PublicationRightsStatus;
  difficulty: ProblemDifficulty | null;
};

export function validateProblemSetImport(value: unknown) {
  return problemSetImportSchema.safeParse(value);
}
