import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const client = await createSupabaseServerClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) return NextResponse.json({ error: "authentication_required" }, { status: 401 });
  const admin = getSupabaseAdminClient();
  const [subscriptionResult, ordersResult] = await Promise.all([
    admin.from("subscriptions").select("id, plan_code, status, started_at, expires_at")
      .eq("user_id", user.id).eq("status", "ACTIVE").order("expires_at", { ascending: false }).limit(1).maybeSingle(),
    admin.from("payment_orders").select("id, order_code, plan_code, plan_name_snapshot, amount_vnd, currency, status, created_at, paid_at")
      .eq("user_id", user.id).order("created_at", { ascending: false }).limit(10),
  ]);
  if (subscriptionResult.error || ordersResult.error) return NextResponse.json({ error: "payment_history_unavailable" }, { status: 503 });
  let activePlan: { name: string; daily_ai_limit: number | null; duration_days: number | null } | null = null;
  if (subscriptionResult.data) {
    const { data: plan } = await admin.from("plans").select("name, daily_ai_limit, duration_days").eq("slug", subscriptionResult.data.plan_code).maybeSingle();
    activePlan = plan;
  }
  return NextResponse.json({ subscription: subscriptionResult.data, activePlan, orders: ordersResult.data }, { headers: { "Cache-Control": "no-store" } });
}
