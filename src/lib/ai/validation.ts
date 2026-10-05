import { z } from "zod";

export const solverResponseSchema = z.object({
  problemSummary: z.string(),
  problemType: z.string(),
  method: z.string(),
  steps: z.array(z.object({ title: z.string(), content: z.string() })),
  verification: z.string(),
  finalAnswer: z.string(),
  confidenceNote: z.string().nullable(),
});
