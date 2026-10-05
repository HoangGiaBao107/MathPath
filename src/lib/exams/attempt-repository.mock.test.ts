import { describe, expect, it } from "vitest";
import { mockExams } from "./demo-data.mock";
import { MockAttemptRepository } from "./attempt-repository.mock";

const exam = mockExams[0];
const owner = { kind: "guest" as const, guestSessionHash: "owner-one" };

describe("mock attempt repository", () => {
  it("resumes the same active attempt and enforces owner access", () => {
    const repository = new MockAttemptRepository(() => 1_800_000_000_000);
    const started = repository.start(exam, owner, "start-request");
    expect(repository.findCurrent(owner, exam.id)?.id).toBe(started.id);
    expect(
      repository.get(started.id, { kind: "guest", guestSessionHash: "another-owner" }),
    ).toBeNull();
    const publicAttempt = repository.toPublicAttempt(started);
    expect(publicAttempt?.questions[0]).not.toHaveProperty("correctOptionKey");
  });

  it("prevents duplicate final submissions and returns the stored result", () => {
    const repository = new MockAttemptRepository(() => 1_800_000_000_000);
    const started = repository.start(exam, owner, "start-request");
    const first = repository.submit(started.id, owner, "submit-request", "manual");
    const duplicate = repository.submit(started.id, owner, "duplicate-request", "manual");
    expect(first?.status).toBe("submitted");
    expect(duplicate?.id).toBe(first?.id);
    expect(duplicate?.submitRequestId).toBe("submit-request");
    expect(duplicate?.result).toEqual(first?.result);
  });

  it("creates a fresh stable attempt only when a learner explicitly starts another run", () => {
    const repository = new MockAttemptRepository(() => 1_800_000_000_000);
    const first = repository.start(exam, owner, "first-run");
    repository.submit(first.id, owner, "first-submit", "manual");
    const second = repository.start(exam, owner, "second-run");
    expect(second.id).not.toBe(first.id);
    expect(repository.start(exam, owner, "second-run").id).toBe(second.id);
  });

  it("auto-submits against the server deadline even if the client does not call submit", () => {
    let now = 1_800_000_000_000;
    const repository = new MockAttemptRepository(() => now);
    const started = repository.start(exam, owner, "start-request");
    now += (exam.durationSeconds ?? 0) * 1000 + 100;
    const resumed = repository.get(started.id, owner);
    expect(resumed?.status).toBe("auto_submitted");
    expect(resumed?.submittedAt).not.toBeNull();
    expect(resumed?.durationSeconds).toBe(exam.durationSeconds);
  });

  it("does not add a countdown deadline to elapsed practice attempts", () => {
    const practice = mockExams[1];
    const repository = new MockAttemptRepository(() => 1_800_000_000_000);
    const started = repository.start(practice, owner, "practice-start");
    expect(started.deadlineAt).toBeNull();
    expect(started.durationSeconds).toBeNull();
  });

  it("does not let one signed-in user read another user's attempt", () => {
    const repository = new MockAttemptRepository(() => 1_800_000_000_000);
    const alice = { kind: "user" as const, userId: "alice" };
    const bob = { kind: "user" as const, userId: "bob" };
    const started = repository.start(exam, alice, "alice-start");
    expect(repository.get(started.id, alice)?.id).toBe(started.id);
    expect(repository.get(started.id, bob)).toBeNull();
  });

  it("limits a guest to ten answered questions across exam sets", () => {
    const repository = new MockAttemptRepository(() => 1_800_000_000_000);
    const first = repository.start(exam, owner, "first-set");
    for (const questionId of first.questionIdsInOrder.slice(0, 10)) {
      repository.save(first.id, owner, {
        questionId,
        answer: { type: "multiple_choice", optionKey: "A" },
        markedForReview: false,
      });
    }
    repository.submit(first.id, owner, "first-submit", "manual");
    const secondExam = {
      ...exam,
      id: "another-exam-set",
      questions: exam.questions.map((question) => ({
        ...question,
        id: `other-${question.id}`,
      })),
    };
    const second = repository.start(secondExam, owner, "second-set");
    expect(() =>
      repository.save(second.id, owner, {
        questionId: second.questionIdsInOrder[0],
        answer: { type: "multiple_choice", optionKey: "A" },
        markedForReview: false,
      }),
    ).toThrow("guest_question_limit_reached");
    expect(repository.getGuestQuestionUsage(owner)).toBe(10);
  });

  it("starts a fresh empty attempt after a user exits an active attempt", () => {
    let now = 1_800_000_000_000;
    const repository = new MockAttemptRepository(() => now);
    const first = repository.start(exam, owner, "before-exit");
    repository.save(first.id, owner, {
      questionId: first.questionIdsInOrder[0],
      answer: { type: "multiple_choice", optionKey: "A" },
      markedForReview: false,
    });
    now += 60_000;
    expect(repository.abandon(first.id, owner)).toBe(true);
    expect(repository.findCurrent(owner, exam.id)).toBeNull();
    const next = repository.start(exam, owner, "after-exit");
    expect(next.id).not.toBe(first.id);
    expect(next.startedAt).not.toBe(first.startedAt);
    expect(next.answers[first.questionIdsInOrder[0]]?.answer).toBeNull();
  });
});
