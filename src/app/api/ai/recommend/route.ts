import { z } from "zod";
import { NextResponse } from "next/server";
import { deriveStudentPersonalization } from "@/lib/analytics/personalization";
import { getStudentAttemptResult, getStudentProgress } from "@/lib/analytics/server";
import { aiErrorResponse } from "@/lib/ai/http.server";
import { getAIIdentity, withAIReservation } from "@/lib/ai/service.server";

const schema = z.object({ locale: z.enum(["vi", "en"]), attemptId: z.string().uuid().optional() });

export async function POST(request: Request) {
  try {
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
    const { userId } = await getAIIdentity();
    let topic: string | null = null;
    let accuracyPercent: number | null = null;
    let targetScore: number | null = null;
    let currentAverage: number | null = null;
    let scoreTrend: "improving" | "declining" | "stable" | "insufficient_data" =
      "insufficient_data";
    let attemptCount = 0;
    if (userId) {
      const progress = await getStudentProgress(userId);
      const personalization = deriveStudentPersonalization(progress);
      topic = personalization.weakestTopic?.topic ?? null;
      accuracyPercent = personalization.weakestTopic?.accuracy ?? null;
      targetScore = progress.targetScore;
      currentAverage = progress.averageScore;
      scoreTrend = personalization.scoreTrend;
      attemptCount = progress.totalAttempts;
      if (parsed.data.attemptId) {
        const attempt = await getStudentAttemptResult(userId, parsed.data.attemptId);
        if (!attempt) return NextResponse.json({ error: "attempt_not_found" }, { status: 404 });
        const weakest = [...attempt.result.knowledgeOutcomes].sort(
          (a, b) =>
            b.incorrectCount +
            b.partialCount +
            b.unansweredCount -
            (a.incorrectCount + a.partialCount + a.unansweredCount),
        )[0];
        const weakCount = weakest
          ? weakest.incorrectCount + weakest.partialCount + weakest.unansweredCount
          : 0;
        if (weakest && weakCount > 0) {
          topic = weakest.topic;
          const valid = attempt.result.knowledgeOutcomes.reduce(
            (sum, item) => sum + item.questionCount,
            0,
          );
          const correct = attempt.result.questionOutcomes.filter(
            (item) => item.topic === weakest.topic && item.state === "correct",
          ).length;
          accuracyPercent = valid ? Math.round((correct / valid) * 1000) / 10 : null;
        }
      }
    }
    const result = await withAIReservation("recommend", "text", (provider) =>
      provider.recommend({
        topic,
        accuracyPercent,
        targetScore,
        currentAverage,
        scoreTrend,
        attemptCount,
        locale: parsed.data.locale,
      }),
    );
    return NextResponse.json({
      recommendation: result.data,
      facts: { topic, accuracyPercent, targetScore, currentAverage, scoreTrend, attemptCount },
      quota: result.quota,
    });
  } catch (error) {
    return aiErrorResponse(error);
  }
}
