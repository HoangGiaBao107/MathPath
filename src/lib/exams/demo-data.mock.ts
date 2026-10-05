import { REAL_EXAM_TIME_LIMIT_SECONDS } from "../config/exam.ts";
import type {
  ExamDefinition,
  ExamQuestion,
  ExamSection,
  ExamPublicSummary,
  SafeExamQuestion,
} from "./types";

const multipleChoiceQuestions: ExamQuestion[] = [
  ["3 + 4", 7],
  ["12 − 5", 7],
  ["6 × 3", 18],
  ["20 ÷ 4", 5],
  ["2² + 1", 5],
  ["15 − 8", 7],
  ["9 + 6", 15],
  ["4 × 5", 20],
  ["18 ÷ 3", 6],
  ["7 + 8", 15],
  ["3²", 9],
  ["24 ÷ 6", 4],
].map(([stem, answer], index) => {
  const expected = Number(answer);
  return {
    id: `demo-official-mcq-${index + 1}`,
    sectionId: "part-1",
    number: String(index + 1),
    type: "multiple_choice" as const,
    stem: `Tính nhanh: ${stem} = ?`,
    options: [expected, expected + 1, Math.max(0, expected - 1), expected + 2].map(
      (value, optionIndex) => ({ key: "ABCD"[optionIndex], text: String(value) }),
    ),
    points: 0.25,
    correctOptionKey: "A",
  };
});

const officialTrueFalsePatterns = [
  [true, true, true, true],
  [true, true, false, true],
  [true, false, true, false],
  [false, false, false, true],
];

const officialTrueFalseQuestions: ExamQuestion[] = officialTrueFalsePatterns.map(
  (pattern, index) => ({
    id: `demo-official-tf-${index + 1}`,
    sectionId: "part-2",
    number: String(index + 13),
    type: "true_false" as const,
    stem: `Xét các nhận định trong câu ${index + 1} (dữ liệu minh họa).`,
    statements: ["a", "b", "c", "d"].map((key, statementIndex) => {
      const left = statementIndex + 2;
      const right = statementIndex + 1;
      const result = left + right + (pattern[statementIndex] ? 0 : 1);
      return { key, text: `Nhận định ${key}: ${left} + ${right} = ${result}.` };
    }),
    points: 1,
    correctStatements: Object.fromEntries(["a", "b", "c", "d"].map((key, i) => [key, pattern[i]])),
    scoring: { kind: "partial" as const, pointsByCorrectCount: [0, 0.1, 0.25, 0.5, 1] },
  }),
);

const officialShortAnswerItems = [
  ["Tính 2 × 3.", "6"],
  ["Tính 9 + 6.", "15"],
  ["Tính 1 ÷ 2. Ghi số thập phân bằng dấu phẩy.", "0,5"],
  ["Tìm nghiệm của phương trình x + 3 = 0.", "-3"],
  ["Tính 5 ÷ 2. Ghi số thập phân bằng dấu phẩy.", "2,5"],
  ["Tính 4 × 2.", "8"],
];
const officialShortAnswerQuestions: ExamQuestion[] = officialShortAnswerItems.map(
  ([stem, canonicalAnswer], index) => ({
    id: `demo-official-short-${index + 1}`,
    sectionId: "part-3",
    number: String(index + 17),
    type: "short_answer" as const,
    stem,
    points: 0.5,
    canonicalAnswer,
  }),
);

function buildSection(
  id: string,
  title: string,
  description: string,
  questions: ExamQuestion[],
  maxScore: number,
): ExamSection {
  return { id, title, description, maxScore };
}

const officialQuestions = [
  ...multipleChoiceQuestions,
  ...officialTrueFalseQuestions,
  ...officialShortAnswerQuestions,
];

const officialSections = [
  buildSection(
    "part-1",
    "Phần I · Trắc nghiệm",
    "12 câu chọn một đáp án",
    multipleChoiceQuestions,
    3,
  ),
  buildSection(
    "part-2",
    "Phần II · Đúng / Sai",
    "4 câu, mỗi câu gồm 4 nhận định",
    officialTrueFalseQuestions,
    4,
  ),
  buildSection(
    "part-3",
    "Phần III · Trả lời ngắn",
    "6 câu trả lời ngắn",
    officialShortAnswerQuestions,
    3,
  ),
];

