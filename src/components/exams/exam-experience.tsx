"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ClipboardEvent,
} from "react";
import { useLocale } from "@/components/providers/locale-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { interpolate } from "@/lib/i18n/messages";
import { MathContentView } from "@/components/problems/math-content-view";
import { validateShortAnswer } from "@/lib/exams/short-answer";
import type { ExamAnswer, ExamPublicSummary, PublicExamAttempt } from "@/lib/exams/types";

type Phase = "loading" | "intro" | "active" | "submitted" | "error";
type DraftState = { answer: ExamAnswer | null; markedForReview: boolean };

export function ExamExperience({ exam }: { exam: ExamPublicSummary }) {
  const { locale, messages } = useLocale();
  const copy = messages.exam;
  const title = exam.mode === "practice" ? copy.practiceTitle : copy.officialPresetTitle;
  const description =
    exam.mode === "practice" ? copy.practiceDescription : copy.officialDescription;
  const [phase, setPhase] = useState<Phase>("loading");
  const [attempt, setAttempt] = useState<PublicExamAttempt | null>(null);
  const attemptRef = useRef<PublicExamAttempt | null>(null);
  const mountedRef = useRef(false);
  const [drafts, setDrafts] = useState<Record<string, DraftState>>({});
  const draftsRef = useRef<Record<string, DraftState>>({});
  const [dirtyCount, setDirtyCount] = useState(0);
  const dirtyIdsRef = useRef(new Set<string>());
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());
  const [saveError, setSaveError] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [requestError, setRequestError] = useState("");
  const [guestLimitReached, setGuestLimitReached] = useState(false);
  const guestLimitReachedRef = useRef(false);
  const [isGuest, setIsGuest] = useState(false);
  const guestQuestionUsageRef = useRef(0);
  const persistedDraftsRef = useRef<Record<string, DraftState>>({});
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [clockNow, setClockNow] = useState(0);
  const startKeyRef = useRef<string | null>(null);
  const submitKeyRef = useRef<string | null>(null);
  const autoSubmitTriggeredRef = useRef(false);
  const currentQuestionRef = useRef<HTMLDivElement>(null);

  const orderedQuestions = useMemo(() => attempt?.questions ?? [], [attempt?.questions]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const currentQuestion = orderedQuestions[currentIndex];
  const currentDraft = currentQuestion ? drafts[currentQuestion.id] : undefined;
  const isCountdown = attempt?.deadlineAt !== null && attempt?.deadlineAt !== undefined;
  const millisecondsLeft = isCountdown
    ? Math.max(0, Date.parse(attempt.deadlineAt!) - clockNow)
    : 0;
  const elapsedSeconds = attempt
    ? Math.max(0, Math.floor((clockNow - Date.parse(attempt.startedAt)) / 1000))
    : 0;
  const remainingSeconds = Math.ceil(millisecondsLeft / 1000);
  const timerText = formatClock(isCountdown ? remainingSeconds : elapsedSeconds);
  const countSummary = useMemo(() => {
    let answered = 0;
    let marked = 0;
    for (const question of orderedQuestions) {
      const state = drafts[question.id];
      if (state && hasDraftAnswer(state.answer)) answered += 1;
      if (state?.markedForReview) marked += 1;
    }
    return { answered, unanswered: orderedQuestions.length - answered, marked };
  }, [drafts, orderedQuestions]);

  const applyAttempt = useCallback((nextAttempt: PublicExamAttempt) => {
    attemptRef.current = nextAttempt;
    setAttempt(nextAttempt);
    const nextDrafts: Record<string, DraftState> = Object.fromEntries(
      Object.entries(nextAttempt.answers).map(([questionId, state]) => [
        questionId,
        { answer: state.answer, markedForReview: state.markedForReview },
      ]),
    );
    draftsRef.current = nextDrafts;
    persistedDraftsRef.current = nextDrafts;
    setDrafts(nextDrafts);
    dirtyIdsRef.current.clear();
    setDirtyCount(0);
    setSaveError(false);
    setCurrentIndex(0);
    setClockNow(Date.now());
    setPhase(nextAttempt.status === "in_progress" ? "active" : "submitted");
  }, []);

  const loadCurrent = useCallback(
    async (restartPreviousAttempt = false) => {
      setRequestError("");
      try {
        const response = await fetch(`/api/attempts?examId=${encodeURIComponent(exam.id)}`, {
          cache: "no-store",
        });
        if (!response.ok) throw new Error("load");
        const data = (await response.json()) as {
          attempt: PublicExamAttempt | null;
          guestQuestionUsage?: number;
          isGuest?: boolean;
        };
        guestQuestionUsageRef.current = data.guestQuestionUsage ?? 0;
        guestLimitReachedRef.current = data.isGuest === true && guestQuestionUsageRef.current >= 10;
        setIsGuest(data.isGuest === true);
        setGuestLimitReached(guestLimitReachedRef.current);
        if (data.attempt && restartPreviousAttempt) {
          const abandonResponse = await fetch(`/api/attempts/${data.attempt.id}/abandon`, {
            method: "POST",
            keepalive: true,
          });
          if (!abandonResponse.ok) throw new Error("abandon");
          attemptRef.current = null;
          setPhase("intro");
        } else if (data.attempt) applyAttempt(data.attempt);
        else setPhase("intro");
      } catch {
        setRequestError(copy.loadError);
        setPhase("error");
      }
    },
    [applyAttempt, copy.loadError, exam.id],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => void loadCurrent(true), 0);
    return () => window.clearTimeout(timer);
  }, [loadCurrent]);

  useEffect(() => {
    mountedRef.current = true;
    const abandonOnExit = () => {
      const current = attemptRef.current;
      if (!current || current.status !== "in_progress") return;
      const url = `/api/attempts/${current.id}/abandon`;
      const body = new Blob([], { type: "text/plain" });
      if (!navigator.sendBeacon(url, body)) {
        void fetch(url, { method: "POST", keepalive: true }).catch(() => undefined);
      }
    };
    window.addEventListener("pagehide", abandonOnExit);
    return () => {
      window.removeEventListener("pagehide", abandonOnExit);
      mountedRef.current = false;
      queueMicrotask(() => {
        if (!mountedRef.current) abandonOnExit();
      });
    };
  }, [attempt?.id]);

  useEffect(() => {
    if (phase !== "active") return;
    const tick = () => setClockNow(Date.now());
    tick();
    const interval = window.setInterval(tick, 500);
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") tick();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [phase]);

  const submitAttempt = useCallback(
    async (reason: "manual" | "auto") => {
      if (!attempt || isSubmitting) return;
      setIsSubmitting(true);
      setRequestError("");
      submitKeyRef.current ??= crypto.randomUUID();
      try {
        const response = await fetch(`/api/attempts/${attempt.id}/submit`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ requestId: submitKeyRef.current, reason }),
        });
        if (!response.ok) throw new Error("submit");
        const data = (await response.json()) as { attempt: PublicExamAttempt };
        applyAttempt(data.attempt);
        setConfirmOpen(false);
      } catch {
        setRequestError(copy.submitError);
      } finally {
        setIsSubmitting(false);
      }
    },
    [applyAttempt, attempt, copy.submitError, isSubmitting],
  );

  useEffect(() => {
    if (
      phase === "active" &&
      isCountdown &&
      remainingSeconds <= 0 &&
      !autoSubmitTriggeredRef.current
    ) {
      autoSubmitTriggeredRef.current = true;
      void submitAttempt("auto");
    }
  }, [isCountdown, phase, remainingSeconds, submitAttempt]);

  useEffect(() => {
    if (phase !== "active") return;
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target;
      if (target instanceof HTMLElement && /INPUT|TEXTAREA|SELECT/.test(target.tagName)) return;
      if (event.altKey && event.key === "ArrowLeft") {
        event.preventDefault();
        setCurrentIndex((index) => Math.max(0, index - 1));
      }
      if (event.altKey && event.key === "ArrowRight") {
        event.preventDefault();
        setCurrentIndex((index) => Math.min(orderedQuestions.length - 1, index + 1));
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [orderedQuestions.length, phase]);

  useEffect(() => {
    currentQuestionRef.current?.focus({ preventScroll: true });
  }, [currentIndex]);

  async function startAttempt() {
    if (isStarting) return;
    setIsStarting(true);
    setRequestError("");
    startKeyRef.current ??= crypto.randomUUID();
    try {
      const response = await fetch("/api/attempts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ examId: exam.id, requestKey: startKeyRef.current }),
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as {
          error?: { code?: string };
        } | null;
        if (data?.error?.code === "guest_question_limit_reached") {
          setGuestLimitReached(true);
          setRequestError(copy.guestLimitReached);
          return;
        }
        throw new Error("start");
      }
      const data = (await response.json()) as { attempt: PublicExamAttempt; isGuest?: boolean };
      setIsGuest(data.isGuest === true);
      applyAttempt(data.attempt);
    } catch {
      setRequestError(copy.startError);
    } finally {
      setIsStarting(false);
    }
  }

  function retakeAttempt() {
    startKeyRef.current = crypto.randomUUID();
    submitKeyRef.current = null;
    autoSubmitTriggeredRef.current = false;
    setRequestError("");
    void startAttempt();
  }

  function updateDraft(questionId: string, update: Partial<DraftState>) {
    const current = draftsRef.current[questionId];
    const next = {
      ...draftsRef.current,
      [questionId]: { ...draftsRef.current[questionId], ...update },
    };
    const state = next[questionId];
    const question = orderedQuestions.find((item) => item.id === questionId);
    if (!question || !state) return;
    const validation = validateDraft(question, state.answer);
    if (validation) {
      draftsRef.current = next;
      setDrafts(next);
      setValidationErrors((errors) => ({ ...errors, [questionId]: copy.invalidAnswer }));
      return;
    }
    if (isGuest && hasDraftAnswer(state.answer) && !hasDraftAnswer(current?.answer)) {
      if (guestQuestionUsageRef.current >= 10) {
        guestLimitReachedRef.current = true;
        setGuestLimitReached(true);
        return;
      }
      guestQuestionUsageRef.current += 1;
      if (guestQuestionUsageRef.current >= 10) {
        guestLimitReachedRef.current = true;
        setGuestLimitReached(true);
      }
    }
    draftsRef.current = next;
    setDrafts(next);
    setValidationErrors((errors) => {
      return Object.fromEntries(Object.entries(errors).filter(([id]) => id !== questionId));
    });
    enqueueSave(questionId, state);
  }

  function enqueueSave(questionId: string, state: DraftState) {
    if (!attempt) return;
    dirtyIdsRef.current.add(questionId);
    setDirtyCount(dirtyIdsRef.current.size);
    saveQueueRef.current = saveQueueRef.current
      .catch(() => undefined)
      .then(async () => {
        const response = await fetch(`/api/attempts/${attempt.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            questionId,
            answer: state.answer,
            markedForReview: state.markedForReview,
          }),
        });
        if (!response.ok) {
          const data = (await response.json().catch(() => null)) as {
            error?: { code?: string };
          } | null;
          if (data?.error?.code === "guest_question_limit_reached") {
            const persisted = persistedDraftsRef.current[questionId] ?? {
              answer: null,
              markedForReview: false,
            };
            const restored = { ...draftsRef.current, [questionId]: persisted };
            draftsRef.current = restored;
            setDrafts(restored);
            guestQuestionUsageRef.current = Math.max(10, guestQuestionUsageRef.current);
            guestLimitReachedRef.current = true;
            setGuestLimitReached(true);
            dirtyIdsRef.current.delete(questionId);
            setDirtyCount(dirtyIdsRef.current.size);
            setSaveError(false);
            return;
          }
          if (
            response.status === 400 &&
            ["too_long", "invalid_characters", "invalid_number", "invalid_answer"].includes(
              data?.error?.code ?? "",
            )
          ) {
            setValidationErrors((errors) => ({ ...errors, [questionId]: copy.invalidAnswer }));
            dirtyIdsRef.current.delete(questionId);
            setDirtyCount(dirtyIdsRef.current.size);
            if (dirtyIdsRef.current.size === 0) setSaveError(false);
            return;
          }
          throw new Error("save");
        }
        const latest = draftsRef.current[questionId];
        persistedDraftsRef.current = {
          ...persistedDraftsRef.current,
          [questionId]: state,
        };
        if (JSON.stringify(latest) === JSON.stringify(state))
          dirtyIdsRef.current.delete(questionId);
        setDirtyCount(dirtyIdsRef.current.size);
        if (dirtyIdsRef.current.size === 0) setSaveError(false);
      })
      .catch(() => {
        setSaveError(true);
      });
  }

  async function retryUnsavedAnswers() {
    for (const questionId of dirtyIdsRef.current) {
      const state = draftsRef.current[questionId];
      const question = orderedQuestions.find((item) => item.id === questionId);
      if (state && question && !validateDraft(question, state.answer))
        enqueueSave(questionId, state);
    }
    await saveQueueRef.current;
  }

  async function confirmSubmission() {
    await saveQueueRef.current;
    if (dirtyIdsRef.current.size > 0 || Object.keys(validationErrors).length > 0) {
      setSaveError(true);
      setConfirmOpen(false);
      return;
    }
    await submitAttempt("manual");
  }

  const timeLabel = isCountdown ? copy.countdownLabel : copy.elapsedLabel;
  const timerAccessible = `${timeLabel}: ${timerText}`;

  return (
    <main className="site-main exam-page" id="main-content">
      <div className="container exam-container">
        {phase === "loading" ? (
          <div className="exam-center-state" role="status">
            <span className="exam-spinner" />
            {messages.problemBank.loadingTitle}
          </div>
        ) : null}

        {phase === "error" ? (
          <Card className="exam-intro-card">
            <h1>{copy.loadError}</h1>
            <Button onClick={() => void loadCurrent()}>{copy.retry}</Button>
          </Card>
        ) : null}

        {phase === "intro" ? (
          <Card className="exam-intro-card">
            <Badge tone="primary">
              {exam.mode === "practice" ? copy.practiceTitle : copy.officialPresetTitle}
            </Badge>
            <h1>{title}</h1>
            <p className="exam-intro-description">{description}</p>
            <dl className="exam-intro-metrics">
              <div>
                <dt>{messages.problemBank.questionCount}</dt>
                <dd>{exam.questionCount}</dd>
              </div>
              <div>
                <dt>{copy.scoreLabel}</dt>
                <dd>{formatScore(exam.totalScore, locale)}</dd>
              </div>
              <div>
                <dt>{timeLabel}</dt>
                <dd>{exam.durationSeconds ? formatClock(exam.durationSeconds) : "—"}</dd>
              </div>
            </dl>
            <ul className="exam-section-list">
              {exam.sections.map((section) => (
                <li key={section.id}>
                  <span>{section.title}</span>
                  <strong>
                    {formatScore(section.maxScore, locale)} {copy.scoreLabel.toLowerCase()}
                  </strong>
                </li>
              ))}
            </ul>
            {requestError ? (
              <p className="exam-error-message" role="alert">
                {requestError}
              </p>
            ) : null}
            {guestLimitReached ? (
              <p className="exam-error-message" role="alert">
                {copy.guestLimitReached} <Link href="/auth/register">{copy.guestLimitAction}</Link>
                {" · "}
                <Link href="/auth/login">{copy.guestLimitLogin}</Link>
              </p>
            ) : null}
            <Button
              className="exam-start-button"
              disabled={isStarting || guestLimitReached}
              onClick={() => void startAttempt()}
              size="large"
            >
              {isStarting ? copy.starting : copy.start}
            </Button>
          </Card>
        ) : null}

        {phase === "active" && attempt && currentQuestion ? (
          <>
            <div className="exam-toolbar">
              <div className="exam-toolbar-title">
                <h1>{title}</h1>
                <span>
                  {interpolate(copy.questionOf, {
                    current: currentIndex + 1,
                    total: orderedQuestions.length,
                  })}
                </span>
              </div>
              <div
                className={`exam-timer ${isCountdown && remainingSeconds <= 300 ? "exam-timer--urgent" : ""}`}
              >
                <span>{timeLabel}</span>
                <time
                  aria-label={timerAccessible}
                  aria-live={isCountdown && remainingSeconds <= 60 ? "polite" : "off"}
                >
                  {timerText}
                </time>
              </div>
            </div>

            {requestError ? (
              <div className="exam-inline-error" role="alert">
                <span>{requestError}</span>
                <Button
                  onClick={() => {
                    if (isCountdown && remainingSeconds <= 0) void submitAttempt("auto");
                    else if (confirmOpen) void submitAttempt("manual");
                    else void loadCurrent();
                  }}
                  size="small"
                  variant="secondary"
                >
                  {copy.retry}
                </Button>
              </div>
            ) : null}
            {saveError ? (
              <div className="exam-save-error" role="alert">
                <p>{copy.syncError}</p>
                <Button onClick={() => void retryUnsavedAnswers()} variant="secondary">
                  {copy.retrySave}
                </Button>
              </div>
            ) : null}
            {guestLimitReached ? (
              <div className="exam-save-error" role="alert">
                <p>{copy.guestLimitReached}</p>
                <Link className="button button--secondary" href="/auth/register">
                  {copy.guestLimitAction}
                </Link>
                <Link className="button button--secondary" href="/auth/login">
                  {copy.guestLimitLogin}
                </Link>
              </div>
            ) : null}

            <div className="exam-workspace">
              <section className="exam-question-column" aria-label={title}>
                <div className="exam-section-heading">
                  <span>
                    {
                      exam.sections.find((section) => section.id === currentQuestion.sectionId)
                        ?.title
                    }
                  </span>
                  <span>
                    {interpolate(copy.questionOf, {
                      current: currentIndex + 1,
                      total: orderedQuestions.length,
                    })}
                  </span>
                </div>
                <Card className="exam-question-card">
                  <div className="exam-question-header">
                    <span className="exam-question-number">
                      {copy.question} {currentQuestion.number}
                    </span>
                    <span className="exam-save-status" aria-live="polite" role="status">
                      {dirtyCount > 0 ? copy.saving : copy.answerSaved}
                    </span>
                    <Button
                      aria-pressed={currentDraft?.markedForReview ?? false}
                      disabled={guestLimitReached}
                      onClick={() =>
                        updateDraft(currentQuestion.id, {
                          markedForReview: !currentDraft?.markedForReview,
                        })
                      }
                      variant="secondary"
                    >
                      {currentDraft?.markedForReview ? copy.removeReviewMark : copy.markForReview}
                    </Button>
                  </div>
                  <div ref={currentQuestionRef} className="exam-question-body" tabIndex={-1}>
                    <h2>
                      <MathContentView
                        value={
                          locale === "en" && currentQuestion.displayStemEn
                            ? currentQuestion.displayStemEn
                            : (currentQuestion.displayStemVi ?? currentQuestion.stem)
                        }
                      />
                    </h2>
                    {currentQuestion.type === "multiple_choice" ? (
                      <fieldset className="exam-options">
                        <legend>{copy.answerOptions}</legend>
                        {currentQuestion.options.map((option) => (
                          <label className="exam-option" key={option.key}>
                            <input
                              checked={
                                currentDraft?.answer?.type === "multiple_choice" &&
                                currentDraft.answer.optionKey === option.key
                              }
                              name={`answer-${currentQuestion.id}`}
                              onChange={() =>
                                updateDraft(currentQuestion.id, {
                                  answer: { type: "multiple_choice", optionKey: option.key },
                                })
                              }
                              type="radio"
                              disabled={guestLimitReached}
                              value={option.key}
                            />
                            <span className="exam-option-key">{option.key}</span>
                            <span>
                              <MathContentView
                                value={
                                  locale === "en" && option.displayTextEn
                                    ? option.displayTextEn
                                    : option.text
                                }
                              />
                            </span>
                          </label>
                        ))}
                      </fieldset>
                    ) : null}

                    {currentQuestion.type === "true_false" ? (
                      <div className="exam-tf-wrap">
                        <p>{copy.trueFalseInstructions}</p>
                        <table className="exam-tf-table">
                          <thead>
                            <tr>
                              <th scope="col">{copy.question}</th>
                              <th scope="col">{copy.trueLabel}</th>
                              <th scope="col">{copy.falseLabel}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {currentQuestion.statements.map((statement) => {
                              const selected =
                                currentDraft?.answer?.type === "true_false"
                                  ? currentDraft.answer.statements[statement.key]
                                  : undefined;
                              return (
                                <tr key={statement.key}>
                                  <th scope="row">
                                    <span className="exam-statement-key">{statement.key}</span>
                                    <MathContentView
                                      value={
                                        locale === "en" && statement.displayTextEn
                                          ? statement.displayTextEn
                                          : statement.text
                                      }
                                    />
                                  </th>
                                  {[true, false].map((value) => (
                                    <td key={String(value)}>
                                      <label className="exam-tf-choice">
                                        <input
                                          checked={selected === value}
                                          name={`tf-${currentQuestion.id}-${statement.key}`}
                                          onChange={() =>
                                            updateDraft(currentQuestion.id, {
                                              answer: {
                                                type: "true_false",
                                                statements: {
                                                  ...(currentDraft?.answer?.type === "true_false"
                                                    ? currentDraft.answer.statements
                                                    : {}),
                                                  [statement.key]: value,
                                                },
                                              },
                                            })
                                          }
                                          type="radio"
                                          disabled={guestLimitReached}
                                          value={String(value)}
                                        />
                                        <span className="sr-only">
                                          {value ? copy.trueLabel : copy.falseLabel} —{" "}
                                          {statement.key}
                                        </span>
                                      </label>
                                    </td>
                                  ))}
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    ) : null}

                    {currentQuestion.type === "short_answer" ? (
                      <div className="exam-short-answer-field">
                        <label htmlFor={`short-${currentQuestion.id}`}>
                          {copy.shortAnswerLabel}
                        </label>
                        <input
                          disabled={guestLimitReached}
                          aria-describedby={`short-hint-${currentQuestion.id}${validationErrors[currentQuestion.id] ? ` short-error-${currentQuestion.id}` : ""}`}
                          aria-invalid={Boolean(validationErrors[currentQuestion.id])}
                          autoComplete="off"
                          id={`short-${currentQuestion.id}`}
                          inputMode="text"
                          maxLength={4}
                          onChange={(event) =>
                            onShortAnswerChange(
                              event,
                              currentQuestion.id,
                              currentDraft,
                              updateDraft,
                            )
                          }
                          onPaste={(event) =>
                            onShortAnswerPaste(
                              event,
                              currentQuestion.id,
                              currentDraft,
                              updateDraft,
                              setValidationErrors,
                              copy.invalidAnswer,
                            )
                          }
                          type="text"
                          value={
                            currentDraft?.answer?.type === "short_answer"
                              ? currentDraft.answer.raw
                              : ""
                          }
                        />
                        <span id={`short-hint-${currentQuestion.id}`}>{copy.shortAnswerHint}</span>
                        {validationErrors[currentQuestion.id] ? (
                          <span
                            className="exam-validation-error"
                            id={`short-error-${currentQuestion.id}`}
                            role="alert"
                          >
                            {validationErrors[currentQuestion.id]}
                          </span>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                  <div className="exam-question-navigation">
                    <Button
                      disabled={currentIndex === 0}
                      onClick={() => setCurrentIndex((index) => Math.max(0, index - 1))}
                      variant="secondary"
                    >
                      {copy.previous}
                    </Button>
                    <span>
                      {interpolate(copy.questionOf, {
                        current: currentIndex + 1,
                        total: orderedQuestions.length,
                      })}
                    </span>
                    <Button
                      disabled={currentIndex === orderedQuestions.length - 1}
                      onClick={() =>
                        setCurrentIndex((index) => Math.min(orderedQuestions.length - 1, index + 1))
                      }
                      variant="secondary"
                    >
                      {copy.next}
                    </Button>
                  </div>
                </Card>
                <p className="exam-microcopy">{copy.duringHint}</p>
              </section>

              <aside className="exam-navigator" aria-label={copy.navigator}>
                <div className="exam-navigator-heading">
                  <h2>{copy.navigator}</h2>
                  <span>{interpolate(copy.submitCounts, { ...countSummary })}</span>
                </div>
                {attempt.exam.sections.map((section) => (
                  <div className="exam-navigator-section" key={section.id}>
                    <h3>{section.title}</h3>
                    <div className="exam-question-grid">
                      {orderedQuestions.map((question, index) => {
                        if (question.sectionId !== section.id) return null;
                        const state = drafts[question.id];
                        const answered = state ? hasDraftAnswer(state.answer) : false;
                        const marked = state?.markedForReview ?? false;
                        return (
                          <button
                            aria-current={currentIndex === index ? "step" : undefined}
                            aria-label={`${copy.question} ${question.number}, ${answered ? copy.answered : copy.unanswered}${marked ? `, ${copy.marked}` : ""}`}
                            className={`exam-question-index${currentIndex === index ? " is-current" : ""}${answered ? " is-answered" : ""}${marked ? " is-marked" : ""}`}
                            key={question.id}
                            onClick={() => setCurrentIndex(index)}
                            type="button"
                          >
                            {question.number}
                            {marked ? <span aria-hidden="true">*</span> : null}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
                <div className="exam-legend">
                  <span>
                    <i className="is-answered" />
                    {copy.answered}
                  </span>
                  <span>
                    <i />
                    {copy.unanswered}
                  </span>
                  <span>
                    <i className="is-marked" />
                    {copy.marked}
                  </span>
                </div>
                <div className="exam-submit-box">
                  <strong aria-label={timerAccessible}>{timerText}</strong>
                  <span>
                    {interpolate(isCountdown ? copy.remaining : copy.elapsed, { time: timerText })}
                  </span>
                  <Button className="exam-submit-button" onClick={() => setConfirmOpen(true)}>
                    {copy.submit}
                  </Button>
                </div>
              </aside>
            </div>

            <Modal
              closeLabel={messages.actions.close}
              description={copy.submitDescription}
              onClose={() => setConfirmOpen(false)}
              open={confirmOpen}
              title={copy.submitTitle}
            >
              <div className="exam-submit-modal-content">
                <p>{interpolate(copy.submitCounts, countSummary)}</p>
                {isCountdown ? (
                  <p>{interpolate(copy.remainingTime, { time: formatClock(remainingSeconds) })}</p>
                ) : null}
                {requestError ? (
                  <p role="alert" className="exam-error-message">
                    {requestError}
                  </p>
                ) : null}
                {dirtyCount > 0 || saveError ? (
                  <p className="exam-error-message" role="alert">
                    {copy.syncError}
                  </p>
                ) : null}
                <div className="exam-submit-modal-actions">
                  <Button onClick={() => setConfirmOpen(false)} variant="secondary">
                    {copy.returnToExam}
                  </Button>
                  <Button
                    disabled={
                      isSubmitting || dirtyCount > 0 || Object.keys(validationErrors).length > 0
                    }
                    onClick={() => void confirmSubmission()}
                  >
                    {isSubmitting ? copy.saving : copy.confirmSubmit}
                  </Button>
                </div>
              </div>
            </Modal>
          </>
        ) : null}

        {phase === "submitted" && attempt?.result ? (
          <Card className="exam-result-card" aria-labelledby="exam-result-title">
            <Badge tone="primary">
              {attempt.status === "auto_submitted" ? copy.autoSubmittedTitle : copy.submittedTitle}
            </Badge>
            <h1 id="exam-result-title">{copy.resultHeading}</h1>
            <p className="exam-result-lead">
              {attempt.status === "auto_submitted"
                ? copy.autoSubmittedDescription
                : copy.submittedDescription}
            </p>
            <div className="exam-result-score">
              <span>{copy.scoreLabel}</span>
              <strong>
                {formatScore(attempt.result.score, locale)}
                <small> / {formatScore(attempt.result.totalScore, locale)}</small>
              </strong>
            </div>
            <div className="exam-result-stats">
              <ResultStat label={copy.correctCount} value={attempt.result.correctCount} />
              {attempt.result.partialCount > 0 ? (
                <ResultStat label={copy.partialCount} value={attempt.result.partialCount} />
              ) : null}
              <ResultStat label={copy.incorrectCount} value={attempt.result.incorrectCount} />
              <ResultStat label={copy.unansweredCount} value={attempt.result.unansweredCount} />
              <ResultStat
                label={copy.durationLabel}
                value={formatClock(attempt.durationSeconds ?? 0)}
              />
            </div>
            <section className="exam-section-results" aria-label={copy.sectionResult}>
              <h2>{copy.sectionResult}</h2>
              {attempt.result.sectionOutcomes.map((section) => (
                <div className="exam-section-result-row" key={section.sectionId}>
                  <span>{section.title}</span>
                  <strong>
                    {formatScore(section.pointsEarned, locale)} /{" "}
                    {formatScore(section.pointsPossible, locale)}
                  </strong>
                </div>
              ))}
            </section>
            {(attempt.result.knowledgeOutcomes ?? []).length > 0 ? (
              <section className="exam-section-results" aria-label={copy.knowledgeResult}>
                <h2>{copy.knowledgeResult}</h2>
                {(attempt.result.knowledgeOutcomes ?? []).map((item) => (
                  <div
                    className="exam-section-result-row"
                    key={`${item.topic}:${item.subtopic ?? ""}`}
                  >
                    <span>
                      {item.topic}
                      {item.subtopic ? ` · ${item.subtopic}` : ""}
                    </span>
                    <strong>
                      {item.incorrectCount} {copy.wrongQuestions}
                      {item.partialCount > 0
                        ? ` · ${item.partialCount} ${copy.partialQuestions}`
                        : ""}
                    </strong>
                  </div>
                ))}
              </section>
            ) : null}
            <Link className="button button--secondary exam-result-link" href="/problems">
              {copy.goToBank}
            </Link>
            <Button className="exam-retake-button" disabled={isStarting} onClick={retakeAttempt}>
              {isStarting ? copy.starting : copy.retake}
            </Button>
          </Card>
        ) : null}
      </div>
    </main>
  );
}

function onShortAnswerChange(
  event: ChangeEvent<HTMLInputElement>,
  questionId: string,
  current: DraftState | undefined,
  update: (id: string, value: Partial<DraftState>) => void,
) {
  const raw = event.target.value;
  update(questionId, {
    answer: raw ? { type: "short_answer", raw } : null,
    markedForReview: current?.markedForReview ?? false,
  });
}

function onShortAnswerPaste(
  event: ClipboardEvent<HTMLInputElement>,
  questionId: string,
  current: DraftState | undefined,
  update: (id: string, value: Partial<DraftState>) => void,
  setErrors: (updater: (errors: Record<string, string>) => Record<string, string>) => void,
  errorCopy: string,
) {
  const input = event.currentTarget;
  const pasted = event.clipboardData.getData("text");
  const nextValue = `${input.value.slice(0, input.selectionStart ?? input.value.length)}${pasted}${input.value.slice(input.selectionEnd ?? input.value.length)}`;
  const validation = validateShortAnswer(nextValue);
  if (!validation.valid) {
    event.preventDefault();
    setErrors((errors) => ({ ...errors, [questionId]: errorCopy }));
    return;
  }
  event.preventDefault();
  update(questionId, {
    answer: nextValue ? { type: "short_answer", raw: nextValue } : null,
    markedForReview: current?.markedForReview ?? false,
  });
}

function validateDraft(
  question: PublicExamAttempt["questions"][number],
  answer: ExamAnswer | null,
): boolean {
  if (!answer) return false;
  if (question.type === "short_answer" && answer.type === "short_answer") {
    return !validateShortAnswer(answer.raw).valid;
  }
  return false;
}

function hasDraftAnswer(answer: ExamAnswer | null | undefined): boolean {
  if (!answer) return false;
  if (answer.type === "short_answer") return answer.raw.trim().length > 0;
  if (answer.type === "multiple_choice") return answer.optionKey.length > 0;
  return Object.keys(answer.statements).length > 0;
}

function formatClock(totalSeconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function formatScore(value: number, locale: string): string {
  return new Intl.NumberFormat(locale === "vi" ? "vi-VN" : "en-US", {
    maximumFractionDigits: 2,
  }).format(value);
}

function ResultStat({ label, value }: { label: string; value: number | string }) {
  return (
    <div>
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}
