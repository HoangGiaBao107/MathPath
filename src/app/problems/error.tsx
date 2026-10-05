"use client";

import { useLocale } from "@/components/providers/locale-provider";
import { Button } from "@/components/ui/button";

export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { messages } = useLocale();
  const copy = messages.problemBank;

  return (
    <main className="site-main problem-bank-error" id="main-content" role="alert">
      <span aria-hidden="true">!</span>
      <h1>{copy.errorTitle}</h1>
      <p>{copy.errorDescription}</p>
      <Button onClick={reset}>{copy.errorAction}</Button>
    </main>
  );
}
