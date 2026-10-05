import type { ImproveWithAiContext, StudentProgress, TopicProgress } from "./types";

export type StudentPersonalization = {
  accuracyPercent: number | null;
  errorPercent: number | null;
  scoreGap: number | null;
  targetProgressPercent: number | null;
  weakestTopic: TopicProgress | null;
  strongestTopic: TopicProgress | null;
  scoreTrend: "improving" | "declining" | "stable" | "insufficient_data";
  nextPracticeTopic: string | null;
};

export function deriveStudentPersonalization(progress: StudentProgress): StudentPersonalization {
  const answered = progress.correctCount + progress.partialCount + progress.incorrectCount;
  const scoredErrors = progress.partialCount + progress.incorrectCount;
  const topics = progress.topics.filter(
    (topic) => topic.questionCount > 0 && topic.accuracy !== null,
  );
  const weakestTopic =
    [...topics].sort(
      (left, right) => left.accuracy! - right.accuracy! || right.questionCount - left.questionCount,
    )[0] ?? null;
  const strongestTopic =
    [...topics].sort(
      (left, right) => right.accuracy! - left.accuracy! || right.questionCount - left.questionCount,
    )[0] ?? null;
  const scores = progress.trend.map((point) => point.score);
  const scoreTrend = getScoreTrend(scores);
  const scoreGap =
    progress.targetScore === null || progress.averageScore === null
      ? null
      : round(progress.targetScore - progress.averageScore);

  return {
    accuracyPercent: answered ? round((progress.correctCount / answered) * 100, 1) : null,
    errorPercent: answered ? round((scoredErrors / answered) * 100, 1) : null,
    scoreGap,
    targetProgressPercent:
      progress.targetScore === null || progress.averageScore === null
        ? null
        : progress.targetScore === 0
          ? 100
          : Math.min(
              100,
              Math.max(0, round((progress.averageScore / progress.targetScore) * 100, 1)),
            ),
    weakestTopic,
    strongestTopic,
    scoreTrend,
    nextPracticeTopic: weakestTopic?.topic ?? null,
  };
}

export function createImproveWithAiContext(
  progress: StudentProgress,
  locale: "vi" | "en",
): ImproveWithAiContext {
  const summary = deriveStudentPersonalization(progress);
  return {
    feature: "progress_weak_topic",
    weakTopic: summary.weakestTopic?.topic ?? null,
    accuracyPercent: summary.weakestTopic?.accuracy ?? null,
    targetScore: progress.targetScore,
    currentAverage: progress.averageScore,
    sourceAttemptCount: progress.totalAttempts,
    locale,
  };
}

function getScoreTrend(scores: number[]): StudentPersonalization["scoreTrend"] {
  if (scores.length < 2) return "insufficient_data";
  const recent = scores.slice(-3);
  const previous = scores.slice(Math.max(0, scores.length - 6), Math.max(0, scores.length - 3));
  if (!previous.length) {
    return recent.at(-1)! > recent[0]!
      ? "improving"
      : recent.at(-1)! < recent[0]!
        ? "declining"
        : "stable";
  }
  const recentAverage = recent.reduce((sum, score) => sum + score, 0) / recent.length;
  const previousAverage = previous.reduce((sum, score) => sum + score, 0) / previous.length;
  if (recentAverage - previousAverage >= 0.15) return "improving";
  if (previousAverage - recentAverage >= 0.15) return "declining";
  return "stable";
}

function round(value: number, digits = 2): number {
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}
