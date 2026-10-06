import { z } from "zod";
import { NextResponse } from "next/server";
import {
  AIServiceUnavailableError,
  getAIIdentity,
  withAIReservation,
} from "@/lib/ai/service.server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getStudentAttemptResult, getStudentProgress } from "@/lib/analytics/server";
import { deriveStudentPersonalization } from "@/lib/analytics/personalization";
import { aiErrorResponse } from "@/lib/ai/http.server";
import { AIOutputInvalidError } from "@/lib/ai/providers.server";

const schema = z.object({
  locale: z.enum(["vi", "en"]),
  topic: z.string().trim().min(1).max(120).optional(),
  difficulty: z.enum(["easy", "medium", "hard"]).optional(),
  attemptId: z.string().uuid().optional(),
});

export async function POST(request: Request) {
  try {
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
    const identity = await getAIIdentity();
    let topic = parsed.data.topic ?? null;
    let sourceContext = topic ? "student_selected_topic" : "independent_practice";
    const difficulty = parsed.data.difficulty ?? "medium";
    let sourceAttemptId: string | null = null;

    if (parsed.data.attemptId) {
      if (!identity.userId)
        return NextResponse.json({ error: "attempt_not_found" }, { status: 404 });
      const attempt = await getStudentAttemptResult(identity.userId, parsed.data.attemptId);
      if (!attempt) return NextResponse.json({ error: "attempt_not_found" }, { status: 404 });
      const weak = [...attempt.result.knowledgeOutcomes].sort(
        (a, b) =>
          b.incorrectCount +
          b.partialCount +
          b.unansweredCount -
          (a.incorrectCount + a.partialCount + a.unansweredCount),
      )[0];
      const weakCount = weak ? weak.incorrectCount + weak.partialCount + weak.unansweredCount : 0;
      topic = topic ?? (weakCount ? (weak?.topic ?? null) : null);
      sourceContext =
        weakCount && weak
          ? `exam_result:${attempt.attemptId}:weak_topic:${weak.topic}`
          : `exam_result:${attempt.attemptId}:no_weak_topic`;
      sourceAttemptId = attempt.attemptId;
    } else if (!topic && identity.userId) {
      const progress = await getStudentProgress(identity.userId);
      const summary = deriveStudentPersonalization(progress);
      topic = summary.weakestTopic?.topic ?? null;
      sourceContext = summary.weakestTopic
        ? `phase8_weak_topic:${summary.weakestTopic.topic}`
        : "phase8_insufficient_topic_data";
    }

    const contextTopic =
      topic ?? (parsed.data.locale === "vi" ? "Toán THPT tổng hợp" : "High-school mathematics");
    const generated = await withAIReservation("practice", "text", async (provider) => {
      await getSupabaseAdminClient()
        .from("ai_practice_items")
        .delete()
        .lt("expires_at", new Date().toISOString());
      const problem = await provider.generateSimilarProblem({
        stem: `Generate a fresh question for the topic: ${contextTopic}. Do not reproduce any source question.`,
        topic: contextTopic,
        difficulty,
        skillTags: topic ? [topic] : [],
        locale: parsed.data.locale,
      });
      if (problem.difficulty !== difficulty) throw new AIOutputInvalidError();
      const { data, error } = await getSupabaseAdminClient()
        .from("ai_practice_items")
        .insert({
          user_id: identity.userId,
          guest_session_hash:
            identity.owner.kind === "guest" ? identity.owner.guestSessionHash : null,
          statement: problem.statement,
          question_type: problem.questionType,
          choices: problem.choices,
          correct_answer: problem.correctAnswer,
          explanation: problem.explanation,
          topic: problem.topic,
          difficulty: problem.difficulty,
          source_context: sourceAttemptId
            ? `${sourceContext}:attempt=${sourceAttemptId}`
            : sourceContext,
          provider: provider.name,
          model: provider.model,
        })
        .select("id, created_at")
        .single();
      if (error || !data) throw new AIServiceUnavailableError();
      return {
        problemId: data.id,
        createdAt: data.created_at,
        provider: provider.name,
        model: provider.model,
        ...problem,
      };
    });

    return NextResponse.json({
      practice: {
        problemId: generated.data.problemId,
        statement: generated.data.statement,
        questionType: generated.data.questionType,
        choices: generated.data.choices,
        topic: contextTopic,
        difficulty,
        sourceContext,
        generationTimestamp: generated.data.createdAt,
        provider: generated.data.provider,
        model: generated.data.model,
      },
      quota: generated.quota,
      source: { topic, sourceAttemptId },
    });
  } catch (error) {
    return aiErrorResponse(error);
  }
}
