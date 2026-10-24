import { z } from "zod";

export const shortAnswerPolicySchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("thptqg_numeric") }).strict(),
  z.object({
    kind: z.literal("numeric"), maxLength: z.number().int().min(1).max(32),
    absoluteTolerance: z.number().finite().nonnegative().optional(),
  }).strict(),
  z.object({ kind: z.literal("expression"), maxLength: z.number().int().min(1).max(256) }).strict(),
]);
