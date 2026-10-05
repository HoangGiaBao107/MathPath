"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale } from "@/components/providers/locale-provider";
import { Button } from "@/components/ui/button";
import { MathContentView } from "@/components/problems/math-content-view";
import { cleanupDisplayText, validateMathContent } from "@/lib/problems/math-content";
import { validateDisplayDraft } from "@/lib/problems/display-content";
import type { LocalReviewQuestion } from "@/lib/problems/ingestion-review.server";

type Tab = "vi" | "en";
type DisplayDraft = {
  statement: string;
  options: LocalReviewQuestion["options"];
  statements: LocalReviewQuestion["substatements"];
  shortAnswerPrompt: string;
  explanation: string | null;
};

function initialDraft(question: LocalReviewQuestion, locale: Tab): DisplayDraft {
  return locale === "vi"
    ? {
        statement: question.display_statement_vi ?? question.statement,
        options: question.display_options_vi ?? question.options,
        statements: question.display_true_false_statements_vi ?? question.substatements,
        shortAnswerPrompt: question.display_short_answer_prompt_vi ?? question.statement,
        explanation: question.display_explanation_vi ?? question.explanation,
      }
    : {
        statement: question.display_statement_en ?? "",
        options:
          question.display_options_en ??
          (question.raw_options ?? question.options).map((item) => ({ ...item, text: "" })),
        statements:
          question.display_true_false_statements_en ??
          (question.raw_true_false_statements ?? question.substatements).map((item) => ({
            ...item,
            text: "",
          })),
        shortAnswerPrompt: question.display_short_answer_prompt_en ?? "",
        explanation: question.display_explanation_en ?? "",
      };
}

