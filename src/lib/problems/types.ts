export const problemSetCategories = [
  "mock_exam",
  "chapter_review",
  "topic_review",
  "comprehensive",
] as const;

export const problemDifficulties = ["easy", "medium", "hard", "mixed"] as const;

export type ProblemSetCategory = (typeof problemSetCategories)[number];
export type ProblemDifficulty = (typeof problemDifficulties)[number];
export type ProblemSetTimingMode = "countdown" | "elapsed";
export type QuestionType = "multiple_choice" | "true_false" | "short_answer";
export type ReviewStatus = "draft" | "needs_review" | "approved";
export type PublicationStatus = "draft" | "unpublished" | "published" | "archived";
export type PublicationRightsStatus =
  | "unknown"
  | "pending_review"
  | "approved_for_internal"
  | "approved_for_publication"
  | "restricted";
export type ProvenanceStatus = "source_imported" | "unknown" | "pending_review" | "verified";

export type IllustrationStatus =
  "not_required" | "present" | "possibly_missing" | "missing" | "needs_review";

export type PublicProblemSet = {
  id: string;
  slug: string;
  title: string;
  description: string;
  language: "vi" | "en";
  category: ProblemSetCategory;
  difficulty: ProblemDifficulty;
  topicNames: string[];
  questionCount: number;
  timingMode: ProblemSetTimingMode;
  timeLimitMinutes: number | null;
  estimatedDurationMinutes: number | null;
  examYear: number | null;
  examOrganization: string | null;
  examSession: string | null;
  publishedAt: string;
};

export type DemoProblemSet = PublicProblemSet & { isMock: true };

export type ProblemSetFilters = {
  query?: string;
  category?: ProblemSetCategory | "all";
  difficulty?: ProblemDifficulty | "all";
  sort?: "newest" | "title" | "question_count" | "duration";
  locale?: "vi" | "en";
};

export type ProblemSetPageQuery = ProblemSetFilters & {
  limit?: number;
  cursor?: string | null;
};

export type ProblemSetPage = {
  items: PublicProblemSet[];
  nextCursor: string | null;
  totalCount: number;
};

export interface ProblemSetRepository {
  listPublicProblemSets(query: ProblemSetPageQuery): Promise<ProblemSetPage>;
}

export type PracticeSessionOwner =
  { kind: "user"; userId: string } | { kind: "guest"; guestSessionHash: string };

export type PersistedPracticeSession = {
  id: string;
  owner: PracticeSessionOwner;
  topicId: string;
  questionIdsInOrder: string[];
  createdAt: string;
};

/** Implement later with one transaction that reuses an existing idempotent session. */
export interface PracticeSessionRepository {
  findByIdempotencyKey(
    owner: PracticeSessionOwner,
    key: string,
  ): Promise<PersistedPracticeSession | null>;
  createWithOrderedQuestions(input: {
    owner: PracticeSessionOwner;
    topicId: string;
    idempotencyKey: string;
    questionIdsInOrder: string[];
  }): Promise<PersistedPracticeSession>;
}
