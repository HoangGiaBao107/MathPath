import { NextResponse } from "next/server";
import { AIOutputInvalidError, AIProviderRequestError } from "./providers.server";
import { AIProviderNotConfiguredError } from "./types";
import { AIQuotaExhaustedError, AIServiceUnavailableError } from "./service.server";

export function aiErrorResponse(error: unknown) {
  if (error instanceof AIQuotaExhaustedError) {
    return NextResponse.json({ error: "quota_exhausted" }, { status: 429 });
  }
  if (error instanceof AIProviderNotConfiguredError) {
    return NextResponse.json({ error: "ai_not_configured" }, { status: 503 });
  }
  if (error instanceof AIOutputInvalidError) {
    return NextResponse.json({ error: "ai_output_unclear" }, { status: 502 });
  }
  if (error instanceof AIProviderRequestError || error instanceof AIServiceUnavailableError) {
    return NextResponse.json({ error: "ai_temporarily_unavailable" }, { status: 503 });
  }
  return NextResponse.json({ error: "invalid_request" }, { status: 400 });
}

export function localeFrom(value: unknown): "vi" | "en" | null {
  return value === "vi" || value === "en" ? value : null;
}
