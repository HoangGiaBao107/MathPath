import { z } from "zod";

const serverEnvSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  NEXT_PUBLIC_SUPABASE_URL: z.preprocess(emptyToUndefined, z.string().url().optional()),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.preprocess(
    emptyToUndefined,
    z.string().min(1).optional(),
  ),
  SUPABASE_SERVICE_ROLE_KEY: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  MATHPATH_ATTEMPT_STORE: z.preprocess(emptyToUndefined, z.enum(["mock", "supabase"]).optional()),
  OPENAI_API_KEY: z.string().min(1).optional(),
  ANTHROPIC_API_KEY: z.string().min(1).optional(),
  PAYMENT_PROVIDER_API_KEY: z.string().min(1).optional(),
  PAYMENT_WEBHOOK_SECRET: z.string().min(1).optional(),
  PAYMENT_PROVIDER: z.preprocess(emptyToUndefined, z.enum(["generic_hmac"]).optional()),
  PAYMENT_BANK_CODE: z.preprocess(emptyToUndefined, z.string().regex(/^[A-Za-z0-9_-]{2,24}$/).optional()),
  PAYMENT_BANK_ACCOUNT: z.preprocess(emptyToUndefined, z.string().regex(/^\d{6,20}$/).optional()),
  PAYMENT_ACCOUNT_NAME: z.preprocess(emptyToUndefined, z.string().min(2).max(100).optional()),
});

function emptyToUndefined(value: unknown): unknown {
  return value === "" ? undefined : value;
}

export type ServerEnv = z.infer<typeof serverEnvSchema>;

export function readServerEnv(source: NodeJS.ProcessEnv = process.env): ServerEnv {
  return serverEnvSchema.parse(source);
}
