import { notFound } from "next/navigation";
import {
  IngestionSourceList,
  type IngestionSourceSummary,
} from "@/components/problems/ingestion-source-list";
import {
  getLocalIngestionManifest,
  localIngestionReviewEnabled,
} from "@/lib/problems/ingestion-review.server";

export default async function IngestionReviewIndexPage() {
  if (!localIngestionReviewEnabled()) notFound();
  const rawSources = await getLocalIngestionManifest();
  const sources = rawSources.filter(
    (source): source is IngestionSourceSummary =>
      typeof source === "object" &&
      source !== null &&
      "source_id" in source &&
      typeof source.source_id === "string" &&
      "source_type" in source &&
      (source.source_type === "exam" || source.source_type === "topic_practice"),
  );
  return (
    <main className="page-shell ingestion-review-page">
      <IngestionSourceList sources={sources} />
    </main>
  );
}
