import { NextResponse } from "next/server";
import { z } from "zod";
import { claimCurrentGuestAttempts } from "@/lib/auth/claim-guest.server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAuthRedirectBaseUrl } from "@/lib/auth/redirect-url";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { persistProfileUpdate } from "@/lib/auth/persist-profile-update";
import { canSkipEmailConfirmation } from "@/lib/auth/admin-email-confirmation";
import { isEmailIdentifier, loginIdentifierSchema } from "@/lib/auth/login-identifier";

const credentialsSchema = z.object({
  email: z.string().email().max(254),
  username: z.string().regex(/^[a-zA-Z0-9._-]{3,30}$/),
  password: z.string().min(8).max(128),
  language: z.enum(["vi", "en"]).optional(),
  targetScore: z.number().min(0).max(10).optional(),
});
const emailSchema = z.object({ email: z.string().email().max(254) });
const identifierSchema = z.object({ identifier: loginIdentifierSchema });
const passwordSchema = z.object({ password: z.string().min(8).max(128) });

export async function POST(request: Request, context: RouteContext<"/api/auth/[action]">) {
  const { action } = await context.params;
  try {
    const appOrigin = getAuthRedirectBaseUrl(
      process.env.NEXT_PUBLIC_APP_URL,
      new URL(request.url).origin,
    );
    const supabase = await createSupabaseServerClient();
    const input: unknown = await request.json();

    if (action === "sign-in") {
      const parsed = z.object({
        identifier: loginIdentifierSchema,
        password: z.string().min(8).max(128),
        targetScore: z.number().min(0).max(10).optional(),
      }).safeParse(input);
      if (!parsed.success) return authError("invalid_request", 400);
      const email = await resolveAccountEmail(parsed.data.identifier);
      if (!email) return authError("credentials_not_accepted", 401);
      let { data, error } = await supabase.auth.signInWithPassword({
        email,
        password: parsed.data.password,
      });
      if (error && canSkipEmailConfirmation(error)) {
        try {
          const admin = getSupabaseAdminClient();
          const { data: confirmedUserId, error: confirmationError } = await admin.rpc(
            "confirm_unconfirmed_admin_by_email",
            { target_email: email },
          );
          if (!confirmationError && confirmedUserId) {
            ({ data, error } = await supabase.auth.signInWithPassword({ email, password: parsed.data.password }));
          }
        } catch {
          // Admin auto-confirm is optional and never bypasses password validation.
        }
      }
      if (error) {
        return authError(classifySignInError(error), 401);
      }
      if (!data.user) return authError("credentials_not_accepted", 401);
      if (parsed.data.targetScore !== undefined) {
        const { error: profileError } = await supabase
          .from("profiles")
          .update({ target_score: parsed.data.targetScore })
          .eq("id", data.user.id);
        if (profileError) return authError("profile_sync_failed", 503);
      }
      try {
        await claimCurrentGuestAttempts(data.user.id);
      } catch {
        await supabase.auth.signOut();
        return authError("guest_attempt_migration_failed", 503);
      }
      return NextResponse.json({ ok: true }, { headers: noStoreHeaders });
    }

    if (action === "sign-up") {
      const parsed = credentialsSchema.safeParse(input);
      if (!parsed.success) return authError("invalid_request", 400);
      const { data, error } = await supabase.auth.signUp({
        email: parsed.data.email,
        password: parsed.data.password,
        options: {
          data: {
            display_name: parsed.data.username,
            username: parsed.data.username,
            language: parsed.data.language ?? "vi",
            target_score: parsed.data.targetScore,
          },
          emailRedirectTo: `${appOrigin}/auth/callback?next=/account`,
        },
      });
      if (error) return authError(classifySupabaseAuthError(error), 400);
      if (data.user && data.session) {
        try {
          await claimCurrentGuestAttempts(data.user.id);
        } catch {
          await supabase.auth.signOut();
          return authError("guest_attempt_migration_failed", 503);
        }
      }
      return NextResponse.json(
        { ok: true, confirmationRequired: !data.session },
        { headers: noStoreHeaders },
      );
    }

    if (action === "resend-sign-up") {
      const parsed = emailSchema.safeParse(input);
      if (!parsed.success) return authError("invalid_request", 400);
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: parsed.data.email,
        options: {
          emailRedirectTo: `${appOrigin}/auth/callback?next=/account`,
        },
      });
      if (error) return authError(classifySupabaseAuthError(error), 503);
      return NextResponse.json({ ok: true }, { headers: noStoreHeaders });
    }

    if (action === "sign-out") {
      const { error } = await supabase.auth.signOut();
      if (error) return authError("sign_out_failed", 500);
      return NextResponse.json({ ok: true }, { headers: noStoreHeaders });
    }

    if (action === "recovery") {
      const parsed = identifierSchema.safeParse(input);
      if (!parsed.success) return authError("invalid_request", 400);
      const email = await resolveAccountEmail(parsed.data.identifier);
      if (!email) return NextResponse.json({ ok: true }, { headers: noStoreHeaders });
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${appOrigin}/auth/callback?next=%2Fauth%2Frecovery%3Fupdate%3D1`,
      });
      if (error) return authError("recovery_not_sent", 503);
      return NextResponse.json({ ok: true }, { headers: noStoreHeaders });
    }

    if (action === "password") {
      const parsed = passwordSchema.safeParse(input);
      if (!parsed.success) return authError("invalid_request", 400);
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return authError("session_expired", 401);
      const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
      if (error) return authError("password_not_updated", 400);
      return NextResponse.json({ ok: true }, { headers: noStoreHeaders });
    }

    return authError("not_found", 404);
  } catch (error) {
    if (error instanceof Error && error.message.includes("Supabase is not configured")) {
      return authError("supabase_not_configured", 503);
    }
    return authError("auth_service_unavailable", 503);
  }
}

async function resolveAccountEmail(identifier: string): Promise<string | null> {
  if (isEmailIdentifier(identifier)) return identifier;
  const admin = getSupabaseAdminClient();
  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("id")
    .ilike("username", identifier)
    .maybeSingle();
  if (profileError || !profile) return null;
  const { data, error } = await admin.auth.admin.getUserById(profile.id);
  if (error) return null;
  return data.user.email ?? null;
}

export async function PATCH(request: Request, context: RouteContext<"/api/auth/[action]">) {
  const { action } = await context.params;
  if (action !== "profile") return authError("not_found", 404);
  const inputSchema = z.object({
    targetScore: z.number().min(0).max(10).nullable().optional(),
    language: z.enum(["vi", "en"]).optional(),
    username: z.string().trim().regex(/^[a-zA-Z0-9._-]{3,30}$/).optional(),
  }).refine((value) => Object.keys(value).length > 0);
  const parsed = inputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return authError("invalid_request", 400);
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return authError("session_expired", 401);
    const profileUpdate = {
      ...(parsed.data.targetScore !== undefined ? { target_score: parsed.data.targetScore } : {}),
      ...(parsed.data.language !== undefined ? { language: parsed.data.language } : {}),
      ...(parsed.data.username !== undefined
        ? { username: parsed.data.username, display_name: parsed.data.username }
        : {}),
    };
    // Profile RLS only permits admins to write; the server performs this
    // validated, per-user update with the service client after authenticating.
    const { error } = await persistProfileUpdate(getSupabaseAdminClient(), user.id, profileUpdate);
    if (error?.code === "23505") return authError("username_taken", 409);
    if (error) return authError("profile_sync_failed", 503);
    return NextResponse.json({ ok: true }, { headers: noStoreHeaders });
  } catch {
    return authError("auth_service_unavailable", 503);
  }
}

const noStoreHeaders = { "Cache-Control": "no-store, private" };

function authError(code: string, status: number) {
  return NextResponse.json({ error: { code } }, { status, headers: noStoreHeaders });
}

function classifySupabaseAuthError(error: { code?: string; message: string; status?: number }) {
  const detail = `${error.code ?? ""} ${error.message}`.toLowerCase();
  if (error.code === "23505" || detail.includes("profiles_username_lower_unique"))
    return "username_taken";
  if (
    detail.includes("email_address_not_authorized") ||
    detail.includes("email address not authorized")
  )
    return "email_delivery_not_configured";
  if (
    detail.includes("redirect") &&
    (detail.includes("not allowed") || detail.includes("allowlist"))
  )
    return "auth_redirect_not_allowed";
  if (error.status === 429 || detail.includes("rate limit")) return "email_rate_limited";
  return "account_not_created";
}

function classifySignInError(error: { code?: string; message: string }) {
  const detail = `${error.code ?? ""} ${error.message}`.toLowerCase();
  if (detail.includes("email_not_confirmed") || detail.includes("email not confirmed")) {
    return "email_not_confirmed";
  }
  return "credentials_not_accepted";
}
