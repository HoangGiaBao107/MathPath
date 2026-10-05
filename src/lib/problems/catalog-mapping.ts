import type { ProblemSetRow } from "./database.types";
import type { ProblemDifficulty, PublicProblemSet } from "./types";

type CatalogRow = Pick<
  ProblemSetRow,
  | "id"
  | "slug"
  | "title"
  | "description"
  | "language"
  | "source_year"
  | "timing_mode"
  | "time_limit_seconds"
  | "estimated_duration_seconds"
  | "difficulty"
  | "topic"
  | "category"
  | "exam_metadata"
  | "created_at"
>;

function metadataValue(metadata: Record<string, unknown>, key: string): string | number | null {
  const value = metadata[key];
  return typeof value === "string" || typeof value === "number" ? value : null;
}

export function toPublicProblemSet(row: CatalogRow, questionCount: number): PublicProblemSet {
  const metadata = row.exam_metadata;
  const organization = metadataValue(metadata, "organization");
  const session = metadataValue(metadata, "session");
  const metadataYear = metadataValue(metadata, "year");

  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description ?? "",
    language: row.language,
    category: row.category,
    difficulty: (row.difficulty ?? "mixed") as ProblemDifficulty,
    topicNames: row.topic ? [row.topic] : [],
    questionCount,
    timingMode: row.timing_mode,
    timeLimitMinutes: row.time_limit_seconds === null ? null : row.time_limit_seconds / 60,
    estimatedDurationMinutes:
      row.estimated_duration_seconds === null ? null : row.estimated_duration_seconds / 60,
    examYear: row.source_year ?? (typeof metadataYear === "number" ? metadataYear : null),
    examOrganization: typeof organization === "string" ? organization : null,
    examSession: typeof session === "string" ? session : null,
    publishedAt: row.created_at,
  };
}
