import { readFile, readdir, writeFile } from "node:fs/promises";
import { Buffer } from "node:buffer";
import { get } from "node:http";
import { spawn } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { clearTimeout, setTimeout } from "node:timers";
import { PGlite } from "@electric-sql/pglite";

const ROOT = process.cwd();
const PRIVATE_DIR = path.join(ROOT, "tmp", "mathpath-new-bank-private");
const REPORT_FILE = path.join(PRIVATE_DIR, "stress-report.json");
const SERVER_PORT = 3213;
const SERVER_ORIGIN = `http://127.0.0.1:${SERVER_PORT}`;
const PREFLIGHT = process.argv.includes("--preflight");
const CYCLES = PREFLIGHT ? 1 : 5;

function httpGet(url) {
  return new Promise((resolve, reject) => {
    const request = get(url, (response) => {
      const chunks = [];
      response.on("data", (chunk) => chunks.push(chunk));
      response.on("end", () => resolve({
        status: response.statusCode ?? 0,
        body: Buffer.concat(chunks),
      }));
    });
    request.on("error", reject);
  });
}

const selectedMigration = (name) =>
  name.startsWith("20261003") ||
  name.startsWith("20261004") ||
  [
    "20261008000300_enable_published_exam_runtime.sql",
    "20261020000100_attempt_result_review_assets_and_duration.sql",
    "20261021000100_short_answer_input_policy.sql",
    "20261022000100_exam_runtime_figures.sql",
    "20261023000100_preserve_archived_exam_attempts.sql",
    "20261124000100_allow_image_backed_question_display.sql",
  ].includes(name);

async function loadMigrations(db) {
  await db.exec(`create role anon; create role authenticated; create role service_role; create schema auth;
    create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');
    create function auth.uid() returns uuid language sql as $$select null::uuid$$;
    create function auth.role() returns text language sql as $$select 'service_role'::text$$;
    create function auth.jwt() returns jsonb language sql as $$select '{"role":"service_role"}'::jsonb$$;`);
  const files = (await readdir(path.join(ROOT, "supabase", "migrations")))
    .filter(selectedMigration)
    .sort();
  for (const file of files) {
    let sql = await readFile(path.join(ROOT, "supabase", "migrations", file), "utf8");
    sql = sql.replace(
      "create extension if not exists pgcrypto;",
      "-- Isolated PGlite test: gen_random_uuid is built into the PostgreSQL runtime.",
    );
    try {
      await db.exec(sql);
    } catch (error) {
      throw new Error(`Migration ${file} failed: ${error.message}`);
    }
  }
  return files;
}

async function execPrivateSql(db, sql, stage) {
  try {
    await db.exec(sql);
  } catch (error) {
    const code = error?.code ?? error?.cause?.code ?? "unknown";
    const position = error?.position ?? error?.cause?.position ?? "unknown";
    const table = error?.table ?? error?.cause?.table ?? "unknown table";
    const constraint = error?.constraint ?? error?.cause?.constraint ?? "unknown constraint";
    const detail = String(error?.detail ?? error?.cause?.detail ?? "");
    const missingReference = detail.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)?.[0];
    const message = String(error?.message ?? "").replace(/\s+/g, " ");
    const safeReason = [
      /Existing advanced exam content differs: [A-Z0-9_]+/i,
      /Advanced exam slug collision: [a-z0-9-]+/i,
      /Advanced exam (?:set|question) count mismatch/i,
      /Advanced question count mismatch/i,
      /Advanced key count mismatch/i,
      /Unpublish the problem set before editing a published question answer key/i,
      /Multiple-choice answer must reference an option on the same question/i,
      /True\/false answer must cover every substatement exactly once/i,
      /Short-answer key requires one or more non-empty accepted values/i,
      /A published question must be reviewed, provenance-verified, and rights-cleared/i,
      /A published question must reference verified provenance and cleared source rights/i,
      /A published question must have a verified official answer/i,
      /Every problem image asset must be reviewed before publication/i,
      /Images attached to a published problem must be reviewed/i,
      /Unpublish a question and its set before editing published content/i,
      /Unpublish a question and its set before editing options or substatements/i,
      /A published problem set must be approved and rights-cleared/i,
      /An empty problem set cannot be published/i,
      /Every question must be reviewed, published, and source-cleared before its set/i,
      /Vietnamese display content must be reviewed before publication/i,
      /A blank question display requires an approved source image/i,
      /Every option needs reviewed text or an approved source image/i,
      /Every statement needs reviewed text or an approved source image/i,
    ].map((pattern) => message.match(pattern)?.[0]).find(Boolean);
    throw new Error(`${stage} failed (database code ${code}, table ${table}, constraint ${constraint}, reference ${missingReference ?? "unknown"}, SQL position ${position}${safeReason ? `, reason ${safeReason}` : ""})`);
  }
}

