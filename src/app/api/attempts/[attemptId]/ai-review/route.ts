import { z } from "zod";
import { NextResponse } from "next/server";
import { getAuthenticatedActor, getStudentAttemptResult } from "@/lib/analytics/server";
import { buildAttemptAiContext } from "@/lib/analytics/attempt-ai-context";
import { aiErrorResponse } from "@/lib/ai/http.server";
import { withAIReservation } from "@/lib/ai/service.server";

const messageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1).max(4000),
});

const requestSchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("hint"),
    locale: z.enum(["vi", "en"]),
    questionId: z.string().min(1).max(120),
    level: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  }),
  z.object({
    mode: z.literal("chat"),
    locale: z.enum(["vi", "en"]),
    questionIds: z.array(z.string().min(1).max(120)).min(1).max(8),
    messages: z.array(messageSchema).min(1).max(10),
  }),
]);

export async function POST(
  request: Request,
  context: { params: Promise<{ attemptId: string }> },
) {
  try {
    const { attemptId } = await context.params;
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(attemptId)) {
      return NextResponse.json({ error: "attempt_not_found" }, { status: 404 });
    }

    const body = await request.text();
    if (body.length > 45000) return NextResponse.json({ error: "invalid_request" }, { status: 413 });
    let json: unknown;
    try { json = JSON.parse(body); } catch { return NextResponse.json({ error: "invalid_request" }, { status: 400 }); }
    const parsed = requestSchema.safeParse(json);
    if (!parsed.success) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
    if (
      parsed.data.mode === "chat" &&
      parsed.data.messages.at(-1)?.role !== "user"
    ) {
      return NextResponse.json({ error: "invalid_request" }, { status: 400 });
    }

    const actor = await getAuthenticatedActor();
    if (!actor) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    const attempt = await getStudentAttemptResult(actor.userId, attemptId);
    if (!attempt) return NextResponse.json({ error: "attempt_not_found" }, { status: 404 });

    const questionIds =
      parsed.data.mode === "hint" ? [parsed.data.questionId] : parsed.data.questionIds;
    const groundedContext = buildAttemptAiContext(
      attempt,
      questionIds,
      true,
    );
    if (!groundedContext) return NextResponse.json({ error: "question_not_found" }, { status: 404 });

    const result = await withAIReservation("chat", "text", (provider) => {
      if (parsed.data.mode === "hint") {
        const prompt =
          parsed.data.locale === "vi"
            ? `Hãy đưa gợi ý mức ${parsed.data.level} cho câu ${parsed.data.questionId} trong bối cảnh đề đã nộp. Không làm lộ đáp án cuối.`
            : `Give level ${parsed.data.level} guidance for question ${parsed.data.questionId} from the submitted attempt. Do not reveal the final answer.`;
        return provider.chat({
          locale: parsed.data.locale,
          messages: [{ role: "user", content: prompt }],
          groundedContext,
          responseMode: "hint",
          hintLevel: parsed.data.level,
        });
      }
      return provider.chat({
        locale: parsed.data.locale,
        messages: parsed.data.messages,
        groundedContext,
        responseMode: "chat",
      });
    });

    return NextResponse.json({
      answer: result.data,
      quota: {
        kind: result.quota.kind,
        remaining: result.quota.remaining,
        limit: result.quota.limit,
        resetAt: result.quota.resetAt,
      },
    });
  } catch (error) {
    return aiErrorResponse(error);
  }
}
