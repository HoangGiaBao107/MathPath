import { readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { devReviewActionSchema, type DevReviewAction } from "./review-action-schema";
import {
  getLocalIngestionImport,
  localIngestionReviewEnabled,
} from "@/lib/problems/ingestion-review.server";
import { problemSetImportSchema } from "@/lib/problems/import-schema";
import { validateMathContent } from "@/lib/problems/math-content";
import { mergeDisplayDraft } from "@/lib/problems/display-content";
import { validateDisplayDraft } from "@/lib/problems/display-content";

export const runtime = "nodejs";

function validateDraft(display: Extract<DevReviewAction, { action: "save_display" }>["display"]) {
  return [
    display.statement,
    ...display.options.map((item) => item.text),
    ...display.statements.map((item) => item.text),
    display.shortAnswerPrompt,
    display.explanation ?? "",
  ].flatMap((text) => validateMathContent(text).issues);
}

export async function POST(
  request: Request,
  context: { params: Promise<{ slug: string; questionId: string }> },
) {
  if (!localIngestionReviewEnabled()) return Response.json({ error: "not_found" }, { status: 404 });
  const { slug, questionId } = await context.params;
  const ingestion = await getLocalIngestionImport(slug);
  if (!ingestion) return Response.json({ error: "source_not_found" }, { status: 404 });
  const body = devReviewActionSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return Response.json({ error: "invalid_request" }, { status: 400 });

  const targetPath = path.join(ingestion.directory, "questions.json");
  const temporaryPath = `${targetPath}.${crypto.randomUUID()}.tmp`;
  try {
    const current = JSON.parse(await readFile(targetPath, "utf8")) as typeof ingestion.value;
    const question = current.questions.find((entry) => entry.id === questionId);
    if (!question) return Response.json({ error: "question_not_found" }, { status: 404 });
    const action = body.data;

    if (action.action === "save_display") {
      const draft = action.display;
      try {
        Object.assign(
          question,
          mergeDisplayDraft(question, action.locale, draft, new Date().toISOString()),
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : "invalid_display";
        return Response.json({ error: message }, { status: 422 });
      }
    } else if (action.action === "approve_content") {
      const normalized = {
        statement: question.display_statement_vi ?? question.statement,
        options: question.display_options_vi ?? question.options,
        statements: question.display_true_false_statements_vi ?? question.substatements,
        shortAnswerPrompt: question.display_short_answer_prompt_vi ?? question.statement,
        explanation: question.display_explanation_vi ?? question.explanation,
      };
      const issues = validateDisplayDraft(question, normalized);
      if (issues.length) return Response.json({ error: "invalid_math", issues }, { status: 422 });
      question.content_review_status = "approved";
      question.content_approved_at = new Date().toISOString();
      question.local_review_status = "approved";
    } else if (action.action === "approve_translation") {
      if (
        question.content_review_status !== "approved" ||
        question.translation_status !== "manually_reviewed"
      ) {
        return Response.json({ error: "translation_requires_content_review" }, { status: 422 });
      }
      const englishDraft = {
        statement: question.display_statement_en ?? "",
        options: question.display_options_en ?? [],
        statements: question.display_true_false_statements_en ?? [],
        shortAnswerPrompt: question.display_short_answer_prompt_en ?? "",
        explanation: question.display_explanation_en ?? null,
      };
      const mathIssues = validateDisplayDraft(question, englishDraft);
      if (mathIssues.length)
        return Response.json({ error: "invalid_math", issues: mathIssues }, { status: 422 });
      try {
        mergeDisplayDraft(question, "en", englishDraft, new Date().toISOString());
      } catch (error) {
        return Response.json(
          { error: error instanceof Error ? error.message : "translation_invalid" },
          { status: 422 },
        );
      }
      question.translation_status = "approved";
      question.translation_approved_at = new Date().toISOString();
      question.translation_approved_by = null;
    } else if (action.action === "needs_review") {
      question.content_review_status = "needs_review";
      question.content_approved_at = null;
      question.local_review_status = "needs_review";
      if (question.translation_status === "approved")
        question.translation_status = "manually_reviewed";
      question.translation_approved_at = null;
      question.translation_approved_by = null;
    }

    // Source evidence fields (raw_*, source references, and answer data) are never assigned by display edits.
    const validated = problemSetImportSchema.safeParse(current);
    if (!validated.success)
      return Response.json(
        { error: "edit_invalid", issues: validated.error.issues },
        { status: 422 },
      );
    await writeFile(temporaryPath, `${JSON.stringify(validated.data, null, 2)}\n`, "utf8");
    await rename(temporaryPath, targetPath);
    const currentQuestion = validated.data.questions.find((entry) => entry.id === questionId);
    const hasMathIssues = actionIsDisplaySave(body.data)
      ? validateDraft(body.data.display).length > 0
      : false;
    return Response.json({
      question: currentQuestion,
      published: false,
      warning: hasMathIssues ? "invalid_math" : undefined,
    });
  } catch {
    return Response.json({ error: "save_failed" }, { status: 500 });
  }
}

function actionIsDisplaySave(
  action: DevReviewAction,
): action is Extract<DevReviewAction, { action: "save_display" }> {
  return action.action === "save_display";
}
