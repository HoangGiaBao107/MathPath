"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { MathContentView } from "@/components/problems/math-content-view";
import { useLocale } from "@/components/providers/locale-provider";
import { Card } from "@/components/ui/card";
import { interpolate } from "@/lib/i18n/messages";
import type { SolverResponse } from "@/lib/ai/types";

type Mode = "chat" | "solver" | "practice" | "recommendation";
type ChatMessage = { role: "user" | "assistant"; content: string };
type Quota = {
  kind: "guest" | "account" | "admin";
  plan: string;
  unlimited: boolean;
  remaining: number | null;
  limit: number | null;
  resetAt: string | null;
};
type Practice = {
  problemId: string;
  statement: string;
  questionType: "multiple_choice" | "short_answer";
  choices: string[];
  topic: string;
  difficulty: "easy" | "medium" | "hard";
};

export function AIWorkspace({
  initialMode,
  attemptId,
}: {
  initialMode: Mode;
  attemptId: string | null;
}) {
  const { locale, messages } = useLocale();
  const copy = messages.ai;
  const [mode, setMode] = useState<Mode>(initialMode);
  const [quota, setQuota] = useState<Quota | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [problemText, setProblemText] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const imageUrl = useMemo(() => (image ? URL.createObjectURL(image) : null), [image]);
  const fileInput = useRef<HTMLInputElement>(null);
  const [solution, setSolution] = useState<SolverResponse | null>(null);
  const [topic, setTopic] = useState("");
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard">("medium");
  const [practice, setPractice] = useState<Practice | null>(null);
  const [practiceAnswer, setPracticeAnswer] = useState("");
  const [graded, setGraded] = useState<{
    correct: boolean;
    correctAnswer: string;
    explanation: string;
  } | null>(null);
  const [recommendation, setRecommendation] = useState("");

  useEffect(() => {
    let active = true;
    void fetch("/api/ai/quota", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) return;
        const body = (await response.json()) as { quota: Quota };
        if (active) setQuota(body.quota);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  useEffect(
    () => () => {
      if (imageUrl) URL.revokeObjectURL(imageUrl);
    },
    [imageUrl],
  );

  function clearError() {
    setError(null);
  }

  async function sendChat() {
    if (!chatInput.trim() || busy) return;
    clearError();
    setBusy(true);
    const requestMessages = [
      ...chatMessages,
      { role: "user" as const, content: chatInput.trim() },
    ].slice(-12);
    try {
      const body = await postJson("/api/ai/chat", { locale, messages: requestMessages });
      setChatMessages([...requestMessages, { role: "assistant", content: body.answer as string }]);
      if (body.quota) setQuota(body.quota as Quota);
      setChatInput("");
    } catch (caught) {
      setError(errorCopy(caught, copy));
    } finally {
      setBusy(false);
    }
  }

  async function solveProblem() {
    if (busy || (!problemText.trim() && !image)) return;
    clearError();
    setBusy(true);
    setSolution(null);
    try {
      let body: Record<string, unknown>;
      if (image) {
        const form = new FormData();
        form.set("image", image);
        form.set("locale", locale);
        if (problemText.trim()) form.set("prompt", problemText.trim());
        const response = await fetch("/api/ai/solve/image", { method: "POST", body: form });
        body = await readBody(response);
      } else {
        body = await postJson("/api/ai/solve/text", { prompt: problemText.trim(), locale });
      }
      setSolution(body.solution as SolverResponse);
      if (body.quota) setQuota(body.quota as Quota);
    } catch (caught) {
      setError(errorCopy(caught, copy));
    } finally {
      setBusy(false);
    }
  }

  async function generatePractice() {
    if (busy) return;
    clearError();
    setBusy(true);
    setPractice(null);
    setGraded(null);
    setPracticeAnswer("");
    try {
      const body = await postJson("/api/ai/practice", {
        locale,
        topic: topic.trim() || undefined,
        difficulty,
        attemptId: attemptId ?? undefined,
      });
      setPractice(body.practice as Practice);
      if (body.quota) setQuota(body.quota as Quota);
    } catch (caught) {
      setError(errorCopy(caught, copy));
    } finally {
      setBusy(false);
    }
  }

  async function submitPractice() {
    if (!practice || !practiceAnswer.trim() || busy) return;
    clearError();
    setBusy(true);
    try {
      const body = await postJson("/api/ai/practice/grade", {
        practiceId: practice.problemId,
        answer: practiceAnswer.trim(),
      });
      setGraded({
        correct: Boolean(body.correct),
        correctAnswer: String(body.correctAnswer),
        explanation: String(body.explanation),
      });
    } catch (caught) {
      setError(errorCopy(caught, copy));
    } finally {
      setBusy(false);
    }
  }

  async function requestRecommendation() {
    if (busy) return;
    clearError();
    setBusy(true);
    setRecommendation("");
    try {
      const body = await postJson("/api/ai/recommend", {
        locale,
        attemptId: attemptId ?? undefined,
      });
      setRecommendation(String(body.recommendation));
      if (body.quota) setQuota(body.quota as Quota);
    } catch (caught) {
      setError(errorCopy(caught, copy));
    } finally {
      setBusy(false);
    }
  }

  function onImageChange(file: File | null) {
    clearError();
    if (!file) {
      setImage(null);
      return;
    }
    if (
      !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
      file.size > 5 * 1024 * 1024
    ) {
      setError(copy.errorImage);
      return;
    }
    setImage(file);
    setSolution(null);
  }

  const tabs: { id: Mode; label: string }[] = [
    { id: "chat", label: copy.chatTab },
    { id: "solver", label: copy.solverTab },
    { id: "practice", label: copy.practiceTab },
    { id: "recommendation", label: copy.recommendationTab },
  ];

  return (
    <main className="page-shell ai-page" id="main-content">
      <header className="ai-page-heading">
        <p className="eyebrow">MATHPATH · AI TUTOR</p>
        <h1>{copy.title}</h1>
        <p>{copy.description}</p>
        <QuotaNotice quota={quota} copy={copy} locale={locale} />
      </header>

      <Card className="ai-workspace-card">
        <div className="ai-tabs" role="tablist" aria-label={copy.title}>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              role="tab"
              type="button"
              aria-selected={mode === tab.id}
              className={mode === tab.id ? "is-active" : ""}
              onClick={() => {
                setMode(tab.id);
                clearError();
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {mode === "chat" ? (
          <section className="ai-mode-panel" aria-labelledby="ai-chat-heading">
            <h2 id="ai-chat-heading">{copy.chatHeading}</h2>
            <div className="ai-chat-log" aria-live="polite">
              {chatMessages.length === 0 ? (
                <p className="ai-empty-state">{copy.emptyChat}</p>
              ) : (
                chatMessages.map((message, index) => (
                  <div
                    className={`ai-chat-message ai-chat-message--${message.role}`}
                    key={`${index}-${message.role}`}
                  >
                    <span>
                      {message.role === "user" ? (locale === "vi" ? "Bạn" : "You") : "MathPath AI"}
                    </span>
                    <div>
                      <MathContentView value={message.content} />
                    </div>
                  </div>
                ))
              )}
              {busy ? (
                <p className="ai-loading" role="status">
                  {copy.thinking}
                </p>
              ) : null}
            </div>
            <form
              className="ai-form"
              onSubmit={(event) => {
                event.preventDefault();
                void sendChat();
              }}
            >
              <label className="sr-only" htmlFor="ai-chat-input">
                {copy.chatPlaceholder}
              </label>
              <textarea
                id="ai-chat-input"
                rows={3}
                maxLength={5000}
                value={chatInput}
                onChange={(event) => setChatInput(event.target.value)}
                placeholder={copy.chatPlaceholder}
              />
              <button
                className="button button--primary"
                type="submit"
                disabled={busy || !chatInput.trim()}
              >
                {busy ? copy.loading : copy.send}
              </button>
            </form>
          </section>
        ) : null}

        {mode === "solver" ? (
          <section className="ai-mode-panel" aria-labelledby="ai-solver-heading">
            <h2 id="ai-solver-heading">{copy.solverHeading}</h2>
            <form
              className="ai-form"
              onSubmit={(event) => {
                event.preventDefault();
                void solveProblem();
              }}
            >
              <label className="sr-only" htmlFor="ai-problem-text">
                {copy.problemPlaceholder}
              </label>
              <textarea
                id="ai-problem-text"
                rows={5}
                maxLength={8000}
                value={problemText}
                onChange={(event) => setProblemText(event.target.value)}
                placeholder={copy.problemPlaceholder}
              />
              <label className="ai-image-picker">
                {copy.imageLabel}
                <input
                  ref={fileInput}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(event) => onImageChange(event.target.files?.[0] ?? null)}
                />
              </label>
              {image && imageUrl ? (
                <div className="ai-image-preview">
                  <Image
                    src={imageUrl}
                    alt={image.name}
                    fill
                    unoptimized
                    sizes="(max-width: 700px) 100vw, 600px"
                  />
                  <button
                    type="button"
                    className="button button--secondary button--small"
                    onClick={() => {
                      onImageChange(null);
                      if (fileInput.current) fileInput.current.value = "";
                    }}
                  >
                    {copy.clear}
                  </button>
                </div>
              ) : null}
              <button
                className="button button--primary"
                type="submit"
                disabled={busy || (!problemText.trim() && !image)}
              >
                {busy ? copy.loading : copy.solve}
              </button>
            </form>
            {solution ? <SolutionView solution={solution} copy={copy} /> : null}
          </section>
        ) : null}

        {mode === "practice" ? (
          <section className="ai-mode-panel" aria-labelledby="ai-practice-heading">
            <h2 id="ai-practice-heading">{copy.practiceHeading}</h2>
            <p>{copy.practiceDescription}</p>
            <div className="ai-form">
              <label htmlFor="ai-topic">{copy.topicLabel}</label>
              <input
                id="ai-topic"
                value={topic}
                maxLength={120}
                onChange={(event) => setTopic(event.target.value)}
                placeholder={copy.topicPlaceholder}
              />
              <label htmlFor="ai-difficulty">{copy.difficultyLabel}</label>
              <select
                id="ai-difficulty"
                value={difficulty}
                onChange={(event) => setDifficulty(event.target.value as typeof difficulty)}
              >
                <option value="easy">{copy.easy}</option>
                <option value="medium">{copy.medium}</option>
                <option value="hard">{copy.hard}</option>
              </select>
              <button
                type="button"
                className="button button--primary"
                disabled={busy}
                onClick={() => void generatePractice()}
              >
                {busy ? copy.loading : copy.generate}
              </button>
            </div>
            {practice ? (
              <Card className="ai-practice-question">
                <p className="eyebrow">
                  {practice.topic} · {difficultyLabel(practice.difficulty, copy)}
                </p>
                <MathContentView value={practice.statement} />
                {practice.choices.length ? (
                  <div className="ai-practice-choices">
                    {practice.choices.map((choice, index) => (
                      <label key={`${index}-${choice}`}>
                        <input
                          type="radio"
                          name="practice-answer"
                          value={choice}
                          checked={practiceAnswer === choice}
                          onChange={() => {
                            setPracticeAnswer(choice);
                            setGraded(null);
                          }}
                        />
                        <MathContentView value={choice} />
                      </label>
                    ))}
                  </div>
                ) : (
                  <label className="ai-answer-field">
                    {copy.answerPlaceholder}
                    <input
                      value={practiceAnswer}
                      disabled={Boolean(graded)}
                      onChange={(event) => setPracticeAnswer(event.target.value)}
                    />
                  </label>
                )}
                {!graded ? (
                  <button
                    className="button button--primary"
                    type="button"
                    disabled={busy || !practiceAnswer.trim()}
                    onClick={() => void submitPractice()}
                  >
                    {busy ? copy.loading : copy.submitAnswer}
                  </button>
                ) : (
                  <div
                    className={`ai-grade-result${graded.correct ? " is-correct" : " is-incorrect"}`}
                    role="status"
                  >
                    <strong>{graded.correct ? copy.correct : copy.incorrect}</strong>
                    <p>
                      {copy.answer}: <MathContentView value={graded.correctAnswer} />
                    </p>
                    <p>
                      {copy.explanation}: <MathContentView value={graded.explanation} />
                    </p>
                  </div>
                )}
              </Card>
            ) : null}
          </section>
        ) : null}

        {mode === "recommendation" ? (
          <section className="ai-mode-panel" aria-labelledby="ai-recommend-heading">
            <h2 id="ai-recommend-heading">{copy.recommendationHeading}</h2>
            {recommendation ? (
              <Card className="ai-recommendation" role="status">
                <MathContentView value={recommendation} />
              </Card>
            ) : null}
            <button
              type="button"
              className="button button--primary"
              disabled={busy}
              onClick={() => void requestRecommendation()}
            >
              {busy ? copy.loading : copy.recommendationAction}
            </button>
            {quota?.remaining === 0 && !quota.unlimited ? (
              <p className="ai-muted">{copy.noAttempts}</p>
            ) : null}
          </section>
        ) : null}

        {error ? (
          <div className="ai-error" role="alert">
            <p>{error}</p>
            <button
              type="button"
              className="button button--secondary button--small"
              onClick={() =>
                mode === "chat"
                  ? void sendChat()
                  : mode === "solver"
                    ? void solveProblem()
                    : mode === "practice"
                      ? void generatePractice()
                      : void requestRecommendation()
              }
            >
              {copy.retry}
            </button>
          </div>
        ) : null}
      </Card>
      {quota && quota.remaining === 0 && !quota.unlimited ? (
        <Card className="ai-exhausted-card">
          <p>{quota.kind === "guest" ? copy.exhaustedGuest : copy.exhaustedAccount}</p>
          {quota.kind === "guest" ? (
            <Link className="button button--primary" href="/auth/register">
              {copy.login}
            </Link>
          ) : quota.resetAt ? (
            <small>
              {interpolate(copy.quotaReset, {
                time: new Intl.DateTimeFormat(locale === "vi" ? "vi-VN" : "en-US", {
                  timeStyle: "short",
                  timeZone: "Asia/Ho_Chi_Minh",
                }).format(new Date(quota.resetAt)),
              })}
            </small>
          ) : null}
        </Card>
      ) : null}
    </main>
  );
}

function QuotaNotice({
  quota,
  copy,
  locale,
}: {
  quota: Quota | null;
  copy: ReturnType<typeof useLocale>["messages"]["ai"];
  locale: "vi" | "en";
}) {
  if (!quota)
    return (
      <p className="ai-quota" aria-live="polite">
        {copy.loading}
      </p>
    );
  if (quota.unlimited) return <p className="ai-quota ai-quota--unlimited">{copy.quotaUnlimited}</p>;
  const text = quota.kind === "guest" ? copy.quotaGuest : copy.quotaDaily;
  const reset = quota.resetAt
    ? interpolate(copy.quotaReset, {
        time: new Intl.DateTimeFormat(locale === "vi" ? "vi-VN" : "en-US", {
          timeStyle: "short",
          timeZone: "Asia/Ho_Chi_Minh",
        }).format(new Date(quota.resetAt)),
      })
    : null;
  return (
    <div className="ai-quota-wrap">
      <p className="ai-quota" aria-live="polite">
        {interpolate(text, { remaining: quota.remaining ?? 0, limit: quota.limit ?? 0 })}
      </p>
      {reset ? <small>{reset}</small> : null}
    </div>
  );
}

function SolutionView({
  solution,
  copy,
}: {
  solution: SolverResponse;
  copy: ReturnType<typeof useLocale>["messages"]["ai"];
}) {
  const sections = [
    [copy.solutionSummary, solution.problemSummary],
    [copy.problemType, solution.problemType],
    [copy.method, solution.method],
    [copy.verification, solution.verification],
  ] as const;
  return (
    <div className="ai-solution" aria-live="polite">
      {sections.slice(0, 3).map(([title, value]) => (
        <Card className="ai-solution-section" key={title}>
          <h3>{title}</h3>
          <MathContentView value={value} />
        </Card>
      ))}
      <Card className="ai-solution-section">
        <h3>{copy.steps}</h3>
        {solution.steps.map((step, index) => (
          <div className="ai-solution-step" key={`${index}-${step.title}`}>
            <strong>{step.title}</strong>
            <MathContentView value={step.content} />
          </div>
        ))}
      </Card>
      <Card className="ai-solution-section">
        <h3>{copy.verification}</h3>
        <MathContentView value={solution.verification} />
      </Card>
      {solution.confidenceNote ? (
        <Card className="ai-solution-uncertainty">
          <h3>{copy.uncertainty}</h3>
          <MathContentView value={solution.confidenceNote} />
        </Card>
      ) : null}
      <Card className="ai-solution-answer">
        <h3>{copy.finalAnswer}</h3>
        <MathContentView value={solution.finalAnswer} />
      </Card>
    </div>
  );
}

async function postJson(path: string, body: unknown): Promise<Record<string, unknown>> {
  const response = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return readBody(response);
}

async function readBody(response: Response): Promise<Record<string, unknown>> {
  const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok)
    throw new AIClientError(typeof body.error === "string" ? body.error : "request_failed");
  return body;
}

class AIClientError extends Error {}

function errorCopy(error: unknown, copy: ReturnType<typeof useLocale>["messages"]["ai"]) {
  const code = error instanceof AIClientError ? error.message : "request_failed";
  if (code === "quota_exhausted") return copy.errorQuota;
  if (code === "ai_not_configured") return copy.errorSetup;
  if (code.startsWith("unsupported_image") || code.startsWith("image_") || code.includes("image"))
    return copy.errorImage;
  return copy.errorGeneric;
}

function difficultyLabel(
  value: Practice["difficulty"],
  copy: ReturnType<typeof useLocale>["messages"]["ai"],
) {
  return value === "easy" ? copy.easy : value === "hard" ? copy.hard : copy.medium;
}
