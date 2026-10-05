import "server-only";

import { readServerEnv } from "@/lib/config/env";

export class SupabaseConfigurationError extends Error {
  constructor() {
    super("Supabase is not configured. Set the required Supabase environment variables.");
    this.name = "SupabaseConfigurationError";
  }
}

export function isSupabasePublicConfigured(): boolean {
  const env = readServerEnv();
  return Boolean(
    env.NEXT_PUBLIC_SUPABASE_URL &&
    (env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
  );
}

export function isSupabaseAttemptPersistenceConfigured(): boolean {
  const env = readServerEnv();
  return Boolean(
    env.MATHPATH_ATTEMPT_STORE === "supabase" &&
    env.NEXT_PUBLIC_SUPABASE_URL &&
    (env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY) &&
    env.SUPABASE_SERVICE_ROLE_KEY,
  );
}

export function getSupabasePublicConfig() {
  const env = readServerEnv();
  const anonKey = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !anonKey) {
    throw new SupabaseConfigurationError();
  }
  return { url: env.NEXT_PUBLIC_SUPABASE_URL, anonKey };
}

export function getSupabaseServiceRoleKey(): string {
  const env = readServerEnv();
  if (!env.SUPABASE_SERVICE_ROLE_KEY) throw new SupabaseConfigurationError();
  return env.SUPABASE_SERVICE_ROLE_KEY;
}
