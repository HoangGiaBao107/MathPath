"use client";

import { useLocale } from "@/components/providers/locale-provider";
import { examDisplayTitle } from "@/lib/exams/display-title";

export function TopicPracticeTitle({ title }: { title: string }) {
  const { locale } = useLocale();
  return <h1>{examDisplayTitle(title, locale)}</h1>;
}
