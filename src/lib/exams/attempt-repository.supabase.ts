import "server-only";

import { z } from "zod";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/problems/database.types";
import { scoreExam } from "./scoring";
import { examRuntimeSchema } from "./exam-runtime-schema";
import { postgresUuidSchema } from "./postgres-uuid-schema";
import { toExamPublicSummary, toSafeQuestion } from "./demo-data.mock";
import type {
  AttemptOwner,
  ExamAnswer,
  ExamAttempt,
  ExamDefinition,
  PublicExamAttempt,
} from "./types";
import type { AttemptRepository } from "./attempt-repository";

const attemptPayloadSchema = z.object({
  attempt: z.object({
    id: z.string().uuid(),
    examId: z.string(),
    status: z.enum(["in_progress", "submitted", "auto_submitted", "expired", "abandoned"]),
    questionIdsInOrder: z.array(postgresUuidSchema),
    startedAt: z.string(),
    deadlineAt: z.string().nullable(),
    submittedAt: z.string().nullable(),
    durationSeconds: z.number().nullable(),
    submitRequestId: z.string().nullable(),
    answers: z.record(
      z.string(),
      z.object({
        answer: z.unknown().nullable(),
        markedForReview: z.boolean(),
        updatedAt: z.string().nullable(),
      }),
    ),
    result: z.unknown().nullable(),
  }),
  exam: examRuntimeSchema,
});

export class SupabaseAttemptRepository implements AttemptRepository {
  private readonly client = getSupabaseAdminClient();

  async getExam(examId: string): Promise<ExamDefinition | null> {
    const { data, error } = await this.client.rpc("get_exam_runtime", { p_slug: examId });
    if (error) {
      console.error("Exam runtime RPC failed", { slug: examId, code: error.code || "unknown" });
      throw new Error("exam_data_unavailable");
    }
    if (!data) return null;
    try {
      return examRuntimeSchema.parse(data);
    } catch (validationError) {
      const issues =
        validationError instanceof z.ZodError
          ? validationError.issues.map((issue) => ({
              path: issue.path.join("."),
              code: issue.code,
            }))
          : [];
      console.error("Exam runtime payload failed validation", { slug: examId, issues });
      throw new Error("exam_data_invalid");
    }
  }

  async getGuestQuestionUsage(owner: AttemptOwner): Promise<number> {
    if (owner.kind !== "guest") return 0;
    const { data, error } = await this.client.rpc("get_guest_question_usage", {
      p_guest_session_hash: owner.guestSessionHash,
    });
    if (error) throw new Error("attempt_storage_unavailable");
    return z.number().int().nonnegative().parse(data);
  }

  async findCurrent(examId: string, owner: AttemptOwner): Promise<PublicExamAttempt | null> {
    const { data, error } = await this.client.rpc("find_current_exam_attempt", {
      ...ownerArgs(owner),
      p_slug: examId,
    });
    if (error) {
      console.error("Find current exam attempt RPC failed", {
        slug: examId,
        code: error.code || "unknown",
      });
      throw new Error("attempt_storage_unavailable");
    }
    const attemptId = z.string().uuid().nullable().parse(data);
    return attemptId ? this.get(attemptId, owner) : null;
  }

  async start(examId: string, owner: AttemptOwner, requestKey: string) {
    const current = await this.findCurrent(examId, owner);
    if (current?.status === "in_progress") return current;
    if (owner.kind === "guest" && (await this.getGuestQuestionUsage(owner)) >= 10)
      throw new Error("guest_question_limit_reached");
    const { data, error } = await this.client.rpc("start_exam_attempt", {
      ...ownerArgs(owner),
      p_slug: examId,
      p_idempotency_key: requestKey,
    });
    if (error) {
      if (error.message.includes("exam_not_found")) return null;
      console.error("Exam attempt start RPC failed", {
        slug: examId,
        code: error.code || "unknown",
        category: error.message.includes("profile_not_found")
          ? "profile_not_found"
          : error.message.includes("service_role_required")
            ? "service_role_required"
            : "database_error",
      });
      if (error.message.includes("profile_not_found")) throw new Error("attempt_profile_missing");
      throw new Error("attempt_storage_unavailable");
    }
    const attemptId = z.string().uuid().parse(data);
    return this.get(attemptId, owner);
  }

  async get(attemptId: string, owner: AttemptOwner) {
    const { data, error } = await this.client.rpc("get_exam_attempt", {
      p_attempt_id: attemptId,
      ...ownerArgs(owner),
    });
    if (error) {
      console.error("Get exam attempt RPC failed", {
        attemptId,
        code: error.code || "unknown",
      });
      throw new Error("attempt_storage_unavailable");
    }
    if (!data) return null;
    return this.toPublic(this.parseAttemptPayload(data, attemptId));
  }

  async save(
    attemptId: string,
    owner: AttemptOwner,
    input: { questionId: string; answer: ExamAnswer | null; markedForReview: boolean },
  ) {
    const { error } = await this.client.rpc("save_exam_attempt_state", {
      p_attempt_id: attemptId,
      ...ownerArgs(owner),
      p_problem_id: input.questionId,
      p_selected_answer: (input.answer as unknown as Json) ?? null,
      p_marked_for_review: input.markedForReview,
    });
    if (error) {
      if (error.message.includes("attempt_not_found")) return null;
      throw new Error(
        error.message.includes("guest_question_limit_reached")
          ? "guest_question_limit_reached"
          : error.message.includes("attempt_closed")
            ? "attempt_closed"
            : "attempt_storage_unavailable",
      );
    }
    return this.get(attemptId, owner);
  }

