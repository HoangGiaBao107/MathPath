import { authMessages } from "@/lib/i18n/auth-messages";
import type { Locale } from "@/lib/i18n/types";

export function getScoreGoalMessage(score: number | undefined, goal: number | null, locale: Locale) {
  const copy = authMessages[locale];
  const numberLocale = locale === "vi" ? "vi-VN" : "en-US";
  if (goal === null) {
    return {
      title: copy.scoreSetGoal,
      body: score === undefined
        ? (locale === "vi" ? "Làm thử một đề đầu tiên nhé — mình sẽ cùng bạn xem từng bước tiến." : "Try your first exam and we’ll celebrate each step forward.")
        : copy.scoreWithNoGoal.replace("{score}", score.toLocaleString(numberLocale, { maximumFractionDigits: 1 })),
    };
  }
  const goalText = goal.toLocaleString(numberLocale, { maximumFractionDigits: 1 });
  if (score === undefined) return { title: copy.scoreNoAttempts.replace("{goal}", goalText), body: "" };
  if (score > goal) return { title: copy.scoreGoalExceeded.replace("{goal}", goalText), body: "" };
  if (score === goal) return { title: copy.scoreGoalReached.replace("{goal}", goalText), body: "" };
  return {
    title: copy.scoreGoalProgress
      .replace("{goal}", goalText)
      .replace("{gap}", (goal - score).toLocaleString(numberLocale, { maximumFractionDigits: 1 })),
    body: "",
  };
}
