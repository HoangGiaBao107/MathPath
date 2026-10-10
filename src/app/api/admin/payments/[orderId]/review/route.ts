import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthenticatedActor } from "@/lib/analytics/server";
import { canAdminister } from "@/lib/auth/authorization";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

const schema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("approve"),
    transactionReference: z.string().trim().min(1).max(200),
    note: z.string().max(1000).optional().default(""),
    verified: z.literal(true),
  }),
  z.object({ action: z.literal("cancel"), note: z.string().max(1000).optional().default("") }),
]);

export async function POST(request: Request, context: { params: Promise<{ orderId: string }> }) {
  const origin = request.headers.get("origin");
  if (!origin || new URL(origin).origin !== new URL(request.url).origin) {
    return NextResponse.json({ error: "invalid_origin" }, { status: 403 });
  }
  const actor = await getAuthenticatedActor();
  if (!actor || !canAdminister(actor, "payments:read")) return NextResponse.json({ error: "admin_required" }, { status: 403 });

  const { orderId } = await context.params;
  if (!z.string().uuid().safeParse(orderId).success) return NextResponse.json({ error: "order_not_found" }, { status: 404 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_review_request" }, { status: 400 });

  const { data, error } = await getSupabaseAdminClient().rpc("admin_review_payment_order", {
    p_admin_user_id: actor.userId,
    p_order_id: orderId,
    p_action: parsed.data.action,
    p_transaction_reference: parsed.data.action === "approve" ? parsed.data.transactionReference : null,
    p_note: parsed.data.note,
  });
  if (error) {
    const migrationMissing = error.code === "PGRST202" || error.code === "42883";
    return NextResponse.json({ error: migrationMissing ? "payment_migration_required" : "payment_review_failed" }, { status: 503 });
  }
  const result = data && typeof data === "object" && !Array.isArray(data)
    ? (data as Record<string, unknown>).result
    : null;
  if (result === "paid" || result === "cancelled") return NextResponse.json({ result }, { headers: { "Cache-Control": "no-store" } });
  if (result === "order_not_found") return NextResponse.json({ error: result }, { status: 404 });
  if (result === "order_expired" || result === "order_not_pending") return NextResponse.json({ error: result }, { status: 409 });
  return NextResponse.json({ error: "payment_review_failed" }, { status: 503 });
}
