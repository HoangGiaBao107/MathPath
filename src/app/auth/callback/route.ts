import { NextResponse, type NextRequest } from "next/server";
import { claimCurrentGuestAttempts } from "@/lib/auth/claim-guest.server";
import { safeNextPath } from "@/lib/auth/safe-next-path";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const next = safeNextPath(request.nextUrl.searchParams.get("next"));
  if (!code)
    return NextResponse.redirect(new URL(`/auth/login?error=callback_failed`, request.url));

  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error || !data.user) {
      return NextResponse.redirect(new URL(`/auth/login?error=callback_failed`, request.url));
    }
    try {
      await claimCurrentGuestAttempts(data.user.id);
    } catch {
      await supabase.auth.signOut();
      return NextResponse.redirect(
        new URL(`/auth/login?error=guest_attempt_migration_failed`, request.url),
      );
    }
    return NextResponse.redirect(new URL(next, request.url));
  } catch {
    return NextResponse.redirect(new URL(`/auth/login?error=supabase_not_configured`, request.url));
  }
}
