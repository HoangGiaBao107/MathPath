"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { useLocale } from "@/components/providers/locale-provider";
import { MathContentView } from "@/components/problems/math-content-view";
import { Card } from "@/components/ui/card";
import { resultDesignCopy } from "@/lib/i18n/result-design-copy";
import {
  getAcceptedAnswers,
  getShortAnswer,
  getTrueFalseAnswer,
  isCorrectOption,
  isSelectedOption,
} from "@/lib/analytics/question-review";
import type { StudentAttemptResult } from "@/lib/analytics/types";

type QuestionOutcome = StudentAttemptResult["result"]["questionOutcomes"][number];
type Locale = "vi" | "en";

export function ResultQuestionReview({
  attemptId,
  outcomes,
  sections,
  mode = "review",
}: {
  attemptId: string;
  outcomes: QuestionOutcome[];
  sections: StudentAttemptResult["result"]["sectionOutcomes"];
  mode?: "review" | "study";
}) {
  const { locale, messages } = useLocale();
  const copy = messages.progress;
  const missedQuestions = outcomes
    .filter((outcome) => outcome.review && outcome.state !== "correct")
    .map((outcome) => ({ id: outcome.questionId, number: outcome.questionNumber,
      section: sections.find(s => s.sectionId === outcome.sectionId)?.title }));

  return (
    <>
      {mode === "review" ? <Card className="analytics-panel analytics-question-results">
        <p className="eyebrow">{copy.reviewQuestions}</p>
        <h2>{copy.reviewQuestions}</h2>
        <div className="result-question-list">
          {outcomes.map((outcome) => (
            <QuestionReview
              attemptId={attemptId}
              key={outcome.questionId}
              locale={locale}
              outcome={outcome}
              sectionTitle={sections.find(s => s.sectionId === outcome.sectionId)?.title}
            />
          ))}
        </div>
      </Card> : null}
      {mode === "study" && missedQuestions.length ? (
        <ResultStudyChat attemptId={attemptId} questions={missedQuestions} />
      ) : null}
      {mode === "study" && !missedQuestions.length ? <Card><p>{messages.ai.resultNoWeakTopic}</p></Card> : null}
    </>
  );
}

