import previewData from "@/data/mathpath-word-student-previews.json";
import type { SourceExamPreview } from "./types";

const exams = previewData.exams as SourceExamPreview[];

export function listSourcePreviews(): SourceExamPreview[] {
  return exams;
}

export function getSourcePreview(slug: string): SourceExamPreview | null {
  return exams.find((exam) => exam.slug === slug) ?? null;
}
