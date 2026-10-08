import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const { data, error } = await getSupabaseAdminClient()
    .from("plans")
    .select("slug, name, amount_vnd, currency, duration_days, daily_ai_limit")
    .eq("active", true)
    .in("slug", ["plus", "pro", "pro_max"])
    .order("amount_vnd");
  if (error) return NextResponse.json({ error: "plans_unavailable" }, { status: 503 });
  return NextResponse.json({ plans: data }, { headers: { "Cache-Control": "no-store" } });
}