export function IngestionReview({
  slug,
  problemSetTitle,
  questions,
  processingStatus,
  processingErrors,
  page,
  totalPages,
  searchQuery,
  statusFilter,
}: {
  slug: string;
  problemSetTitle: string;
  questions: LocalReviewQuestion[];
  processingStatus?: string;
  processingErrors?: string[];
  page: number;
  totalPages: number;
  searchQuery: string;
  statusFilter: string;
}) {
  const { messages } = useLocale();
  const copy = messages.pdfReview;
  const editorCopy = copy.contentEditor;
  const isSyntheticFixture = problemSetTitle.startsWith("MathPath Synthetic");
  const question = questions[0];
  const [tab, setTab] = useState<Tab>("vi");
  const [draft, setDraft] = useState<DisplayDraft>(() =>
    question
      ? initialDraft(question, "vi")
      : {
          statement: "",
          options: [],
          statements: [],
          shortAnswerPrompt: "",
          explanation: null,
        },
  );
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [dirty, setDirty] = useState(false);

  const mathIssues = useMemo(
    () =>
      [
        draft.statement,
        ...draft.options.map((item) => item.text),
        ...draft.statements.map((item) => item.text),
        draft.shortAnswerPrompt,
        draft.explanation ?? "",
      ].flatMap((value) => validateMathContent(value).issues),
    [draft],
  );

  useEffect(() => {
    if (!question) return;
    // The route keeps this editor mounted while its paginated question changes.
    // Reset the local draft to the newly selected source question.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDraft(initialDraft(question, tab));
    setDirty(false);
    setNotice("");
  }, [question, tab]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = editorCopy.unsavedWarning;
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, editorCopy.unsavedWarning]);

  const draftIssues = useMemo(
    () => (question ? validateDisplayDraft(question, draft) : []),
    [question, draft],
  );

  function update<K extends keyof DisplayDraft>(key: K, value: DisplayDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
    setDirty(true);
  }

  async function act(
    action: "save_display" | "approve_content" | "approve_translation" | "needs_review",
  ) {
    if (!question) return;
    setSaving(true);
    setNotice("");
    try {
      const response = await fetch(`/api/dev/ingestion-review/${slug}/${question.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          action === "save_display" ? { action, locale: tab, display: draft } : { action },
        ),
      });
      const result = (await response.json()) as { error?: string; issues?: string[] };
      if (!response.ok) {
        if (result.error === "math_translation_mismatch")
          setNotice(editorCopy.mathPreservationError);
        else if (result.error === "invalid_math")
          setNotice(`${editorCopy.mathError} ${result.issues?.join(" · ") ?? ""}`);
        else if (result.error === "vietnamese_content_not_approved")
          setNotice(editorCopy.approveViFirst);
        else if (result.error === "english_translation_incomplete")
          setNotice(editorCopy.englishIncomplete);
        else if (result.error === "translation_requires_content_review")
          setNotice(editorCopy.reviewOnlyNotice);
        else throw new Error("save_failed");
        return;
      }
      setDirty(false);
      setNotice(action === "approve_content" ? editorCopy.approvedContent : copy.saved);
      if (action === "save_display") window.location.reload();
      if (
        action === "approve_content" ||
        action === "approve_translation" ||
        action === "needs_review"
      )
        window.location.reload();
    } catch {
      setNotice(copy.saveError);
    } finally {
      setSaving(false);
    }
  }

  function setItemText(kind: "options" | "statements", index: number, text: string) {
    const rows = [...draft[kind]];
    rows[index] = { ...rows[index], text };
    update(kind, rows);
  }

  const cleaned = cleanupDisplayText(draft.statement);
  if (!question) {
    return (
      <main className="page-shell">
        <section className="container ingestion-editor-empty">
          <h1>{copy.noQuestions}</h1>
          {processingErrors?.map((error) => (
            <p key={error}>{error}</p>
          ))}
        </section>
      </main>
    );
  }

  const localeName = tab === "vi" ? editorCopy.editVi : editorCopy.editEn;
  const pageHref = (target: number) => {
    const query = new URLSearchParams({ page: String(target) });
    if (searchQuery) query.set("q", searchQuery);
    if (statusFilter !== "all") query.set("status", statusFilter);
    return `/admin/ingestion-review/${slug}?${query.toString()}`;
  };
  return (
    <div className="ingestion-editor">
      <header className="ingestion-editor-header">
        <span className="eyebrow">
          {isSyntheticFixture ? "MATHPATH · FIXTURE" : "MATHPATH · LOCAL CONTENT EDITOR"}
        </span>
        <h1>{problemSetTitle}</h1>
        <p>{editorCopy.rawImmutable}</p>
        <div className="ingestion-review-notice" role="note">
          <strong>LOCAL ONLY · DRAFT · NOT PUBLISHED</strong>
          <span>{editorCopy.reviewOnlyNotice}</span>
        </div>
        {processingStatus?.startsWith("failed") ? <p role="status">{processingStatus}</p> : null}
        {notice ? (
          <p className="ingestion-review-feedback" role="status">
            {notice}
          </p>
        ) : null}
      </header>

      <nav className="ingestion-editor-pagination" aria-label={editorCopy.page}>
        <a aria-disabled={page <= 1} href={page > 1 ? pageHref(page - 1) : undefined}>
          ← {editorCopy.previousPage}
        </a>
        <span>
          {editorCopy.page} {page} / {totalPages}
        </span>
        <a
          aria-disabled={page >= totalPages}
          href={page < totalPages ? pageHref(page + 1) : undefined}
        >
          {editorCopy.nextPage} →
        </a>
      </nav>
      <form className="ingestion-editor-filter" action={`/admin/ingestion-review/${slug}`}>
        <label>
          <span>{editorCopy.searchQuestions}</span>
          <input name="q" defaultValue={searchQuery} />
        </label>
        <label>
          <span>{editorCopy.reviewFilter}</span>
          <select name="status" defaultValue={statusFilter}>
            <option value="all">{editorCopy.allQuestions}</option>
            <option value="needs_review">{editorCopy.needsReviewFilter}</option>
            <option value="approved">{editorCopy.approvedFilter}</option>
            <option value="translation">{editorCopy.translationFilter}</option>
          </select>
        </label>
        <Button type="submit" variant="secondary">
          {editorCopy.applyFilter}
        </Button>
      </form>

      <div className="ingestion-editor-grid">
        <aside className="ingestion-editor-source">
          <div className="ingestion-editor-source-heading">
            <span className="eyebrow">
              {copy.question} {question.question_number} · {question.source_document}
            </span>
            <h2>{copy.sourceEvidence}</h2>
          </div>
          {question.source_page_images?.length
            ? question.source_page_images.map((image) => (
                <img
                  key={image}
                  src={`/api/dev/ingestion-review/${slug}/assets/${image}`}
                  alt={`${copy.sourcePage} ${image}`}
                  loading="lazy"
                />
              ))
            : null}
          {question.image_path ? (
            <img
              className="ingestion-editor-crop"
              src={`/api/dev/ingestion-review/${slug}/assets/${question.image_path}`}
              alt={`${copy.questionCrop} ${question.question_number}`}
              loading="lazy"
            />
          ) : null}
          <details className="ingestion-review-raw-source" open>
            <summary>{editorCopy.rawImmutable}</summary>
            <pre>{question.raw_statement ?? question.statement}</pre>
          </details>
          <details className="ingestion-review-raw-source">
            <summary>
              {copy.answer} · {copy.answerProvenance}:{" "}
              {question.answer_provenance ?? copy.missingAnswer}
            </summary>
            <pre>
              {question.correct_answer ? JSON.stringify(question.correct_answer, null, 2) : "null"}
            </pre>
          </details>
          {question.extraction_warnings?.length ? (
            <ul className="ingestion-review-warning">
              {question.extraction_warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          ) : null}
        </aside>

        <section className="ingestion-editor-workspace" aria-label={localeName}>
          <div className="ingestion-editor-tabs" role="tablist" aria-label={copy.extractedText}>
            <button role="tab" aria-selected={tab === "vi"} onClick={() => setTab("vi")}>
              {editorCopy.editVi}
            </button>
            <button
              role="tab"
              aria-selected={tab === "en"}
              disabled={question.content_review_status !== "approved"}
              onClick={() => setTab("en")}
            >
              {editorCopy.editEn}
            </button>
          </div>
          <p className="ingestion-editor-status">
            {tab === "vi"
              ? question.content_review_status === "approved"
                ? editorCopy.approvedContent
                : editorCopy.cleanVi
              : mathIssues.length
                ? editorCopy.translationDraft
                : {
                    not_started: editorCopy.translationNotStarted,
                    machine_draft: editorCopy.translationDraft,
                    manually_reviewed: editorCopy.translationReviewed,
                    approved: editorCopy.translationApproved,
                  }[question.translation_status ?? "not_started"]}
          </p>
          {tab === "en" ? (
            <p className="ingestion-editor-help">{editorCopy.englishNeedsManualDraft}</p>
          ) : null}
          <p className="ingestion-editor-help">{editorCopy.formulaInputHint}</p>

          <label className="ingestion-editor-field">
            <span>{editorCopy.statementField}</span>
            <textarea
              value={draft.statement}
              onChange={(event) => update("statement", event.target.value)}
              rows={7}
            />
          </label>
          {cleaned !== draft.statement && tab === "vi" ? (
            <Button variant="secondary" onClick={() => update("statement", cleaned)}>
              {editorCopy.applySafeCleanup}
            </Button>
          ) : null}

          {question.question_type === "multiple_choice" ? (
            <fieldset className="ingestion-editor-fieldset">
              <legend>{copy.options}</legend>
              {draft.options.map((option, index) => (
                <label className="ingestion-editor-field" key={`${option.key}-${index}`}>
                  <span>{option.key}.</span>
                  <textarea
                    rows={3}
                    value={option.text}
                    onChange={(event) => setItemText("options", index, event.target.value)}
                  />
                </label>
              ))}
              {draft.options.length < 4 ? (
                <Button
                  variant="ghost"
                  onClick={() => {
                    const key =
                      ["A", "B", "C", "D"].find(
                        (candidate) => !draft.options.some((item) => item.key === candidate),
                      ) ?? String(draft.options.length + 1);
                    update("options", [
                      ...draft.options,
                      { key, text: "", order_index: draft.options.length },
                    ]);
                  }}
                >
                  {editorCopy.addOption}
                </Button>
              ) : null}
            </fieldset>
          ) : null}

          {question.question_type === "true_false" ? (
            <fieldset className="ingestion-editor-fieldset">
              <legend>{copy.statements}</legend>
              {draft.statements.map((statement, index) => (
                <label className="ingestion-editor-field" key={`${statement.key}-${index}`}>
                  <span>{statement.key})</span>
                  <textarea
                    rows={3}
                    value={statement.text}
                    onChange={(event) => setItemText("statements", index, event.target.value)}
                  />
                </label>
              ))}
              {draft.statements.length < 4 ? (
                <Button
                  variant="ghost"
                  onClick={() => {
                    const key =
                      ["a", "b", "c", "d"].find(
                        (candidate) => !draft.statements.some((item) => item.key === candidate),
                      ) ?? String.fromCharCode(97 + draft.statements.length);
                    update("statements", [
                      ...draft.statements,
                      { key, text: "", order_index: draft.statements.length },
                    ]);
                  }}
                >
                  {editorCopy.addStatement}
                </Button>
              ) : null}
            </fieldset>
          ) : null}

          {question.question_type === "short_answer" ? (
            <label className="ingestion-editor-field">
              <span>{editorCopy.shortPrompt}</span>
              <textarea
                rows={4}
                value={draft.shortAnswerPrompt}
                onChange={(event) => update("shortAnswerPrompt", event.target.value)}
              />
            </label>
          ) : null}
          {draft.explanation !== null ? (
            <label className="ingestion-editor-field">
              <span>{editorCopy.explanationDisplay}</span>
              <textarea
                rows={5}
                value={draft.explanation ?? ""}
                onChange={(event) => update("explanation", event.target.value)}
              />
            </label>
          ) : null}

          <section className="ingestion-editor-preview" aria-live="polite">
            <h2>{editorCopy.livePreview}</h2>
            <p>
              <MathContentView value={draft.statement} />
            </p>
            {draft.options.map((option) => (
              <p key={option.key}>
                <strong>{option.key}.</strong> <MathContentView value={option.text} />
              </p>
            ))}
            {draft.statements.map((statement) => (
              <p key={statement.key}>
                <strong>{statement.key})</strong> <MathContentView value={statement.text} />
              </p>
            ))}
            {draft.shortAnswerPrompt ? (
              <p>
                <MathContentView value={draft.shortAnswerPrompt} />
              </p>
            ) : null}
            {draft.explanation ? (
              <p>
                <MathContentView value={draft.explanation} />
              </p>
            ) : null}
          </section>

          {mathIssues.length ? (
            <p className="ingestion-editor-validation" role="alert">
              {editorCopy.mathError} {mathIssues.join(" · ")}
            </p>
          ) : null}
          {draftIssues.some((issue) => !mathIssues.includes(issue)) ? (
            <p className="ingestion-editor-validation" role="alert">
              {editorCopy.contentStructureError}{" "}
              {draftIssues.filter((issue) => !mathIssues.includes(issue)).join(" · ")}
            </p>
          ) : null}
          <footer className="ingestion-editor-actions">
            <Button variant="primary" disabled={saving} onClick={() => act("save_display")}>
              {editorCopy.saveDisplayDraft}
            </Button>
            {tab === "vi" ? (
              <Button
                variant="secondary"
                disabled={saving || draftIssues.length > 0}
                onClick={() => act("approve_content")}
              >
                {editorCopy.approveContent}
              </Button>
            ) : (
              <Button
                variant="secondary"
                disabled={
                  saving ||
                  question.content_review_status !== "approved" ||
                  question.translation_status !== "manually_reviewed" ||
                  draftIssues.length > 0
                }
                onClick={() => act("approve_translation")}
              >
                {editorCopy.approveEnglish}
              </Button>
            )}
            <Button variant="ghost" disabled={saving} onClick={() => act("needs_review")}>
              {copy.markNeedsReview}
            </Button>
          </footer>
        </section>
      </div>
    </div>
  );
}
