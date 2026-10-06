"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { useState, type FormEvent } from "react";
import { useLocale } from "@/components/providers/locale-provider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { authMessages } from "@/lib/i18n/auth-messages";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { targetScoreStorageKey } from "@/lib/onboarding/target-score";
import { getAuthRedirectBaseUrl } from "@/lib/auth/redirect-url";
import { PasswordInput } from "@/components/auth/password-input";

type AuthMode = "login" | "register" | "recovery";

export function AuthExperience({
  mode,
  updatingPassword = false,
  passwordUpdated = false,
  nextPath = "/account",
  initialError,
}: {
  mode: AuthMode;
  updatingPassword?: boolean;
  passwordUpdated?: boolean;
  nextPath?: string;
  initialError?: string;
}) {
  const router = useRouter();
  const { locale } = useLocale();
  const copy = authMessages[locale];
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(passwordUpdated ? copy.passwordUpdated : "");
  const [error, setError] = useState(
    initialError === "recovery_link_expired"
      ? copy.recoveryLinkExpired
      : initialError === "callback_failed"
        ? copy.authCallbackFailed
        : "",
  );
  const [pendingEmail, setPendingEmail] = useState("");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setNotice("");
    setError("");
    const form = new FormData(event.currentTarget);
    if (mode === "register" || updatingPassword) {
      if (form.get("password") !== form.get("confirmPassword")) {
        setError(locale === "vi" ? "Mật khẩu xác nhận chưa khớp." : "Passwords do not match.");
        setBusy(false);
        return;
      }
    }
    let targetScore: number | undefined;
    try {
      const localTarget = Number(window.localStorage.getItem(targetScoreStorageKey));
      if (Number.isFinite(localTarget) && localTarget >= 0 && localTarget <= 10)
        targetScore = localTarget;
    } catch {
      // Local profile preferences are optional.
    }
    const endpoint = updatingPassword
      ? "/api/auth/password"
      : mode === "login"
        ? "/api/auth/sign-in"
        : mode === "register"
          ? "/api/auth/sign-up"
          : "/api/auth/recovery";
    const body = updatingPassword
      ? { password: form.get("password") }
      : mode === "recovery"
        ? { identifier: form.get("identifier") }
        : mode === "login"
          ? {
              identifier: form.get("identifier"),
              password: form.get("password"),
              ...(targetScore === undefined ? {} : { targetScore }),
            }
        : {
            email: form.get("email"),
            username: form.get("username"),
            password: form.get("password"),
            ...(targetScore === undefined ? {} : { targetScore }),
            ...(mode === "register" ? { language: locale } : {}),
          };

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = (await response.json()) as {
        error?: { code: string };
        confirmationRequired?: boolean;
      };
      if (!response.ok) {
        const errorCopy: Record<string, string> = {
          invalid_request: copy.invalid,
          email_delivery_not_configured: copy.emailDeliveryNotConfigured,
          auth_redirect_not_allowed: copy.authRedirectNotAllowed,
          email_rate_limited: copy.emailRateLimited,
          credentials_not_accepted: copy.credentialsNotAccepted,
          email_not_confirmed: copy.emailNotConfirmed,
          session_expired: copy.recoveryLinkExpired,
          account_not_created: copy.accountNotCreated,
          username_taken: copy.usernameTaken,
          recovery_not_sent: copy.recoveryNotSent,
          callback_failed: copy.authCallbackFailed,
        };
        setError(errorCopy[payload.error?.code ?? ""] ?? copy.genericError);
        return;
      }
      if (mode === "register" && payload.confirmationRequired) {
        setPendingEmail(String(form.get("email") ?? ""));
        setNotice(copy.checkEmail);
        return;
      }
      if (mode === "recovery" && !updatingPassword) {
        setNotice(copy.recoverySent);
        return;
      }
      if (updatingPassword) {
        router.replace("/auth/login?password_updated=1" as Route);
        router.refresh();
        return;
      }
      router.replace(nextPath as Route);
      router.refresh();
    } catch {
      setError(copy.genericError);
    } finally {
      setBusy(false);
    }
  }

  async function resendConfirmation() {
    if (!pendingEmail || busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/auth/resend-sign-up", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: pendingEmail }),
      });
      if (!response.ok) throw new Error("resend_failed");
      setNotice(copy.confirmationResent);
    } catch {
      setError(copy.genericError);
    } finally {
      setBusy(false);
    }
  }

  async function signInWithGoogle() {
    setBusy(true);
    setError("");
    try {
      const supabase = getSupabaseBrowserClient();
      const next = encodeURIComponent(nextPath);
      const appOrigin = getAuthRedirectBaseUrl(
        process.env.NEXT_PUBLIC_APP_URL,
        window.location.origin,
      );
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${appOrigin}/auth/callback?next=${next}`,
          queryParams: { prompt: "select_account" },
        },
      });
      if (oauthError) setError(copy.genericError);
    } catch {
      setError(copy.genericError);
    } finally {
      setBusy(false);
    }
  }

  const title = updatingPassword
    ? copy.recoveryUpdateTitle
    : mode === "login"
      ? copy.loginTitle
      : mode === "register"
        ? copy.registerTitle
        : copy.recoveryTitle;
  const submitLabel = updatingPassword
    ? copy.submitPassword
    : mode === "login"
      ? copy.submitLogin
      : mode === "register"
        ? copy.submitRegister
        : copy.submitRecovery;

  return (
    <main className="site-main auth-page" id="main-content">
      <div className="container auth-container">
        <Card className="auth-card">
          <p className="eyebrow">MathPath</p>
          <h1>{title}</h1>
          <p>{copy.description}</p>
          <form className="auth-form" onSubmit={(event) => void onSubmit(event)}>
            {mode === "register" ? (
              <label>
                {copy.username}
                <input autoComplete="username" name="username" required minLength={3} maxLength={30} pattern="[A-Za-z0-9._-]{3,30}" />
              </label>
            ) : null}
            {!updatingPassword && mode === "register" ? (
              <label>
                {copy.email}
                <input autoComplete="email" type="email" name="email" required maxLength={254} />
              </label>
            ) : null}
            {!updatingPassword && mode !== "register" ? (
              <label>
                {copy.loginIdentifier}
                <input autoComplete={mode === "login" ? "username" : "email"} type="text" name="identifier" required maxLength={254} />
              </label>
            ) : null}
            {mode !== "recovery" || updatingPassword ? (
              <label>
                {updatingPassword ? copy.newPassword : copy.password}
                <PasswordInput
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  type="password"
                  name="password"
                  required
                  minLength={8}
                  maxLength={128}
                />
              </label>
            ) : null}
            {mode === "register" || updatingPassword ? (
              <label>
                {updatingPassword
                  ? locale === "vi" ? "Nhập lại mật khẩu mới" : "Confirm new password"
                  : locale === "vi" ? "Nhập lại mật khẩu" : "Confirm password"}
                <PasswordInput
                  autoComplete="new-password"
                  name="confirmPassword"
                  required
                  minLength={8}
                  maxLength={128}
                />
              </label>
            ) : null}
            {error ? (
              <p className="auth-message auth-message--error" role="alert">
                {error}
              </p>
            ) : null}
            {notice ? (
              <p className="auth-message" role="status">
                {notice}
              </p>
            ) : null}
            {mode === "register" && pendingEmail ? (
              <Button disabled={busy} onClick={() => void resendConfirmation()} variant="secondary">
                {copy.resendConfirmation}
              </Button>
            ) : null}
            <Button disabled={busy} size="large" type="submit">
              {busy ? "…" : submitLabel}
            </Button>
          </form>

          {mode === "login" ? (
            <>
              <Button
                className="auth-google"
                disabled={busy}
                onClick={() => void signInWithGoogle()}
                variant="secondary"
              >
                {copy.google}
              </Button>
              <p className="auth-links">
                <Link href="/auth/recovery">{copy.forgot}</Link>
              </p>
              <p className="auth-links">
                {copy.noAccount} <Link href="/auth/register">{copy.registerLink}</Link>
              </p>
            </>
          ) : null}
          {mode === "register" ? (
            <p className="auth-links">
              {copy.hasAccount} <Link href="/auth/login">{copy.loginLink}</Link>
            </p>
          ) : null}
          {mode === "recovery" && !updatingPassword ? (
            <p className="auth-links">
              <Link href="/auth/login">{copy.loginLink}</Link>
            </p>
          ) : null}
        </Card>
      </div>
    </main>
  );
}
