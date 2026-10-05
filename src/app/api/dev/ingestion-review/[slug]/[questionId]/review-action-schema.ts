import { z } from "zod";

const textSchema = z.string().max(12000);
const optionDraftSchema = z.array(
  z.object({ key: z.string(), text: textSchema, order_index: z.number().int() }),
);
const statementDraftSchema = z.array(
  z.object({ key: z.string(), text: textSchema, order_index: z.number().int() }),
);
const displayDraftSchema = z.object({
  statement: textSchema,
  options: optionDraftSchema,
  statements: statementDraftSchema,
  shortAnswerPrompt: textSchema,
  explanation: textSchema.nullable(),
});

export const devReviewActionSchema = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("save_display"),
      locale: z.enum(["vi", "en"]),
      display: displayDraftSchema,
    })
    .strict(),
  z.object({ action: z.literal("approve_content") }),
  z.object({ action: z.literal("approve_translation") }),
  z.object({ action: z.literal("needs_review") }),
]);

export type DevReviewAction = z.infer<typeof devReviewActionSchema>;
