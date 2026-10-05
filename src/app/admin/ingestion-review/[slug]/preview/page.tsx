import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LocalExamPreview } from "@/components/problems/local-exam-preview";
import {
  getLocalIngestionImport,
  localIngestionReviewEnabled,
} from "@/lib/problems/ingestion-review.server";

export const metadata: Metadata = {
  title: "Local Exam Preview | MathPath",
  robots: { index: false, follow: false },
};

export default async function LocalExamPreviewPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  if (!localIngestionReviewEnabled()) notFound();
  const { slug } = await params;
  const ingestion = await getLocalIngestionImport(slug);
  if (
    !ingestion ||
    ingestion.value.problem_set.source_kind !== "exam" ||
    !ingestion.value.questions.length
  ) {
    notFound();
  }

  const questions = ingestion.value.questions.map((question) => ({
    id: question.id,
    section: question.section,
    question_number: question.question_number,
    order_index: question.order_index,
    statement: question.statement,
    question_type: question.question_type,
    options: question.options,
    substatements: question.substatements,
    source_page: question.source_page,
    image_path: question.image_path,
    illustration_status: question.illustration_status,
    extraction_warnings: question.extraction_warnings,
  }));

  return (
    <LocalExamPreview slug={slug} title={ingestion.value.problem_set.title} questions={questions} />
  );
}
