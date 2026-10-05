import { NextResponse } from "next/server";
import { z } from "zod";
import { getAttemptRepository } from "@/lib/exams/repository-provider.server";
import { readExamOwner } from "@/lib/exams/guest-session.server";

const submitSchema = z.object({
  requestId: z.string().uuid(),
  reason: z.enum(["manual", "auto"]),
});

export async function POST(
  request: Request,
  context: RouteContext<"/api/attempts/[attemptId]/submit">,
) {
  try {
    const parsed = submitSchema.safeParse(await request.json());
    if (!parsed.success) return apiError("invalid_request", 400);
    const { attemptId } = await context.params;
    const owner = await readExamOwner();
    if (!owner) return apiError("attempt_not_found", 404);
    const attempt = await getAttemptRepository().submit(
      attemptId,
      owner,
      parsed.data.requestId,
      parsed.data.reason,
    );
    if (!attempt) return apiError("attempt_not_found", 404);
    return NextResponse.json({ attempt }, { headers: noStoreHeaders });
  } catch (error) {
    if (error instanceof Error && error.message === "attempt_closed") {
      return apiError("attempt_closed", 409);
    }
    return apiError(
      error instanceof Error && error.message.includes("Supabase")
        ? "supabase_configuration_required"
        : "attempt_storage_unavailable",
      503,
    );
  }
}

const noStoreHeaders = { "Cache-Control": "no-store, private" };

function apiError(code: string, status: number) {
  return NextResponse.json({ error: { code } }, { status, headers: noStoreHeaders });
}