function parseExam(row) {
  const value = row?.exam;
  if (!value) return null;
  return typeof value === "string" ? JSON.parse(value) : value;
}

async function getExamDefinitions(db, plan) {
  const exams = [];
  for (const item of plan.exams) {
    const row = (await db.query("select public.get_exam_runtime($1) as exam", [item.slug])).rows[0];
    const exam = parseExam(row);
    if (!exam) throw new Error(`Published runtime missing for ${item.examId}`);
    if (exam.questions.length !== item.questionCount) throw new Error(`Question count mismatch for ${item.examId}`);
    exams.push(exam);
  }
  return exams;
}

async function verifyImportRevisions(db, plan) {
  for (const item of plan.exams) {
    const row = (await db.query(
      "select exam_metadata->>'import_sha256' as revision from public.problem_sets where slug = $1 and exam_metadata->>'curriculum_level' = 'advanced'",
      [item.slug],
    )).rows[0];
    if (!row || row.revision !== item.importSha256) {
      throw new Error(`Stored import revision mismatch: ${item.examId}`);
    }
  }
}

function validateAnswerRecords(exams) {
  let questionCount = 0;
  for (const exam of exams) {
    const pointsBySection = new Map(exam.sections.map((section) => [section.id, 0]));
    for (const question of exam.questions) {
      pointsBySection.set(question.sectionId, (pointsBySection.get(question.sectionId) ?? 0) + question.points);
      if (question.type === "multiple_choice") {
        if (!(question.options ?? []).some((option) => option.key === question.correctOptionKey)) {
          throw new Error(`Multiple-choice key mapping failed for ${question.id}`);
        }
      } else if (question.type === "true_false") {
        const keys = question.statements.map((statement) => statement.key).sort();
        const answerKeys = Object.keys(question.correctStatements ?? {}).sort();
        if (JSON.stringify(keys) !== JSON.stringify(answerKeys) ||
            Object.values(question.correctStatements).some((value) => typeof value !== "boolean")) {
          throw new Error(`True/false key mapping failed for ${question.id}`);
        }
      } else if (!question.canonicalAnswer || !(question.acceptedNormalizedAnswers ?? []).length) {
        throw new Error(`Short-answer key is incomplete for ${question.id}`);
      }
    }
    for (const section of exam.sections) {
      if (Math.abs((pointsBySection.get(section.id) ?? 0) - section.maxScore) > 0.001) {
        throw new Error(`Section score total mismatch for ${exam.id}/${section.id}`);
      }
    }
    if (Math.abs([...pointsBySection.values()].reduce((sum, points) => sum + points, 0) - exam.totalScore) > 0.001) {
      throw new Error(`Exam score total mismatch for ${exam.id}`);
    }
    questionCount += exam.questions.length;
  }
  return questionCount;
}

async function uniqueAssets(runtime) {
  const urls = new Set();
  for (const exam of runtime) {
    for (const question of exam.questions) {
      for (const figure of question.figures ?? []) urls.add(figure.url);
    }
  }
  return [...urls].sort();
}

