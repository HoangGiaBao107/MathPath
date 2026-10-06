"use client";

import Link from "next/link";
import type { Route } from "next";
import { useLocale } from "@/components/providers/locale-provider";
import { Card } from "@/components/ui/card";
import type { StudentAttemptResult } from "@/lib/analytics/types";

export function StudentAttemptResultExperience({ attempt }: { attempt: StudentAttemptResult }) {
  const { locale, messages } = useLocale();
  const copy = messages.progress;
  const result = attempt.result;
  return (
    <main className="page-shell analytics-page analytics-result-page" id="main-content">
      <header className="analytics-page-heading">
        <Link className="analytics-back-link" href={"/progress" as Route}>
          ← {copy.resultBack}
        </Link>
        <p className="eyebrow">{copy.resultTitle}</p>
        <h1>{attempt.examTitle}</h1>
        <p>
          {formatDateTime(attempt.submittedAt, locale)} ·{" "}
          {attempt.status === "submitted" ? copy.submitted : copy.autoSubmitted}
        </p>
      </header>
      <Card className="analytics-result-score-card">
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
        </div>
      </Card>
      {result.knowledgeOutcomes.length > 0
        ? (() => {
            const weakest = [...result.knowledgeOutcomes].sort(
              (a, b) =>
                b.incorrectCount +
                b.partialCount +
                b.unansweredCount -
                (a.incorrectCount + a.partialCount + a.unansweredCount),
            )[0]!;
            const weakCount =
              weakest.incorrectCount + weakest.partialCount + weakest.unansweredCount;
            const topicQuestions = result.questionOutcomes.filter(
              (item) => item.topic === weakest.topic,
            );
            const correct = topicQuestions.filter((item) => item.state === "correct").length;
            const accuracy =
              weakCount && topicQuestions.length
                ? Math.round((correct / topicQuestions.length) * 100)
                : null;
            return (
              <Card className="ai-result-improvement">
                <div>
                  <p className="eyebrow">{locale === "vi" ? "BƯỚC TIẾP THEO" : "YOUR NEXT STEP"}</p>
                  <h2>{messages.ai.resultNextTitle}</h2>
                  <p>
                    {weakCount ? messages.ai.resultWeakTopic : messages.ai.resultNoWeakTopic}
                    {weakCount ? (
                      <>
                        : <strong>{weakest.topic}</strong>
                      </>
                    ) : null}
                    {accuracy === null
                      ? ""
                      : ` · ${locale === "vi" ? "đúng" : "accuracy"} ${accuracy}%`}
                  </p>
                </div>
                <div className="ai-result-actions">
                  <Link
                    className="button button--primary button--small"
                    href={
                      `/ai?mode=practice&attemptId=${encodeURIComponent(attempt.attemptId)}` as Route
                    }
                  >
                    {messages.ai.practiceWithAI}
                  </Link>
                  <Link
                    className="button button--secondary button--small"
                    href={
                      `/ai?mode=recommendation&attemptId=${encodeURIComponent(attempt.attemptId)}` as Route
                    }
                  >
                    {messages.ai.getStudyAdvice}
                  </Link>
                </div>
              </Card>
            );
          })()
        : null}
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
          {result.knowledgeOutcomes.length === 0 ? (
            <p className="analytics-empty-message">{copy.noTopicData}</p>
          ) : (
            <div className="analytics-result-section-list">
              {result.knowledgeOutcomes.map((topic, index) => {
                const correct = result.questionOutcomes.filter(
                  (item) =>
                    item.topic === topic.topic &&
                    item.subtopic === topic.subtopic &&
                    item.state === "correct",
                ).length;
                return (
                  <div key={`${topic.topic}-${topic.subtopic ?? ""}-${index}`}>
                    <span>
                      {topic.topic}
                      {topic.subtopic ? ` · ${topic.subtopic}` : ""}
                    </span>
                    <strong>
                      {correct}/{topic.questionCount} {copy.correct.toLowerCase()} ·{" "}
                      {topic.incorrectCount} {copy.incorrect.toLowerCase()}
                    </strong>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </section>
      <Card className="analytics-panel analytics-question-results">
        <p className="eyebrow">{messages.exam.question}</p>
        <h2>{messages.exam.resultHeading}</h2>
        <div className="analytics-question-result-grid">
          {result.questionOutcomes.map((question) => (
            <div
              key={question.questionId}
              className={`analytics-question-result analytics-question-result--${question.state}`}
            >
              <span>
                {messages.exam.question} {question.questionNumber}
              </span>
              <strong>
                {question.state === "correct"
                  ? copy.correct
                  : question.state === "partially_correct"
                    ? copy.partial
                    : question.state === "incorrect"
                      ? copy.incorrect
                      : messages.exam.unansweredCount}
              </strong>
              {question.topic ? (
                <small>
                  {question.topic}
                  {question.subtopic ? ` · ${question.subtopic}` : ""}
                </small>
              ) : null}
              <small>
                {formatNumber(question.pointsEarned, locale)} /{" "}
                {formatNumber(question.pointsPossible, locale)}
              </small>
            </div>
          ))}
        </div>
      </Card>
    </main>
  );
}

function formatNumber(value: number, locale: "vi" | "en") {
  return value.toLocaleString(locale === "vi" ? "vi-VN" : "en-US", { maximumFractionDigits: 2 });
}

function formatDateTime(value: string, locale: "vi" | "en") {
  return new Intl.DateTimeFormat(locale === "vi" ? "vi-VN" : "en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(new Date(value));
}
