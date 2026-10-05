import "server-only";

import { readServerEnv } from "@/lib/config/env";
import { SupabaseConfigurationError } from "@/lib/supabase/config";
import { DevelopmentAttemptRepository } from "./attempt-repository.mock";
import { SupabaseAttemptRepository } from "./attempt-repository.supabase";
import type { AttemptRepository } from "./attempt-repository";

let repository: AttemptRepository | null = null;

export function getAttemptRepository(): AttemptRepository {
  if (repository) return repository;
  const env = readServerEnv();
  const mode =
    env.MATHPATH_ATTEMPT_STORE ?? (process.env.NODE_ENV === "production" ? "supabase" : "mock");
  const configured = Boolean(
    env.NEXT_PUBLIC_SUPABASE_URL &&
    (env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY) &&
    env.SUPABASE_SERVICE_ROLE_KEY,
  );
  if (mode === "supabase") {
    if (!configured) {
      throw new SupabaseConfigurationError();
    }
    repository = new SupabaseAttemptRepository();
    return repository;
  }
  if (process.env.NODE_ENV === "production") {
    throw new SupabaseConfigurationError();
  }
  repository = new DevelopmentAttemptRepository();
  return repository;
}
