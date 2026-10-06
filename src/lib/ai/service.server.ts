import "server-only";

import { randomUUID } from "node:crypto";
import { getOrCreateExamOwner } from "@/lib/exams/guest-session.server";
import type { AttemptOwner } from "@/lib/exams/types";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAIProvider } from "./providers.server";

export type AIRequestType = "chat" | "solve_text" | "solve_image" | "practice" | "recommend";
export type AIInputType = "text" | "image" | "mixed";

export class AIQuotaExhaustedError extends Error {
  constructor() {
    super("ai_quota_exhausted");
    this.name = "AIQuotaExhaustedError";
  }
}

export class AIServiceUnavailableError extends Error {
  constructor() {
    super("ai_service_unavailable");
    this.name = "AIServiceUnavailableError";
  }
}

export type QuotaSnapshot = {
  kind: "guest" | "account" | "admin";
  plan: string;
  unlimited: boolean;
  remaining: number | null;
  limit: number | null;
  resetAt: string | null;
};

export type ReservedAIRequest = QuotaSnapshot & {
  reservationId: string;
  usageId: string;
  requestId: string;
};

export async function getAIIdentity(): Promise<{ owner: AttemptOwner; userId: string | null }> {
  let userId: string | null = null;
  try {
    const client = await createSupabaseServerClient();
    const { data } = await client.auth.getUser();
    userId = data.user?.id ?? null;
  } catch {
    // Local guest mode is available when Supabase has not been configured.
  }
  if (userId) return { owner: { kind: "user", userId }, userId };
  return { owner: await getOrCreateExamOwner(), userId: null };
}

function ownerArgs(owner: AttemptOwner) {
  return owner.kind === "user"
    ? { p_user_id: owner.userId, p_guest_session_hash: null }
    : { p_user_id: null, p_guest_session_hash: owner.guestSessionHash };
}

export async function readAIQuota(): Promise<QuotaSnapshot> {
  const { owner } = await getAIIdentity();
  const { data, error } = await getSupabaseAdminClient().rpc("get_ai_quota", ownerArgs(owner));
  if (error || !data) throw new AIServiceUnavailableError();
  return parseQuota(data);
}

export async function reserveAIRequest(
  type: AIRequestType,
  inputType: AIInputType,
): Promise<ReservedAIRequest> {
  const provider = getAIProvider();
  const { owner } = await getAIIdentity();
  const requestId = randomUUID();
  const { data, error } = await getSupabaseAdminClient().rpc("reserve_ai_request", {
    ...ownerArgs(owner),
    p_request_id: requestId,
    p_request_type: type,
    p_input_type: inputType,
    p_provider: provider.name,
    p_model: provider.model,
  });
  if (error) {
    if (error.message.includes("ai_quota_exhausted")) throw new AIQuotaExhaustedError();
    throw new AIServiceUnavailableError();
  }
  const result = parseQuota(data);
  const value = data as Record<string, unknown>;
  if (
    typeof value.reservationId !== "string" ||
    typeof value.usageId !== "string" ||
    typeof value.requestId !== "string"
  ) {
    throw new AIServiceUnavailableError();
  }
  return {
    ...result,
    reservationId: value.reservationId,
    usageId: value.usageId,
    requestId: value.requestId,
  };
}

export async function finishAIRequest(
  reservation: ReservedAIRequest,
  succeeded: boolean,
  durationMs: number,
): Promise<void> {
  const { error } = await getSupabaseAdminClient().rpc("finish_ai_request", {
    p_reservation_id: reservation.reservationId,
    p_usage_id: reservation.usageId,
    p_succeeded: succeeded,
    p_duration_ms: Math.max(0, Math.round(durationMs)),
    p_input_tokens: null,
    p_output_tokens: null,
  });
  if (error) throw new AIServiceUnavailableError();
}

export function parseQuota(data: unknown): QuotaSnapshot {
  if (!data || typeof data !== "object") throw new AIServiceUnavailableError();
  const value = data as Record<string, unknown>;
  if (
    !["guest", "account", "admin"].includes(String(value.kind)) ||
    typeof value.plan !== "string" ||
    typeof value.unlimited !== "boolean" ||
    !(typeof value.remaining === "number" || value.remaining === null) ||
    !(typeof value.limit === "number" || value.limit === null) ||
    !(typeof value.resetAt === "string" || value.resetAt === null)
  )
    throw new AIServiceUnavailableError();
  return value as QuotaSnapshot;
}

export async function withAIReservation<T>(
  type: AIRequestType,
  inputType: AIInputType,
  operation: (
    provider: ReturnType<typeof getAIProvider>,
    reservation: ReservedAIRequest,
  ) => Promise<T>,
): Promise<{ data: T; quota: ReservedAIRequest }> {
  const provider = getAIProvider();
  const reservation = await reserveAIRequest(type, inputType);
  const startedAt = Date.now();
  try {
    const data = await operation(provider, reservation);
    await finishAIRequest(reservation, true, Date.now() - startedAt);
    return { data, quota: reservation };
  } catch (error) {
    try {
      await finishAIRequest(reservation, false, Date.now() - startedAt);
    } catch {
      // Keep the original failure; expired reservations are reconciled by the database.
    }
    throw error;
  }
}

export function isAIQuotaExhausted(error: unknown): error is AIQuotaExhaustedError {
  return error instanceof AIQuotaExhaustedError;
}

export function isAIUnavailable(error: unknown): error is AIServiceUnavailableError {
  return error instanceof AIServiceUnavailableError;
}