  async abandon(attemptId: string, owner: AttemptOwner): Promise<boolean> {
    const { data, error } = await this.client.rpc("abandon_exam_attempt", {
      p_attempt_id: attemptId,
      ...ownerArgs(owner),
    });
    if (error) throw new Error("attempt_storage_unavailable");
    return data === true;
  }

  async submit(
    attemptId: string,
    owner: AttemptOwner,
    requestId: string,
    reason: "manual" | "auto",
  ) {
    const existing = await this.loadFull(attemptId, owner);
    if (!existing) return null;
    if (existing.attempt.result) return this.toPublic(existing);
    const { error: claimError } = await this.client.rpc("claim_exam_attempt_submission", {
      p_attempt_id: attemptId,
      ...ownerArgs(owner),
      p_request_id: requestId,
      p_reason: reason,
    });
    if (claimError) {
      if (claimError.message.includes("attempt_not_found")) return null;
      throw new Error(
        claimError.message.includes("submission_in_progress")
          ? "submission_in_progress"
          : claimError.message.includes("attempt_closed")
            ? "attempt_closed"
            : "attempt_storage_unavailable",
      );
    }
    const current = await this.loadFull(attemptId, owner);
    if (!current) return null;
    if (current.attempt.result) return this.toPublic(current);
    if (current.attempt.submitRequestId !== requestId) throw new Error("submission_in_progress");

    const answers = Object.fromEntries(
      Object.entries(current.attempt.answers).map(([id, state]) => [id, state.answer]),
    ) as Record<string, ExamAnswer | null>;
    const result = scoreExam(current.exam, answers);
    const deadlinePassed =
      current.attempt.deadlineAt !== null && Date.parse(current.attempt.deadlineAt) <= Date.now();
    const { error } = await this.client.rpc("submit_exam_attempt", {
      p_attempt_id: attemptId,
      ...ownerArgs(owner),
      p_request_id: requestId,
      p_reason: deadlinePassed ? "auto" : reason,
      p_result_payload: result as unknown as Json,
    });
    if (error) {
      if (error.message.includes("attempt_not_found")) return null;
      throw new Error("attempt_storage_unavailable");
    }
    return this.get(attemptId, owner);
  }

  async claimGuestAttempts(guestSessionHash: string, userId: string): Promise<number> {
    const { data, error } = await this.client.rpc("claim_guest_attempts", {
      p_guest_session_hash: guestSessionHash,
      p_user_id: userId,
    });
    if (error) throw new Error("guest_attempt_claim_failed");
    return z.number().int().nonnegative().parse(data);
  }

  private async loadFull(attemptId: string, owner: AttemptOwner) {
    const { data, error } = await this.client.rpc("get_exam_attempt", {
      p_attempt_id: attemptId,
      ...ownerArgs(owner),
    });
    if (error) {
      console.error("Load full exam attempt RPC failed", {
        attemptId,
        code: error.code || "unknown",
      });
      throw new Error("attempt_storage_unavailable");
    }
    return data ? this.parseAttemptPayload(data, attemptId) : null;
  }

  private parseAttemptPayload(data: unknown, attemptId: string) {
    const parsed = attemptPayloadSchema.safeParse(data);
    if (!parsed.success) {
      console.error("Exam attempt payload failed validation", {
        attemptId,
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.join("."),
          code: issue.code,
        })),
      });
      throw new Error("attempt_data_invalid");
    }
    return parsed.data;
  }

  private toPublic(payload: z.infer<typeof attemptPayloadSchema>): PublicExamAttempt {
    const attemptData = payload.attempt;
    const exam = payload.exam;
    const attempt: ExamAttempt = {
      ...attemptData,
      owner: { kind: "guest", guestSessionHash: "" },
      answers: Object.fromEntries(
        Object.entries(attemptData.answers).map(([id, state]) => [
          id,
          { ...state, answer: state.answer as ExamAnswer | null },
        ]),
      ),
      result: attemptData.result as ExamAttempt["result"],
    };
    return {
      id: attempt.id,
      examId: attempt.examId,
      status: attempt.status,
      questionIdsInOrder: attempt.questionIdsInOrder,
      answers: attempt.answers,
      startedAt: attempt.startedAt,
      deadlineAt: attempt.deadlineAt,
      submittedAt: attempt.submittedAt,
      durationSeconds: attempt.durationSeconds,
      submitRequestId: attempt.submitRequestId,
      result: attempt.result,
      exam: toExamPublicSummary(exam),
      questions: attempt.questionIdsInOrder
        .map((id) => exam.questions.find((question) => question.id === id))
        .filter((question): question is (typeof exam.questions)[number] => question !== undefined)
        .map(toSafeQuestion),
    };
  }
}

function ownerArgs(owner: AttemptOwner) {
  return owner.kind === "guest"
    ? { p_user_id: null, p_guest_session_hash: owner.guestSessionHash }
    : { p_user_id: owner.userId, p_guest_session_hash: null };
}
