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
  if (error instanceof AIProviderRequestError) {
    const detail = {
      error: "ai_provider_error",
      provider: error.provider,
      providerStatus: error.status,
      providerCode: error.code,
      providerMessage: error.providerMessage,
      providerRequestId: error.requestId ?? null,
    };
    console.error("MathPath AI provider request failed", detail);
    return NextResponse.json(detail, { status: 502 });
  }
  if (error instanceof AIServiceUnavailableError) {
    console.error("MathPath AI service request failed", { code: error.code });
    return NextResponse.json(
      { error: "ai_service_unavailable", code: error.code },
      { status: 503 },
    );
  }
  if (error instanceof Error && (error.name === "AbortError" || error.name === "TimeoutError")) {
    console.error("MathPath AI request timed out");
    return NextResponse.json({ error: "ai_request_timeout" }, { status: 504 });
  }
  if (error instanceof Error) {
    console.error("MathPath AI internal request failed", { name: error.name });
  }
  return NextResponse.json({ error: "ai_internal_error" }, { status: 500 });
}

export function localeFrom(value: unknown): "vi" | "en" | null {
  return value === "vi" || value === "en" ? value : null;
}
