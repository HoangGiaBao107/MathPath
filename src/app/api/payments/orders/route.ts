import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getPaymentProvider } from "@/lib/payments/provider.server";
import { createPaymentOrderSchema } from "@/lib/payments/validation";

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin || new URL(origin).origin !== new URL(request.url).origin) {
    return NextResponse.json({ error: "invalid_origin" }, { status: 403 });
  }
  const client = await createSupabaseServerClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) return NextResponse.json({ error: "authentication_required" }, { status: 401 });

  const parsed = createPaymentOrderSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_plan" }, { status: 400 });
  const { data: profile, error: profileError } = await client.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profileError || !profile) return NextResponse.json({ error: "account_unavailable" }, { status: 503 });
  if (profile.role === "admin") return NextResponse.json({ error: "admin_subscription_not_required" }, { status: 400 });

  const provider = getPaymentProvider();
  const { data, error } = await getSupabaseAdminClient().rpc("create_payment_order", {
    p_user_id: user.id,
    p_plan_code: parsed.data.planCode,
    p_provider: provider?.name ?? "unconfigured",
  });
  if (error || !data || typeof data !== "object" || Array.isArray(data)) {
    const unavailable = error?.message.includes("payment_plan_unavailable");
    if (error) {
      console.error("[payments] create_payment_order RPC failed", {
        code: error.code,
        message: error.message,
      });
    }
    return NextResponse.json({
      error: unavailable ? "plan_unavailable" : "order_creation_failed",
      ...(error?.code ? { diagnosticCode: error.code } : {}),
    }, { status: unavailable ? 409 : 503 });
  }
  let order = data as Record<string, unknown>;
  if (typeof order.id !== "string") {
    return NextResponse.json({ error: "order_creation_failed" }, { status: 503 });
  }
  const admin = getSupabaseAdminClient();
  let orderId = order.id;
  const initialOrderRead = await admin.from("payment_orders")
    .select("created_at, expires_at, status")
    .eq("id", order.id)
    .eq("user_id", user.id)
    .maybeSingle();
  let persistedOrder = initialOrderRead.data;
  if (initialOrderRead.error || !persistedOrder) {
    return NextResponse.json({ error: "order_creation_failed" }, { status: 503 });
  }
  let safeExpiry = new Date(Math.min(Date.parse(persistedOrder.expires_at), Date.parse(persistedOrder.created_at) + 5 * 60_000)).toISOString();
  if (persistedOrder.status === "pending" && Date.parse(safeExpiry) <= Date.now()) {
    await admin.from("payment_orders").update({ status: "expired", updated_at: new Date().toISOString() })
      .eq("id", orderId).eq("status", "pending");
    const replacement = await admin.rpc("create_payment_order", {
      p_user_id: user.id,
      p_plan_code: parsed.data.planCode,
      p_provider: provider?.name ?? "unconfigured",
    });
    if (replacement.error || !replacement.data || typeof replacement.data !== "object" || Array.isArray(replacement.data)) {
      return NextResponse.json({ error: "order_creation_failed" }, { status: 503 });
    }
    order = replacement.data as Record<string, unknown>;
    if (typeof order.id !== "string") return NextResponse.json({ error: "order_creation_failed" }, { status: 503 });
    orderId = order.id;
    const latest = await admin.from("payment_orders").select("created_at, expires_at, status")
      .eq("id", orderId).eq("user_id", user.id).maybeSingle();
    if (latest.error || !latest.data) return NextResponse.json({ error: "order_creation_failed" }, { status: 503 });
    persistedOrder = latest.data;
    safeExpiry = new Date(Math.min(Date.parse(latest.data.expires_at), Date.parse(latest.data.created_at) + 5 * 60_000)).toISOString();
  }
  if (persistedOrder.status === "pending" && safeExpiry !== persistedOrder.expires_at) {
    await admin.from("payment_orders").update({ expires_at: safeExpiry, updated_at: new Date().toISOString() })
      .eq("id", orderId).eq("status", "pending").gt("expires_at", safeExpiry);
  }
  return NextResponse.json({ orderId, checkoutUrl: `/checkout/${orderId}` }, { status: 201, headers: { "Cache-Control": "no-store" } });
}
