"use client";

import { AnalyticsErrorState } from "@/components/analytics/analytics-error-state";

export default function AdminAnalyticsError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <AnalyticsErrorState admin reset={reset} />;
}
