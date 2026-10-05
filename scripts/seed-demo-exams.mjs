import { createClient } from "@supabase/supabase-js";
import { log } from "node:console";
import process from "node:process";
import { mockExams } from "../src/lib/exams/demo-data.mock.ts";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  throw new Error(
    "Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local first.",
  );
}

const supabase = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
});
const exams = mockExams.map((exam) => ({
  id: exam.id,
  title: exam.title,
  description: exam.description,
  mode: exam.mode,
  demo: true,
  timingMode: exam.timingMode,
  durationSeconds: exam.durationSeconds,
  totalScore: exam.totalScore,
  sections: exam.sections.map((section, orderIndex) => ({ ...section, orderIndex })),
  questions: exam.questions.map((question, orderIndex) => ({
    ...question,
    orderIndex,
    options:
      question.type === "multiple_choice"
        ? question.options.map((option, optionOrder) => ({ ...option, orderIndex: optionOrder }))
        : undefined,
    statements:
      question.type === "true_false"
        ? question.statements.map((statement, statementOrder) => ({
            ...statement,
            orderIndex: statementOrder,
          }))
        : undefined,
    answer:
      question.type === "multiple_choice"
        ? { optionKey: question.correctOptionKey }
        : question.type === "true_false"
          ? { statements: question.correctStatements, scoring: question.scoring }
          : {
              canonicalAnswer: question.canonicalAnswer,
              acceptedValues: question.acceptedNormalizedAnswers ?? [question.canonicalAnswer],
            },
  })),
}));

const { data, error } = await supabase.rpc("seed_demo_exams", { p_exams: exams });
if (error) throw new Error(`Demo seed failed: ${error.message}`);
log(`Seeded ${data} clearly labeled demo questions across ${exams.length} sets.`);
