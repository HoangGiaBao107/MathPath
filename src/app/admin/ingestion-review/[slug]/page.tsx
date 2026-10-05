import { notFound } from "next/navigation";
import { IngestionReview } from "@/components/problems/ingestion-review";
import {
  getLocalIngestionImport,
  getLocalIngestionReport,
  localIngestionReviewEnabled,
  type LocalReviewQuestion,
} from "@/lib/problems/ingestion-review.server";

export default async function IngestionReviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string; q?: string; status?: string }>;
}) {
  if (!localIngestionReviewEnabled()) notFound();
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const [ingestion, report] = await Promise.all([
    getLocalIngestionImport(slug),
    getLocalIngestionReport(slug),
  ]);
  if (!ingestion) notFound();
  const search = query.q?.trim().slice(0, 120) ?? "";
  const statusCandidate = query.status;
  const status =
    statusCandidate && ["needs_review", "approved", "translation"].includes(statusCandidate)
      ? statusCandidate
      : "all";
  const questions = ingestion.value.questions.filter((question) => {
    const matchesQuery =
      !search ||
      `${question.question_number} ${question.statement}`
        .toLocaleLowerCase()
        .includes(search.toLocaleLowerCase());
    const matchesStatus =
      status === "needs_review"
        ? question.content_review_status !== "approved"
        : status === "approved"
          ? question.content_review_status === "approved"
          : status === "translation"
            ? question.content_review_status === "approved" &&
              question.translation_status !== "approved"
            : true;
    return matchesQuery && matchesStatus;
  });
  const page = Math.min(
    Math.max(Number.parseInt(query.page ?? "1", 10) || 1, 1),
    Math.max(1, questions.length),
  );
  const activeQuestion = questions[page - 1];

  return (
    <main className="page-shell ingestion-review-page">
      <IngestionReview
        slug={slug}
        problemSetTitle={ingestion.value.problem_set.title}
        questions={activeQuestion ? [activeQuestion as LocalReviewQuestion] : []}
        page={page}
        totalPages={questions.length}
        searchQuery={search}
        statusFilter={status}
        processingStatus={report?.status}
        processingErrors={[...(report?.errors ?? []), ...(report?.warnings ?? [])]}
      />
    </main>
  );
}
