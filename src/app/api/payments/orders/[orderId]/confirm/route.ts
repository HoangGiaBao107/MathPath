import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

const idSchema = z.string().uuid();

export async function POST(request: Request, context: { params: Promise<{ orderId: string }> }) {
  const origin = request.headers.get("origin");
  if (!origin || new URL(origin).origin !== new URL(request.url).origin) {
    return NextResponse.json({ error: "invalid_origin" }, { status: 403 });
  }

  const { orderId } = await context.params;
  if (!idSchema.safeParse(orderId).success) return NextResponse.json({ error: "order_not_found" }, { status: 404 });
  const client = await createSupabaseServerClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) return NextResponse.json({ error: "authentication_required" }, { status: 401 });

  const admin = getSupabaseAdminClient();
  const { data: order, error } = await admin.from("payment_orders")
    .select("id, status, expires_at, customer_reported_paid_at")
    .eq("id", orderId).eq("user_id", user.id).maybeSingle();
  if (error) {
    return NextResponse.json({ error: error.code === "42703" ? "payment_migration_required" : "order_unavailable" }, { status: 503 });
  }
  if (!order) return NextResponse.json({ error: "order_not_found" }, { status: 404 });
  if (order.status === "paid") return NextResponse.json({ status: "paid" });
  if (order.status !== "pending" && order.status !== "expired") {
    return NextResponse.json({ error: "order_not_pending" }, { status: 409 });
  }
  if (order.status === "pending" && Date.parse(order.expires_at) <= Date.now()) {
      await admin.from("payment_orders").update({ status: "expired", updated_at: new Date().toISOString() })
        .eq("id", order.id).eq("user_id", user.id).eq("status", "pending").lte("expires_at", new Date().toISOString());
  }

  if (!order.customer_reported_paid_at) {
    const { data: updatedOrder, error: updateError } = await admin.from("payment_orders")
      .update({ customer_reported_paid_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", order.id).eq("user_id", user.id).in("status", ["pending", "expired"])
      .is("customer_reported_paid_at", null).select("id").maybeSingle();
    if (updateError) {
      return NextResponse.json({ error: updateError.code === "42703" ? "payment_migration_required" : "payment_confirmation_failed" }, { status: 503 });
    }
    if (!updatedOrder) {
      const latest = await admin.from("payment_orders").select("status, customer_reported_paid_at").eq("id", order.id).eq("user_id", user.id).maybeSingle();
      if (latest.data?.status === "paid") return NextResponse.json({ status: "paid" });
      if (latest.data?.customer_reported_paid_at) return NextResponse.json({ status: "reported" });
      return NextResponse.json({ error: "order_not_pending" }, { status: 409 });
    }
  }

  return NextResponse.json({ status: "reported", message: "payment_reported_waiting_for_review" }, { headers: { "Cache-Control": "no-store" } });
}
