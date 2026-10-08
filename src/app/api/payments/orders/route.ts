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
    return NextResponse.json({ error: unavailable ? "plan_unavailable" : "order_creation_failed" }, { status: unavailable ? 409 : 503 });
  }
  const order = data as Record<string, unknown>;
  return NextResponse.json({ orderId: order.id, checkoutUrl: `/checkout/${order.id}` }, { status: 201, headers: { "Cache-Control": "no-store" } });
}
