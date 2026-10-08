export type ExamMode = "official_thptqg" | "practice" | "school_mock";
export type ExamTimingMode = "countdown" | "elapsed";

export type ExamOption = { key: string; text: string; displayTextEn?: string | null };
export type ExamStatement = { key: string; text: string; displayTextEn?: string | null };

export type MultipleChoiceQuestion = {
  id: string;
  sectionId: string;
  number: string;
  type: "multiple_choice";
  stem: string;
  topic?: string | null;
  subtopic?: string | null;
  displayStemVi?: string | null;
  displayStemEn?: string | null;
  options: ExamOption[];
  points: number;
  correctOptionKey: string;
};

export type TrueFalseQuestion = {
  id: string;
  sectionId: string;
  number: string;
  type: "true_false";
  stem: string;
  topic?: string | null;
  subtopic?: string | null;
  displayStemVi?: string | null;
  displayStemEn?: string | null;
  statements: ExamStatement[];
  points: number;
  correctStatements: Record<string, boolean>;
  scoring: { kind: "all_or_nothing" } | { kind: "partial"; pointsByCorrectCount: number[] };
};

export type ShortAnswerQuestion = {
  id: string;
  sectionId: string;
  number: string;
  type: "short_answer";
  stem: string;
  topic?: string | null;
  subtopic?: string | null;
  displayStemVi?: string | null;
  displayStemEn?: string | null;
  points: number;
  canonicalAnswer: string;
  acceptedNormalizedAnswers?: string[];
};

export type ExamQuestion = MultipleChoiceQuestion | TrueFalseQuestion | ShortAnswerQuestion;

export type ExamAnswer =
  | { type: "multiple_choice"; optionKey: string }
  | { type: "true_false"; statements: Record<string, boolean> }
  | { type: "short_answer"; raw: string };

export type ExamSection = {
  id: string;
  title: string;
  description: string;
  maxScore: number;
};

export type ExamDefinition = {
  id: string;
  title: string;
  description: string;
  mode: ExamMode;
  demo: boolean;
  timingMode: ExamTimingMode;
  durationSeconds: number | null;
  totalScore: number;
  sections: ExamSection[];
  questions: ExamQuestion[];
};

export type QuestionOutcome = {
  questionId: string;
  sectionId: string;
  questionNumber: string;
  topic: string | null;
  subtopic: string | null;
  state: "unanswered" | "correct" | "partially_correct" | "incorrect";
  pointsEarned: number;
  pointsPossible: number;
};

export type KnowledgeOutcome = {
  topic: string;
  subtopic: string | null;
  questionCount: number;
  incorrectCount: number;
  partialCount: number;
  unansweredCount: number;
};

export type SectionOutcome = {
  sectionId: string;
  title: string;
  pointsEarned: number;
  pointsPossible: number;
};

export type ExamScore = {
  score: number;
  totalScore: number;
  correctCount: number;
  partialCount: number;
  incorrectCount: number;
  unansweredCount: number;
  questionCount: number;
  percentage: number;
  questionOutcomes: QuestionOutcome[];
  sectionOutcomes: SectionOutcome[];
  knowledgeOutcomes: KnowledgeOutcome[];
};

export type ExamPublicSummary = Omit<ExamDefinition, "questions"> & {
  questionCount: number;
};

export type SafeExamQuestion =
  | Omit<MultipleChoiceQuestion, "correctOptionKey">
  | Omit<TrueFalseQuestion, "correctStatements" | "scoring">
  | Omit<ShortAnswerQuestion, "canonicalAnswer" | "acceptedNormalizedAnswers">;

export type AttemptStatus =
  "in_progress" | "submitted" | "auto_submitted" | "expired" | "abandoned";

export type AttemptOwner =
  { kind: "guest"; guestSessionHash: string } | { kind: "user"; userId: string };

export type AttemptAnswerState = {
  answer: ExamAnswer | null;
  markedForReview: boolean;
  updatedAt: string | null;
};

export type ExamAttempt = {
  id: string;
  examId: string;
  owner: AttemptOwner;
  status: AttemptStatus;
  questionIdsInOrder: string[];
  answers: Record<string, AttemptAnswerState>;
  startedAt: string;
  deadlineAt: string | null;
  submittedAt: string | null;
  durationSeconds: number | null;
  submitRequestId: string | null;
  result: ExamScore | null;
};

export type PublicExamAttempt = Omit<ExamAttempt, "owner"> & {
  exam: ExamPublicSummary;
  questions: SafeExamQuestion[];
};
