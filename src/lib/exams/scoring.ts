import { normalizeShortAnswer } from "./short-answer";
import type { ExamAnswer, ExamDefinition, ExamScore, QuestionOutcome } from "./types";

function isAnswered(answer: ExamAnswer | null | undefined): boolean {
  if (!answer) return false;
  if (answer.type === "short_answer") return answer.raw.trim().length > 0;
  if (answer.type === "multiple_choice") return answer.optionKey.length > 0;
  return Object.keys(answer.statements).length > 0;
}

export function scoreExam(
  exam: ExamDefinition,
  answers: Record<string, ExamAnswer | null | undefined>,
): ExamScore {
  const questionOutcomes: QuestionOutcome[] = exam.questions.map((question) => {
    const answer = answers[question.id] ?? null;
    if (!isAnswered(answer)) {
      return {
        questionId: question.id,
        sectionId: question.sectionId,
        questionNumber: question.number,
        topic: question.topic ?? null,
        subtopic: question.subtopic ?? null,
        state: "unanswered",
        pointsEarned: 0,
        pointsPossible: question.points,
      };
    }

    let earned = 0;
    if (question.type === "multiple_choice" && answer?.type === "multiple_choice") {
      earned = answer.optionKey === question.correctOptionKey ? question.points : 0;
    } else if (question.type === "true_false" && answer?.type === "true_false") {
      const correctCount = question.statements.reduce(
        (count, statement) =>
          count +
          Number(answer.statements[statement.key] === question.correctStatements[statement.key]),
        0,
      );
      if (question.scoring.kind === "all_or_nothing") {
        earned = correctCount === question.statements.length ? question.points : 0;
      } else {
        earned = question.scoring.pointsByCorrectCount[correctCount] ?? 0;
      }
    } else if (question.type === "short_answer" && answer?.type === "short_answer") {
      const accepted = question.acceptedNormalizedAnswers ?? [question.canonicalAnswer];
      const normalizedAccepted = accepted.map(normalizeShortAnswer);
      earned = normalizedAccepted.includes(normalizeShortAnswer(answer.raw)) ? question.points : 0;
    }

    return {
      questionId: question.id,
      sectionId: question.sectionId,
      questionNumber: question.number,
      topic: question.topic ?? null,
      subtopic: question.subtopic ?? null,
      state: earned >= question.points ? "correct" : earned > 0 ? "partially_correct" : "incorrect",
      pointsEarned: earned,
      pointsPossible: question.points,
    };
  });

  const sectionOutcomes = exam.sections.map((section) => {
    const sectionQuestions = questionOutcomes.filter((item) => item.sectionId === section.id);
    return {
      sectionId: section.id,
      title: section.title,
      pointsEarned: sectionQuestions.reduce((sum, item) => sum + item.pointsEarned, 0),
      pointsPossible: section.maxScore,
    };
  });
  const correctCount = questionOutcomes.filter((item) => item.state === "correct").length;
  const partialCount = questionOutcomes.filter((item) => item.state === "partially_correct").length;
  const unansweredCount = questionOutcomes.filter((item) => item.state === "unanswered").length;
  const score = questionOutcomes.reduce((sum, item) => sum + item.pointsEarned, 0);
  const knowledge = new Map<string, ExamScore["knowledgeOutcomes"][number]>();
  for (const outcome of questionOutcomes) {
    if (!outcome.topic) continue;
    const key = `${outcome.topic}\u0000${outcome.subtopic ?? ""}`;
    const current = knowledge.get(key) ?? {
      topic: outcome.topic,
      subtopic: outcome.subtopic,
      questionCount: 0,
      incorrectCount: 0,
      partialCount: 0,
      unansweredCount: 0,
    };
    current.questionCount += 1;
    if (outcome.state === "incorrect") current.incorrectCount += 1;
    if (outcome.state === "partially_correct") current.partialCount += 1;
    if (outcome.state === "unanswered") current.unansweredCount += 1;
    knowledge.set(key, current);
  }

  return {
    score: roundScore(score),
    totalScore: exam.totalScore,
    correctCount,
    partialCount,
    incorrectCount: questionOutcomes.length - correctCount - partialCount - unansweredCount,
    unansweredCount,
    questionCount: questionOutcomes.length,
    percentage: exam.totalScore > 0 ? roundScore((score / exam.totalScore) * 100) : 0,
    questionOutcomes,
    sectionOutcomes,
    knowledgeOutcomes: [...knowledge.values()],
  };
}

function roundScore(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
