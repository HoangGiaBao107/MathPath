import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getPaymentProvider } from "@/lib/payments/provider.server";

const idSchema = z.string().uuid();

export async function GET(_request: Request, context: RouteContext<"/api/payments/orders/[orderId]">) {
  const { orderId } = await context.params;
  if (!idSchema.safeParse(orderId).success) return NextResponse.json({ error: "order_not_found" }, { status: 404 });
  const client = await createSupabaseServerClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) return NextResponse.json({ error: "authentication_required" }, { status: 401 });

  const admin = getSupabaseAdminClient();
  const { data: order, error } = await admin.from("payment_orders")
    .select("id, user_id, plan_code, plan_name_snapshot, amount_vnd, currency, order_code, status, provider, created_at, expires_at, paid_at")
    .eq("id", orderId).eq("user_id", user.id).maybeSingle();
  if (error || !order) return NextResponse.json({ error: "order_not_found" }, { status: 404 });
  const { data: plan, error: planError } = await admin.from("plans")
    .select("duration_days, daily_ai_limit").eq("slug", order.plan_code).maybeSingle();
  if (planError || !plan) return NextResponse.json({ error: "plan_unavailable" }, { status: 503 });

  let status = order.status;
  if (status === "pending" && Date.parse(order.expires_at) <= Date.now()) {
    const { data: expiredOrder } = await admin.from("payment_orders")
      .update({ status: "expired", updated_at: new Date().toISOString() })
      .eq("id", order.id).eq("status", "pending").select("status").maybeSingle();
    status = expiredOrder?.status ?? (await admin.from("payment_orders").select("status").eq("id", order.id).single()).data?.status ?? order.status;
  }
  const provider = getPaymentProvider(order.provider === "unconfigured" ? undefined : order.provider);
  const payment = provider?.createPayment({ id: order.id, orderCode: order.order_code, amountVnd: order.amount_vnd, expiresAt: order.expires_at }) ?? {
    provider: null, bankCode: null, accountNumber: null, accountName: null,
    transferDescription: order.order_code, qrImageUrl: null, providerReady: false,
  };
  return NextResponse.json({ order: { ...order, ...plan, status }, payment }, { headers: { "Cache-Control": "no-store" } });
}
