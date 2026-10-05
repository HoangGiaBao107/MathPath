"use client";

import { useCallback, useEffect, useState, useSyncExternalStore, type FormEvent } from "react";
import { useLocale } from "@/components/providers/locale-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { interpolate } from "@/lib/i18n/messages";
import {
  getOnboardingServerSnapshot,
  getOnboardingSnapshot,
  notifyTargetScoreChanged,
  onboardingDismissedStorageKey,
  saveGuestTargetScore,
  setSessionTargetScore,
  subscribeToTargetScoreChanges,
} from "@/lib/onboarding/target-score";

const scoreOptions = [5, 6, 7, 8, 9, 10] as const;

export function TargetScoreOnboarding() {
  const { messages, locale } = useLocale();
  const snapshot = useSyncExternalStore(
    subscribeToTargetScoreChanges,
    getOnboardingSnapshot,
    getOnboardingServerSnapshot,
  );
  const [manuallyOpen, setManuallyOpen] = useState(false);
  const [manuallyDismissed, setManuallyDismissed] = useState(false);
  const [selected, setSelected] = useState<number | null>(8);
  const [customMode, setCustomMode] = useState(false);
  const [customValue, setCustomValue] = useState("");
  const [error, setError] = useState("");
  const [scoreText, dismissedText] = snapshot?.split("|") ?? [];
  const targetScore = scoreText && scoreText !== "none" ? Number(scoreText) : null;
  const dismissed = dismissedText === "1";
  const open =
    manuallyOpen || (snapshot !== null && targetScore === null && !dismissed && !manuallyDismissed);

  useEffect(() => {
    const editGoal = () => {
      const isPreset =
        targetScore !== null && scoreOptions.includes(targetScore as (typeof scoreOptions)[number]);
      setSelected(isPreset ? targetScore : 8);
      setCustomMode(targetScore !== null && !isPreset);
      setCustomValue(targetScore !== null && !isPreset ? String(targetScore) : "");
      setError("");
      setManuallyDismissed(false);
      setManuallyOpen(true);
    };
    window.addEventListener("mathpath:edit-goal", editGoal);
    return () => window.removeEventListener("mathpath:edit-goal", editGoal);
  }, [targetScore]);

  const dismiss = useCallback(() => {
    setManuallyDismissed(true);
    setManuallyOpen(false);
    try {
      window.sessionStorage.setItem(onboardingDismissedStorageKey, "1");
    } catch {
      /* The dialog remains skippable without storage. */
    }
    notifyTargetScoreChanged();
  }, []);

  function save(score: number) {
    let saved = false;
    try {
      saved = saveGuestTargetScore(window.localStorage, score);
    } catch {
      /* Storage may be disabled by the browser. */
    }
    if (!saved) setSessionTargetScore(score);
    void fetch("/api/auth/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetScore: score, language: locale }),
    }).catch(() => undefined);
    notifyTargetScoreChanged();
    dismiss();
  }

  function submitCustom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!customMode && selected !== null) {
      save(selected);
      return;
    }
    const value = Number(customValue.replace(",", "."));
    if (customValue.trim() === "" || !Number.isFinite(value) || value < 0 || value > 10) {
      setError(messages.onboarding.invalid);
      return;
    }
    save(value);
  }

  if (snapshot === null) return null;

  return (
    <Modal
      open={open}
      title={messages.onboarding.title}
      description={messages.onboarding.description}
      onClose={dismiss}
      closeLabel={messages.onboarding.close}
    >
      <div className="onboarding-body">
        <fieldset className="score-choice-group">
          <legend>{messages.onboarding.question}</legend>
          <div className="score-options">
            {scoreOptions.map((score) => (
              <button
                aria-pressed={!customMode && selected === score}
                aria-label={interpolate(messages.onboarding.optionLabel, {
                  score: `${score}${score === 10 ? "" : "+"}`,
                })}
                className="score-option"
                key={score}
                onClick={() => {
                  setCustomMode(false);
                  setSelected(score);
                  setError("");
                }}
                type="button"
              >
                {score === 10 ? "10" : `${score}+`}
              </button>
            ))}
          </div>
        </fieldset>
        <form className="custom-score-form" onSubmit={submitCustom}>
          <Input
            id="custom-target-score"
            label={messages.onboarding.customLabel}
            helperText={messages.onboarding.customHint}
            type="number"
            min="0"
            max="10"
            step="0.1"
            inputMode="decimal"
            value={customValue}
            errorMessage={error || undefined}
            onFocus={() => {
              setCustomMode(true);
              setError("");
            }}
            onChange={(event) => {
              setCustomValue(event.target.value);
              setCustomMode(true);
              setError("");
            }}
          />
          <div className="onboarding-actions">
            <Button className="onboarding-submit" type="submit" size="large">
              {messages.onboarding.save}
            </Button>
          </div>
        </form>
        <button className="onboarding-skip" onClick={dismiss} type="button">
          {messages.onboarding.skip}
        </button>
      </div>
    </Modal>
  );
}
