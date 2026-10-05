import "server-only";

import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import type { AdminAnalytics, StudentAttemptResult, StudentProgress } from "./types";

const topicSchema = z.object({
  topic: z.string(),
  questionCount: z.number().int().nonnegative(),
  correctCount: z.number().int().nonnegative(),
  partialCount: z.number().int().nonnegative(),
  incorrectCount: z.number().int().nonnegative(),
  unansweredCount: z.number().int().nonnegative(),
  accuracy: z.number().nullable(),
});

const studentProgressSchema = z.object({
  targetScore: z.number().nullable(),
  totalAttempts: z.number().int().nonnegative(),
  averageScore: z.number().nullable(),
  questionsAttempted: z.number().int().nonnegative(),
  correctCount: z.number().int().nonnegative(),
  partialCount: z.number().int().nonnegative(),
  incorrectCount: z.number().int().nonnegative(),
  trend: z.array(
    z.object({
      attemptId: z.string().uuid(),
      examTitle: z.string(),
      submittedAt: z.string(),
      score: z.number(),
    }),
  ),
  topics: z.array(topicSchema),
  historyTotal: z.number().int().nonnegative(),
  history: z.array(
    z.object({
      attemptId: z.string().uuid(),
      examSlug: z.string().nullable(),
      examTitle: z.string(),
      submittedAt: z.string(),
      status: z.enum(["submitted", "auto_submitted"]),
      score: z.number(),
      rawScore: z.number(),
      totalScore: z.number(),
      correctCount: z.number().int().nonnegative(),
      partialCount: z.number().int().nonnegative(),
      incorrectCount: z.number().int().nonnegative(),
      unansweredCount: z.number().int().nonnegative(),
      questionCount: z.number().int().nonnegative(),
      durationSeconds: z.number().int().nonnegative().nullable(),
    }),
  ),
});

const adminAnalyticsSchema = z.object({
  totalAccounts: z.number().int().nonnegative(),
  totalVip: z.number().int().nonnegative(),
  totalAttempts: z.number().int().nonnegative(),
  averageScore: z.number().nullable(),
  completedAttempts: z.number().int().nonnegative(),
  submissionRate: z.number().nullable(),
  averageAttemptsPerAccount: z.number().nullable(),
  subscriptions: z.object({
    free: z.number().int().nonnegative(),
    plus: z.number().int().nonnegative(),
    pro: z.number().int().nonnegative(),
    proMax: z.number().int().nonnegative(),
    otherVip: z.number().int().nonnegative(),
  }),
  targetDistribution: z.array(
    z.object({ bucket: z.number().int(), label: z.string(), count: z.number().int() }),
  ),
  dailyActivity: z.array(
    z.object({ date: z.string(), activeUsers: z.number().int(), submissions: z.number().int() }),
  ),
  scoreTrend: z.array(
    z.object({ date: z.string(), submissions: z.number().int(), averageScore: z.number() }),
  ),
  users: z.array(
    z.object({
      userId: z.string().uuid(),
      email: z.string().nullable(),
      displayName: z.string(),
      attempts: z.number().int().nonnegative(),
      questionsAttempted: z.number().int().nonnegative(),
      averageScore: z.number().nullable(),
    }),
  ),
});

const attemptResultSchema = z.object({
  attemptId: z.string().uuid(),
  examSlug: z.string().nullable(),
  examTitle: z.string(),
  submittedAt: z.string(),
  status: z.enum(["submitted", "auto_submitted"]),
  result: z.object({
    score: z.number(),
    totalScore: z.number(),
    correctCount: z.number().int(),
    partialCount: z.number().int(),
    incorrectCount: z.number().int(),
    unansweredCount: z.number().int(),
    questionCount: z.number().int(),
    percentage: z.number(),
    questionOutcomes: z.array(
      z.object({
        questionId: z.string(),
        sectionId: z.string(),
        questionNumber: z.string(),
        topic: z.string().nullable(),
        subtopic: z.string().nullable(),
        state: z.enum(["unanswered", "correct", "partially_correct", "incorrect"]),
        pointsEarned: z.number(),
        pointsPossible: z.number(),
      }),
    ),
    sectionOutcomes: z.array(
      z.object({
        sectionId: z.string(),
        title: z.string(),
        pointsEarned: z.number(),
        pointsPossible: z.number(),
      }),
    ),
    knowledgeOutcomes: z.array(
      z.object({
        topic: z.string(),
        subtopic: z.string().nullable(),
        questionCount: z.number().int(),
        incorrectCount: z.number().int(),
        partialCount: z.number().int(),
        unansweredCount: z.number().int(),
      }),
    ),
  }),
});

export async function getAuthenticatedActor() {
  const client = await createSupabaseServerClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) return null;
  const { data: profile, error } = await client
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (error || !profile) return null;
  return { userId: user.id, role: profile.role, email: user.email ?? null } as const;
}

export async function getStudentProgress(userId: string, page = 1): Promise<StudentProgress> {
  const limit = 10;
  const safePage = Math.max(1, Math.floor(page));
  const { data, error } = await getSupabaseAdminClient().rpc("get_student_progress", {
    p_user_id: userId,
    p_history_limit: limit,
    p_history_offset: (safePage - 1) * limit,
  });
  if (error) throw new Error("student_progress_unavailable");
  return studentProgressSchema.parse(data) satisfies StudentProgress;
}

export async function getStudentAttemptResult(
  userId: string,
  attemptId: string,
): Promise<StudentAttemptResult | null> {
  const { data, error } = await getSupabaseAdminClient().rpc("get_student_attempt_result", {
    p_user_id: userId,
    p_attempt_id: attemptId,
  });
  if (error) throw new Error("student_attempt_result_unavailable");
  if (!data) return null;
  return attemptResultSchema.parse(data) satisfies StudentAttemptResult;
}

export async function getAdminAnalytics(actorUserId: string): Promise<AdminAnalytics> {
  const { data, error } = await getSupabaseAdminClient().rpc("get_admin_analytics", {
    p_actor_user_id: actorUserId,
  });
  if (error)
    throw new Error(
      error.message.includes("admin_required") ? "admin_required" : "admin_analytics_unavailable",
    );
  return adminAnalyticsSchema.parse(data) satisfies AdminAnalytics;
}
