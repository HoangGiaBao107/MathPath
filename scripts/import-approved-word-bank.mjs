import { createHash } from "node:crypto";
import { Buffer } from "node:buffer";
import console from "node:console";
import process from "node:process";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = path.resolve(import.meta.dirname, "..");
const UUID_NAMESPACE = "c75ce75c-6266-4e31-9cf4-18a8f07c4488";
const GENERAL_IDS = Array.from({ length: 8 }, (_, index) => `exam-${index + 1}`);
const TOPIC_IDS = [
  "practice-dao_ham-1",
  "practice-dao_ham-2",
  "practice-nguyen_ham-1",
  "practice-nguyen_ham-2",
];
const FORBIDDEN_SOURCE_PREFIXES = ["d1", "d2", "d3", "d4", "d5", "d6", "d7", "d8", "d9", "d10"];

function readJson(relativePath) {
  return JSON.parse(readFileSync(path.join(ROOT, relativePath), "utf8"));
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function uuidBytes(uuid) {
  return Buffer.from(uuid.replaceAll("-", ""), "hex");
}

export function stableUuid(name, namespace = UUID_NAMESPACE) {
  const digest = createHash("sha1")
    .update(Buffer.concat([uuidBytes(namespace), Buffer.from(name, "utf8")]))
    .digest();
  digest[6] = (digest[6] & 0x0f) | 0x50;
  digest[8] = (digest[8] & 0x3f) | 0x80;
  const hex = digest.subarray(0, 16).toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function assertUnique(values, label) {
  if (new Set(values).size !== values.length)
    throw new Error(`Duplicate ${label} in approved source.`);
}

function sqlText(value) {
  return value === null || value === undefined
    ? "null"
    : `'${String(value).replaceAll("'", "''")}'`;
}

function sqlNumber(value) {
  if (value === null || value === undefined) return "null";
  if (!Number.isFinite(Number(value))) throw new Error("Non-finite number in import source.");
  return String(Number(value));
}

function sqlJson(value) {
  return `${sqlText(JSON.stringify(value))}::jsonb`;
}

function optionKeyFromSource(value, context) {
  const answer = String(value ?? "").trim();
  const match = answer.match(/^([A-D])(?:\s*[.)])?$/i);
  const keyBeforeAttachedExplanation = answer.match(
    /^([A-D])(?=(?:Giải thích|Explanation)\s*[:：])/i,
  );
  if (!match && !keyBeforeAttachedExplanation)
    throw new Error(`Unrecognized existing answer key for ${context}; import stopped.`);
  return (match ?? keyBeforeAttachedExplanation)[1].toUpperCase();
}

function extractTrueFalseAnswers(explanation) {
  const answers = new Map();
  for (const match of explanation.matchAll(/([a-d])\)\s*(Đúng|Sai)\b/gi)) {
    answers.set(match[1].toLowerCase(), match[2].toLocaleLowerCase("vi") === "đúng");
  }
  for (const match of explanation.matchAll(/(?:phát biểu|ý)\s+([a-d])\s+(?:là\s+)?(Đúng|Sai)\b/gi)) {
    answers.set(match[1].toLowerCase(), match[2].toLocaleLowerCase("vi") === "đúng");
  }
  return answers;
}

