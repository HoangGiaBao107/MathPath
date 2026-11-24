import { z } from "zod";
import { shortAnswerPolicySchema } from "./short-answer-policy-schema";

const examQuestionSchema = z.discriminatedUnion("type", [
  z.object({
    id: z.string(),
    sectionId: z.string().nullable(),
    number: z.string().nullable(),
    type: z.literal("multiple_choice"),
    stem: z.string().nullable(),
    displayStemVi: z.string().nullable().optional(),
    displayStemEn: z.string().nullable().optional(),
    figures: z
      .array(
        z.object({
          url: z.string().regex(/^\/problem-assets\/[A-Za-z0-9._/-]+$/),
          alt: z.string(),
        }),
      )
      .optional(),
    topic: z.string().nullable().optional(),
    subtopic: z.string().nullable().optional(),
    options: z.array(
      z.object({
        key: z.string(),
        text: z.string().nullable(),
        displayTextEn: z.string().nullable().optional(),
      }),
    ),
    points: z.number().nonnegative(),
    correctOptionKey: z.string(),
  }),
  z.object({
    id: z.string(),
    sectionId: z.string().nullable(),
    number: z.string().nullable(),
    type: z.literal("true_false"),
    stem: z.string().nullable(),
    displayStemVi: z.string().nullable().optional(),
    displayStemEn: z.string().nullable().optional(),
    figures: z
      .array(
        z.object({
          url: z.string().regex(/^\/problem-assets\/[A-Za-z0-9._/-]+$/),
          alt: z.string(),
        }),
      )
      .optional(),
    topic: z.string().nullable().optional(),
    subtopic: z.string().nullable().optional(),
    statements: z.array(
      z.object({
        key: z.string(),
        text: z.string().nullable(),
        displayTextEn: z.string().nullable().optional(),
      }),
    ),
    points: z.number().nonnegative(),
    correctStatements: z.record(z.string(), z.boolean()),
    scoring: z.discriminatedUnion("kind", [
      z.object({ kind: z.literal("all_or_nothing") }),
      z.object({ kind: z.literal("partial"), pointsByCorrectCount: z.array(z.number()) }),
    ]),
  }),
  z.object({
    id: z.string(),
    sectionId: z.string().nullable(),
    number: z.string().nullable(),
    type: z.literal("short_answer"),
    stem: z.string().nullable(),
    displayStemVi: z.string().nullable().optional(),
    displayStemEn: z.string().nullable().optional(),
    figures: z
      .array(
        z.object({
          url: z.string().regex(/^\/problem-assets\/[A-Za-z0-9._/-]+$/),
          alt: z.string(),
        }),
      )
      .optional(),
    topic: z.string().nullable().optional(),
    subtopic: z.string().nullable().optional(),
    points: z.number().nonnegative(),
    canonicalAnswer: z.string().nullable().optional(),
    acceptedNormalizedAnswers: z.array(z.string()).nullable().optional(),
    inputPolicy: shortAnswerPolicySchema
      .nullable()
      .optional()
      .transform((inputPolicy) => inputPolicy ?? undefined),
  }),
]);

export const examRuntimeSchema = z
  .object({
    id: z.string(),
    title: z.string(),
    description: z.string(),
    mode: z.enum(["official_thptqg", "practice", "school_mock"]),
    demo: z.boolean(),
    timingMode: z.enum(["countdown", "elapsed"]),
    durationSeconds: z.number().positive().nullable(),
    totalScore: z.number().positive(),
    sections: z.array(
      z.object({
        id: z.string(),
        title: z.string(),
        description: z.string(),
        maxScore: z.number().nonnegative(),
      }),
    ),
    questions: z.array(examQuestionSchema),
  })
  .superRefine((exam, ctx) => {
    if (exam.mode !== "official_thptqg") return;
    const mc = exam.questions.filter((question) => question.type === "multiple_choice");
    const tf = exam.questions.filter((question) => question.type === "true_false");
    const sa = exam.questions.filter((question) => question.type === "short_answer");
    if (
      mc.length !== 12 ||
      tf.length !== 4 ||
      sa.length !== 6 ||
      exam.totalScore !== 10 ||
      mc.some((question) => question.points !== 0.25) ||
      sa.some(
        (question) =>
          question.points !== 0.5 ||
          (question.inputPolicy && question.inputPolicy.kind !== "thptqg_numeric"),
      ) ||
      tf.some(
        (question) =>
          question.points !== 1 ||
          question.statements.length !== 4 ||
          question.scoring.kind !== "partial" ||
          JSON.stringify(question.scoring.pointsByCorrectCount) !== "[0,0.1,0.25,0.5,1]",
      )
    ) {
      ctx.addIssue({
        code: "custom",
        message: "Invalid official THPTQG scoring/input configuration",
      });
    }
  });
