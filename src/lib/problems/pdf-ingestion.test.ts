import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { validateProblemSetImport } from "./import-schema";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const pdfPath = path.join(root, "content/fixtures/demo-ingestion-fixture.pdf");
const scriptPath = path.join(root, "scripts/pdf_ingestion.py");
const outputDir = mkdtempSync(path.join(tmpdir(), "mathpath-pdf-ingestion-"));
const fixtureOutput = path.join(outputDir, "demo-ingestion-fixture");

type FixtureQuestion = {
  id: string;
  section: string;
  question_number: string;
  order_index: number;
  source_pages: number[];
  source_page_images?: string[];
  statement: string;
  options: Array<{ key: string; text: string; order_index: number }>;
  substatements: Array<{ key: string }>;
  image_path: string;
  illustration_status: string;
  local_review_status: string;
  correct_answer:
    | { type: "short_answer"; accepted_values: string[] }
    | { type: "multiple_choice"; option_key: string }
    | { type: "true_false"; statements: Record<string, boolean> }
    | null;
  review_status: string;
  publication_status: string;
  answer_provenance?: string;
};

type FixtureImport = {
  format_version: number;
  problem_set: {
    id: string;
    description: string;
    provenance_status: string;
    review_status: string;
    publication_status: string;
  };
  questions: FixtureQuestion[];
};

type ExtractionReport = {
  fixture_label: string;
  page_count: number;
  detected_sections: Array<{ section: string; question_count: number }>;
  answer_key_count: number;
  question_images_generated: number;
  illustrations_present: number;
  illustrations_missing: number;
  illustrations_possibly_missing: number;
  multi_page_questions: number;
  needs_review: string[];
  questions_requiring_review: string[];
};

function python(args: string[]) {
  const candidates = process.env.MATHPATH_PYTHON
    ? [process.env.MATHPATH_PYTHON]
    : process.platform === "win32"
      ? ["python", "py"]
      : ["python3", "python"];
  for (const candidate of candidates) {
    const result = spawnSync(candidate, args, { cwd: root, encoding: "utf8" });
    if (!result.error || (result.error as NodeJS.ErrnoException).code !== "ENOENT") return result;
  }
  throw new Error(
    "Python was not found; install requirements-pdf.txt and set MATHPATH_PYTHON if needed.",
  );
}

function readOutput(): FixtureImport {
  return JSON.parse(
    readFileSync(path.join(fixtureOutput, "questions.json"), "utf8"),
  ) as FixtureImport;
}

