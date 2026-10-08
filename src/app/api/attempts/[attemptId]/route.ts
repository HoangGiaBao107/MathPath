import { NextResponse } from "next/server";
import { z } from "zod";
import { getAttemptRepository } from "@/lib/exams/repository-provider.server";
import { validateAnswerForQuestion } from "@/lib/exams/answer-validation";
import { readExamOwner } from "@/lib/exams/guest-session.server";

const saveSchema = z.object({
  questionId: z.string().min(1).max(120),
  answer: z.unknown().nullable(),
  markedForReview: z.boolean(),
});

export async function GET(request: Request, context: RouteContext<"/api/attempts/[attemptId]">) {
  try {
    const { attemptId } = await context.params;
    const owner = await readExamOwner(request);
    if (!owner) return apiError("attempt_not_found", 404);
    const repository = getAttemptRepository();
    const attempt = await repository.get(attemptId, owner);
    if (!attempt) return apiError("attempt_not_found", 404);
    return NextResponse.json({ attempt }, { headers: noStoreHeaders });
  } catch (error) {
    return apiError(storageErrorCode(error), 503);
  }
}

export async function PATCH(request: Request, context: RouteContext<"/api/attempts/[attemptId]">) {
  try {
    const parsed = saveSchema.safeParse(await request.json());
    if (!parsed.success) return apiError("invalid_request", 400);
    const { attemptId } = await context.params;
    const owner = await readExamOwner(request);
    if (!owner) return apiError("attempt_not_found", 404);
    const repository = getAttemptRepository();
    const attempt = await repository.get(attemptId, owner);
    if (!attempt) return apiError("attempt_not_found", 404);
    if (attempt.status !== "in_progress") return apiError("attempt_closed", 409);
    const question = attempt.questions.find((item) => item.id === parsed.data.questionId);
    if (!question || !attempt.questionIdsInOrder.includes(question.id)) {
      return apiError("question_not_in_attempt", 400);
    }
    const validation = validateAnswerForQuestion(question, parsed.data.answer);
    if (!validation.valid) return apiError(validation.code, 400);
    const saved = await repository.save(attemptId, owner, {
      questionId: question.id,
      answer: validation.answer,
      markedForReview: parsed.data.markedForReview,
    });
    if (!saved) return apiError("attempt_not_found", 404);
    if (saved.status !== "in_progress") return apiError("attempt_expired", 409);
    return NextResponse.json({ attempt: saved }, { headers: noStoreHeaders });
  } catch (error) {
    if (error instanceof Error && error.message === "guest_question_limit_reached") {
      return apiError("guest_question_limit_reached", 403);
    }
    if (error instanceof Error && error.message === "attempt_closed") {
      return apiError("attempt_expired", 409);
    }
    return apiError(storageErrorCode(error), 503);
  }
}

const noStoreHeaders = { "Cache-Control": "no-store, private" };

function apiError(code: string, status: number) {
  return NextResponse.json({ error: { code } }, { status, headers: noStoreHeaders });
}

function storageErrorCode(error: unknown): string {
  return error instanceof Error && error.message.includes("Supabase")
    ? "supabase_configuration_required"
    : "attempt_storage_unavailable";
}
