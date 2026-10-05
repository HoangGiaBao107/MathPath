import topicPracticeData from "@/data/mathpath-topic-practice-exams.json";
import type { PreviewQuestion } from "./types";

type ImportedTopicQuestion = {
  id: string;
  sectionId: string;
  number: string;
  points: number;
  type: "multiple_choice" | "true_false" | "short_answer";
  stem: string;
  options?: Array<{ key: string; text: string }>;
  statements?: Array<{ key: string; text: string }>;
};

type ImportedTopicExam = {
  id: string;
  slug: string;
  title: string;
  description: string;
  topic: string;
  sourceFile: string;
  timingMode: "elapsed";
  totalScore: number;
  questionCount: number;
  sections: Array<{ id: string; title: string; description: string }>;
  questions: ImportedTopicQuestion[];
};

const exams = topicPracticeData.exams as ImportedTopicExam[];

export function listTopicPracticePreviews(): ImportedTopicExam[] {
  return exams;
}

export function getTopicPracticePreview(slug: string): ImportedTopicExam | null {
  return exams.find((exam) => exam.slug === slug) ?? null;
}

export function toPreviewQuestions(exam: ImportedTopicExam): PreviewQuestion[] {
  return exam.questions.map((question, index) => {
    const section = exam.sections.find((item) => item.id === question.sectionId);
    return {
      id: question.id,
      section: question.sectionId,
      sectionLabel: { vi: section?.title ?? "Câu hỏi", en: section?.title ?? "Questions" },
      questionNumber: question.number,
      orderIndex: index + 1,
      practiceOrder: index + 1,
      questionType: question.type,
      statement: question.stem,
      options: (question.options ?? []).map((option, orderIndex) => ({ ...option, orderIndex })),
      substatements: (question.statements ?? []).map((statement, orderIndex) => ({
        ...statement,
        orderIndex,
      })),
      source: {
        slug: exam.slug,
        file: exam.sourceFile,
        questionId: question.id,
        questionNumber: question.number,
        pages: [],
        crop: null,
        cropWidth: null,
        cropHeight: null,
        extractionStatus: "word_import_reviewed",
        warnings: [],
        reviewStatus: "unverified_preview",
        figureStatus: "not_required",
        figureKind: "unavailable",
        generationStatus: "not_generated",
      },
    };
  });
}
