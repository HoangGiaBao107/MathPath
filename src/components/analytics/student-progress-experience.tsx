"use client";

import Link from "next/link";
import type { Route } from "next";
import { useMemo } from "react";
import { LineChart } from "@/components/analytics/line-chart";
import { useLocale } from "@/components/providers/locale-provider";
import { Card } from "@/components/ui/card";
import { interpolate } from "@/lib/i18n/messages";
import { deriveStudentPersonalization } from "@/lib/analytics/personalization";
import type { StudentProgress } from "@/lib/analytics/types";

const historyPageSize = 10;

export function StudentProgressExperience({ data, page }: { data: StudentProgress; page: number }) {
  const { messages, locale } = useLocale();
  const copy = messages.progress;
  const summary = useMemo(() => deriveStudentPersonalization(data), [data]);
  const historyPages = Math.max(1, Math.ceil(data.historyTotal / historyPageSize));
  const hasTopicData = data.topics.length > 0;
  const recommendation = summary.weakestTopic
    ? interpolate(copy.recommendationTopic, {
        topic: summary.weakestTopic.topic,
        accuracy:
          summary.weakestTopic.accuracy === null
            ? "—"
            : formatNumber(summary.weakestTopic.accuracy, locale),
      })
    : copy.noRecommendation;
  const trendLabel =
    summary.scoreTrend === "improving"
      ? copy.trendImproving
      : summary.scoreTrend === "declining"
        ? copy.trendDeclining
        : summary.scoreTrend === "stable"
          ? copy.trendStable
          : copy.insufficientTrend;
  const chartLabels = data.trend.map((point) => formatDateShort(point.submittedAt, locale));

  return (
    <main className="page-shell analytics-page" id="main-content">
      <header className="analytics-page-heading">
        <p className="eyebrow">{copy.title}</p>
        <h1>{copy.title}</h1>
        <p>{copy.description}</p>
      </header>

      {data.totalAttempts === 0 ? (
        <Card className="analytics-empty-card">
          <div className="analytics-empty-mark" aria-hidden="true">
            ↗
          </div>
          <h2>{copy.noAttemptsTitle}</h2>
          <p>{copy.noAttemptsDescription}</p>
          <Link className="button button--primary" href={"/problems" as Route}>
            {messages.home.practiceCta}
          </Link>
        </Card>
      ) : null}

      <section className="analytics-kpi-grid" aria-label={copy.title}>
        <MetricCard
          label={copy.averageScore}
          value={formatScore(data.averageScore, locale)}
          suffix="/10"
        />
        <MetricCard label={copy.submittedExams} value={String(data.totalAttempts)} />
        <MetricCard label={copy.questionsAttempted} value={String(data.questionsAttempted)} />
        <MetricCard label={copy.accuracy} value={formatPercent(summary.accuracyPercent, locale)} />
        <MetricCard label={copy.errorRate} value={formatPercent(summary.errorPercent, locale)} />
      </section>

      <section className="analytics-primary-grid">
        <Card className="analytics-panel analytics-trend-panel">
          <div className="analytics-panel-heading">
            <div>
              <p className="eyebrow">{copy.scoreTrend}</p>
              <h2>{copy.scoreTrend}</h2>
            </div>
            <span className={`analytics-trend-badge analytics-trend-badge--${summary.scoreTrend}`}>
              {trendLabel}
            </span>
          </div>
          {data.trend.length ? (
            <LineChart
              ariaLabel={copy.scoreTrend}
              labels={chartLabels}
              pointDetails={[
                data.trend.map(
                  (point) => `${point.examTitle} · ${formatDateTime(point.submittedAt, locale)}`,
                ),
              ]}
              series={[
                {
                  label: copy.score,
                  color: "#d71920",
                  values: data.trend.map((point) => point.score),
                },
                ...(data.targetScore === null
                  ? []
                  : [{
                      label: copy.targetScore,
                      color: "#273247",
                      dashed: true,
                      values: data.trend.map(() => data.targetScore!),
                    }]),
              ]}
              formatValue={(value) => formatNumber(value, locale)}
            />
          ) : (
            <EmptyMessage>{copy.noAttemptsDescription}</EmptyMessage>
          )}
        </Card>

        <Card className="analytics-panel analytics-target-panel">
          <div className="analytics-panel-heading">
            <div>
              <p className="eyebrow">{copy.targetScore}</p>
              <h2>{copy.targetScore}</h2>
            </div>
          </div>
          {data.targetScore === null ? (
            <EmptyMessage>{copy.noTarget}</EmptyMessage>
          ) : (
            <>
              <div className="analytics-target-values">
                <div>
                  <span>{copy.targetScore}</span>
                  <strong>
                    {formatNumber(data.targetScore, locale)}
                    <small>/10</small>
                  </strong>
                </div>
                <div>
                  <span>{copy.currentAverage}</span>
                  <strong>
                    {formatScore(data.averageScore, locale)}
                    <small>/10</small>
                  </strong>
                </div>
              </div>
              <div className="analytics-progress-caption">
                <span>{copy.targetProgress}</span>
                <strong>{formatPercent(summary.targetProgressPercent, locale)}</strong>
              </div>
              <div
                className="analytics-progress-track"
                role="progressbar"
                aria-label={copy.targetProgress}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={summary.targetProgressPercent ?? 0}
              >
                <span style={{ width: `${summary.targetProgressPercent ?? 0}%` }} />
              </div>
              <p className="analytics-gap-line">
                {summary.scoreGap === null
                  ? copy.noScore
                  : `${copy.scoreGap}: ${formatSigned(summary.scoreGap, locale)} ${locale === "vi" ? "điểm" : "points"}`}
              </p>
            </>
          )}
        </Card>
      </section>

      <section className="analytics-primary-grid">
        <Card className="analytics-panel analytics-topic-panel">
          <div className="analytics-panel-heading">
            <div>
              <p className="eyebrow">{copy.topicBreakdown}</p>
              <h2>{copy.topicBreakdown}</h2>
            </div>
          </div>
          {!hasTopicData ? (
            <EmptyMessage>{copy.noTopicData}</EmptyMessage>
          ) : (
            <div className="analytics-topic-list">
              {data.topics
                .slice()
                .sort((a, b) => (a.accuracy ?? 101) - (b.accuracy ?? 101))
                .map((topic) => (
                  <div className="analytics-topic-row" key={topic.topic}>
                    <div className="analytics-topic-title">
                      <strong>{topic.topic}</strong>
                      <span>
                        {formatPercent(topic.accuracy, locale)} · {topic.questionCount}{" "}
                        {copy.answeredQuestions}
                      </span>
                    </div>
                    <div className="analytics-topic-track" aria-hidden="true">
                      <span style={{ width: `${topic.accuracy ?? 0}%` }} />
                    </div>
                    <small>
                      {copy.correct}: {topic.correctCount} · {copy.partial}: {topic.partialCount} ·{" "}
                      {copy.incorrect}: {topic.incorrectCount}
                    </small>
                  </div>
                ))}
            </div>
          )}
        </Card>

        <Card className="analytics-panel analytics-personal-panel">
          <div className="analytics-panel-heading">
            <div>
              <p className="eyebrow">{copy.nextPractice}</p>
              <h2>{copy.nextPractice}</h2>
            </div>
          </div>
          <div className="analytics-insight-pair">
            <div>
              <span>{copy.weakTopic}</span>
              <strong>{summary.weakestTopic?.topic ?? "—"}</strong>
              {summary.weakestTopic ? (
                <small>{formatPercent(summary.weakestTopic.accuracy, locale)}</small>
              ) : null}
            </div>
            <div>
              <span>{copy.strongTopic}</span>
              <strong>{summary.strongestTopic?.topic ?? "—"}</strong>
              {summary.strongestTopic ? (
                <small>{formatPercent(summary.strongestTopic.accuracy, locale)}</small>
              ) : null}
            </div>
          </div>
          <p className="analytics-recommendation">{recommendation}</p>
          <div className="analytics-ai-card">
            <p className="eyebrow">{copy.improveWithAi}</p>
            <h3>{copy.improveWithAi}</h3>
            <p>{copy.aiDescription}</p>
            <Link
              className="button button--primary button--small"
              href={"/ai?mode=practice" as Route}
            >
              {copy.improveWithAi}
            </Link>
            <Link
              className="button button--secondary button--small"
              href={"/ai?mode=recommendation" as Route}
            >
              {messages.ai.recommendationAction}
            </Link>
          </div>
        </Card>
      </section>

      <section className="analytics-history-section">
        <div className="analytics-section-heading">
          <div>
            <p className="eyebrow">{copy.attemptHistory}</p>
            <h2>{copy.attemptHistory}</h2>
          </div>
          {data.historyTotal > 0 ? <span>{data.historyTotal}</span> : null}
        </div>
        {data.history.length === 0 ? (
          <Card className="analytics-history-empty">
            <p>{copy.noAttemptsDescription}</p>
          </Card>
        ) : (
          <div className="analytics-history-list">
            {data.history.map((attempt) => (
              <Card className="analytics-history-item" key={attempt.attemptId}>
                <div className="analytics-history-main">
                  <span className="analytics-history-status">
                    {attempt.status === "submitted" ? copy.submitted : copy.autoSubmitted}
                  </span>
                  <h3>{attempt.examTitle}</h3>
                  <time dateTime={attempt.submittedAt}>
                    {formatDateTime(attempt.submittedAt, locale)}
                  </time>
                </div>
                <div className="analytics-history-score">
                  <span>{copy.score}</span>
                  <strong>
                    {formatNumber(attempt.score, locale)}
                    <small>/10</small>
                  </strong>
                </div>
                <div className="analytics-history-counts">
                  <span>
                    {copy.correct}: {attempt.correctCount}
                  </span>
                  <span>
                    {copy.partial}: {attempt.partialCount}
                  </span>
                  <span>
                    {copy.incorrect}: {attempt.incorrectCount}
                  </span>
                </div>
                <Link
                  className="button button--secondary button--small"
                  href={`/progress/attempts/${attempt.attemptId}` as Route}
                >
                  {copy.viewResult}
                </Link>
              </Card>
            ))}
          </div>
        )}
        {historyPages > 1 ? (
          <nav className="analytics-pagination" aria-label={copy.attemptHistory}>
            <Link
              aria-disabled={page <= 1}
              className={`button button--secondary button--small${page <= 1 ? " is-disabled" : ""}`}
              href={(page <= 1 ? "/progress" : `/progress?page=${page - 1}`) as Route}
            >
              {copy.previousPage}
            </Link>
            <span>{interpolate(copy.pageOf, { page, pages: historyPages })}</span>
            <Link
              aria-disabled={page >= historyPages}
              className={`button button--secondary button--small${page >= historyPages ? " is-disabled" : ""}`}
              href={
                (page >= historyPages
                  ? `/progress?page=${historyPages}`
                  : `/progress?page=${page + 1}`) as Route
              }
            >
              {copy.nextPage}
            </Link>
          </nav>
        ) : null}
      </section>
    </main>
  );
}

