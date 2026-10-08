import { z } from "zod";

export const createPaymentOrderSchema = z.object({
  planCode: z.enum(["plus", "pro", "pro_max"]),
}).strict();
