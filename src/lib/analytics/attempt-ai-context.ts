import type { StudentAttemptResult } from "./types";

type AttemptQuestionOutcome = StudentAttemptResult["result"]["questionOutcomes"][number];

export function buildAttemptAiContext(
  attempt: StudentAttemptResult,
  questionIds: string[],
  allowCorrectQuestions = false,
): string | null {
  if (questionIds.length === 0 || questionIds.length > 8 || new Set(questionIds).size !== questionIds.length) {
    return null;
  }

  const outcomesById = new Map(attempt.result.questionOutcomes.map((outcome) => [outcome.questionId, outcome]));
  const selected: AttemptQuestionOutcome[] = [];
  for (const questionId of questionIds) {
    const outcome = outcomesById.get(questionId);
    if (!outcome || (!allowCorrectQuestions && outcome.state === "correct") || !outcome.review) {
      return null;
    }
    selected.push(outcome);
  }

  return JSON.stringify(
    {
      examTitle: attempt.examTitle,
      questions: selected.map((outcome) => ({
        questionId: outcome.questionId,
        questionNumber: outcome.questionNumber,
        topic: outcome.topic,
        subtopic: outcome.subtopic,
        questionType: outcome.review?.questionType,
        statement: outcome.review?.statement,
        options: outcome.review?.options,
        substatements: outcome.review?.substatements,
        figureDescriptions: outcome.review?.assets.map((asset) => asset.altText) ?? [],
        figureAccess: "descriptions_only_do_not_infer_unseen_geometry",
        gradingStatus: outcome.gradingStatus ?? "graded",
        studentAnswer: outcome.review?.selectedAnswer,
        verifiedCorrectAnswer: outcome.review?.correctAnswer,
        explanation: outcome.review?.explanation,
        pointsEarned: outcome.pointsEarned,
        pointsPossible: outcome.pointsPossible,
      })),
    },
    null,
    2,
  );
}