function QuestionReview({
  attemptId,
  locale,
  outcome,
  sectionTitle,
}: {
  attemptId: string;
  locale: Locale;
  outcome: QuestionOutcome;
  sectionTitle?: string;
}) {
  const { messages } = useLocale();
  const copy = messages.progress;
  const review = outcome.review;
  const stateLabel =
    outcome.gradingStatus === "needs_review" ? copy.gradingNeedsReview : outcome.state === "correct"
      ? copy.correct
      : outcome.state === "partially_correct"
        ? copy.partial
        : outcome.state === "incorrect"
          ? copy.incorrect
          : messages.exam.unansweredCount;
  const selectedOption = review?.options.find((option) =>
    isSelectedOption(review.selectedAnswer, option.key),
  );
  const correctOption = review?.options.find((option) =>
    isCorrectOption(review.correctAnswer, option.key),
  );

  return (
    <details className={`result-question-item result-question-item--${outcome.state}`}>
      <summary className="result-question-summary">
        <span className="result-question-title">
          <strong>
            {messages.exam.question} {outcome.questionNumber}
            {sectionTitle ? ` · ${sectionTitle}` : ""}
          </strong>
          {outcome.topic ? (
            <small>
              {outcome.topic}
              {outcome.subtopic ? ` · ${outcome.subtopic}` : ""}
            </small>
          ) : null}
        </span>
        <span className={`result-question-state result-question-state--${outcome.state}`}>
          {stateLabel}
        </span>
        <span className="result-question-points">
          {formatNumber(outcome.pointsEarned, locale)} / {formatNumber(outcome.pointsPossible, locale)}
        </span>
        <span className="result-question-chevron" aria-hidden="true">⌄</span>
      </summary>
      <div className="result-question-content">
        {review ? (
          <>
            {outcome.gradingStatus === "needs_review" ? <p role="status" className="result-unverified-note">{copy.gradingNeedsReviewNote}</p> : null}
            <p
              className={`result-answer-verification ${review.correctAnswer ? "is-verified" : "is-unverified"}`}
              role="status"
            >
              {review.correctAnswer ? copy.answerKeyVerified : copy.answerKeyUnverified}
            </p>
            <div className="result-question-statement">
              <p className="result-review-label">{messages.exam.question}</p>
              {review.statement ? <MathContentView value={review.statement} /> : null}
              {review.assets
                .filter((asset) => asset.placement === "stem" && asset.path.startsWith("/problem-assets/"))
                .map((asset) => (
                  <figure className="result-question-figure" key={asset.path}>
                    {/* Assets are only returned by the server after their admin review gate. */}
                    <img src={asset.path} alt={asset.altText} loading="lazy" />
                    <figcaption>{asset.altText}</figcaption>
                  </figure>
                ))}
            </div>

            {review.questionType === "multiple_choice" ? (
              <div className="result-review-answer-grid">
                <AnswerLine label={copy.yourAnswer}>
                  {selectedOption ? (
                    <>
                      <strong>{selectedOption.key}.</strong> <MathContentView value={selectedOption.text} />
                    </>
                  ) : (
                    copy.noAnswer
                  )}
                </AnswerLine>
                <AnswerLine label={copy.correctAnswer}>
                  {correctOption ? (
                    <>
                      <strong>{correctOption.key}.</strong> <MathContentView value={correctOption.text} />
                    </>
                  ) : (
                    copy.answerKeyUnavailable
                  )}
                </AnswerLine>
              </div>
            ) : null}

            {review.questionType === "multiple_choice" && review.options.length ? (
              <ul className="result-review-options">
                {review.options.map((option) => {
                  const selected = isSelectedOption(review.selectedAnswer, option.key);
                  const correct = isCorrectOption(review.correctAnswer, option.key);
                  return (
                    <li
                      className={correct ? "is-correct-answer" : selected ? "is-selected-answer" : ""}
                      key={option.key}
                    >
                      <strong>{option.key}.</strong> <MathContentView value={option.text} />
                      {selected ? <span>{copy.yourAnswer}</span> : null}
                      {correct ? <span>{copy.correctAnswer}</span> : null}
                    </li>
                  );
                })}
              </ul>
            ) : null}

            {review.questionType === "true_false" ? (
              <div className="result-review-statements">
                <p className="result-review-label">
                        {copy.yourAnswer} · {copy.correctAnswer} · {copy.pointsReceived}: {formatNumber(outcome.pointsEarned, locale)} / {formatNumber(outcome.pointsPossible, locale)}
                </p>
                {review.substatements.map((item) => {
                  const selected = getTrueFalseAnswer(review.selectedAnswer, item.key);
                  const correct = getTrueFalseAnswer(review.correctAnswer, item.key);
                  const itemState = selected === null || correct === null ? "unverified" : selected === correct ? "correct" : "incorrect";
                  return (
                    <div className={`result-review-statement result-review-statement--${itemState}`} key={item.key}>
                      <strong>{item.key.toUpperCase()}.</strong>
                      <div><MathContentView value={item.text} /></div>
                      <small>
                        {copy.yourAnswer}: {selected === null ? copy.noAnswer : selected ? messages.exam.trueLabel : messages.exam.falseLabel}
                        {correct === null ? "" : ` · ${copy.correctAnswer}: ${correct ? messages.exam.trueLabel : messages.exam.falseLabel}`}
                      </small>
                    </div>
                  );
                })}
                {!review.correctAnswer ? <p className="result-unverified-note">{copy.answerKeyUnavailable}</p> : null}
                {outcome.scoringRule ? <p className="result-review-label">
                  {copy.trueFalseScoring.replace("{correct}", String(outcome.correctStatementCount ?? 0))}
                  {" "}{outcome.scoringRule.map((points, count) => `${count} → ${formatNumber(points, locale)}`).join(" · ")}
                </p> : null}
              </div>
            ) : null}

            {review.questionType === "short_answer" ? (
              <div className="result-review-answer-grid">
                <AnswerLine label={copy.yourAnswer}>
                  {getShortAnswer(review.selectedAnswer) ?? copy.noAnswer}
                </AnswerLine>
                <AnswerLine label={copy.correctAnswer}>
                  {getAcceptedAnswers(review.correctAnswer).length ? (
                    <MathContentView value={getAcceptedAnswers(review.correctAnswer).map(value =>
                      review.correctAnswer?.input_policy && (review.correctAnswer.input_policy as { kind?: string }).kind === "expression"
                        ? `$${value}$` : value).join(" ; ")} />
                  ) : (
                    copy.answerKeyUnavailable
                  )}
                </AnswerLine>
              </div>
            ) : null}

            {!review.correctAnswer && review.questionType !== "true_false" ? (
              <p className="result-unverified-note">{copy.unverifiedKey}</p>
            ) : null}
            <div className="result-question-explanation">
              <p className="result-review-label">{copy.explanation}</p>
              {review.explanation ? (
                <MathContentView value={review.explanation} />
              ) : (
                <p>{copy.noExplanation}</p>
              )}
            </div>
            <QuestionAiHint attemptId={attemptId} locale={locale} questionId={outcome.questionId} />
          </>
        ) : (
          <p className="result-unverified-note">{copy.answerKeyUnverified}</p>
        )}
      </div>
    </details>
  );
}

