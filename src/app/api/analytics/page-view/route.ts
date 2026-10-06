import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

const pageViewSchema = z.object({
  path: z.string().min(1).max(200).regex(/^\/(?!\/)/).refine((path) => !/[?#]/.test(path)),
});

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin || new URL(origin).origin !== new URL(request.url).origin) {
    return NextResponse.json({ ok: false }, { status: 403 });
  }

  const parsed = pageViewSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  if (isExcludedPath(parsed.data.path)) return NextResponse.json({ ok: false }, { status: 400 });

  const { error } = await getSupabaseAdminClient().rpc("record_site_page_view", {
    p_path: parsed.data.path,
  });
  if (error) return NextResponse.json({ ok: false }, { status: 503 });
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}

function isExcludedPath(path: string) {
  return (
    path === "/admin" || path.startsWith("/admin/") ||
    path === "/auth" || path.startsWith("/auth/") ||
    path.startsWith("/api/") || path.startsWith("/_next/")
  );
}
