import { NextResponse } from "next/server";
import { getPaymentProvider } from "@/lib/payments/provider.server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { readServerEnv } from "@/lib/config/env";

const MAX_WEBHOOK_BYTES = 32_000;

export async function POST(request: Request, context: RouteContext<"/api/payments/webhook/[provider]">) {
  const { provider: providerName } = await context.params;
  const provider = getPaymentProvider();
  if (!provider || provider.name !== providerName) return NextResponse.json({ error: "provider_not_configured" }, { status: 503 });
  const env = readServerEnv();
  const webhookSecretConfigured = provider.name === "sepay_gateway"
    ? Boolean(env.SEPAY_SECRET_KEY)
    : Boolean(env.PAYMENT_WEBHOOK_SECRET);
  if (env.PAYMENT_MODE === "disabled" || !webhookSecretConfigured) {
    return NextResponse.json({ error: "provider_not_configured" }, { status: 503 });
  }
  if (Number(request.headers.get("content-length") ?? 0) > MAX_WEBHOOK_BYTES) return NextResponse.json({ error: "payload_too_large" }, { status: 413 });
  const rawBody = await readBoundedBody(request.body);
  if (!rawBody) return NextResponse.json({ error: "payload_too_large" }, { status: 413 });
  const rawText = new TextDecoder().decode(rawBody);
  const signature = provider.name === "sepay_gateway"
    ? request.headers.get("x-secret-key")
    : provider.name === "sepay"
      ? request.headers.get("x-sepay-signature")
      : request.headers.get("x-mathpath-signature");
  const timestamp = provider.name === "sepay" ? request.headers.get("x-sepay-timestamp") : null;
  if (!provider.verifyWebhook(rawBody, signature, timestamp)) {
    return NextResponse.json({ error: "invalid_signature" }, { status: 401 });
  }
  let payload: unknown;
  try { payload = JSON.parse(rawText) as unknown; }
  catch { return NextResponse.json({ error: "invalid_payload" }, { status: 400 }); }
  const transaction = provider.parseTransaction(payload);
  if (!transaction) {
    // A validly signed SePay event without an incoming recognized order code
    // cannot activate anything and is acknowledged to prevent futile retries.
    return provider.name === "sepay" || provider.name === "sepay_gateway"
      ? NextResponse.json({ success: true }, { headers: { "Cache-Control": "no-store" } })
      : NextResponse.json({ error: "invalid_payment_event" }, { status: 400 });
  }

  const { data, error } = await getSupabaseAdminClient().rpc("process_payment_webhook", {
    p_provider: provider.name,
    p_event_id: transaction.eventId,
    p_order_code: transaction.orderCode,
    p_transaction_id: transaction.transactionId,
    p_provider_reference: transaction.providerReference,
    p_amount_vnd: transaction.amountVnd,
    p_description: transaction.description,
    p_payload: payload as import("@/lib/problems/database.types").Json,
  });
  if (error || !data || typeof data !== "object" || Array.isArray(data)) {
    return NextResponse.json({ error: "webhook_processing_failed" }, { status: 503 });
  }
  const result = (data as Record<string, unknown>).result;
  if (provider.name === "sepay") {
    return NextResponse.json({ success: true }, { headers: { "Cache-Control": "no-store" } });
  }
  return NextResponse.json({ received: true, result }, { headers: { "Cache-Control": "no-store" } });
}

async function readBoundedBody(body: ReadableStream<Uint8Array> | null): Promise<Uint8Array | null> {
  if (!body) return new Uint8Array();
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_WEBHOOK_BYTES) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
  } catch {
    return null;
  } finally {
    reader.releaseLock();
  }
  const result = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.byteLength; }
  return result;
}