function AnswerLine({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="result-answer-line">
      <span>{label}</span>
      <strong>{children}</strong>
    </div>
  );
}

function QuestionAiHint({
  attemptId,
  locale,
  questionId,
}: {
  attemptId: string;
  locale: Locale;
  questionId: string;
}) {
  const { messages } = useLocale();
  const copy = messages.progress;
  const [level, setLevel] = useState<1 | 2 | 3 | null>(null);
  const [hint, setHint] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(null);
  const labels = [copy.hintLevelOne, copy.hintLevelTwo, copy.hintLevelThree] as const;

  async function requestHint(nextLevel: 1 | 2 | 3) {
    setLevel(nextLevel);
    setHint("");
    setError("");
    setLoading(true);
    try {
      const response = await fetch(`/api/attempts/${encodeURIComponent(attemptId)}/ai-review`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mode: "hint", locale, questionId, level: nextLevel }),
      });
      const payload = (await response.json()) as {
        answer?: string;
        error?: string;
        quota?: { remaining?: number | null };
      };
      if (!response.ok || !payload.answer) {
        setError(aiErrorMessage(payload.error, messages.ai.errorGeneric, messages.ai.errorQuota, messages.ai.errorSetup, messages.ai.errorTimeout));
        return;
      }
      setHint(payload.answer);
      setRemaining(typeof payload.quota?.remaining === "number" ? payload.quota.remaining : null);
    } catch {
      setError(messages.ai.errorGeneric);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="result-ai-hint" aria-label={copy.hintHeading}>
      <div className="result-ai-hint-heading">
        <div>
          <p className="result-review-label">{copy.hintHeading}</p>
          {remaining !== null ? <small>{copy.aiQuotaRemaining.replace("{remaining}", String(remaining))}</small> : null}
        </div>
        <div className="result-ai-hint-buttons">
          {labels.map((label, index) => {
            const hintLevel = (index + 1) as 1 | 2 | 3;
            return (
              <button
                aria-pressed={level === hintLevel}
                className="button button--secondary button--small"
                disabled={loading}
                key={hintLevel}
                onClick={() => void requestHint(hintLevel)}
                type="button"
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>
      {loading ? <p role="status">{copy.hintLoading}</p> : null}
      {hint ? <div className="result-ai-hint-answer"><MathContentView value={hint} /></div> : null}
      {error ? <p className="result-ai-hint-error" role="alert">{error}</p> : null}
    </section>
  );
}

export function ResultStudyChat({
  attemptId,
  questions,
}: {
  attemptId: string;
  questions: { id: string; number: string; section?: string }[];
}) {
  const { locale, messages } = useLocale();
  const copy = messages.progress;
  const design = resultDesignCopy[locale];
  const [selectedIds, setSelectedIds] = useState<string[]>(questions.slice(0, 1).map((question) => question.id));
  const [chatMessages, setChatMessages] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(null);

  function toggleQuestion(questionId: string) {
    setSelectedIds((current) =>
      current.includes(questionId)
        ? current.filter((id) => id !== questionId)
        : current.length < 8
          ? [...current, questionId]
          : current,
    );
    setChatMessages([]);
    setError("");
  }

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = draft.trim();
    if (!content || loading || !selectedIds.length) return;
    const nextMessages = [...chatMessages.slice(-8), { role: "user" as const, content }];
    setChatMessages(nextMessages);
    setDraft("");
    setError("");
    setLoading(true);
    try {
      const response = await fetch(`/api/attempts/${encodeURIComponent(attemptId)}/ai-review`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mode: "chat", locale, questionIds: selectedIds, messages: nextMessages }),
      });
      const payload = (await response.json()) as {
        answer?: string;
        error?: string;
        quota?: { remaining?: number | null };
      };
      if (!response.ok || !payload.answer) {
        setError(aiErrorMessage(payload.error, messages.ai.errorGeneric, messages.ai.errorQuota, messages.ai.errorSetup, messages.ai.errorTimeout));
        return;
      }
      setChatMessages([...nextMessages, { role: "assistant", content: payload.answer }]);
      setRemaining(typeof payload.quota?.remaining === "number" ? payload.quota.remaining : null);
    } catch {
      setError(messages.ai.errorGeneric);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="result-study-chat" aria-labelledby="result-study-chat-heading">
      <header className="result-study-chat-header">
      <span className="result-study-avatar" aria-hidden="true">✳</span>
      <div>
      <h2 id="result-study-chat-heading">{copy.studyChatHeading}</h2>
      <p>{copy.studyChatDescription}</p>
      </div></header>
      <div className="result-study-layout">
      <aside className="result-study-sidebar">
      <h3>{design.picker}</h3>
      <p className="result-study-selected" aria-live="polite">{design.selected.replace("{count}", String(selectedIds.length))}</p>
      <p className="result-study-picker-note">{design.pickerNote}</p>
      <div className="result-study-question-picker" aria-label={copy.reviewQuestions}>
        {[...new Set(questions.map(question => question.section ?? ""))].map(section => <fieldset key={section}>
          <legend>{section || copy.reviewQuestions}</legend>
        {questions.filter(question => (question.section ?? "") === section).map((question) => (
          <label key={question.id}>
            <input
              checked={selectedIds.includes(question.id)}
              disabled={loading || (selectedIds.length >= 8 && !selectedIds.includes(question.id))}
              onChange={() => toggleQuestion(question.id)}
              type="checkbox"
            />
            {messages.exam.question} {question.number}
          </label>
        ))}</fieldset>)}
      </div>
      </aside>
      <div className="result-study-conversation">
      {chatMessages.length ? (
        <div className="result-study-chat-thread" aria-live="polite">
          {chatMessages.map((message, index) => (
            <div className={`result-study-chat-message result-study-chat-message--${message.role}`} key={`${message.role}-${index}`}>
              <MathContentView value={message.content} />
            </div>
          ))}
        </div>
      ) : (
        <div className="result-study-chat-empty"><span className="result-study-avatar" aria-hidden="true">✳</span><h3>{design.ready}</h3><p>{copy.studyChatEmpty}</p><div className="result-study-prompts">{[[design.promptLabel, design.prompt], [design.formulaLabel, design.formula]].map(([label, prompt]) => <button key={label} type="button" onClick={() => {setDraft(prompt); document.getElementById("result-study-chat-input")?.focus();}}>{label} <span aria-hidden="true">↗</span></button>)}</div></div>
      )}
      {remaining !== null ? <p className="result-study-chat-quota">{copy.aiQuotaRemaining.replace("{remaining}", String(remaining))}</p> : null}
      {error ? <p className="result-study-chat-error" role="alert">{error}</p> : null}
      <form className="result-study-chat-form" onSubmit={sendMessage}>
        <label htmlFor="result-study-chat-input">{design.composer}</label>
        <textarea
          id="result-study-chat-input"
          maxLength={4000}
          onChange={(event) => setDraft(event.currentTarget.value)}
          placeholder={copy.studyChatPlaceholder}
          rows={3}
          value={draft}
        />
        <div className="result-study-composer-footer"><small>{design.sendNote}</small><button className="button button--primary" disabled={loading || !draft.trim() || !selectedIds.length} type="submit">
          {loading ? messages.ai.thinking : copy.studyChatSend}
        </button></div>
      </form>
      </div></div>
    </Card>
  );
}

function formatNumber(value: number, locale: Locale) {
  return value.toLocaleString(locale === "vi" ? "vi-VN" : "en-US", { maximumFractionDigits: 2 });
}

function aiErrorMessage(
  error: string | undefined,
  generic: string,
  quota: string,
  setup: string,
  timeout: string,
) {
  if (error === "quota_exhausted") return quota;
  if (error === "ai_not_configured") return setup;
  if (error === "ai_request_timeout") return timeout;
  return generic;
}