async function startProductionServer() {
  const child = spawn(
    process.execPath,
    ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", String(SERVER_PORT)],
    {
      cwd: ROOT,
      env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1" },
      windowsHide: true,
      stdio: ["ignore", "ignore", "ignore"],
    },
  );
  const started = Date.now();
  while (Date.now() - started < 30000) {
    if (child.exitCode !== null) throw new Error("Production asset server exited before readiness");
    try {
      const response = await httpGet(`${SERVER_ORIGIN}/`);
      if (response.status === 200) return child;
    } catch {
      // Retry during Next startup.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  child.kill();
  throw new Error("Production asset server did not become ready within 30 seconds");
}

async function verifyAssets(urls, concurrency = 16) {
  let index = 0;
  const errors = [];
  const worker = async () => {
    while (true) {
      const current = index;
      index += 1;
      if (current >= urls.length) return;
      const url = urls[current];
      if (!url.startsWith("/problem-assets/mathpath-new-20261124/")) {
        errors.push("unexpected asset path");
        continue;
      }
      const filePath = path.join(ROOT, "public", ...url.slice(1).split("/"));
      try {
        const [response, expected] = await Promise.all([
          httpGet(`${SERVER_ORIGIN}${url}`),
          readFile(filePath),
        ]);
        if (response.status !== 200) {
          errors.push(`HTTP ${response.status}: ${url}`);
          continue;
        }
        const served = response.body;
        if (!served.equals(expected)) errors.push(`asset byte mismatch: ${url}`);
      } catch {
        errors.push(`asset request failed: ${url}`);
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, urls.length) }, worker));
  if (errors.length) throw new Error(errors.slice(0, 8).join("; "));
  return urls.length;
}

async function main() {
  const importSql = await readFile(path.join(PRIVATE_DIR, "import-advanced-bank.sql"), "utf8");
  const activateSql = await readFile(path.join(PRIVATE_DIR, "activate-advanced-bank.sql"), "utf8");
  const plan = JSON.parse(await readFile(path.join(PRIVATE_DIR, "release-plan.json"), "utf8"));
  const runtime = JSON.parse(await readFile(path.join(PRIVATE_DIR, "runtime-exams.json"), "utf8"));
  if (plan.examCount !== 18 || plan.questionCount !== 594) throw new Error("Release plan counts are invalid");

  const db = new PGlite();
  let server;
  const report = { mode: PREFLIGHT ? "preflight" : "five_cycle_stress", cycleCount: CYCLES, cycles: [], productionTouched: false };
  try {
    report.migrations = await loadMigrations(db);
    await execPrivateSql(db, importSql, "Initial advanced-bank import");
    await execPrivateSql(db, activateSql, "Initial advanced-bank activation");
    await verifyImportRevisions(db, plan);
    const urls = await uniqueAssets(runtime);
    if (urls.length !== plan.uniquePublicAssetFileCount) throw new Error("Unique public asset file count mismatch");
    server = await startProductionServer();

    for (let cycle = 1; cycle <= CYCLES; cycle += 1) {
      const started = Date.now();
      // Re-run the guarded SQL to test idempotence and publication consistency.
      await execPrivateSql(db, importSql, `Cycle ${cycle} repeat import`);
      await execPrivateSql(db, activateSql, `Cycle ${cycle} repeat activation`);
      await verifyImportRevisions(db, plan);
      const exams = await getExamDefinitions(db, plan);
      const questionCount = validateAnswerRecords(exams);
      if (questionCount !== plan.questionCount) throw new Error("Runtime question total mismatch");

      await db.exec("set role anon;");
      let privateDenied = false;
      try {
        await db.query("select * from private.problem_answer_keys limit 1");
      } catch {
        privateDenied = true;
      }
      await db.exec("reset role;");
      if (!privateDenied) throw new Error("Anonymous role can read private answer keys");

      const assetCount = await verifyAssets(urls);
      report.cycles.push({
        cycle,
        examCount: exams.length,
        questionCount,
        assetFilesServedAndByteCompared: assetCount,
        answerRecordsAndScoringTotalsValid: true,
        anonymousAnswerKeyAccessDenied: true,
        idempotentImport: true,
        durationMs: Date.now() - started,
        passed: true,
      });
    }
  } finally {
    if (server && server.exitCode === null) {
      server.kill();
      await new Promise((resolve) => {
        const timeout = setTimeout(resolve, 3000);
        server.once("exit", () => {
          clearTimeout(timeout);
          resolve();
        });
      });
    }
    await db.close();
  }

  report.passed = report.cycles.length === CYCLES && report.cycles.every((cycle) => cycle.passed);
  await writeFile(REPORT_FILE, JSON.stringify(report, null, 2), "utf8");
  process.stdout.write(JSON.stringify({
    passed: report.passed,
    mode: report.mode,
    cycles: report.cycles.length,
    examCount: 18,
    questionCount: 594,
    uniquePublicAssets: report.cycles[0]?.assetFilesServedAndByteCompared ?? 0,
    productionTouched: false,
  }, null, 2) + "\n");
  if (!report.passed) process.exitCode = 1;
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : "Stress test failed"}\n`);
  process.exitCode = 1;
});
