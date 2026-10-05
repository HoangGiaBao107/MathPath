"use client";

import { useLocale } from "@/components/providers/locale-provider";
import { Button } from "@/components/ui/button";

export function AnalyticsErrorState({
  reset,
  admin = false,
}: {
  reset: () => void;
  admin?: boolean;
}) {
  const { messages } = useLocale();
  const copy = messages.progress;
  return (
    <main className="page-shell analytics-page" id="main-content" role="alert">
      <div className="analytics-empty-card">
        <h1>{admin ? messages.adminAnalytics.loadingError : copy.unavailableTitle}</h1>
        <p>{copy.unavailableDescription}</p>
        <Button type="button" onClick={reset}>
          {messages.problemBank.errorAction}
        </Button>
      </div>
    </main>
  );
}
