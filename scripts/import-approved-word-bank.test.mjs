import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { URL } from "node:url";
import {
  buildApprovedImportBundle,
  buildImportSql,
  buildPublishSql,
  stableUuid,
} from "./import-approved-word-bank.mjs";

describe("approved Word question-bank import", () => {
  const bundle = buildApprovedImportBundle();

  it("loads only the owner-approved 8 exams and 4 topic sets", () => {
    expect(bundle.summary).toMatchObject({
      setCount: 12,
      generalExamCount: 8,
      topicSetCount: 4,
      questionCount: 336,
      answerKeyCount: 336,
      answerKeysPending: 0,
      generalQuestionsLabeled: 176,
      skipped: 0,
    });
    expect(bundle.sets.map((set) => set.slug)).toEqual([
      "exam-1",
      "exam-2",
      "exam-3",
      "exam-4",
      "exam-5",
      "exam-6",
      "exam-7",
      "exam-8",
      "practice-dao_ham-1",
      "practice-dao_ham-2",
      "practice-nguyen_ham-1",
      "practice-nguyen_ham-2",
    ]);
    expect(bundle.sets.some((set) => /^d(?:[1-9]|10)(?:-|$)/.test(set.slug))).toBe(false);
  });

  it("preserves source order, question wording, and existing topic UUIDs", () => {
    const source = JSON.parse(awaitRead("src/data/mathpath-topic-practice-exams.json"));
    for (const original of source.exams) {
      const topic = bundle.sets.find((set) => set.slug === original.slug);
      expect(topic.questions.map((question) => question.id)).toEqual(
        original.questions.map((question) => question.id),
      );
      expect(topic.questions.map((question) => question.stem)).toEqual(
        original.questions.map((question) => question.stem),
      );
      expect(topic.questions.map((question) => question.orderIndex)).toEqual(
        original.questions.map((_, index) => index + 1),
      );
      expect(
        topic.questions.map((question) => question.options.map(({ key, text }) => ({ key, text }))),
      ).toEqual(
        original.questions.map((question) =>
          (question.options ?? []).map(({ key, text }) => ({ key, text })),
        ),
      );
      expect(
        topic.questions.map((question) =>
          question.statements.map(({ key, text }) => ({ key, text })),
        ),
      ).toEqual(
        original.questions.map((question) =>
          (question.statements ?? []).map(({ key, text }) => ({ key, text })),
        ),
      );
    }
  });

  it("preserves every topic set's 40-question, 0.25-point, 10-point scoring", () => {
    for (const topic of bundle.sets.filter((set) => set.sourceKind === "topic")) {
      expect(topic.scoringConfig.totalScore).toBe(10);
      expect(topic.scoringConfig.questionScoring).toHaveLength(40);
      expect(topic.scoringConfig.questionScoring.every((item) => item.points === 0.25)).toBe(true);
    }
  });

  it("uses stable IDs and idempotent upserts", () => {
    expect(stableUuid("question:exam-1:word-exam-1-q1-1")).toBe(
      stableUuid("question:exam-1:word-exam-1-q1-1"),
    );
    const sql = buildImportSql(bundle);
    expect(sql.match(/on conflict \(slug\) do update/g)).toHaveLength(2);
    expect(sql).toContain("on conflict (problem_id, option_key) do nothing");
    expect(sql).toContain("on conflict (problem_id) do update");
    expect(sql).toContain("on conflict (source_fingerprint) do update");
  });

  it("keeps answer records private and promotes answer keys found in the Word explanations", () => {
    const sql = buildImportSql(bundle);
    expect(sql).toContain("insert into private.problem_answer_keys");
    expect(sql).not.toContain("insert into public.problem_answer_keys");
    const incomplete = bundle.sets
      .flatMap((set) => set.questions)
      .filter((question) => question.correctAnswer.verification_status === "uncertain");
    expect(incomplete).toHaveLength(0);
    const getQuestion = (slug, number) =>
      bundle.sets.find((set) => set.slug === slug).questions.find((question) => question.questionNumber === number && question.type === "true_false");
    expect(getQuestion("exam-6", "2").correctAnswer.statements.b).toBe(false);
    expect(getQuestion("exam-8", "2").correctAnswer.statements).toEqual({
      a: true,
      b: true,
      c: true,
      d: true,
    });
    expect(getQuestion("exam-8", "4").correctAnswer.statements.c).toBe(false);
    const question8 = bundle.sets.find((set) => set.slug === "exam-1").questions.find(
      (question) => question.sourceQuestionId === "word-exam-1-q8-1",
    );
    expect(question8.options.map(({ key, text }) => [key, text])).toEqual([
      ["A", "$0 < c < 1 < q$"],
      ["B", "$0 < q < 1 < c$"],
      ["C", "$0 < q < c < 1$"],
      ["D", "$0 < c < q < 1$"],
    ]);
    expect(question8.correctAnswer.option_key).toBe("B");
    expect(question8.explanation).toBe(
      "Hàm $y=c^x$ đồng biến nên $c > 1$. Hàm $y=q^x$ nghịch biến nên $0 < q < 1$. Suy ra $0 < q < 1 < c$.",
    );
    expect(buildImportSql(bundle)).toContain("source_document_id = excluded.source_document_id");
  });

  it("labels all general-exam questions and keeps the 10-point THPTQG score model", () => {
    const general = bundle.sets.filter((set) => set.sourceKind === "general");
    const questions = general.flatMap((set) => set.questions);
    expect(questions).toHaveLength(176);
    expect(questions.every((question) => question.topic && question.subtopic)).toBe(true);
    expect(questions.every((question) => question.topicId === null)).toBe(true);
    for (const set of general) {
      expect(set.scoringConfig.totalScore).toBe(10);
      expect(set.scoringConfig.sections.map((section) => section.maxScore)).toEqual([3, 4, 3]);
      expect(set.scoringConfig.questionScoring).toHaveLength(22);
    }
    expect(buildImportSql(bundle)).toContain("subtopic = excluded.subtopic");
  });

  it("builds ordered publication updates after approval and preserves pending figure prompts", () => {
    expect(bundle.sets.every((set) => set.publicationStatus === "unpublished")).toBe(true);
    const sql = buildImportSql(bundle);
    expect(sql).toContain("'unpublished'");
    const publishSql = buildPublishSql(bundle);
    expect(publishSql.indexOf("update public.problems")).toBeLessThan(
      publishSql.indexOf("update public.problem_sets"),
    );
    expect(bundle.figureManifest.figures).toHaveLength(21);
    expect(
      bundle.sets.flatMap((set) => set.questions).some((question) => question.generatedFigure),
    ).toBe(false);
  });
});

function awaitRead(relativePath) {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");
}
