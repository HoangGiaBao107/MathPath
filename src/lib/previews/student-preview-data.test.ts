import { describe, expect, it } from "vitest";
import wordData from "@/data/mathpath-word-student-previews.json";
import figureManifest from "../../../content/word-import/figure-generation-manifest.json";
import { extractDelimitedMath, renderValidatedMathToHtml } from "@/lib/problems/math-content";
import { getSourcePreview, listSourcePreviews } from "./data";

describe("Word-import student preview data", () => {
  it("publishes exactly the eight available exams using generic MathPath titles", () => {
    const exams = listSourcePreviews();
    expect(exams.map((exam) => exam.slug)).toEqual(
      Array.from({ length: 8 }, (_, index) => `exam-${index + 1}`),
    );
    expect(exams.map((exam) => exam.title)).toEqual(
      Array.from({ length: 8 }, (_, index) => `Đề thi thử số ${index + 1}`),
    );
    expect(exams.every((exam) => exam.sourceFile === "Đề thi.docx")).toBe(true);
    expect(JSON.stringify(exams)).not.toMatch(/THPT|Chuyên|school name/i);
  });

  it("preserves the declared 12/4/6 question structure in all eight exams", () => {
    for (const exam of listSourcePreviews()) {
      expect(exam.visibleQuestionCount).toBe(22);
      expect(
        exam.questions.filter((question) => question.questionType === "multiple_choice"),
      ).toHaveLength(12);
      expect(
        exam.questions.filter((question) => question.questionType === "true_false"),
      ).toHaveLength(4);
      expect(
        exam.questions.filter((question) => question.questionType === "short_answer"),
      ).toHaveLength(6);
      expect(
        exam.questions.filter(
          (question) =>
            question.questionType === "multiple_choice" && question.options.length !== 4,
        ),
      ).toHaveLength(0);
      expect(
        exam.questions.filter(
          (question) =>
            question.questionType === "true_false" && question.substatements.length !== 4,
        ),
      ).toHaveLength(0);
    }
  });

  it("keeps answer keys and explanations out of the student bundle", () => {
    const serialized = JSON.stringify({ data: wordData, exams: listSourcePreviews() });
    expect(serialized).not.toMatch(/correct_answer|answer_key|explanation|"answer"\s*:/i);
    expect(serialized).toContain("Đề thi.docx");
    expect(serialized).toContain("word_structure_preserved");
    expect(serialized).toContain('"answersIncluded":false');
  });

  it("renders every delimited Word/LaTeX formula through KaTeX without replacement glyphs", () => {
    const formulas = listSourcePreviews()
      .flatMap((exam) =>
        exam.questions.flatMap((question) => [
          question.statement,
          ...question.options.map((option) => option.text),
          ...question.substatements.map((item) => item.text),
        ]),
      )
      .flatMap(extractDelimitedMath);
    expect(formulas.length).toBeGreaterThan(150);
    for (const formula of formulas)
      expect(renderValidatedMathToHtml(formula), formula).not.toBeNull();
    const studentText = JSON.stringify(listSourcePreviews());
    expect(studentText).not.toMatch(/[\uE000-\uF8FF\u25A1\u25A0]/u);
  });

  it("records the two requested option corrections and the owner-supplied choices", () => {
    const exam = getSourcePreview("exam-1");
    expect(exam).not.toBeNull();
    const q3 = exam!.questions.find(
      (question) => question.section === "part_1" && question.questionNumber === "3",
    )!;
    const q6 = exam!.questions.find(
      (question) => question.section === "part_1" && question.questionNumber === "6",
    )!;
    const q8 = exam!.questions.find(
      (question) => question.section === "part_1" && question.questionNumber === "8",
    )!;
    expect(q3.options.find((option) => option.key === "D")?.text).toContain("I(-4;0;3)");
    expect(q6.options.find((option) => option.key === "A")?.text).toContain("z=-1+t");
    expect(q8.options.map(({ key, text }) => [key, text])).toEqual([
      ["A", "$0 < c < 1 < q$"],
      ["B", "$0 < q < 1 < c$"],
      ["C", "$0 < q < c < 1$"],
      ["D", "$0 < c < q < 1$"],
    ]);
    expect(q8.source.warnings).toEqual([]);
  });

  it("keeps all 21 figure-generation prompts explicitly pending", () => {
    expect(wordData.figurePromptCount).toBe(21);
    expect(wordData.figuresGenerated).toBe(false);
    expect(wordData.generatedFigureCount).toBe(0);
    expect(figureManifest.figures).toHaveLength(21);
    expect(figureManifest.figures.every((figure) => figure.status === "pending_generation")).toBe(
      true,
    );
    expect(
      figureManifest.figures.every((figure) =>
        figure.promptForImageGeneration.includes("white background"),
      ),
    ).toBe(true);
    expect(
      figureManifest.figures.some(
        (figure) =>
          figure.visualStyle === "red_graph_black_points_white_background" &&
          figure.promptForImageGeneration.includes("every plotted point black"),
      ),
    ).toBe(true);
    expect(
      listSourcePreviews()
        .flatMap((exam) => exam.questions)
        .filter((question) => question.source.figureStatus === "ai_prompt_pending"),
    ).toHaveLength(21);
  });
});
