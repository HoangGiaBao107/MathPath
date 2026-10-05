import type { AttemptOwner, ExamAnswer, PublicExamAttempt } from "./types";

export interface AttemptRepository {
  getExam(examId: string): Promise<import("./types").ExamDefinition | null>;
  getGuestQuestionUsage(owner: AttemptOwner): Promise<number>;
  findCurrent(examId: string, owner: AttemptOwner): Promise<PublicExamAttempt | null>;
  start(examId: string, owner: AttemptOwner, requestKey: string): Promise<PublicExamAttempt | null>;
  get(attemptId: string, owner: AttemptOwner): Promise<PublicExamAttempt | null>;
  save(
    attemptId: string,
    owner: AttemptOwner,
    input: { questionId: string; answer: ExamAnswer | null; markedForReview: boolean },
  ): Promise<PublicExamAttempt | null>;
  abandon(attemptId: string, owner: AttemptOwner): Promise<boolean>;
  submit(
    attemptId: string,
    owner: AttemptOwner,
    requestId: string,
    reason: "manual" | "auto",
  ): Promise<PublicExamAttempt | null>;
  claimGuestAttempts(guestSessionHash: string, userId: string): Promise<number>;
}