function MetricCard({ label, value, suffix }: { label: string; value: string; suffix?: string }) {
  return (
    <Card className="analytics-metric">
      <span>{label}</span>
      <strong>
        {value}
        {suffix ? <small>{suffix}</small> : null}
      </strong>
    </Card>
  );
}

function EmptyMessage({ children }: { children: string }) {
  return <p className="analytics-empty-message">{children}</p>;
}

function formatNumber(value: number, locale: "vi" | "en") {
  return value.toLocaleString(locale === "vi" ? "vi-VN" : "en-US", { maximumFractionDigits: 2 });
}

function formatScore(value: number | null, locale: "vi" | "en") {
  return value === null ? "—" : formatNumber(value, locale);
}

function formatPercent(value: number | null, locale: "vi" | "en") {
  return value === null ? "—" : `${formatNumber(value, locale)}%`;
}

function formatSigned(value: number, locale: "vi" | "en") {
  return `${value > 0 ? "+" : ""}${formatNumber(value, locale)}`;
}

function formatDateShort(value: string, locale: "vi" | "en") {
  return new Intl.DateTimeFormat(locale === "vi" ? "vi-VN" : "en-US", {
    day: "2-digit",
    month: "2-digit",
  }).format(new Date(value));
}

function formatDateTime(value: string, locale: "vi" | "en") {
  return new Intl.DateTimeFormat(locale === "vi" ? "vi-VN" : "en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(new Date(value));
}
