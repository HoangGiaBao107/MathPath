export const targetScoreStorageKey = "mathpath.target-score.v1";
export const onboardingDismissedStorageKey = "mathpath.target-score-dismissed.v1";
const targetScoreChangedEvent = "mathpath:target-score-changed";
let sessionTargetScore: number | null = null;

export type GuestStorage = Pick<Storage, "getItem" | "setItem">;

export function formatTargetScore(score: number, locale: "vi" | "en"): string {
  const formatted = Number.isInteger(score)
    ? String(score)
    : score.toLocaleString(locale === "vi" ? "vi-VN" : "en-US", { maximumFractionDigits: 1 });
  return Number.isInteger(score) && score >= 5 && score < 10 ? `${formatted}+` : formatted;
}

export function parseTargetScore(value: string | null): number | null {
  if (value === null || value.trim() === "") return null;
  const score = Number(value);
  return Number.isFinite(score) && score >= 0 && score <= 10 ? score : null;
}

export function readGuestTargetScore(storage: GuestStorage): number | null {
  try {
    return parseTargetScore(storage.getItem(targetScoreStorageKey));
  } catch {
    return null;
  }
}

export function saveGuestTargetScore(storage: GuestStorage, score: number): boolean {
  if (!Number.isFinite(score) || score < 0 || score > 10) return false;
  try {
    storage.setItem(targetScoreStorageKey, String(score));
    return true;
  } catch {
    return false;
  }
}

export function subscribeToTargetScoreChanges(listener: () => void) {
  if (typeof window === "undefined") return () => undefined;
  window.addEventListener(targetScoreChangedEvent, listener);
  window.addEventListener("storage", listener);
  return () => {
    window.removeEventListener(targetScoreChangedEvent, listener);
    window.removeEventListener("storage", listener);
  };
}

export function notifyTargetScoreChanged() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(targetScoreChangedEvent));
}

export function setSessionTargetScore(score: number) {
  sessionTargetScore = score;
}

export function getTargetScoreSnapshot(): number | null {
  if (typeof window === "undefined") return null;
  try {
    const storedScore = readGuestTargetScore(window.localStorage);
    return storedScore ?? sessionTargetScore;
  } catch {
    return sessionTargetScore;
  }
}

export function getTargetScoreServerSnapshot(): null {
  return null;
}

export function getOnboardingSnapshot(): string {
  const score = getTargetScoreSnapshot();
  let dismissed = false;
  try {
    dismissed = window.sessionStorage.getItem(onboardingDismissedStorageKey) === "1";
  } catch {
    /* Session state is optional. */
  }
  return `${score === null ? "none" : score}|${dismissed ? "1" : "0"}`;
}

export function getOnboardingServerSnapshot(): null {
  return null;
}