const practiceMultipleChoice: ExamQuestion[] = Array.from({ length: 10 }, (_, index) => {
  const left = index + 2;
  const right = index + 3;
  const answer = left + right;
  return {
    id: `demo-practice-mcq-${index + 1}`,
    sectionId: "practice",
    number: String(index + 1),
    type: "multiple_choice",
    stem: `Tính ${left} + ${right}.`,
    options: [answer, answer + 1, answer - 1, answer + 2].map((value, i) => ({
      key: "ABCD"[i],
      text: String(value),
    })),
    points: 0.5,
    correctOptionKey: "A",
  };
});

const practiceTrueFalse: ExamQuestion[] = Array.from({ length: 5 }, (_, index) => ({
  id: `demo-practice-tf-${index + 1}`,
  sectionId: "practice",
  number: String(index + 11),
  type: "true_false",
  stem: `Kiểm tra các nhận định ${index + 1} (dữ liệu minh họa).`,
  statements: ["a", "b", "c", "d"].map((key, statementIndex) => ({
    key,
    text: `${statementIndex + 1} + ${index + 1} = ${statementIndex + index + 2}.`,
  })),
  points: 0.5,
  correctStatements: { a: true, b: true, c: true, d: true },
  scoring: { kind: "all_or_nothing" },
}));

const practiceShortAnswers: ExamQuestion[] = ["10", "12", "14", "16", "18"].map(
  (canonicalAnswer, index) => ({
    id: `demo-practice-short-${index + 1}`,
    sectionId: "practice",
    number: String(index + 16),
    type: "short_answer",
    stem: `Tính ${index + 5} × 2.`,
    points: 0.5,
    canonicalAnswer,
  }),
);

const practiceQuestions = [
  ...practiceMultipleChoice,
  ...practiceTrueFalse,
  ...practiceShortAnswers,
];

export const mockExams: ExamDefinition[] = [
  {
    id: "demo-thptqg-format",
    title: "Bài kiểm tra engine · Cấu trúc THPTQG",
    description:
      "Bộ câu hỏi toán học tự tạo để kiểm thử cách tính điểm theo cấu hình THPTQG. Không phải đề thi chính thức.",
    mode: "official_thptqg",
    demo: true,
    timingMode: "countdown",
    durationSeconds: REAL_EXAM_TIME_LIMIT_SECONDS,
    totalScore: 10,
    sections: officialSections,
    questions: officialQuestions,
  },
  {
    id: "demo-practice-20",
    title: "Ôn luyện 20 câu · Bản demo",
    description:
      "20 câu minh họa, mỗi câu 0,5 điểm. Phần Đúng / Sai chỉ tính điểm khi cả bốn ý đều đúng.",
    mode: "practice",
    demo: true,
    timingMode: "elapsed",
    durationSeconds: null,
    totalScore: 10,
    sections: [
      buildSection(
        "practice",
        "Luyện tập tổng hợp",
        "20 câu · 0,5 điểm mỗi câu",
        practiceQuestions,
        10,
      ),
    ],
    questions: practiceQuestions,
  },
];

export function getMockExam(examId: string): ExamDefinition | null {
  return mockExams.find((exam) => exam.id === examId) ?? null;
}

export function toExamPublicSummary(exam: ExamDefinition): ExamPublicSummary {
  const { questions, ...summary } = exam;
  return { ...summary, questionCount: questions.length };
}

export function toSafeQuestion(question: ExamQuestion): SafeExamQuestion {
  if (question.type === "multiple_choice") {
    return {
      id: question.id,
      sectionId: question.sectionId,
      number: question.number,
      type: question.type,
      stem: question.stem,
      displayStemVi: question.displayStemVi,
      displayStemEn: question.displayStemEn,
      options: question.options,
      points: question.points,
    };
  }
  if (question.type === "true_false") {
    return {
      id: question.id,
      sectionId: question.sectionId,
      number: question.number,
      type: question.type,
      stem: question.stem,
      displayStemVi: question.displayStemVi,
      displayStemEn: question.displayStemEn,
      statements: question.statements,
      points: question.points,
    };
  }
  return {
    id: question.id,
    sectionId: question.sectionId,
    number: question.number,
    type: question.type,
    stem: question.stem,
    displayStemVi: question.displayStemVi,
    displayStemEn: question.displayStemEn,
    points: question.points,
  };
}
