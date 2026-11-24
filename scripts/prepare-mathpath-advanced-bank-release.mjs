import { createHash } from "node:crypto";
import { Buffer } from "node:buffer";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";

const ROOT = process.cwd();
const DATASET = "mathpath-new-20261124";
const PRIVATE_DIR = path.join(ROOT, "tmp", "mathpath-new-bank-private");
const RUNTIME_FILE = path.join(PRIVATE_DIR, "runtime-exams.json");
const PATCH_FILE = path.join(os.homedir(), "Downloads", "MathPath_18_de_MASTER_PATCH_for_Codex.json");
const SOURCE_ROOT = path.join(ROOT, "MATHPATH_NEW", "input", "source_package", "source_pdfs");
const GENERATED_DOC_ID = uuid(`source:${DATASET}:owner-patch`);

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function uuid(value) {
  const bytes = Buffer.from(sha256(value).slice(0, 32), "hex");
  bytes[12] = (bytes[12] & 0x0f) | 0x40;
  bytes[16] = (bytes[16] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function quote(value) {
  if (value === null || value === undefined) return "null";
  return `'${String(value).replaceAll("'", "''")}'`;
}

function json(value) {
  return `${quote(JSON.stringify(value))}::jsonb`;
}

function insert(table, values, onConflict = "do nothing") {
  const columns = Object.keys(values);
  return `insert into ${table} (${columns.join(", ")}) values (${columns
    .map((column) => values[column])
    .join(", ")}) on conflict ${onConflict};`;
}

function insertIfAbsent(table, values, condition) {
  const columns = Object.keys(values);
  return `insert into ${table} (${columns.join(", ")}) select ${columns
    .map((column) => values[column])
    .join(", ")} where not exists (select 1 from ${table} existing where ${condition}) on conflict do nothing;`;
}

function recordId(examId, sourceId) {
  return uuid(`question:${DATASET}:${examId}:${sourceId}`);
}

function examSlug(examId) {
  return `advanced-${examId.toLowerCase().replaceAll("_", "-")}-20261124`;
}

async function fileHash(filePath) {
  return sha256(await readFile(filePath));
}

function answerPayload(question) {
  if (question.type === "multiple_choice") {
    return { option_key: question.correctOptionKey };
  }
  if (question.type === "true_false") {
    return {
      statements: question.correctStatements,
      scoring: question.scoring ?? { kind: "all_or_nothing" },
    };
  }
  return {
    canonical_answer: question.canonicalAnswer,
    accepted_values: question.acceptedNormalizedAnswers,
    input_policy: question.inputPolicy,
  };
}

function isOwnerAuthored(question) {
  return question.answer_provenance === "author_verified_solution" ||
    question.answer_provenance === "source_key_and_independent_derivation" ||
    question.source_id.startsWith("SUP_");
}

function answerProvenance(question, practiceKeyById, mockKeyById) {
  if (question.answer_provenance === "author_verified_solution") {
    return "Owner-authored correction or supplement; answer independently solved and exact-expression checked.";
  }
  if (question.answer_provenance === "source_key_and_independent_derivation") {
    return "Owner-authorized source restoration; key independently derived from the source statement.";
  }
  const practiceKey = practiceKeyById.get(question.source_id);
  if (practiceKey) {
    const reference = practiceKey.key_reference ?? {};
    return `Transcribed and matched to the owner-supplied source answer cell: ${reference.file ?? "source answer PDF"}, page ${reference.page_reference ?? "?"}; comparison confirms transcription, not independent mathematical re-derivation.`;
  }
  const mockKey = mockKeyById.get(question.source_id);
  if (mockKey) {
    return "Matched to the owner-supplied official mock answer record; transcription/source-record match does not assert independent mathematical re-derivation.";
  }
  return "Owner-supplied answer provenance is recorded in the private master patch.";
}

function addSourceDocument(sql, document) {
  sql.push(
    insert("public.problem_source_documents", {
      id: quote(document.id),
      document_name: quote(document.name),
      source_type: quote(document.type),
      provenance_status: quote("verified"),
      publication_rights_status: quote("approved_for_publication"),
      provenance_note: quote(document.note),
      source_fingerprint: quote(document.fingerprint),
    }),
  );
}

async function main() {
  const [runtime, patch, patchBytes] = await Promise.all([
    readFile(RUNTIME_FILE, "utf8").then(JSON.parse),
    readFile(PATCH_FILE, "utf8").then(JSON.parse),
    readFile(PATCH_FILE),
  ]);
  if (runtime.length !== 18 || patch.exam_manifest.length !== 18) {
    throw new Error("Expected exactly 18 owner-approved advanced exams");
  }

  const patchHash = sha256(patchBytes);
  const practiceKeyById = new Map(
    patch.practice_source_keys.map((row) => [row.question_uid, row]),
  );
  const mockKeyById = new Map(
    patch.answer_records_mock.map((row) => [row.question_uid, row]),
  );
  const manifestById = new Map(patch.exam_manifest.map((row) => [row.exam_id, row]));
  const layout = JSON.parse(await readFile(path.join(ROOT, "MATHPATH_NEW", "data", "questions_source_layout.json"), "utf8"));
  const layoutById = new Map(layout.questions.map((question) => [question.uid, question]));
  const allQuestions = runtime.flatMap((exam) => exam.questions);
  if (allQuestions.length !== 594) throw new Error("Expected exactly 594 questions");

  const sql = ["begin;", "set local lock_timeout = '10s';"];
  const expectedSetIds = [];
  const expectedProblemIds = [];
  const sourceDocuments = new Map();
  const setRevisions = new Map();
  const questionIdsByExam = new Map();

  for (const manifest of patch.exam_manifest) {
    const exam = runtime.find((row) => row.id === manifest.exam_id);
    if (!exam || exam.questions.length !== manifest.expected_question_count) {
      throw new Error(`Runtime exam mismatch: ${manifest.exam_id}`);
    }
    for (const question of exam.questions) {
      if (isOwnerAuthored(question)) continue;
      const layoutQuestion = layoutById.get(question.source_id);
      if (!layoutQuestion?.source_pdf) throw new Error(`Missing source document for ${question.source_id}`);
      const sourceFile = layoutQuestion.source_pdf;
      const sourceId = uuid(`source:${DATASET}:source-pdf:${sourceFile}`);
      if (!sourceDocuments.has(sourceId)) {
        const sourcePath = path.join(SOURCE_ROOT, sourceFile);
        sourceDocuments.set(sourceId, {
          id: sourceId,
          name: `MATHPATH_NEW source PDF: ${sourceFile}`,
          type: sourceFile.startsWith("ĐỀ SỐ") ? "official_exam" : "practice_book",
          fingerprint: await fileHash(sourcePath),
          note: `Owner-supplied source PDF ${sourceFile}. Public question pages preserve its selectable text/vector math; source file is not included in the public repository.`,
        });
      }
    }
    const setId = uuid(`set:${DATASET}:${manifest.exam_id}`);
    const slug = examSlug(manifest.exam_id);
    const qIds = exam.questions.map((question) => recordId(exam.id, question.source_id));
    questionIdsByExam.set(exam.id, qIds);
    expectedSetIds.push(setId);
    expectedProblemIds.push(...qIds);

    const revision = sha256(JSON.stringify({
      exam: { ...exam, questions: undefined },
      questions: exam.questions,
    }));
    setRevisions.set(manifest.exam_id, revision);
    sql.push(`do $$ begin
      if exists (select 1 from public.problem_sets where slug = ${quote(slug)} and id <> ${quote(setId)}::uuid) then
        raise exception 'Advanced exam slug collision: ${slug}';
      end if;
      if exists (select 1 from public.problem_sets where id = ${quote(setId)}::uuid
        and exam_metadata->>'import_sha256' is distinct from ${quote(revision)}) then
        raise exception 'Existing advanced exam content differs: ${manifest.exam_id}';
      end if;
    end $$;`);
  }

  const generatedSource = {
    id: GENERATED_DOC_ID,
    name: "MATHPATH_NEW owner master patch and selection manifest",
    type: "generated",
    fingerprint: patchHash,
    note: "Owner-supplied master patch for the exam selection manifest, replacements, restored text, and supplements. Replacements are limited to source questions flagged unusable; generated answers were independently derived.",
  };
  sourceDocuments.set(GENERATED_DOC_ID, generatedSource);
  for (const document of sourceDocuments.values()) addSourceDocument(sql, document);

  for (const exam of runtime) {
    const manifest = manifestById.get(exam.id);
    const setId = uuid(`set:${DATASET}:${exam.id}`);
    const slug = examSlug(exam.id);
    const sourceId = GENERATED_DOC_ID;
    const setType = manifest.exam_type === "mock_test" ? "official_exam" : "practice_book";
    const revision = setRevisions.get(exam.id);
    const metadata = {
      dataset: DATASET,
      sourceExamId: exam.id,
      curriculum_level: "advanced",
      import_sha256: revision,
      automatic_qa_passed: true,
      human_reviewed: false,
      questionSourceMode: "selectable_source_pdf_with_extracted_named_figures",
    };
    const scoringConfig = {
      examMode: exam.mode,
      totalScore: exam.totalScore,
      sections: exam.sections.map((section) => ({
        key: section.id,
        maxScore: section.maxScore,
        description: section.description ?? "",
      })),
      questionScoring: exam.questions.map((question, orderIndex) => ({
        orderIndex,
        points: question.points,
        ...(question.scoring ? { scoring: question.scoring } : {}),
      })),
    };
    sql.push(insert("public.problem_sets", {
      id: quote(setId),
      slug: quote(slug),
      title: quote(exam.title),
      description: quote(exam.description),
      language: quote("vi"),
      source_name: quote("MATHPATH_NEW advanced bank"),
      source_type: quote(setType),
      category: quote(manifest.exam_type === "mock_test" ? "mock_exam" : "chapter_review"),
      difficulty: quote("hard"),
      timing_mode: quote(exam.timingMode),
      time_limit_seconds: quote(exam.durationSeconds ?? null),
      estimated_duration_seconds: quote(exam.estimatedDurationSeconds ?? null),
      review_status: quote("needs_review"),
      publication_status: quote("unpublished"),
      rights_status: quote("approved_for_publication"),
      source_document_id: quote(sourceId),
      exam_metadata: json(metadata),
      scoring_config: json(scoringConfig),
    }));
    sql.push(insert("private.problem_set_provenance_notes", {
      problem_set_id: quote(setId),
      provenance_note: quote(`Owner requested publication in the advanced collection. Content source: ${manifest.source_exam_pdf}. Keys are owner-supplied; private question-level provenance records whether each is source-matched or owner-derived.`),
    }));

    const sectionIds = new Map();
    for (let index = 0; index < exam.sections.length; index += 1) {
      const section = exam.sections[index];
      const sectionId = uuid(`section:${DATASET}:${exam.id}:${section.id}`);
      sectionIds.set(section.id, sectionId);
      sql.push(insert("public.problem_set_sections", {
        id: quote(sectionId),
        problem_set_id: quote(setId),
        section_key: quote(section.id),
        title: quote(section.title),
        order_index: String(index),
      }));
    }

    for (let orderIndex = 0; orderIndex < exam.questions.length; orderIndex += 1) {
      const question = exam.questions[orderIndex];
      const problemId = qIdsFor(exam, question);
      const ownerAuthored = isOwnerAuthored(question);
      const layoutQuestion = layoutById.get(question.source_id);
      const qSourceId = ownerAuthored
        ? GENERATED_DOC_ID
        : uuid(`source:${DATASET}:source-pdf:${layoutQuestion.source_pdf}`);
      const qSourcePage = ownerAuthored ? null : (question.source_page ?? null);
      const qSectionId = sectionIds.get(question.sectionId ?? question.section);
      if (!qSectionId) throw new Error(`Missing section ID for ${question.source_id}`);
      const qType = question.type;
      const stem = question.stem ?? "";

      sql.push(insert("public.problems", {
        id: quote(problemId),
        problem_set_id: quote(setId),
        source_reference: quote(question.source_reference ?? question.source_id),
        source_question_number: quote(question.source_id),
        order_index: String(orderIndex),
        question_number: quote(question.number),
        section_id: quote(qSectionId),
        stem: quote(stem),
        topic: quote(question.source_category ?? exam.title),
        subtopic: quote(null),
        difficulty: quote("hard"),
        source_page: quote(qSourcePage),
        question_type: quote(qType),
        provenance_status: quote("verified"),
        review_status: quote("needs_review"),
        publication_status: quote("unpublished"),
        rights_status: quote("approved_for_publication"),
        source_document_id: quote(qSourceId),
        display_stem_vi: quote(stem),
        content_review_status: quote("needs_review"),
      }));
      sql.push(insert("private.problem_content_source", {
        problem_id: quote(problemId),
        raw_stem: quote(stem),
        source_reference: quote(question.source_reference ?? question.source_id),
      }));
      sql.push(insert("private.problem_provenance_notes", {
        problem_id: quote(problemId),
        provenance_note: quote(`${question.answer_provenance ?? "source_answer_record"}. ${answerProvenance(question, practiceKeyById, mockKeyById)}`),
      }));

      for (let optionIndex = 0; optionIndex < (question.options ?? []).length; optionIndex += 1) {
        const option = question.options[optionIndex];
        const optionId = uuid(`option:${DATASET}:${exam.id}:${question.source_id}:${option.key}`);
        sql.push(insertIfAbsent("public.problem_options", {
          id: quote(optionId),
          problem_id: quote(problemId),
          option_key: quote(option.key),
          option_text: quote(option.text ?? ""),
          display_text_vi: quote(option.text ?? ""),
          order_index: String(optionIndex),
        }, `existing.id = ${quote(optionId)}::uuid or (existing.problem_id = ${quote(problemId)}::uuid and existing.option_key = ${quote(option.key)})`));
      }
      for (let statementIndex = 0; statementIndex < (question.statements ?? []).length; statementIndex += 1) {
        const statement = question.statements[statementIndex];
        const statementId = uuid(`statement:${DATASET}:${exam.id}:${question.source_id}:${statement.key}`);
        sql.push(insertIfAbsent("public.problem_substatements", {
          id: quote(statementId),
          problem_id: quote(problemId),
          statement_key: quote(statement.key),
          statement_text: quote(statement.text ?? ""),
          display_text_vi: quote(statement.text ?? ""),
          order_index: String(statementIndex),
        }, `existing.id = ${quote(statementId)}::uuid or (existing.problem_id = ${quote(problemId)}::uuid and existing.statement_key = ${quote(statement.key)})`));
      }

      const payload = answerPayload(question);
      if (qType === "multiple_choice" && (!payload.option_key || !(question.options ?? []).some((option) => option.key === payload.option_key))) {
        throw new Error(`Invalid MC answer record: ${question.source_id}`);
      }
      if (qType === "true_false" && Object.keys(payload.statements ?? {}).length !== (question.statements ?? []).length) {
        throw new Error(`Invalid true/false answer record: ${question.source_id}`);
      }
      if (qType === "short_answer" && !payload.accepted_values?.length) {
        throw new Error(`Missing short-answer key: ${question.source_id}`);
      }
      sql.push(insert("private.problem_answer_keys", {
        problem_id: quote(problemId),
        correct_answer: json(payload),
        verification_status: quote("verified"),
        provenance_note: quote(answerProvenance(question, practiceKeyById, mockKeyById)),
      }));

      if (typeof question.solution === "string" && question.solution.trim() && ownerAuthored) {
        sql.push(insert("private.problem_explanations", {
          problem_id: quote(problemId),
          explanation: quote(question.solution),
          display_explanation_vi: quote(question.solution),
          review_status: quote("approved"),
          rights_status: quote("approved_for_publication"),
          provenance_note: quote("Owner-authorized authored derivation stored as private answer support."),
        }));
      }

      for (let figureIndex = 0; figureIndex < (question.figures ?? []).length; figureIndex += 1) {
        const figure = question.figures[figureIndex];
        sql.push(insert("public.problem_assets", {
          id: quote(uuid(`asset:${DATASET}:${exam.id}:${question.source_id}:${figureIndex}`)),
          problem_id: quote(problemId),
          asset_path: quote(figure.url),
          alt_text_vi: quote(figure.alt),
          placement: quote("stem"),
          order_index: String(figureIndex),
          review_status: quote("approved"),
        }));
      }
    }
  }

  const setIdList = expectedSetIds.map((id) => `${quote(id)}::uuid`).join(", ");
  const problemIdList = expectedProblemIds.map((id) => `${quote(id)}::uuid`).join(", ");
  sql.push(`do $$ begin
    if (select count(*) from public.problem_sets where id in (${setIdList})) <> 18 then
      raise exception 'Advanced exam set count mismatch';
    end if;
    if (select count(*) from public.problems where id in (${problemIdList})) <> 594 then
      raise exception 'Advanced question count mismatch';
    end if;
    if (select count(*) from private.problem_answer_keys where problem_id in (${problemIdList}) and verification_status='verified') <> 594 then
      raise exception 'Advanced key count mismatch';
    end if;
  end $$;`);
  sql.push("commit;");

  const activate = [
    "begin;",
    "set local lock_timeout = '10s';",
    `do $$ begin
      if (select count(*) from public.problem_sets where id in (${setIdList}) and exam_metadata->>'curriculum_level'='advanced') <> 18 then
        raise exception 'Advanced exam classification mismatch';
      end if;
      if (select count(*) from public.problem_assets where problem_id in (${problemIdList}) and review_status='approved') < 584 then
        raise exception 'Question PDF assets are incomplete';
      end if;
      if (select count(*) from private.problem_answer_keys where problem_id in (${problemIdList}) and verification_status='verified') <> 594 then
        raise exception 'Verified answer keys are incomplete';
      end if;
    end $$;`,
    `update public.problems set review_status='approved', content_review_status='approved', publication_status='published' where id in (${problemIdList});`,
    `update public.problem_sets set review_status='approved', publication_status='published', updated_at=now() where id in (${setIdList});`,
    `do $$ begin
      if (select count(*) from public.problem_sets where id in (${setIdList}) and publication_status='published') <> 18 then
        raise exception 'Advanced exam publication failed';
      end if;
      if (select count(*) from public.problems where id in (${problemIdList}) and publication_status='published') <> 594 then
        raise exception 'Advanced question publication failed';
      end if;
    end $$;`,
    "commit;",
  ].join("\n");
  const rollback = [
    "begin;",
    "set local lock_timeout = '10s';",
    `update public.problem_sets set publication_status='archived', updated_at=now() where id in (${setIdList});`,
    `update public.problems set publication_status='archived' where id in (${problemIdList});`,
    "commit;",
  ].join("\n");

  await mkdir(PRIVATE_DIR, { recursive: true });
  await Promise.all([
    writeFile(path.join(PRIVATE_DIR, "import-advanced-bank.sql"), sql.join("\n"), "utf8"),
    writeFile(path.join(PRIVATE_DIR, "activate-advanced-bank.sql"), activate, "utf8"),
    writeFile(path.join(PRIVATE_DIR, "rollback-advanced-bank.sql"), rollback, "utf8"),
    writeFile(
      path.join(PRIVATE_DIR, "release-plan.json"),
      JSON.stringify({
        dataset: DATASET,
        exams: runtime.map((exam) => ({
          examId: exam.id,
          slug: examSlug(exam.id),
          questionCount: exam.questions.length,
          type: manifestById.get(exam.id).exam_type,
          advanced: true,
          importSha256: setRevisions.get(exam.id),
        })),
        examCount: runtime.length,
        questionCount: allQuestions.length,
        generatedQuestionCount: allQuestions.filter(isOwnerAuthored).length,
        answerCount: 594,
        pdfPageCount: allQuestions.filter((question) => question.pdf_page !== null).length,
        publicAssetCount: allQuestions.reduce((sum, question) => sum + (question.figures ?? []).length, 0),
        uniquePublicAssetFileCount: new Set(
          allQuestions.flatMap((question) => (question.figures ?? []).map((figure) => figure.url)),
        ).size,
        publicSourceKeysIndependentlyRederived: false,
        sourceDocumentCount: sourceDocuments.size,
      }, null, 2),
      "utf8",
    ),
  ]);
  process.stdout.write(JSON.stringify({
    prepared: true,
    examCount: runtime.length,
    questionCount: allQuestions.length,
    answerCount: 594,
    privateSqlBytes: Buffer.byteLength(sql.join("\n")),
    publicAssetCount: allQuestions.reduce((sum, question) => sum + (question.figures ?? []).length, 0),
    sourceKeysIndependentlyRederived: false,
  }, null, 2) + "\n");
}

function qIdsFor(exam, question) {
  return recordId(exam.id, question.source_id);
}

await main();
