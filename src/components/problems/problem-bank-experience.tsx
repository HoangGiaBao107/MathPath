"use client";

import Link from "next/link";
import type { Route } from "next";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocale } from "@/components/providers/locale-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { interpolate } from "@/lib/i18n/messages";
import { filterAndSortProblemSets } from "@/lib/problems/catalog";
import type {
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
  const [sort, setSort] = useState<NonNullable<ProblemSetFilters["sort"]>>("newest");
  const categoryOptions = [
    { value: "all" as const, label: copy.allCategories },
    { value: "mock_exam" as const, label: copy.categories.mock_exam },
    { value: "topic_review" as const, label: copy.categories.topic_review },
  ];
  const sortOptions = [
    { value: "newest" as const, label: copy.sortNewest },
    { value: "title" as const, label: copy.sortTitle },
    { value: "question_count" as const, label: copy.sortQuestionCount },
    { value: "duration" as const, label: copy.sortDuration },
  ];
  const visibleSets = useMemo(
    () => filterAndSortProblemSets(problemSets, { query, category, sort, locale }),
    [problemSets, query, category, sort, locale],
  );

  function clearFilters() {
    setQuery("");
    setCategory("all");
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
          <StyledDropdown
            label={copy.categoryLabel}
            value={category}
            options={categoryOptions}
            onChange={(value) => setCategory(value as ProblemSetCategory | "all")}
          />
          <StyledDropdown
            label={copy.sortLabel}
            value={sort}
            options={sortOptions}
            className="problem-bank-sort"
            onChange={(value) => setSort(value as NonNullable<ProblemSetFilters["sort"]>)}
          />
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

type DropdownOption<Value extends string> = { value: Value; label: string };

function StyledDropdown<Value extends string>({
  label,
  value,
  options,
  onChange,
  className = "",
}: {
  label: string;
  value: Value;
  options: DropdownOption<Value>[];
  onChange: (value: Value) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const selected = options.find((option) => option.value === value) ?? options[0];

  useEffect(() => {
    function closeOutside(event: PointerEvent) {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) setOpen(false);
    }
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, []);

  function openMenu() {
    setOpen(true);
    requestAnimationFrame(() => rootRef.current?.querySelector<HTMLButtonElement>("[role=option]")?.focus());
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      setOpen(false);
      triggerRef.current?.focus();
      return;
    }
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    const optionsInMenu = Array.from(rootRef.current?.querySelectorAll<HTMLButtonElement>("[role=option]") ?? []);
    const currentIndex = optionsInMenu.indexOf(document.activeElement as HTMLButtonElement);
    if (currentIndex < 0) {
      event.preventDefault();
      openMenu();
      return;
    }
    event.preventDefault();
    const step = event.key === "ArrowDown" ? 1 : -1;
    optionsInMenu[(currentIndex + step + optionsInMenu.length) % optionsInMenu.length]?.focus();
  }

  return (
    <div className={`field problem-bank-filter problem-bank-custom-select${open ? " is-open" : ""} ${className}`} ref={rootRef} onKeyDown={handleKeyDown}>
      <span className="field-label">{label}</span>
      <button
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={`${label}: ${selected?.label ?? ""}`}
        className={`input problem-bank-select-trigger${open ? " is-open" : ""}`}
        onClick={() => (open ? setOpen(false) : openMenu())}
        ref={triggerRef}
        type="button"
      >
        <span>{selected?.label}</span>
        <svg aria-hidden="true" viewBox="0 0 20 20"><path d="m5 7.5 5 5 5-5" /></svg>
      </button>
      {open ? (
        <div className="problem-bank-select-menu" role="listbox" aria-label={label}>
          {options.map((option) => (
            <button
              aria-selected={option.value === value}
              className={`problem-bank-select-option${option.value === value ? " is-selected" : ""}`}
              key={option.value}
              onClick={() => { onChange(option.value); setOpen(false); triggerRef.current?.focus(); }}
              role="option"
              tabIndex={0}
              type="button"
            >
              <span>{option.label}</span>
              {option.value === value ? <span aria-hidden="true">✓</span> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
