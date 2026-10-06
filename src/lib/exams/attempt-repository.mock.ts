import { randomUUID } from "node:crypto";
import { scoreExam } from "./scoring";
import { getMockExam, toExamPublicSummary, toSafeQuestion } from "./demo-data.mock";
import type {
  AttemptOwner,
  ExamAnswer,
  ExamAttempt,
  ExamDefinition,
  PublicExamAttempt,
} from "./types";
import type { AttemptRepository } from "./attempt-repository";

export class MockAttemptRepository {
  private readonly attempts = new Map<string, ExamAttempt>();
  private readonly startKeys = new Map<string, string>();
  private readonly guestAnsweredQuestions = new Map<string, Set<string>>();

  constructor(private readonly now: () => number = Date.now) {}

  start(exam: ExamDefinition, owner: AttemptOwner, requestKey: string): ExamAttempt {
    const startKey = `${owner.kind === "guest" ? owner.guestSessionHash : `user:${owner.userId}`}:${exam.id}:${requestKey}`;
    const existingId = this.startKeys.get(startKey);
    if (existingId) return this.attempts.get(existingId)!;

    const current = this.findCurrent(owner, exam.id);
    if (current?.status === "in_progress") return current;

    const startedAtMs = this.now();
    const attempt: ExamAttempt = {
      id: randomUUID(),
      examId: exam.id,
      owner,
      status: "in_progress",
      questionIdsInOrder: exam.questions.map((question) => question.id),
      answers: Object.fromEntries(
        exam.questions.map((question) => [
          question.id,
          { answer: null, markedForReview: false, updatedAt: null },
        ]),
      ),
      startedAt: new Date(startedAtMs).toISOString(),
      deadlineAt:
        exam.timingMode === "countdown" && exam.durationSeconds !== null
          ? new Date(startedAtMs + exam.durationSeconds * 1000).toISOString()
          : null,
      submittedAt: null,
      durationSeconds: null,
      submitRequestId: null,
      result: null,
    };
    this.attempts.set(attempt.id, attempt);
    this.startKeys.set(startKey, attempt.id);
    return attempt;
  }

  findCurrent(owner: AttemptOwner, examId: string): ExamAttempt | null {
    const attempt = [...this.attempts.values()]
      .filter(
        (item) =>
          item.examId === examId && item.status === "in_progress" && isSameOwner(item.owner, owner),
      )
      .sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt))[0];
    if (attempt && hasExpired(attempt, this.now())) {
      return this.finalize(attempt, "auto_submitted", `expiry:${attempt.id}`);
    }
    return attempt ?? null;
  }

  get(attemptId: string, owner: AttemptOwner): ExamAttempt | null {
    const attempt = this.attempts.get(attemptId);
    if (!attempt || !isSameOwner(attempt.owner, owner)) return null;
    if (attempt.status === "in_progress" && hasExpired(attempt, this.now())) {
      return this.finalize(attempt, "auto_submitted", `expiry:${attempt.id}`);
    }
    return attempt;
  }

  save(
    attemptId: string,
    owner: AttemptOwner,
    input: { questionId: string; answer: ExamAnswer | null; markedForReview: boolean },
  ): ExamAttempt | null {
    const attempt = this.get(attemptId, owner);
    if (!attempt || attempt.status !== "in_progress") return attempt;
    if (!attempt.questionIdsInOrder.includes(input.questionId)) return null;
    if (owner.kind === "guest" && input.answer !== null) {
      const used = this.guestAnsweredQuestions.get(owner.guestSessionHash) ?? new Set<string>();
      if (!used.has(input.questionId) && used.size >= 10)
        throw new Error("guest_question_limit_reached");
      used.add(input.questionId);
      this.guestAnsweredQuestions.set(owner.guestSessionHash, used);
    }
    attempt.answers[input.questionId] = {
      answer: input.answer,
      markedForReview: input.markedForReview,
      updatedAt: new Date(this.now()).toISOString(),
    };
    return attempt;
  }

  abandon(attemptId: string, owner: AttemptOwner): boolean {
    const attempt = this.get(attemptId, owner);
    if (!attempt || attempt.status !== "in_progress") return false;
    attempt.status = "abandoned";
    return true;
  }

  getGuestQuestionUsage(owner: AttemptOwner): number {
    return owner.kind === "guest"
      ? (this.guestAnsweredQuestions.get(owner.guestSessionHash)?.size ?? 0)
      : 0;
  }

  submit(
    attemptId: string,
    owner: AttemptOwner,
    requestId: string,
    reason: "manual" | "auto",
  ): ExamAttempt | null {
    const attempt = this.get(attemptId, owner);
    if (!attempt) return null;
    if (attempt.status !== "in_progress") return attempt;
    const expired = hasExpired(attempt, this.now());
    return this.finalize(
      attempt,
      expired || reason === "auto" ? "auto_submitted" : "submitted",
      requestId,
    );
  }

  toPublicAttempt(attempt: ExamAttempt): PublicExamAttempt | null {
    const exam = getMockExam(attempt.examId);
    if (!exam) return null;
    const safeAttempt = {
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
    };
    return {
      ...safeAttempt,
      exam: toExamPublicSummary(exam),
      questions: attempt.questionIdsInOrder
        .map((id) => exam.questions.find((question) => question.id === id))
        .filter((question): question is NonNullable<typeof question> => question !== undefined)
        .map(toSafeQuestion),
    };
  }

  private finalize(
    attempt: ExamAttempt,
    status: "submitted" | "auto_submitted",
    requestId: string,
  ): ExamAttempt {
    if (attempt.status !== "in_progress") return attempt;
    const exam = getMockExam(attempt.examId);
    if (!exam) return attempt;
    const submittedAtMs = this.now();
    attempt.status = status;
    attempt.submittedAt = new Date(submittedAtMs).toISOString();
    attempt.durationSeconds = Math.max(
      0,
      Math.floor((submittedAtMs - Date.parse(attempt.startedAt)) / 1000),
    );
    attempt.submitRequestId = requestId;
    attempt.result = scoreExam(
      exam,
      Object.fromEntries(Object.entries(attempt.answers).map(([id, state]) => [id, state.answer])),
    );
    return attempt;
  }
}

