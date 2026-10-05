"use client";

import { useLocale } from "@/components/providers/locale-provider";

export default function Loading() {
  const { messages } = useLocale();
  const copy = messages.problemBank;

  return (
    <main className="site-main problem-bank-loading" id="main-content" aria-busy="true">
      <div className="container">
        <div className="problem-bank-skeleton" />
        <h1>{copy.loadingTitle}</h1>
        <p>{copy.loadingDescription}</p>
        <div className="problem-bank-skeleton-grid" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      </div>
    </main>
  );
}
