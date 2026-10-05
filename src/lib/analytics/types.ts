export type AttemptTrendPoint = {
  attemptId: string;
  examTitle: string;
  submittedAt: string;
  score: number;
};

export type TopicProgress = {
  topic: string;
  questionCount: number;
  correctCount: number;
  partialCount: number;
  incorrectCount: number;
  unansweredCount: number;
  accuracy: number | null;
};

export type StudentAttemptHistoryItem = {
  attemptId: string;
  examSlug: string | null;
  examTitle: string;
  submittedAt: string;
  status: "submitted" | "auto_submitted";
  score: number;
  rawScore: number;
  totalScore: number;
  correctCount: number;
  partialCount: number;
  incorrectCount: number;
  unansweredCount: number;
  questionCount: number;
  durationSeconds: number | null;
};

export type StudentProgress = {
  targetScore: number | null;
  totalAttempts: number;
  averageScore: number | null;
  questionsAttempted: number;
  correctCount: number;
  partialCount: number;
  incorrectCount: number;
  trend: AttemptTrendPoint[];
  topics: TopicProgress[];
  historyTotal: number;
  history: StudentAttemptHistoryItem[];
};

export type ImproveWithAiContext = {
  feature: "progress_weak_topic";
  weakTopic: string | null;
  accuracyPercent: number | null;
  targetScore: number | null;
  currentAverage: number | null;
  sourceAttemptCount: number;
  locale: "vi" | "en";
};

export type AdminDailyActivity = {
  date: string;
  activeUsers: number;
  submissions: number;
};

export type AdminScoreTrend = {
  date: string;
  submissions: number;
  averageScore: number;
};

export type AdminUserActivity = {
  userId: string;
  email: string | null;
  displayName: string;
  attempts: number;
  questionsAttempted: number;
  averageScore: number | null;
};

export type AdminAnalytics = {
  totalAccounts: number;
  totalVip: number;
  totalAttempts: number;
  averageScore: number | null;
  completedAttempts: number;
  submissionRate: number | null;
  averageAttemptsPerAccount: number | null;
  subscriptions: { free: number; plus: number; pro: number; proMax: number; otherVip: number };
  targetDistribution: { bucket: number; label: string; count: number }[];
  dailyActivity: AdminDailyActivity[];
  scoreTrend: AdminScoreTrend[];
  users: AdminUserActivity[];
};

export type StudentAttemptResult = {
  attemptId: string;
  examSlug: string | null;
  examTitle: string;
  submittedAt: string;
  status: "submitted" | "auto_submitted";
  result: {
    score: number;
    totalScore: number;
    correctCount: number;
    partialCount: number;
    incorrectCount: number;
    unansweredCount: number;
    questionCount: number;
    percentage: number;
    questionOutcomes: {
      questionId: string;
      sectionId: string;
      questionNumber: string;
      topic: string | null;
      subtopic: string | null;
      state: "unanswered" | "correct" | "partially_correct" | "incorrect";
      pointsEarned: number;
      pointsPossible: number;
    }[];
    sectionOutcomes: {
      sectionId: string;
      title: string;
      pointsEarned: number;
      pointsPossible: number;
    }[];
    knowledgeOutcomes: {
      topic: string;
      subtopic: string | null;
      questionCount: number;
      incorrectCount: number;
      partialCount: number;
      unansweredCount: number;
    }[];
  };
};
