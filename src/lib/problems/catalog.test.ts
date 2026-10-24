import { describe, expect, it } from "vitest";
import { filterAndSortProblemSets, paginateProblemSets } from "./catalog";
import { demoProblemSets } from "./demo-data.mock";

describe("problem bank catalogue", () => {
  it("shows all 19 exams across two pages without duplicates and searches the second page", () => {
    const sets = Array.from({ length: 19 }, (_, index) => ({ ...demoProblemSets[0], id: `exam-${index}`, title: `Exam ${index}`, slug: `exam-${index}` }));
    const first = paginateProblemSets(sets, { limit: 12 });
    const second = paginateProblemSets(sets, { limit: 12, cursor: first.nextCursor });
    expect(first.totalCount).toBe(19);
    expect(first.items).toHaveLength(12);
    expect(second.items).toHaveLength(7);
    expect(second.nextCursor).toBeNull();
    expect(new Set([...first.items, ...second.items].map(item => item.id)).size).toBe(19);
    expect(paginateProblemSets(filterAndSortProblemSets(sets, { query: "Exam 18" })).items.map(item => item.id)).toEqual(["exam-18"]);
  });
  it("searches Vietnamese topic names without requiring tone marks", () => {
    const result = filterAndSortProblemSets(demoProblemSets, { query: "ham so" });
    expect(result.length).toBe(3);
    expect(result.every((item) => item.topicNames.includes("Hàm số"))).toBe(true);
  });

  it("supports case- and tone-insensitive search for Vietnamese titles", () => {
    expect(filterAndSortProblemSets(demoProblemSets, { query: "DE THI THU" })).toHaveLength(1);
  });

  it("combines category and difficulty filters", () => {
    const result = filterAndSortProblemSets(demoProblemSets, {
      category: "topic_review",
      difficulty: "hard",
    });
    expect(result.map((item) => item.slug)).toEqual(["ung-dung-dao-ham-minh-hoa"]);
  });

  it("sorts and paginates catalogue previews", () => {
    const sorted = filterAndSortProblemSets(demoProblemSets, { sort: "question_count" });
    const first = paginateProblemSets(sorted, { limit: 2 });
    const second = paginateProblemSets(sorted, { limit: 2, cursor: first.nextCursor });

    expect(first.items.map((item) => item.questionCount)).toEqual([30, 22]);
    expect(first.nextCursor).toBe("2");
    expect(second.items).toHaveLength(2);
    expect([...first.items, ...second.items]).toHaveLength(4);
  });

  it("bounds page size and handles a malformed cursor safely", () => {
    expect(paginateProblemSets(demoProblemSets, { limit: 1000 }).items).toHaveLength(6);
    expect(
      paginateProblemSets(demoProblemSets, { limit: 2, cursor: "invalid" }).items,
    ).toHaveLength(2);
  });

  it("distinguishes timed exam limits from estimated practice duration", () => {
    const exam = demoProblemSets.find((item) => item.category === "mock_exam");
    const practice = demoProblemSets.find((item) => item.category === "topic_review");
    expect(exam).toMatchObject({
      timingMode: "countdown",
      timeLimitMinutes: 90,
      estimatedDurationMinutes: null,
    });
    expect(practice).toMatchObject({
      timingMode: "elapsed",
      timeLimitMinutes: null,
      estimatedDurationMinutes: 35,
    });
  });
});
