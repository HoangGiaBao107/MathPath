export type PreviewQuestionType = "multiple_choice" | "true_false" | "short_answer";

export type PreviewQuestion = {
  id: string;
  section: string | null;
  sectionLabel: { vi: string; en: string };
  questionNumber: string;
  orderIndex: number;
  practiceOrder?: number;
  questionType: PreviewQuestionType;
  statement: string;
  options: Array<{ key: string; text: string; orderIndex: number }>;
  substatements: Array<{ key: string; text: string; orderIndex: number }>;
  source: {
    slug: string;
    file: string;
    questionId: string;
    questionNumber: string;
    pages: number[];
    crop: string | null;
    cropWidth: number | null;
    cropHeight: number | null;
    extractionStatus: string;
    warnings: string[];
    reviewStatus: "unverified_preview";
    figureStatus: string;
    figureKind: "original_question_crop" | "generated_illustration" | "unavailable";
    generationStatus: "not_generated";
  };
};

export type PreviewSourcePage = { page: number; image: string; width: number; height: number };

export type SourceExamPreview = {
  slug: string;
  title: string;
  sourceFile: string;
  sourceKind: "exam_source" | "word_import";
  previewStatus: "unresolved" | "review_preview";
  processingStatus: string;
  visibleQuestionCount: number;
  warningCount: number;
  reportWarnings: string[];
  sourcePageCount: number;
  unresolvedQuestionCount: number;
  answerKeyPagesExcluded: number[];
  sourcePages?: PreviewSourcePage[];
  unresolvedReason?: string;
  questions: PreviewQuestion[];
};

export type TopicPreviewExam = {
  slug: "multiple-choice" | "true-false" | "short-answer";
  title: string;
  questionType: PreviewQuestionType;
  sourceFiles: string[];
  previewStatus: "review_preview_unverified";
  scoring: {
    questionCount: number;
    pointsPerQuestion: number | null;
    maximumScore: number | null;
    grading: string;
    correctPoints: number | null;
    incorrectPoints: number | null;
    unansweredPoints: number | null;
    previewOnly: true;
    answerChecking: false;
  };
  questions: PreviewQuestion[];
};

export type TopicSelectionManifest = {
  selectionSeed: string;
  selectionVersion: number;
  previewOnly: boolean;
  officiallyVerified: boolean;
  answerKeysIncluded: boolean;
  uniqueSourceQuestionCount: number;
  exams: Record<
    string,
    {
      questionType: PreviewQuestionType;
      questionCount: number;
      scoring: TopicPreviewExam["scoring"];
      questions: Array<{
        sourceSlug: string;
        sourceFile: string;
        sourceQuestionId: string;
        sourceQuestionNumber: string;
        sourceOrderIndex: number;
        sourcePages: number[];
      }>;
    }
  >;
};

export type StudentPreviewData = {
  formatVersion: number;
  previewOnly: true;
  notOfficiallyVerified: true;
  answersIncluded: false;
  exams: SourceExamPreview[];
  topicPractice: {
    slug: string;
    title: string;
    previewStatus: "review_preview_unverified";
    selectionSeed: string;
    selectionManifest: TopicSelectionManifest;
    exams: TopicPreviewExam[];
  };
};
