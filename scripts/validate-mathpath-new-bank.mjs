import { readFile } from "node:fs/promises";
import process from "node:process";
import katex from "katex";
import { canParseExactExpression } from "../src/lib/exams/exact-expression.ts";

const runtime = JSON.parse(
  await readFile("tmp/mathpath-new-bank-private/runtime-exams.json", "utf8"),
);
const vercelIgnoreRules = (await readFile(".vercelignore", "utf8")).split(/\r?\n/);
const errors = [];
let checkedExpressions = 0;
let checkedMathFragments = 0;
const mathPattern = /\$\$([\s\S]+?)\$\$|\$([^$]+)\$|\\\[([\s\S]+?)\\\]|\\\(([\s\S]+?)\\\)/g;

if (
  !vercelIgnoreRules.includes("*.pdf") ||
  !vercelIgnoreRules.includes("!public/problem-assets/mathpath-new-20261124/exams/*.pdf")
) {
  errors.push("advanced_exam_source_pdfs_must_be_deployed");
}

for (const exam of runtime) {
  for (const question of exam.questions) {
    const displayFields = [
      question.stem,
      question.solution,
      ...(question.options ?? []).map((option) => option.text),
      ...(question.statements ?? []).map((statement) => statement.text),
    ].filter((value) => typeof value === "string");
    for (const value of displayFields) {
      for (const match of value.matchAll(mathPattern)) {
        const fragment = match.slice(1).find((part) => part !== undefined);
        if (!fragment) continue;
        checkedMathFragments += 1;
        try {
          katex.renderToString(fragment, { throwOnError: true, strict: "error", trust: false });
        } catch {
          errors.push(question.source_id);
        }
      }
    }

    if (question.type === "short_answer" && question.inputPolicy?.kind === "expression") {
      checkedExpressions += 1;
      for (const answer of question.acceptedNormalizedAnswers ?? [question.canonicalAnswer]) {
        if (!canParseExactExpression(answer)) errors.push(question.source_id);
      }
    }
  }
}

const report = {
  expression_answers_checked: checkedExpressions,
  katex_math_fragments_checked: checkedMathFragments,
  errors: [...new Set(errors)],
  passed: errors.length === 0,
};
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
if (errors.length) process.exitCode = 2;
