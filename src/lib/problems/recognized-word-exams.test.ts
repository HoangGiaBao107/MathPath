import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const loadJson = (relativePath: string) =>
  JSON.parse(readFileSync(path.join(root, relativePath), "utf8")) as Record<string, unknown>;

describe("recognized MathPath Word exam collection", () => {
  const existing = loadJson("src/data/mathpath-word-student-previews.json");
  const topic = loadJson("src/data/mathpath-topic-practice-exams.json");
  const existingExams = existing.exams as Array<Record<string, unknown>>;
  const topicExams = topic.exams as Array<Record<string, unknown>>;

  it("contains the eight accepted general exams and four topic practice exams", () => {
    expect(existingExams).toHaveLength(8);
    expect(topicExams).toHaveLength(4);
    expect(topicExams.map((exam) => exam.id)).toEqual([
      "practice-dao_ham-1",
      "practice-dao_ham-2",
      "practice-nguyen_ham-1",
      "practice-nguyen_ham-2",
    ]);
  });

  it("keeps each imported topic exam at 40 questions with all three question forms", () => {
    for (const exam of topicExams) {
      const questions = exam.questions as Array<Record<string, unknown>>;
      expect(questions).toHaveLength(40);
      expect(questions.filter((question) => question.type === "multiple_choice")).toHaveLength(20);
      expect(questions.filter((question) => question.type === "true_false")).toHaveLength(10);
      expect(questions.filter((question) => question.type === "short_answer")).toHaveLength(10);
      expect(exam.demo).toBe(false);
    }
  });
});
