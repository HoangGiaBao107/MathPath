import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getAttemptRepository } from "@/lib/exams/repository-provider.server";
import { getOrCreateExamOwner, readExamOwner } from "@/lib/exams/guest-session.server";

const startSchema = z.object({
  examId: z.string().min(1).max(100),
  requestKey: z.string().uuid().optional(),
});

export async function GET(request: Request) {
  try {
    const examId = new URL(request.url).searchParams.get("examId");
    if (!examId) return apiError("exam_id_required", 400);
    const owner = await readExamOwner(request);
    if (!owner)
      return NextResponse.json(
        { attempt: null, guestQuestionUsage: 0, isGuest: true },
        { headers: noStoreHeaders },
      );
    const repository = getAttemptRepository();
    const [attempt, guestQuestionUsage] = await Promise.all([
      repository.findCurrent(examId, owner),
      repository.getGuestQuestionUsage(owner),
    ]);
    return NextResponse.json(
      { attempt, guestQuestionUsage, isGuest: owner.kind === "guest" },
      { headers: noStoreHeaders },
    );
  } catch (error) {
    return apiError(storageErrorCode(error), 503);
  }
}

export async function POST(request: Request) {
  try {
    const parsed = startSchema.safeParse(await request.json());
    if (!parsed.success) return apiError("invalid_request", 400);
    const owner = await getOrCreateExamOwner(request);
    const attempt = await getAttemptRepository().start(
      parsed.data.examId,
      owner,
      parsed.data.requestKey ?? randomUUID(),
    );
    if (!attempt) return apiError("exam_not_found", 404);
    return NextResponse.json(
      { attempt, isGuest: owner.kind === "guest" },
      { headers: noStoreHeaders },
    );
  } catch (error) {
    if (error instanceof Error && error.message === "guest_question_limit_reached")
      return apiError("guest_question_limit_reached", 403);
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