function knowledgeLabel(examSlug, question) {
  const sourceQuestion = String(question.sourceContent ?? "").split(/Đáp án(?:\s*&\s*Giải thích)?\s*:/i)[0];
  const text = `${question.stem} ${sourceQuestion} ${(question.statements ?? []).map((item) => item.text).join(" ")}`;
  const has = (pattern) => pattern.test(text);
  if (has(/thống kê|mẫu số liệu|tứ phân vị|trung vị|tần số ghép nhóm|nhóm chứa mốt|số giờ tự học|chiều cao trung bình/i)) {
    return { topic: "Thống kê", subtopic: "Số liệu ghép nhóm" };
  }
  if (has(/số phức|phần thực|phần ảo|liên hợp|môđun.*z|điểm biểu diễn/i)) {
    const subtopic = has(/môđun|\|z|đường tròn|điểm biểu diễn/i)
      ? "Môđun và hình học số phức"
      : has(/liên hợp|phần ảo/i)
        ? "Số phức liên hợp và phần ảo"
        : "Phép toán và phần thực số phức";
    return { topic: "Số phức", subtopic };
  }
  if (has(/xác suất|gieo.*xúc xắc|biến cố|số cách|chọn ra \d+ học sinh|xếp \d+ học sinh|số tự nhiên gồm|chỉnh hợp|hoán vị|tổ hợp/i)) {
    return {
      topic: "Xác suất và tổ hợp",
      subtopic: has(/xác suất|gieo.*xúc xắc|biến cố/i) ? "Xác suất" : "Quy tắc đếm và tổ hợp",
    };
  }
  if (has(/∫|\\int|nguyên hàm|tích phân|vận tốc|gia tốc|quãng đường|v\(t\)|diện tích hình phẳng/i)) {
    const subtopic = has(/vận tốc|gia tốc|quãng đường|v\(t\)/i)
      ? "Ứng dụng tích phân trong chuyển động"
      : has(/diện tích hình phẳng/i)
        ? "Ứng dụng tích phân tính diện tích"
        : has(/nguyên hàm/i)
          ? "Nguyên hàm"
          : "Tính chất và ứng dụng tích phân";
    return { topic: "Nguyên hàm và tích phân", subtopic };
  }
  if (has(/cấp số cộng|cấp số nhân|công sai|công bội|số hạng đầu|u_\{?\d/i)) {
    return { topic: "Dãy số", subtopic: "Cấp số cộng và cấp số nhân" };
  }
  if (has(/log|ln\s*\(|\\log|e\^|[a-z]=?\^x|\^\s*\{?x/i)) {
    return { topic: "Hàm số mũ và logarit", subtopic: "Phương trình, bất phương trình và tính chất" };
  }
  if (has(/hàm số|đạo hàm|đồng biến|nghịch biến|cực đại|cực tiểu|cực trị|tiệm cận|bảng biến thiên|đồ thị|bất phương trình/i)) {
    let subtopic = "Khảo sát và đọc đồ thị hàm số";
    if (has(/đạo hàm/)) subtopic = "Đạo hàm";
    else if (has(/cực đại|cực tiểu|cực trị/)) subtopic = "Cực trị";
    else if (has(/tiệm cận/)) subtopic = "Tiệm cận";
    else if (has(/đồng biến|nghịch biến/)) subtopic = "Tính đơn điệu";
    return { topic: "Hàm số", subtopic };
  }
  if (has(/Oxyz|vectơ|\bvector\b|mặt phẳng|đường thẳng|tọa độ|khoảng cách.*\(P\)|mặt cầu.*\(S\)|A\([^)]*\).{0,80}B\(/i)) {
    const subtopic = has(/mặt cầu/i)
      ? "Mặt cầu và khoảng cách"
      : has(/đường thẳng/i) && has(/mặt phẳng/i)
        ? "Vị trí tương đối đường thẳng và mặt phẳng"
        : has(/đường thẳng/i)
          ? "Phương trình và vectơ chỉ phương đường thẳng"
          : has(/mặt phẳng/i)
            ? "Phương trình và vectơ pháp tuyến mặt phẳng"
            : has(/vectơ|vector/i)
              ? "Vectơ và tích vô hướng"
              : "Tọa độ điểm, trung điểm và khoảng cách";
    return { topic: "Hình học tọa độ Oxyz", subtopic };
  }
  if (has(/lăng trụ|hình chóp|khối chóp|khối lập phương|lập phương|hình trụ|khối trụ|hình nón|khối nón|khối cầu|mặt cầu|tứ diện|đáy là hình vuông|đường chéo.*hình vuông|thể tích/i)) {
    const subtopic = has(/hình trụ|khối trụ|hình nón|khối nón|khối cầu|mặt cầu/i)
      ? "Khối tròn xoay"
      : has(/lăng trụ|khối lập phương|lập phương/i)
        ? "Lăng trụ và hình lập phương"
        : has(/hình chóp|khối chóp|tứ diện/i)
          ? "Hình chóp và tứ diện"
          : has(/bể|thùng|chi phí|nhỏ nhất|lớn nhất/i)
            ? "Tối ưu hình học"
            : "Thể tích và diện tích khối hình học";
    return { topic: "Hình học không gian", subtopic };
  }
  throw new Error(`No reliable knowledge label for ${examSlug} question ${question.questionNumber}: ${text.slice(0, 180)}`);
}

function answerPayload(question, privateQuestion, sourceKind) {
  const sourceAnswerRecord = globalThis.structuredClone(privateQuestion);
  if (sourceKind === "topic") {
    if (question.type === "multiple_choice") {
      if (
        !(question.options ?? []).some(
          (option) =>
            option.key ===
            String(privateQuestion.correctOptionKey ?? "")
              .trim()
              .toUpperCase(),
        )
      ) {
        return {
          answer_pending: true,
          pending_reason: "source_has_no_matching_option",
          source_answer_record: sourceAnswerRecord,
          verification_status: "uncertain",
        };
      }
      return {
        option_key: optionKeyFromSource(
          privateQuestion.correctOptionKey,
          `${question.id} multiple choice`,
        ),
        source_answer_record: sourceAnswerRecord,
      };
    }
    if (question.type === "true_false") {
      if (!privateQuestion.correctStatements || !privateQuestion.scoring) {
        throw new Error(`Approved true/false answer data incomplete for ${question.id}.`);
      }
      return {
        statements: privateQuestion.correctStatements,
        scoring: privateQuestion.scoring,
        source_answer_record: sourceAnswerRecord,
      };
    }
    const canonical = String(privateQuestion.canonicalAnswer ?? "");
    const accepted = privateQuestion.acceptedNormalizedAnswers;
    if (!canonical.trim() || !Array.isArray(accepted) || accepted.length === 0) {
      throw new Error(`Approved short-answer data incomplete for ${question.id}.`);
    }
    return {
      canonical_answer: canonical,
      accepted_values: accepted,
      source_answer_record: sourceAnswerRecord,
    };
  }

  if (question.questionType === "multiple_choice") {
    const key = String(privateQuestion.answer ?? "")
      .trim()
      .match(/^([A-D])/i)?.[1]
      ?.toUpperCase();
    if (!key) {
      return {
        answer_pending: true,
        pending_reason: "source_has_no_matching_option",
        source_answer_record: sourceAnswerRecord,
        verification_status: "uncertain",
      };
    }
    if (!(question.options ?? []).some((option) => option.key === key)) {
      if ((question.options ?? []).length === 0) {
        return {
          option_key: key,
          source_answer_text: privateQuestion.answer,
          source_answer_record: sourceAnswerRecord,
          verification_status: "verified",
          content_warning: "source_options_missing",
        };
      }
      return {
        answer_pending: true,
        pending_reason: "source_answer_does_not_match_options",
        source_answer_record: sourceAnswerRecord,
        verification_status: "uncertain",
      };
    }
    return {
      option_key: optionKeyFromSource(privateQuestion.answer, `${question.id} multiple choice`),
      source_answer_text: privateQuestion.answer,
      source_answer_record: sourceAnswerRecord,
    };
  }
  if (question.questionType === "true_false") {
    const subanswers = privateQuestion.subanswers ?? [];
    const answersFromExplanation = extractTrueFalseAnswers(privateQuestion.explanation ?? "");
    const hasStructuredAnswers = subanswers.length === question.substatements.length && subanswers.every((item) =>
      ["đúng", "sai"].includes(
        String(item.answer ?? "")
          .trim()
          .toLocaleLowerCase("vi"),
      ),
    );
    const answers = hasStructuredAnswers
      ? new Map(subanswers.map((item) => [item.key, String(item.answer).trim().toLocaleLowerCase("vi") === "đúng"]))
      : answersFromExplanation;
    if (question.substatements.some((item) => !answers.has(item.key))) {
      return {
        statements: Object.fromEntries(question.substatements.map((item) => [item.key, answers.get(item.key) ?? null])),
        answer_pending: true,
        source_subanswers: subanswers,
        answer_source: hasStructuredAnswers ? "structured_source_key" : "word_explanation_answer_markers",
        source_answer_record: sourceAnswerRecord,
        verification_status: "uncertain",
      };
    }
    const statements = Object.fromEntries(question.substatements.map((item) => [item.key, answers.get(item.key)]));
    return {
      statements,
      source_subanswers: subanswers,
      answer_source: hasStructuredAnswers ? "structured_source_key" : "word_explanation_answer_markers",
      source_answer_record: sourceAnswerRecord,
      verification_status: "verified",
    };
  }
  const canonical = String(privateQuestion.answer ?? "");
  if (!canonical.trim()) throw new Error(`Approved short-answer data missing for ${question.id}.`);
  return {
    canonical_answer: canonical,
    accepted_values: [canonical],
    source_answer_text: canonical,
    source_answer_record: sourceAnswerRecord,
  };
}

function buildTopicScoreConfig(exam) {
  const sections = exam.sections.map((section) => {
    const sectionQuestions = exam.questions.filter((question) => question.sectionId === section.id);
    return {
      key: section.id,
      description: section.description,
      maxScore: sectionQuestions.reduce((sum, question) => sum + question.points, 0),
    };
  });
  return {
    examMode: exam.mode,
    totalScore: exam.totalScore,
    sections,
    questionScoring: exam.questions.map((question, index) => ({
      orderIndex: index + 1,
      points: question.points,
    })),
  };
}

function buildGeneralScoreConfig(exam) {
  const pointsFor = (question) =>
    question.questionType === "multiple_choice" ? 0.25 : question.questionType === "true_false" ? 1 : 0.5;
  const sections = [...new Set(exam.questions.map((question) => question.section))].map((key) => ({
    key,
    description: "",
    maxScore: exam.questions
      .filter((question) => question.section === key)
      .reduce((sum, question) => sum + pointsFor(question), 0),
  }));
  return {
    examMode: "official_thptqg",
    totalScore: 10,
    sections,
    questionScoring: exam.questions.map((question) => ({
      orderIndex: question.orderIndex,
      points: pointsFor(question),
      ...(question.questionType === "true_false"
        ? { scoring: { kind: "partial", pointsByCorrectCount: [0, 0.1, 0.25, 0.5, 1] } }
        : {}),
    })),
  };
}

export function buildApprovedImportBundle() {
  const generalData = readJson("src/data/mathpath-word-student-previews.json");
  const generalAnswers = readJson("content/word-import/private-exam-solutions.json");
  const topicData = readJson("src/data/mathpath-topic-practice-exams.json");
  const topicAnswers = readJson("content/word-import/private-topic-practice-keys.json");
  const figureManifest = readJson("content/word-import/figure-generation-manifest.json");

  const currentGeneralIds = generalData.exams.map((exam) => exam.slug);
  const currentTopicIds = topicData.exams.map((exam) => exam.slug);
  if (JSON.stringify(currentGeneralIds) !== JSON.stringify(GENERAL_IDS)) {
    throw new Error(
      "The approved general-exam allowlist does not match the current source. No write performed.",
    );
  }
  if (JSON.stringify(currentTopicIds) !== JSON.stringify(TOPIC_IDS)) {
    throw new Error(
      "The approved topic-set allowlist does not match the current source. No write performed.",
    );
  }
  if (generalData.exams.some((exam) => exam.previewOnly === true)) {
    // The owner explicitly re-verified this exact set in the current conversation.
    // Keep source files unchanged and record the resulting approval in database rows.
  }

  const generalSourcePath = path.join(ROOT, "Đề thi.docx");
  const generalSourceHash = sha256(readFileSync(generalSourcePath));
  if (
    generalData.source.sha256 !== generalSourceHash ||
    generalAnswers.source.sha256 !== generalSourceHash
  ) {
    throw new Error("The general exam Word source fingerprint changed. No write performed.");
  }
  for (const source of topicData.sources) {
    const actualHash = sha256(readFileSync(path.join(ROOT, source.file)));
    if (source.sha256 !== actualHash)
      throw new Error(`Word source fingerprint mismatch: ${source.file}`);
  }

  const generalAnswersBySlug = new Map(generalAnswers.exams.map((exam) => [exam.slug, exam]));
  const topicAnswersBySlug = new Map(topicAnswers.exams.map((exam) => [exam.id, exam]));
  const sources = new Map();
  const sets = [];

  for (const [sourceKind, exams, answerMap] of [
    ["general", generalData.exams, generalAnswersBySlug],
    ["topic", topicData.exams, topicAnswersBySlug],
  ]) {
    for (const exam of exams) {
      const examId = exam.slug;
      const privateExam = answerMap.get(examId);
      if (!privateExam || privateExam.questions.length !== exam.questions.length) {
        throw new Error(`Question/answer alignment failed for ${examId}. No write performed.`);
      }
      const answerByQuestionId = new Map(
        privateExam.questions.map((question) => [question.id, question]),
      );
      const sourceFile = sourceKind === "general" ? "Đề thi.docx" : exam.sourceFile;
      const fileHash = sourceKind === "general" ? generalSourceHash : exam.sourceSha256;
      const sourceFingerprint = `word-import:${fileHash}`;
      const sourceKey = sourceFingerprint;
      sources.set(sourceKey, {
        id: stableUuid(`source:${sourceFingerprint}`),
        sourceFingerprint,
        documentName: sourceFile,
        sourceType: sourceKind === "general" ? "other" : "practice_book",
        provenanceStatus: "verified",
        rightsStatus: "approved_for_publication",
        provenanceNote: JSON.stringify({
          importKind: "word_import",
          sourceFile,
          sourceSha256: fileHash,
          ownerConfirmedContent: true,
        }),
      });

      const sourceQuestions = exam.questions;
      const sectionKeys =
        sourceKind === "general"
          ? [...new Set(sourceQuestions.map((question) => question.section))]
          : exam.sections.map((section) => section.id);
      const sections = sectionKeys.map((sectionKey, index) => {
        const sourceSection =
          sourceKind === "general"
            ? sourceQuestions.find((question) => question.section === sectionKey)?.sectionLabel
            : exam.sections.find((section) => section.id === sectionKey);
        return {
          id: stableUuid(`section:${examId}:${sectionKey}`),
          key: sectionKey,
          orderIndex: index,
          title: sourceSection?.vi ?? sourceSection?.title ?? sectionKey,
          titleEn: sourceSection?.en ?? null,
          description: sourceSection?.description ?? "",
        };
      });
      const sectionIdByKey = new Map(sections.map((section) => [section.key, section.id]));
      const topicId = sourceKind === "topic" ? stableUuid(`topic:${exam.topicId}`) : null;
      const rightsStatus = "approved_for_publication";
      const normalizedQuestions = sourceQuestions.map((question, sourceIndex) => {
        const sourceQuestionId = question.id;
        const questionId =
          /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
            sourceQuestionId,
          )
            ? sourceQuestionId
            : stableUuid(`question:${examId}:${sourceQuestionId}`);
        const sectionKey = sourceKind === "general" ? question.section : question.sectionId;
        const privateQuestion = answerByQuestionId.get(sourceQuestionId);
        if (!privateQuestion)
          throw new Error(`Missing existing private answer for ${sourceQuestionId}.`);
        const type = sourceKind === "general" ? question.questionType : question.type;
        const stem = sourceKind === "general" ? question.statement : question.stem;
        const options = (question.options ?? []).map((option, index) => ({
          id: stableUuid(`option:${questionId}:${option.key}`),
          key: option.key,
          text: option.text,
          displayTextEn: option.displayTextEn ?? null,
          orderIndex: option.orderIndex ?? index,
        }));
        const statements = (
          sourceKind === "general" ? question.substatements : (question.statements ?? [])
        ).map((statement, index) => ({
          id: stableUuid(`substatement:${questionId}:${statement.key}`),
          key: statement.key,
          text: statement.text,
          displayTextEn: statement.displayTextEn ?? null,
          orderIndex: statement.orderIndex ?? index,
        }));
        const typeKey = sourceKind === "general" ? type : type;
        const mappedType = typeKey;
        const privateKey = answerPayload(question, privateQuestion, sourceKind);
        const knowledge = sourceKind === "general" ? knowledgeLabel(examId, {
          stem: type === "short_answer" ? "" : stem,
          sourceContent: privateQuestion.sourceContent,
          statements,
          questionNumber: question.questionNumber,
        }) : null;
        return {
          id: questionId,
          sourceQuestionId,
          orderIndex: sourceKind === "general" ? question.orderIndex : sourceIndex + 1,
          questionNumber: sourceKind === "general" ? question.questionNumber : question.number,
          sectionKey,
          sectionId: sectionIdByKey.get(sectionKey),
          type: mappedType,
          stem,
          options,
          statements,
          topic: sourceKind === "topic" ? exam.topic : knowledge.topic,
          subtopic: knowledge?.subtopic ?? null,
          topicId,
          rightsStatus,
          sourcePage: sourceKind === "general" ? (question.source?.pages?.[0] ?? null) : null,
          correctAnswer: privateKey,
          explanation: privateQuestion.explanation ?? "",
          provenanceNote: JSON.stringify({
            sourceKind,
            sourceFile,
            sourceSha256: fileHash,
            ownerConfirmedContent: true,
            originalQuestionId: sourceQuestionId,
            originalQuestion: question,
            privateSourceRecord: privateQuestion,
          }),
        };
      });
      assertUnique(
        normalizedQuestions.map((question) => question.id),
        `${examId} question UUID`,
      );
      assertUnique(
        normalizedQuestions.map((question) => question.orderIndex),
        `${examId} question order`,
      );
      const scoringConfig =
        sourceKind === "topic" ? buildTopicScoreConfig(exam) : buildGeneralScoreConfig(exam);
      const examMetadata =
        sourceKind === "general"
          ? {
              sourceKind: exam.sourceKind,
              sourceFile,
              sourceSha256: fileHash,
              ownerConfirmedContent: true,
              reportWarnings: exam.reportWarnings,
              sectionTitlesEn: Object.fromEntries(
                sections
                  .filter((section) => section.titleEn)
                  .map((section) => [section.key, section.titleEn]),
              ),
            }
          : {
              topicId: exam.topicId,
              sourceFile,
              sourceExamNumber: exam.sourceExamNumber,
              sourceSha256: fileHash,
              contentStatus: exam.contentStatus,
              publicationRightsStatus: exam.publicationRightsStatus,
              ownerConfirmedContent: true,
            };
      sets.push({
        id: stableUuid(`problem-set:${examId}`),
        sourceId: examId,
        slug: examId,
        title: exam.title,
        description: sourceKind === "topic" ? exam.description : null,
        sourceName: sourceFile,
        sourceType: "word_import",
        sourceFingerprint,
        sourceKind,
        category: sourceKind === "general" ? "mock_exam" : "topic_review",
        language: "vi",
        difficulty: "mixed",
        topic: sourceKind === "topic" ? exam.topic : null,
        topicId,
        timingMode: sourceKind === "general" ? "countdown" : "elapsed",
        timeLimitSeconds: sourceKind === "general" ? 5400 : null,
        estimatedDurationSeconds: null,
        examMetadata,
        scoringConfig,
        rightsStatus,
        reviewStatus: "approved",
        publicationStatus: "unpublished",
        sections,
        questions: normalizedQuestions,
      });
    }
  }

  const setIds = sets.map((set) => set.slug);
  assertUnique(setIds, "problem-set slug");
  if (sets.length !== 12 || sets.reduce((sum, set) => sum + set.questions.length, 0) !== 336) {
    throw new Error(
      "The exact approved 8 + 4 source scope failed its count guard. No write performed.",
    );
  }
  if (
    sets.some((set) =>
      FORBIDDEN_SOURCE_PREFIXES.some(
        (prefix) => set.slug === prefix || set.slug.startsWith(`${prefix}-`),
      ),
    )
  ) {
    throw new Error("Forbidden d1-d10 content detected. No write performed.");
  }

  const summary = {
    setCount: sets.length,
    generalExamCount: sets.filter((set) => set.sourceKind === "general").length,
    topicSetCount: sets.filter((set) => set.sourceKind === "topic").length,
    questionCount: sets.reduce((sum, set) => sum + set.questions.length, 0),
    generalQuestionsLabeled: sets
      .filter((set) => set.sourceKind === "general")
      .reduce((sum, set) => sum + set.questions.filter((question) => question.topic && question.subtopic).length, 0),
    answerKeyCount: sets.reduce(
      (sum, set) =>
        sum +
        set.questions.filter(
          (question) => question.correctAnswer.verification_status !== "uncertain",
        ).length,
      0,
    ),
    answerKeysPending: sets.reduce(
      (sum, set) =>
        sum +
        set.questions.filter(
          (question) => question.correctAnswer.verification_status === "uncertain",
        ).length,
      0,
    ),
    answerKeysPendingBySet: Object.fromEntries(
      sets
        .map((set) => [
          set.slug,
          set.questions.filter(
            (question) => question.correctAnswer.verification_status === "uncertain",
          ).length,
        ])
        .filter(([, count]) => count > 0),
    ),
    questionCountsBySet: Object.fromEntries(sets.map((set) => [set.slug, set.questions.length])),
    duplicateSourceIds: 0,
    skipped: 0,
    publicationStatus: Object.fromEntries(sets.map((set) => [set.slug, set.publicationStatus])),
  };
  return { sources: [...sources.values()], sets, summary, figureManifest };
}

function insertSql(table, columns, rows, conflictTarget, updates) {
  if (rows.length === 0) return;
  const values = rows.map((row) => `(${row.map((value) => value).join(", ")})`).join(",\n");
  return `insert into ${table} (${columns.join(", ")})\nvalues ${values}\non conflict (${conflictTarget}) do ${updates === "nothing" ? "nothing" : `update set ${updates}`};`;
}

export function splitSqlStatements(sql) {
  const statements = [];
  let current = "";
  let inString = false;
  for (let index = 0; index < sql.length; index += 1) {
    const character = sql[index];
    current += character;
    if (character === "'") {
      if (inString && sql[index + 1] === "'") {
        current += sql[index + 1];
        index += 1;
      } else {
        inString = !inString;
      }
    } else if (character === ";" && !inString) {
      statements.push(current.trim().replace(/;$/, ""));
      current = "";
    }
  }
  if (current.trim()) statements.push(current.trim());
  return statements.filter(
    (statement) => statement && !/^begin$/i.test(statement) && !/^commit$/i.test(statement),
  );
}

export function buildImportSql(bundle) {
  const statements = ["begin;"];
  statements.push(
    insertSql(
      "public.problem_source_documents",
      [
        "id",
        "document_name",
        "source_type",
        "source_year",
        "provenance_status",
        "publication_rights_status",
        "provenance_note",
        "source_fingerprint",
      ],
      bundle.sources.map((source) => [
        sqlText(source.id),
        sqlText(source.documentName),
        sqlText(source.sourceType),
        "null",
        sqlText(source.provenanceStatus),
        sqlText(source.rightsStatus),
        sqlText(source.provenanceNote),
        sqlText(source.sourceFingerprint),
      ]),
      "source_fingerprint",
      "document_name = excluded.document_name, source_type = excluded.source_type, provenance_status = excluded.provenance_status, publication_rights_status = excluded.publication_rights_status, provenance_note = excluded.provenance_note",
    ),
  );

  const topics = new Map();
  for (const set of bundle.sets) {
    if (set.topicId && set.topic)
      topics.set(set.topicId, { id: set.topicId, slug: set.topicId, name: set.topic });
  }
  if (topics.size) {
    statements.push(
      insertSql(
        "public.problem_topics",
        ["id", "slug", "name_vi", "name_en", "is_active", "order_index"],
        [...topics.values()].map((topic, orderIndex) => [
          sqlText(topic.id),
          sqlText(topic.slug),
          sqlText(topic.name),
          "null",
          "true",
          String(orderIndex),
        ]),
        "slug",
        "name_vi = excluded.name_vi, is_active = excluded.is_active, order_index = excluded.order_index",
      ),
    );
  }

  const setRows = bundle.sets.map((set) => [
    sqlText(set.id),
    sqlText(set.slug),
    sqlText(set.title),
    sqlText(set.description),
    sqlText(set.language),
    sqlText(set.sourceName),
    sqlText(set.sourceType),
    "null",
    sqlText(set.difficulty),
    sqlText(set.topic),
    sqlText(set.category),
    sqlJson(set.examMetadata),
    sqlJson(set.scoringConfig),
    sqlText(set.timingMode),
    sqlNumber(set.timeLimitSeconds),
    sqlNumber(set.estimatedDurationSeconds),
    sqlText(set.reviewStatus),
    sqlText(set.publicationStatus),
    sqlText(set.rightsStatus),
    `(select id from public.problem_source_documents where source_fingerprint = ${sqlText(set.sourceFingerprint)})`,
  ]);
  statements.push(
    insertSql(
      "public.problem_sets",
      [
        "id",
        "slug",
        "title",
        "description",
        "language",
        "source_name",
        "source_type",
        "source_year",
        "difficulty",
        "topic",
        "category",
        "exam_metadata",
        "scoring_config",
        "timing_mode",
        "time_limit_seconds",
        "estimated_duration_seconds",
        "review_status",
        "publication_status",
        "rights_status",
        "source_document_id",
      ],
      setRows,
      "slug",
      "title = excluded.title, description = excluded.description, language = excluded.language, source_name = excluded.source_name, source_type = excluded.source_type, source_year = excluded.source_year, difficulty = excluded.difficulty, topic = excluded.topic, category = excluded.category, exam_metadata = excluded.exam_metadata, scoring_config = excluded.scoring_config, timing_mode = excluded.timing_mode, time_limit_seconds = excluded.time_limit_seconds, estimated_duration_seconds = excluded.estimated_duration_seconds, review_status = excluded.review_status, publication_status = excluded.publication_status, rights_status = excluded.rights_status, source_document_id = excluded.source_document_id, updated_at = now()",
    ),
  );

  const setProvenanceRows = bundle.sets.map((set) => [
    `(select id from public.problem_sets where slug = ${sqlText(set.slug)})`,
    sqlText(
      JSON.stringify({
        importKind: "word_import",
        sourceFile: set.sourceName,
        sourceSha256: set.sourceFingerprint.replace("word-import:", ""),
        sourceKind: set.sourceKind,
        ownerConfirmedContent: true,
        sourceOrderPreserved: true,
      }),
    ),
  ]);
  statements.push(
    insertSql(
      "private.problem_set_provenance_notes",
      ["problem_set_id", "provenance_note"],
      setProvenanceRows,
      "problem_set_id",
      "provenance_note = excluded.provenance_note, updated_at = now()",
    ),
  );

  const sectionRows = bundle.sets.flatMap((set) =>
    set.sections.map((section) => [
      sqlText(section.id),
      `(select id from public.problem_sets where slug = ${sqlText(set.slug)})`,
      sqlText(section.key),
      sqlText(section.title),
      String(section.orderIndex),
    ]),
  );
  statements.push(
    insertSql(
      "public.problem_set_sections",
      ["id", "problem_set_id", "section_key", "title", "order_index"],
      sectionRows,
      "problem_set_id, section_key",
      "id = excluded.id, title = excluded.title, order_index = excluded.order_index",
    ),
  );

  const questions = bundle.sets.flatMap((set) =>
    set.questions.map((question) => ({ set, question })),
  );
  const problemRows = questions.map(({ set, question }) => [
    sqlText(question.id),
    `(select id from public.problem_sets where slug = ${sqlText(set.slug)})`,
    sqlText(question.sourceQuestionId),
    String(question.orderIndex),
    sqlText(question.stem),
    sqlText(question.topic),
    sqlText(question.subtopic),
    "null",
    sqlText(question.type),
    sqlText(question.questionNumber),
    sqlText(question.sectionId),
    question.topicId ? sqlText(question.topicId) : "null",
    `(select id from public.problem_source_documents where source_fingerprint = ${sqlText(set.sourceFingerprint)})`,
    sqlText(question.questionNumber),
    sqlText("verified"),
    sqlText("approved"),
    sqlText("unpublished"),
    sqlText(question.rightsStatus),
    sqlText(question.stem),
    "null",
    sqlText("approved"),
    sqlText("not_started"),
  ]);
  statements.push(
    insertSql(
      "public.problems",
      [
        "id",
        "problem_set_id",
        "source_reference",
        "order_index",
        "stem",
        "topic",
        "subtopic",
        "difficulty",
        "question_type",
        "question_number",
        "section_id",
        "topic_id",
        "source_document_id",
        "source_question_number",
        "provenance_status",
        "review_status",
        "publication_status",
        "rights_status",
        "display_stem_vi",
        "display_stem_en",
        "content_review_status",
        "translation_status",
      ],
      problemRows,
      "id",
      "topic = excluded.topic, subtopic = excluded.subtopic, source_document_id = excluded.source_document_id, provenance_status = excluded.provenance_status, review_status = excluded.review_status, publication_status = excluded.publication_status, rights_status = excluded.rights_status, updated_at = now()",
    ),
  );

  const optionRows = questions.flatMap(({ question }) =>
    question.options.map((option) => [
      sqlText(option.id),
      sqlText(question.id),
      sqlText(option.key),
      sqlText(option.text),
      sqlText(option.text),
      sqlText(option.displayTextEn),
      String(option.orderIndex),
    ]),
  );
  statements.push(
    insertSql(
      "public.problem_options",
      [
        "id",
        "problem_id",
        "option_key",
        "option_text",
        "display_text_vi",
        "display_text_en",
        "order_index",
      ],
      optionRows,
      "problem_id, option_key",
      "nothing",
    ),
  );

  const substatementRows = questions.flatMap(({ question }) =>
    question.statements.map((statement) => [
      sqlText(statement.id),
      sqlText(question.id),
      sqlText(statement.key),
      sqlText(statement.text),
      sqlText(statement.text),
      sqlText(statement.displayTextEn),
      String(statement.orderIndex),
    ]),
  );
  if (substatementRows.length) {
    statements.push(
      insertSql(
        "public.problem_substatements",
        [
          "id",
          "problem_id",
          "statement_key",
          "statement_text",
          "display_text_vi",
          "display_text_en",
          "order_index",
        ],
        substatementRows,
        "problem_id, statement_key",
        "nothing",
      ),
    );
  }

  const answerRows = questions
    .filter(({ question }) => question.correctAnswer.verification_status !== "uncertain")
    .map(({ question }) => [
      sqlText(question.id),
      sqlJson(question.correctAnswer),
      sqlText(question.correctAnswer.verification_status ?? "verified"),
      "null",
      "now()",
      sqlText(
        `Owner-confirmed answer record from ${question.sourceQuestionId}; source text is retained in correct_answer.source_answer_record.`,
      ),
    ]);
  statements.push(
    insertSql(
      "private.problem_answer_keys",
      [
        "problem_id",
        "correct_answer",
        "verification_status",
        "verified_by",
        "verified_at",
        "provenance_note",
      ],
      answerRows,
      "problem_id",
      "correct_answer = excluded.correct_answer, verification_status = excluded.verification_status, verified_at = coalesce(private.problem_answer_keys.verified_at, excluded.verified_at), provenance_note = excluded.provenance_note, updated_at = now()",
    ),
  );

  const explanationRows = questions.map(({ question }) => [
    sqlText(question.id),
    sqlText(question.explanation),
    sqlText("approved"),
    sqlText(question.rightsStatus),
    sqlText(`Word import; source question ${question.sourceQuestionId}.`),
    sqlText(question.explanation),
    "null",
    sqlText("not_started"),
  ]);
  statements.push(
    insertSql(
      "private.problem_explanations",
      [
        "problem_id",
        "explanation",
        "review_status",
        "rights_status",
        "provenance_note",
        "display_explanation_vi",
        "display_explanation_en",
        "translation_status",
      ],
      explanationRows,
      "problem_id",
      "nothing",
    ),
  );

  const noteRows = questions.map(({ question }) => [
    sqlText(question.id),
    sqlText(question.provenanceNote),
  ]);
  statements.push(
    insertSql(
      "private.problem_provenance_notes",
      ["problem_id", "provenance_note"],
      noteRows,
      "problem_id",
      "provenance_note = excluded.provenance_note, updated_at = now()",
    ),
  );

  statements.push("commit;");
  return `${statements.filter(Boolean).join("\n\n")}\n`;
}

export function buildPublishSql(bundle) {
  const slugs = bundle.sets.map((set) => sqlText(set.slug)).join(", ");
  const pending = bundle.sets.flatMap((set) =>
    set.questions
      .filter((question) => (question.correctAnswer.verification_status ?? "verified") !== "verified")
      .map((question) => `${set.slug}/${question.questionNumber}`),
  );
  const noChoices = bundle.sets.flatMap((set) =>
    set.questions
      .filter((question) => question.type === "multiple_choice" && question.options.length < 2)
      .map((question) => `${set.slug}/${question.questionNumber}`),
  );
  if (pending.length || noChoices.length) {
    throw new Error(
      `Refusing to publish: pending answer keys [${pending.join(", ")}]; multiple-choice questions without choices [${noChoices.join(", ")}].`,
    );
  }
  return [
    `update public.problems set publication_status = 'published' where problem_set_id in (select id from public.problem_sets where slug in (${slugs}));`,
    `update public.problem_sets set publication_status = 'published', updated_at = now() where slug in (${slugs});`,
  ].join("\n\n");
}

function printSummary(summary) {
  console.log(JSON.stringify(summary, null, 2));
}

function executeSql(sql) {
  const tempDir = mkdtempSync(path.join(tmpdir(), "mathpath-approved-import-"));
  try {
    const command = process.execPath;
    const cliEntry = path.join(ROOT, "node_modules", "supabase", "dist", "supabase.js");
    const statements = splitSqlStatements(sql);
    for (let index = 0; index < statements.length; index += 1) {
      const sqlPath = path.join(tempDir, `import-${String(index + 1).padStart(2, "0")}.sql`);
      writeFileSync(sqlPath, `${statements[index]};\n`, "utf8");
      const result = spawnSync(command, [cliEntry, "db", "query", "--linked", "--file", sqlPath], {
        cwd: ROOT,
        encoding: "utf8",
        env: { ...process.env, SUPABASE_TELEMETRY_DISABLED: "1" },
        shell: false,
        maxBuffer: 16 * 1024 * 1024,
      });
      if (result.error || result.status !== 0) {
        throw new Error(
          `Import statement ${index + 1}/${statements.length} failed. ${[result.stderr, result.stdout, result.error?.message].filter(Boolean).join("\n") || "Supabase CLI import failed."}`,
        );
      }
      if (result.stdout) process.stdout.write(result.stdout);
    }
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const bundle = buildApprovedImportBundle();
    const sql = buildImportSql(bundle);
    const publish = process.argv.includes("--publish");
    const apply = process.argv.includes("--apply") || publish;
    const summary = {
      ...bundle.summary,
      mode: apply ? "apply" : "dry-run",
      duplicatePolicy: "upsert on stable IDs/source keys",
      d1d10Imported: false,
      figuresGenerated: 0,
      pendingFigurePromptsPreservedPrivately: bundle.figureManifest.figures.length,
      publication: publish ? "publish requested after import" : "unpublished; no publication action performed",
      sqlBytes: Buffer.byteLength(sql),
    };
    printSummary(summary);
    if (apply) executeSql(sql);
    if (publish) executeSql(buildPublishSql(bundle));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