function hash(filePath: string) {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

let report: ExtractionReport;

beforeAll(() => {
  const result = python([scriptPath, pdfPath, fixtureOutput]);
  expect(result.status, result.stderr).toBe(0);
  report = JSON.parse(readFileSync(path.join(fixtureOutput, "extraction-report.json"), "utf8"));
});

afterAll(() => rmSync(outputDir, { recursive: true, force: true }));

describe("synthetic PDF ingestion pipeline", () => {
  it("parses a PDF fixture marked as non-official", () => {
    expect(report.fixture_label).toBe("DEMO INGESTION FIXTURE — NOT OFFICIAL");
    expect(readOutput().problem_set.description).toBe("DEMO INGESTION FIXTURE — NOT OFFICIAL");
  });

  it("counts all source pages", () => expect(report.page_count).toBe(4));

  it("detects Part I with three questions", () => {
    expect(report.detected_sections).toContainEqual({ section: "part_1", question_count: 3 });
  });

  it("detects Part II with two questions", () => {
    expect(report.detected_sections).toContainEqual({ section: "part_2", question_count: 2 });
  });

  it("detects Part III with two questions", () => {
    expect(report.detected_sections).toContainEqual({ section: "part_3", question_count: 2 });
  });

  it("preserves section numbering and global order", () => {
    const questions = readOutput().questions;
    expect(questions.map((question) => [question.section, question.question_number])).toEqual([
      ["part_1", "1"],
      ["part_1", "2"],
      ["part_1", "3"],
      ["part_2", "1"],
      ["part_2", "2"],
      ["part_3", "1"],
      ["part_3", "2"],
    ]);
    expect(questions.map((question) => question.order_index)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it("extracts all four multiple-choice options in source order", () => {
    const questions = readOutput().questions.filter((question) => question.section === "part_1");
    expect(
      questions.map((question) => question.options.map((option: { key: string }) => option.key)),
    ).toEqual([
      ["A", "B", "C", "D"],
      ["A", "B", "C", "D"],
      ["A", "B", "C", "D"],
    ]);
    expect(questions[0].statement).not.toContain("Câu 2");
  });

  it("keeps each Part II a/b/c/d set grouped as one question", () => {
    const questions = readOutput().questions.filter((question) => question.section === "part_2");
    expect(questions).toHaveLength(2);
    expect(
      questions.map((question) => question.substatements.map((item: { key: string }) => item.key)),
    ).toEqual([
      ["a", "b", "c", "d"],
      ["a", "b", "c", "d"],
    ]);
  });

  it("extracts the known answer key without inventing values", () => {
    const answerKey = JSON.parse(readFileSync(path.join(fixtureOutput, "answer-key.json"), "utf8"));
    expect(answerKey).toEqual({
      part_1: { "1": "A", "2": "C", "3": "D" },
      part_2: {
        "1": { a: true, b: true, c: false, d: true },
        "2": { a: false, b: true, c: false, d: true },
      },
      part_3: { "1": "15", "2": "-0,5" },
    });
    expect(report.answer_key_count).toBe(7);
  });

  it("preserves Vietnamese wording, mathematical notation, and punctuation", () => {
    const question = readOutput().questions[0];
    expect(question.statement).toContain("hàm số f(x) = x² − 4x + 3.");
    expect(question.statement).toContain("Giá trị nhỏ nhất");
  });

  it("extracts numeric short answers including comma and minus sign", () => {
    const questions = readOutput().questions.filter(
      (question) =>
        question.section === "part_3" && question.correct_answer?.type === "short_answer",
    );
    expect(
      questions.map((question) =>
        question.correct_answer?.type === "short_answer"
          ? question.correct_answer.accepted_values[0]
          : null,
      ),
    ).toEqual(["15", "-0,5"]);
  });

  it("recognizes the two-page question as one ordered record", () => {
    const question = readOutput().questions[2];
    expect(question.source_pages).toEqual([1, 2]);
    expect(question.order_index).toBe(3);
    expect(question.statement).toContain("Tiếp câu 3");
    expect(question.statement).not.toMatch(/\n[xyO]\n/);
    expect(report.multi_page_questions).toBe(1);
  });

  it("generates one high-resolution PNG per question", () => {
    const questions = readOutput().questions;
    expect(report.question_images_generated).toBe(7);
    for (const question of questions) {
      const image = path.join(fixtureOutput, question.image_path);
      expect(statSync(image).size).toBeGreaterThan(8_000);
      expect(question.image_path).toMatch(/^questions\/q\d{2}\.png$/);
    }
  });

  it("detects the embedded coordinate illustration from PDF layout", () => {
    const question = readOutput().questions[2];
    expect(question.illustration_status).toBe("present");
    expect(statSync(path.join(fixtureOutput, "illustrations", "q03.png")).size).toBeGreaterThan(
      8_000,
    );
    expect(report.illustrations_present).toBe(1);
  });

  it("flags the referenced but absent figure for review", () => {
    const question = readOutput().questions[4];
    expect(question.statement).toContain("đồ thị như hình dưới đây");
    expect(question.illustration_status).toBe("possibly_missing");
    expect(report.illustrations_possibly_missing).toBe(1);
    expect(report.needs_review).toContain(question.id);
  });

  it("produces records accepted by the Phase 3 import validator", () => {
    const parsed = validateProblemSetImport(readOutput());
    expect(parsed.success, parsed.success ? undefined : JSON.stringify(parsed.error.issues)).toBe(
      true,
    );
    expect(
      readOutput().questions.every((question) => question.publication_status === "draft"),
    ).toBe(true);
  });

  it("leaves every extracted record in review and draft", () => {
    const output = readOutput();
    expect(output.problem_set.provenance_status).toBe("source_imported");
    expect(output.problem_set.publication_status).toBe("unpublished");
    expect(output.questions.every((question) => question.review_status === "needs_review")).toBe(
      true,
    );
    expect(output.questions.every((question) => question.publication_status === "draft")).toBe(
      true,
    );
    expect(report.questions_requiring_review).toHaveLength(7);
  });

  it("overwrites stable IDs/assets on rerun and preserves local review for the same source", () => {
    const before = readOutput();
    const questionHashes = before.questions.map((question) =>
      hash(path.join(fixtureOutput, question.image_path)),
    );
    before.questions[0].local_review_status = "approved";
    writeFileSync(
      path.join(fixtureOutput, "questions.json"),
      `${JSON.stringify(before, null, 2)}\n`,
    );
    const result = python([scriptPath, pdfPath, fixtureOutput]);
    expect(result.status, result.stderr).toBe(0);
    const after = readOutput();
    expect(after.questions).toHaveLength(7);
    expect(after.questions[0].local_review_status).toBe("approved");
    expect(after.questions.map((question) => question.id)).toEqual(
      before.questions.map((question) => question.id),
    );
    expect(
      after.questions.map((question) => hash(path.join(fixtureOutput, question.image_path))),
    ).toEqual(questionHashes);
  });

  it("rejects invalid PDF bytes without writing a successful extraction", () => {
    const invalid = path.join(outputDir, "invalid.pdf");
    const invalidOutput = path.join(outputDir, "invalid-output");
    writeFileSync(invalid, "not a pdf");
    const result = python([scriptPath, invalid, invalidOutput]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("valid PDF header");
    expect(existsSync(path.join(invalidOutput, "questions.json"))).toBe(false);
  });

  it("blocks the real-source PDF directory before invoking a parser", () => {
    const result = spawnSync(
      process.execPath,
      [path.join(root, "scripts/ingest-pdf.mjs"), "content/source-pdfs/not-imported.pdf"],
      { cwd: root, encoding: "utf8" },
    );
    expect(result.status).toBe(2);
    expect(result.stderr).toContain("fixture-only");
  });
});
