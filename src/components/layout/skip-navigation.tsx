"use client";

import { useLocale } from "@/components/providers/locale-provider";

export function SkipNavigation() {
  const { messages } = useLocale();
  return (
    <a className="skip-link" href="#main-content">
      {messages.actions.skipNavigation}
    </a>
  );
}
