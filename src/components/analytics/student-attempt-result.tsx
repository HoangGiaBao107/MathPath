"use client";

import Link from "next/link";
import type { Route } from "next";
import { useLocale } from "@/components/providers/locale-provider";
import { ResultQuestionReview } from "@/components/analytics/result-question-review";
import { Card } from "@/components/ui/card";
import type { StudentAttemptResult } from "@/lib/analytics/types";
import type { ResultView } from "@/lib/analytics/result-view";
import { resultDesignCopy } from "@/lib/i18n/result-design-copy";

export function StudentAttemptResultExperience({
  attempt,
  historyBeforeAttemptCount,
  view = "overview",
  basePath,
}: {
  attempt: StudentAttemptResult;
  historyBeforeAttemptCount: number;
  view?: ResultView;
  basePath?: string;
}) {
  const { locale, messages } = useLocale();
  const copy = messages.progress;
  const design = resultDesignCopy[locale];
  const resultPath = basePath ?? `/progress/attempts/${attempt.attemptId}`;
  const detailCards = [
    { key: "review", title: copy.reviewQuestions, description: design.reviewDescription, icon: "≡" },
    { key: "analysis", title: design.analysisTitle, description: design.analysisDescription, icon: "↗" },
    { key: "study", title: copy.studyChatHeading, description: design.studyDescription, icon: "✳" },
  ];
  const result = attempt.result;
  const weakest = [...result.knowledgeOutcomes].sort(
    (a, b) =>
      b.incorrectCount +
      b.partialCount +
      b.unansweredCount -
      (a.incorrectCount + a.partialCount + a.unansweredCount),
  )[0];
  const weakCount = weakest
    ? weakest.incorrectCount + weakest.partialCount + weakest.unansweredCount
    : 0;
  const topicQuestions = weakest
    ? result.questionOutcomes.filter(
        (item) => item.topic === weakest.topic && item.subtopic === weakest.subtopic,
      )
    : [];
  const correctInWeakTopic = topicQuestions.filter((item) => item.state === "correct").length;
  const accuracy =
    weakCount && topicQuestions.length
      ? Math.round((correctInWeakTopic / topicQuestions.length) * 100)
      : null;
  return (
    <main className="page-shell analytics-page analytics-result-page" id="main-content">
      <header className="analytics-page-heading">
        <Link className="analytics-back-link" href={(view === "overview" ? (basePath ? "/dev/mathpath-bank" : "/progress") : resultPath) as Route}>
          ← {view === "overview" ? (basePath ? design.library : copy.resultBack) : design.backToResult}
        </Link>
        <p className="eyebrow">{copy.resultTitle}</p>
        <h1>{view === "overview" ? attempt.examTitle : detailCards.find(card => card.key === view)?.title}</h1>
        <p>
          {view !== "overview" ? `${attempt.examTitle} · ` : ""}
          {formatDateTime(attempt.submittedAt, locale)} ·{" "}
          {attempt.status === "submitted" ? copy.submitted : copy.autoSubmitted}
        </p>
      </header>
      {view === "overview" ? <><Card className="analytics-result-score-card">
        <span>{copy.score}</span>
        <strong>
          {formatNumber((result.score * 10) / Math.max(result.totalScore, 0.0001), locale)}
          <small>/10</small>
        </strong>
        <div className="analytics-result-counts">
          <span>
            {copy.correct}: {result.correctCount}
          </span>
          <span>
            {copy.partial}: {result.partialCount}
          </span>
          <span>
            {copy.incorrect}: {result.incorrectCount}
          </span>
          <span>
            {messages.exam.unansweredCount}: {result.unansweredCount}
          </span>
          {attempt.durationSeconds !== null ? (
            <span>
              {copy.duration}: {formatDuration(attempt.durationSeconds, locale)}
            </span>
          ) : null}
        </div>
      </Card>
      <section className="result-hub-grid" aria-label={design.nextTitle}>
        {detailCards.map(card => <Link key={card.key} href={`${resultPath}/${card.key}` as Route} className="result-hub-card">
          <span className="result-hub-icon" aria-hidden="true">{card.icon}</span>
          <div><h2>{card.title}</h2><p>{card.description}</p></div><span className="result-hub-arrow" aria-hidden="true">↗</span>
        </Link>)}
      </section></> : <nav className="result-detail-nav" aria-label={design.nextTitle}>{detailCards.map(card => <Link key={card.key} href={`${resultPath}/${card.key}` as Route} aria-current={view === card.key ? "page" : undefined}>{card.title}</Link>)}</nav>}
      {view === "analysis" ? <><section className="result-ai-next-steps" aria-labelledby="result-ai-heading">
        <div className="result-ai-heading">
          <p className="eyebrow">{locale === "vi" ? "BƯỚC TIẾP THEO" : "YOUR NEXT STEP"}</p>
          <h2 id="result-ai-heading">{messages.ai.resultNextTitle}</h2>
          <p>
            {weakCount ? messages.ai.resultWeakTopic : messages.ai.resultNoWeakTopic}
            {weakCount && weakest ? (
              <>
                : <strong>{weakest.topic}</strong>
              </>
            ) : null}
            {accuracy === null ? "" : ` · ${locale === "vi" ? "đúng" : "accuracy"} ${accuracy}%`}
          </p>
        </div>
        <div className="result-ai-cards">
          <Card className="result-ai-card result-ai-card--analysis">
            <span className="result-ai-card-icon" aria-hidden="true">
              ✳
            </span>
            <div>
              <h3>{messages.ai.resultAnalysisTitle}</h3>
              <p>{messages.ai.resultAnalysisDescription}</p>
              {historyBeforeAttemptCount === 0 ? (
                <p className="result-ai-history-note">
                  {messages.ai.resultNoHistory} {messages.ai.resultHistoryContext}
                </p>
              ) : null}
            </div>
            <Link
              className="button button--secondary button--small"
              href={
                `/ai?mode=recommendation&attemptId=${encodeURIComponent(attempt.attemptId)}` as Route
              }
            >
              {messages.ai.getStudyAdvice}
              <span aria-hidden="true"> →</span>
            </Link>
          </Card>
          <Card className="result-ai-card result-ai-card--practice">
            <span className="result-ai-card-icon" aria-hidden="true">
              ↗
            </span>
            <div>
              <h3>{messages.ai.resultPracticeTitle}</h3>
              <p>{messages.ai.resultPracticeDescription}</p>
            </div>
            <Link
              className="button button--primary button--small"
              href={`/ai?mode=practice&attemptId=${encodeURIComponent(attempt.attemptId)}` as Route}
            >
              {messages.ai.practiceWithAI}
              <span aria-hidden="true"> →</span>
            </Link>
          </Card>
        </div>
      </section>
      <section className="analytics-primary-grid">
        <Card className="analytics-panel">
          <p className="eyebrow">{copy.sectionBreakdown}</p>
          <h2>{copy.sectionBreakdown}</h2>
          <div className="analytics-result-section-list">
            {result.sectionOutcomes.map((section) => (
              <div key={section.sectionId}>
                <span>{section.title}</span>
                <strong>
                  {formatNumber(section.pointsEarned, locale)} /{" "}
                  {formatNumber(section.pointsPossible, locale)}
                </strong>
              </div>
            ))}
          </div>
        </Card>
        <Card className="analytics-panel">
          <p className="eyebrow">{copy.knowledgeBreakdown}</p>
          <h2>{copy.knowledgeBreakdown}</h2>
          <p className="result-weakness-chart-description">{copy.errorChartDescription}</p>
          {result.knowledgeOutcomes.length === 0 ? (
            <p className="analytics-empty-message">{copy.noTopicData}</p>
          ) : (
            <div className="result-weakness-chart">
              {[...result.knowledgeOutcomes]
                .sort(
                  (left, right) =>
                    right.incorrectCount +
                    right.partialCount +
                    right.unansweredCount -
                    (left.incorrectCount + left.partialCount + left.unansweredCount),
                )
                .map((topic, index) => {
                  const correct = result.questionOutcomes.filter(
                    (item) =>
                      item.topic === topic.topic &&
                      item.subtopic === topic.subtopic &&
                      item.state === "correct",
                  ).length;
                  const count = topic.questionCount || 0;
                  const segments = [
                    { key: "correct", label: copy.correct, value: correct },
                    { key: "partial", label: copy.partial, value: topic.partialCount },
                    { key: "incorrect", label: copy.incorrect, value: topic.incorrectCount },
                    { key: "unanswered", label: copy.unanswered, value: topic.unansweredCount },
                  ];
                  const title = `${topic.topic}${topic.subtopic ? ` · ${topic.subtopic}` : ""}`;
                  return (
                    <div className="result-weakness-row" key={`${title}-${index}`}>
                      <div className="result-weakness-title">
                        <strong>{title}</strong>
                        <span>
                          {count} {messages.problemBank.questionCount}
                        </span>
                      </div>
                      <div
                        className="result-weakness-track"
                        role="img"
                        aria-label={`${title}: ${segments.map((segment) => `${segment.value} ${segment.label.toLowerCase()}`).join(", ")}`}
                      >
                        {segments.map((segment) => (
                          <span
                            className={`result-weakness-segment result-weakness-segment--${segment.key}`}
                            key={segment.key}
                            style={{ width: `${count ? (segment.value / count) * 100 : 0}%` }}
                          />
                        ))}
                      </div>
                      <div className="result-weakness-legend">
                        {segments.map((segment) => (
                          <span key={segment.key}>
                            <i
                              className={`result-weakness-dot result-weakness-dot--${segment.key}`}
                            />
                            {segment.value} {segment.label.toLowerCase()}
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </Card>
      </section></> : null}
      {view === "review" || view === "study" ? <ResultQuestionReview mode={view} attemptId={attempt.attemptId} outcomes={result.questionOutcomes} sections={result.sectionOutcomes} /> : null}

    </main>
  );
}

function formatNumber(value: number, locale: "vi" | "en") {
  return value.toLocaleString(locale === "vi" ? "vi-VN" : "en-US", { maximumFractionDigits: 2 });
}

function formatDuration(value: number, locale: "vi" | "en") {
  const minutes = Math.floor(value / 60);
  const seconds = value % 60;
  const minute = new Intl.NumberFormat(locale === "vi" ? "vi-VN" : "en-US", {
    style: "unit",
    unit: "minute",
    unitDisplay: "short",
  });
  const second = new Intl.NumberFormat(locale === "vi" ? "vi-VN" : "en-US", {
    style: "unit",
    unit: "second",
    unitDisplay: "short",
  });
  return `${minute.format(minutes)} ${second.format(seconds)}`;
}

function formatDateTime(value: string, locale: "vi" | "en") {
  return new Intl.DateTimeFormat(locale === "vi" ? "vi-VN" : "en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(new Date(value));
}
