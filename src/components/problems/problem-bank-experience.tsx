"use client";

import Link from "next/link";
import type { Route } from "next";
import { useMemo, useState } from "react";
import { useLocale } from "@/components/providers/locale-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { interpolate } from "@/lib/i18n/messages";
import { filterAndSortProblemSets } from "@/lib/problems/catalog";
import type {
  ProblemDifficulty,
  ProblemSetCategory,
  ProblemSetFilters,
  PublicProblemSet,
} from "@/lib/problems/types";

export function ProblemBankExperience({
  problemSets,
  previewOnly = false,
}: {
  problemSets: PublicProblemSet[];
  previewOnly?: boolean;
}) {
  const { locale, messages } = useLocale();
  const copy = messages.problemBank;
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<ProblemSetCategory | "all">("all");
  const [difficulty, setDifficulty] = useState<ProblemDifficulty | "all">("all");
  const [sort, setSort] = useState<NonNullable<ProblemSetFilters["sort"]>>("newest");
  const visibleSets = useMemo(
    () => filterAndSortProblemSets(problemSets, { query, category, difficulty, sort, locale }),
    [problemSets, query, category, difficulty, sort, locale],
  );

  function clearFilters() {
    setQuery("");
    setCategory("all");
    setDifficulty("all");
    setSort("newest");
  }

  return (
    <main className="site-main problem-bank-page" id="main-content">
      <section className="problem-bank-hero" aria-labelledby="problem-bank-title">
        <div className="container problem-bank-hero-inner">
          <div className="problem-bank-copy">
            <p className="eyebrow">
              <span className="eyebrow-dot" aria-hidden="true" />
              {copy.eyebrow}
            </p>
            <h1 id="problem-bank-title">{copy.title}</h1>
            <p className="problem-bank-description">{copy.description}</p>
          </div>
          <div className="problem-bank-decoration" aria-hidden="true">
            <span>∑</span>
            <i />
            <b />
          </div>
        </div>
      </section>

      <div className="container problem-bank-content">
        {previewOnly ? (
          <aside className="problem-bank-demo-notice" aria-label={copy.demoNoticeTitle}>
            <span className="problem-bank-notice-icon" aria-hidden="true">
              i
            </span>
            <div>
              <strong>{copy.demoNoticeTitle}</strong>
              <p>{copy.demoNoticeDescription}</p>
            </div>
          </aside>
        ) : null}

        <section className="problem-bank-tools" aria-label={copy.accessiblyFiltered}>
          <div className="problem-bank-search">
            <label className="field-label" htmlFor="problem-search">
              {copy.searchLabel}
            </label>
            <div className="problem-search-wrap">
              <span aria-hidden="true">⌕</span>
              <input
                autoComplete="off"
                className="input"
                id="problem-search"
                onChange={(event) => setQuery(event.target.value)}
                placeholder={copy.searchPlaceholder}
                type="search"
                value={query}
              />
            </div>
          </div>
          <label className="field problem-bank-filter">
            <span className="field-label">{copy.categoryLabel}</span>
            <select
              className="input"
              onChange={(event) => setCategory(event.target.value as ProblemSetCategory | "all")}
              value={category}
            >
              <option value="all">{copy.allCategories}</option>
              {Object.entries(copy.categories).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="field problem-bank-filter">
            <span className="field-label">{copy.difficultyLabel}</span>
            <select
              className="input"
              onChange={(event) => setDifficulty(event.target.value as ProblemDifficulty | "all")}
              value={difficulty}
            >
              <option value="all">{copy.allDifficulties}</option>
              {Object.entries(copy.difficulties).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="field problem-bank-filter problem-bank-sort">
            <span className="field-label">{copy.sortLabel}</span>
            <select
              className="input"
              onChange={(event) =>
                setSort(event.target.value as NonNullable<ProblemSetFilters["sort"]>)
              }
              value={sort}
            >
              <option value="newest">{copy.sortNewest}</option>
              <option value="title">{copy.sortTitle}</option>
              <option value="question_count">{copy.sortQuestionCount}</option>
              <option value="duration">{copy.sortDuration}</option>
            </select>
          </label>
        </section>

        <div className="problem-bank-results" aria-live="polite" aria-atomic="true">
          {interpolate(copy.resultCount, { count: visibleSets.length })}
        </div>

        {visibleSets.length > 0 ? (
          <section className="problem-set-grid" aria-label={copy.accessiblyFiltered}>
            {visibleSets.map((problemSet) => {
              const examHref = previewOnly
                ? problemSet.id.startsWith("word-exam-")
                  ? `/exams/preview/${problemSet.slug}`
                  : problemSet.id.startsWith("practice-")
                    ? `/exams/practice/${problemSet.slug}`
                    : null
                : `/exams/${problemSet.slug}`;
              return (
                <Card className="problem-set-card" interactive key={problemSet.id}>
                  <div className="problem-set-card-top">
                    <span className="problem-set-icon" aria-hidden="true">
                      {problemSet.category === "mock_exam" ? "▤" : "∑"}
                    </span>
                    <Badge tone="primary">{copy.categories[problemSet.category]}</Badge>
                  </div>
                  <h2>{problemSet.title}</h2>
                  <p className="problem-set-description">{problemSet.description}</p>

                  <div className="problem-set-topics" aria-label={copy.categoryLabel}>
                    {problemSet.topicNames.map((topic) => (
                      <span key={topic}>{topic}</span>
                    ))}
                  </div>

                  <dl className="problem-set-metrics">
                    <div>
                      <dt aria-label={copy.questionCount}>▧</dt>
                      <dd>
                        <strong>{problemSet.questionCount}</strong> {copy.questionCount}
                      </dd>
                    </div>
                    <div>
                      <dt
                        aria-label={
                          problemSet.timingMode === "countdown"
                            ? copy.timeLimitLabel
                            : problemSet.estimatedDurationMinutes === null
                              ? copy.elapsedTimerLabel
                              : copy.estimatedDurationLabel
                        }
                      >
                        ◷
                      </dt>
                      <dd>
                        <strong>
                          {problemSet.timingMode === "elapsed" &&
                          problemSet.estimatedDurationMinutes === null
                            ? copy.elapsedTimerLabel
                            : (problemSet.timeLimitMinutes ??
                              problemSet.estimatedDurationMinutes ??
                              "—")}
                        </strong>
                        {problemSet.timingMode === "elapsed" &&
                        problemSet.estimatedDurationMinutes === null
                          ? ""
                          : copy.minutes}
                      </dd>
                    </div>
                    <div>
                      <dt aria-label={copy.difficultyLabel}>↗</dt>
                      <dd>{copy.difficulties[problemSet.difficulty]}</dd>
                    </div>
                  </dl>

                  <div className="problem-set-timer-mode">
                    <span>
                      {problemSet.timingMode === "countdown"
                        ? copy.timeLimitLabel
                        : problemSet.estimatedDurationMinutes === null
                          ? copy.elapsedTimerLabel
                          : copy.estimatedDurationLabel}
                    </span>
                    <strong>
                      {problemSet.timingMode === "countdown"
                        ? copy.countdownBehavior
                        : copy.elapsedBehavior}
                    </strong>
                  </div>

                  {problemSet.examYear !== null || problemSet.examOrganization ? (
                    <div className="problem-set-exam-meta">
                      <span>{copy.examMetadata}</span>
                      <strong>
                        {[problemSet.examOrganization, problemSet.examYear, problemSet.examSession]
                          .filter(Boolean)
                          .join(" · ")}
                      </strong>
                    </div>
                  ) : null}

                  <div className="problem-set-card-footer">
                    <div className="problem-set-badges">
                      {previewOnly ? <Badge>{copy.demoBadge}</Badge> : null}
                      {previewOnly ? <Badge>{copy.previewBadge}</Badge> : null}
                    </div>
                    {examHref ? (
                      <Link
                        className="button button--primary problem-set-start-link"
                        href={examHref as Route}
                      >
                        Mở đề
                      </Link>
                    ) : (
                      <span className="problem-set-not-ready">{copy.noQuestions}</span>
                    )}
                  </div>
                </Card>
              );
            })}
          </section>
        ) : (
          <section className="problem-bank-empty" role="status">
            <span aria-hidden="true">⌕</span>
            <h2>{copy.emptyTitle}</h2>
            <p>{copy.emptyDescription}</p>
            <Button onClick={clearFilters} variant="secondary">
              {copy.resetFilters}
            </Button>
          </section>
        )}
      </div>
    </main>
  );
}
