import "server-only";
import { readFile, realpath } from "node:fs/promises";
import path from "node:path";
import { problemSetImportSchema } from "./import-schema";
import { hydrateDisplayLayers } from "./display-content";

const extractionRoot = path.resolve(process.cwd(), "content/extracted");
const manifestPath = path.join(extractionRoot, "manifest.json");
const safeSlug = /^[a-z0-9][a-z0-9_-]{0,79}$/;

export type LocalReviewQuestion = {
  id: string;
  section: string | null;
  question_number: string;
  order_index: number;
  statement: string;
  raw_statement?: string;
  display_statement_vi?: string;
  display_statement_en?: string;
  raw_options?: Array<{ key: string; text: string; order_index: number }>;
  display_options_vi?: Array<{ key: string; text: string; order_index: number }>;
  display_options_en?: Array<{ key: string; text: string; order_index: number }>;
  raw_true_false_statements?: Array<{ key: string; text: string; order_index: number }>;
  display_true_false_statements_vi?: Array<{ key: string; text: string; order_index: number }>;
  display_true_false_statements_en?: Array<{ key: string; text: string; order_index: number }>;
  raw_short_answer_prompt?: string;
  display_short_answer_prompt_vi?: string;
  display_short_answer_prompt_en?: string;
  raw_explanation?: string | null;
  display_explanation_vi?: string | null;
  display_explanation_en?: string | null;
  translation_status?: "not_started" | "machine_draft" | "manually_reviewed" | "approved";
  content_review_status?: "needs_review" | "approved";
  edited_at?: string | null;
  edited_by?: string | null;
  content_approved_at?: string | null;
  translation_approved_at?: string | null;
  translation_approved_by?: string | null;
  question_type: "multiple_choice" | "true_false" | "short_answer";
  options: Array<{ key: string; text: string; order_index: number }>;
  substatements: Array<{ key: string; text: string; order_index: number }>;
  correct_answer:
    | { type: "multiple_choice"; option_key: string }
    | { type: "true_false"; statements: Record<string, boolean> }
    | {
        type: "short_answer";
        accepted_values: string[];
        case_sensitive: boolean;
        tolerance?: number;
      }
    | null;
  source_page: number;
  source_pages?: number[];
  source_page_images?: string[];
  image_path?: string;
  answer_provenance?: string;
  raw_answer?: unknown;
  explanation: string | null;
  explanation_provenance?: string | null;
  source_id?: string;
  topic?: string | null;
  source_document?: string | null;
  source_question_number?: string;
  illustration_prompt?: string | null;
  editorial_notes?: string[];
  source_file_hash?: string;
  extraction_warnings?: string[];
  illustration_status?: string;
  extraction_status?: string;
  local_review_status?: string;
  review_status: string;
  publication_status: string;
};

export async function getLocalIngestionImport(slug: string) {
  if (!safeSlug.test(slug)) return null;
  const directory = path.resolve(extractionRoot, slug);
  if (!directory.startsWith(`${extractionRoot}${path.sep}`)) return null;
  try {
    const [realRoot, realDirectory] = await Promise.all([
      realpath(extractionRoot),
      realpath(directory),
    ]);
    if (!realDirectory.startsWith(`${realRoot}${path.sep}`)) return null;
    const questionsPath = await realpath(path.join(realDirectory, "questions.json"));
    if (!questionsPath.startsWith(`${realDirectory}${path.sep}`)) return null;
    const source = await readFile(questionsPath, "utf8");
    const parsed = problemSetImportSchema.safeParse(JSON.parse(source));
    if (!parsed.success) return null;
    parsed.data.questions = parsed.data.questions.map(hydrateDisplayLayers);
    return { directory: realDirectory, value: parsed.data };
  } catch {
    return null;
  }
}

export async function getLocalIngestionManifest() {
  try {
    const source = await readFile(manifestPath, "utf8");
    const parsed = JSON.parse(source) as { sources?: unknown[]; [key: string]: unknown };
    return Array.isArray(parsed.sources) ? parsed.sources : [];
  } catch {
    return [];
  }
}

export async function getLocalIngestionReport(slug: string) {
  if (!safeSlug.test(slug)) return null;
  const directory = path.resolve(extractionRoot, slug);
  if (!directory.startsWith(`${extractionRoot}${path.sep}`)) return null;
  try {
    const [realRoot, realDirectory] = await Promise.all([
      realpath(extractionRoot),
      realpath(directory),
    ]);
    if (!realDirectory.startsWith(`${realRoot}${path.sep}`)) return null;
    const reportPath = await realpath(path.join(realDirectory, "extraction-report.json"));
    if (!reportPath.startsWith(`${realDirectory}${path.sep}`)) return null;
    return JSON.parse(await readFile(reportPath, "utf8")) as {
      status?: string;
      errors?: string[];
      warnings?: string[];
      questions_detected?: number;
      [key: string]: unknown;
    };
  } catch {
    return null;
  }
}

export function localIngestionReviewEnabled() {
  return process.env.NODE_ENV === "development";
}
