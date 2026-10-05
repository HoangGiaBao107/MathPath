"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useLocale } from "@/components/providers/locale-provider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { authMessages } from "@/lib/i18n/auth-messages";

export function AccountExperience({
  email,
  displayName,
  language,
  targetScore,
  configured,
}: {
  email: string | null;
  displayName: string | null;
  language?: string | null;
  targetScore?: number | null;
  configured: boolean;
}) {
  const router = useRouter();
  const { locale } = useLocale();
  const copy = authMessages[locale];
  const [error, setError] = useState(false);
  async function signOut() {
    const response = await fetch("/api/auth/sign-out", { method: "POST" });
    if (!response.ok) {
      setError(true);
      return;
    }
    router.replace("/");
    router.refresh();
  }
  return (
    <main className="site-main auth-page" id="main-content">
      <div className="container auth-container">
        <Card className="auth-card">
          <p className="eyebrow">MathPath</p>
          <h1>{copy.accountTitle}</h1>
          <p>{copy.accountDescription}</p>
          {!configured ? (
            <p className="auth-message auth-message--error" role="status">
              {copy.setupMissing}
            </p>
          ) : (
            <>
              <dl className="account-details">
                <div>
                  <dt>{copy.name}</dt>
                  <dd>{displayName || "—"}</dd>
                </div>
                <div>
                  <dt>{copy.email}</dt>
                  <dd>{email || "—"}</dd>
                </div>
                <div>
                  <dt>{copy.languageLabel}</dt>
                  <dd>{language || "vi"}</dd>
                </div>
                <div>
                  <dt>{copy.targetScoreLabel}</dt>
                  <dd>
                    {targetScore === null || targetScore === undefined ? "—" : `${targetScore}/10`}
                  </dd>
                </div>
              </dl>
              {error ? (
                <p className="auth-message auth-message--error" role="alert">
                  {copy.genericError}
                </p>
              ) : null}
              <Button onClick={() => void signOut()} variant="secondary">
                {copy.signOut}
              </Button>
            </>
          )}
          {!email ? (
            <p className="auth-links">
              <Link href="/auth/login">{copy.loginLink}</Link>
            </p>
          ) : null}
        </Card>
      </div>
    </main>
  );
}
