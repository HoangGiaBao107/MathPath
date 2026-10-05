"use client";

import { AnalyticsErrorState } from "@/components/analytics/analytics-error-state";

export default function ProgressError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <AnalyticsErrorState reset={reset} />;
}
