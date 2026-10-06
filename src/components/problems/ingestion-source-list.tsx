"use client";

import Link from "next/link";
import type { Route } from "next";
import { useLocale } from "@/components/providers/locale-provider";
import { Card } from "@/components/ui/card";

export type IngestionSourceSummary = {
  source_id: string;
  exact_filename?: string;
  source_type: "exam" | "topic_practice";
  title?: string | null;
  page_count?: number | null;
  question_count?: number;
  answer_count?: number;
  missing_answer_count?: number;
  explanation_count?: number;
  illustration_count?: number;
  missing_illustration_count?: number;
  incomplete_text_count?: number;
  contradictory_answer_count?: number | null;
  needs_review_count?: number;
  approved_count?: number;
  draft_count?: number;
  conflict_count?: number | null;
  processing_status?: string;
  warnings?: string[];
};

export function IngestionSourceList({ sources }: { sources: IngestionSourceSummary[] }) {
  const { locale, messages } = useLocale();
  const copy = messages.ingestionReview;
  const isVi = locale === "vi";

  return (
    <>
      <header className="ingestion-review-header">
        <span className="eyebrow">LOCAL · DRAFT · NOT PUBLISHED</span>
        <h1>{copy.indexTitle}</h1>
        <p>{copy.indexDescription}</p>
        <p className="ingestion-review-provenance">
          {sources.length} {copy.sourceCount}
        </p>
      </header>
      <div className="ingestion-source-list">
        {sources.map((source) => {
          const failed = source.processing_status?.startsWith("failed") ?? false;
          return (
            <Card key={source.source_id} className="ingestion-source-card">
              <div className="ingestion-source-card-heading">
                <div>
                  <span className="eyebrow">
                    {source.source_type === "exam" ? copy.examSource : copy.topicSource} ·{" "}
                    {source.source_id}
                  </span>
                  <h2>{source.title || source.exact_filename || source.source_id}</h2>
                  <p className="ingestion-review-provenance">{source.exact_filename}</p>
                </div>
                <span className={`ingestion-source-status${failed ? " is-error" : ""}`}>
                  {failed ? copy.statusFailed : copy.statusComplete}
                </span>
              </div>
              <dl className="ingestion-source-metrics">
                <div>
                  <dt>{isVi ? "Số trang" : "Pages"}</dt>
                  <dd>{source.page_count ?? "—"}</dd>
                </div>
                <div>
                  <dt>{copy.questionCount}</dt>
                  <dd>{source.question_count ?? 0}</dd>
                </div>
                <div>
                  <dt>{copy.answerCount}</dt>
                  <dd>{source.answer_count ?? 0}</dd>
                </div>
                <div>
                  <dt>{copy.reviewCount}</dt>
                  <dd>{source.needs_review_count ?? 0}</dd>
                </div>
                <div>
                  <dt>{isVi ? "Đã duyệt nội dung" : "Reviewed"}</dt>
                  <dd>{source.approved_count ?? 0}</dd>
                </div>
                <div>
                  <dt>{isVi ? "Bản nháp" : "Draft"}</dt>
                  <dd>{source.draft_count ?? 0}</dd>
                </div>
                <div>
                  <dt>{copy.visualIssueCount}</dt>
                  <dd>{source.missing_illustration_count ?? 0}</dd>
                </div>
                <div>
                  <dt>{isVi ? "Đáp án mâu thuẫn" : "Answer conflicts"}</dt>
                  <dd>{source.conflict_count ?? "—"}</dd>
                </div>
              </dl>
              <Link
                className="button button--secondary"
                href={`/admin/ingestion-review/${source.source_id}`}
              >
                {copy.openSource}
              </Link>
              {source.source_type === "exam" && (source.question_count ?? 0) > 0 ? (
                <Link
                  className="button button--primary ingestion-preview-link"
                  href={`/admin/ingestion-review/${source.source_id}/preview` as Route}
                >
                  {copy.previewExam}
                </Link>
              ) : null}
              {failed && source.warnings?.length ? (
                <ul className="ingestion-source-errors">
                  {source.warnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              ) : null}
            </Card>
          );
        })}
      </div>
    </>
  );
}