/** Async adapter keeps test/development behavior behind the same repository contract. */
export class DevelopmentAttemptRepository implements AttemptRepository {
  constructor(private readonly store: MockAttemptRepository = getDevelopmentAttemptRepository()) {}

  async getExam(examId: string): Promise<ExamDefinition | null> {
    return getMockExam(examId);
  }

  async findCurrent(examId: string, owner: AttemptOwner): Promise<PublicExamAttempt | null> {
    const attempt = this.store.findCurrent(owner, examId);
    return attempt ? this.store.toPublicAttempt(attempt) : null;
  }

  async getGuestQuestionUsage(owner: AttemptOwner): Promise<number> {
    return this.store.getGuestQuestionUsage(owner);
  }

  async start(examId: string, owner: AttemptOwner, requestKey: string) {
    const exam = getMockExam(examId);
    if (!exam) return null;
    const current = this.store.findCurrent(owner, examId);
    if (current?.status === "in_progress") return this.store.toPublicAttempt(current);
    if (owner.kind === "guest" && this.store.getGuestQuestionUsage(owner) >= 10)
      throw new Error("guest_question_limit_reached");
    const attempt = this.store.start(exam, owner, requestKey);
    return this.store.toPublicAttempt(attempt);
  }

  async get(attemptId: string, owner: AttemptOwner) {
    const attempt = this.store.get(attemptId, owner);
    return attempt ? this.store.toPublicAttempt(attempt) : null;
  }

  async save(
    attemptId: string,
    owner: AttemptOwner,
    input: Parameters<AttemptRepository["save"]>[2],
  ) {
    const attempt = this.store.save(attemptId, owner, input);
    return attempt ? this.store.toPublicAttempt(attempt) : null;
  }

  async abandon(attemptId: string, owner: AttemptOwner): Promise<boolean> {
    return this.store.abandon(attemptId, owner);
  }

  async submit(
    attemptId: string,
    owner: AttemptOwner,
    requestId: string,
    reason: "manual" | "auto",
  ) {
    const attempt = this.store.submit(attemptId, owner, requestId, reason);
    return attempt ? this.store.toPublicAttempt(attempt) : null;
  }

  async claimGuestAttempts(): Promise<number> {
    return 0;
  }
}

function isSameOwner(left: AttemptOwner, right: AttemptOwner): boolean {
  if (left.kind !== right.kind) return false;
  return left.kind === "guest"
    ? right.kind === "guest" && left.guestSessionHash === right.guestSessionHash
    : right.kind === "user" && left.userId === right.userId;
}

function hasExpired(attempt: ExamAttempt, now: number): boolean {
  return attempt.deadlineAt !== null && Date.parse(attempt.deadlineAt) <= now;
}

type GlobalWithDemoStore = typeof globalThis & {
  __mathPathDemoAttemptRepository?: MockAttemptRepository;
};

/** A development-only shared mock for exercising refresh, resume, and submission flows. */
export function getDevelopmentAttemptRepository(): MockAttemptRepository {
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "Attempt persistence is not configured. Refusing to use the demo memory store.",
    );
  }
  const runtime = globalThis as GlobalWithDemoStore;
  runtime.__mathPathDemoAttemptRepository ??= new MockAttemptRepository();
  return runtime.__mathPathDemoAttemptRepository;
}
