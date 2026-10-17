"use client";

import Link from "next/link";
import type { Route } from "next";
import { useLocale } from "@/components/providers/locale-provider";
import { Card } from "@/components/ui/card";
import type { StudentAttemptResult } from "@/lib/analytics/types";
import {
  getAcceptedAnswers,
  getShortAnswer,
  getTrueFalseAnswer,
  isCorrectOption,
  isSelectedOption,
} from "@/lib/analytics/question-review";

export function StudentAttemptResultExperience({ attempt }: { attempt: StudentAttemptResult }) {
  const { locale, messages } = useLocale();
  const copy = messages.progress;
  const result = attempt.result;
  const weakest = [...result.knowledgeOutcomes].sort(
    (a, b) =>
      b.incorrectCount +
      b.partialCount +
      b.unansweredCount -
      (a.incorrectCount + a.partialCount + a.unansweredCount),
  )[0];
  const weakCount = weakest
    ? weakest.incorrectCount + weakest.partialCount + weakest.unansweredCount
    : 0;
  const topicQuestions = weakest
    ? result.questionOutcomes.filter((item) => item.topic === weakest.topic)
    : [];
  const correctInWeakTopic = topicQuestions.filter((item) => item.state === "correct").length;
  const accuracy =
    weakCount && topicQuestions.length
      ? Math.round((correctInWeakTopic / topicQuestions.length) * 100)
      : null;
  return (
    <main className="page-shell analytics-page analytics-result-page" id="main-content">
      <header className="analytics-page-heading">
        <Link className="analytics-back-link" href={"/progress" as Route}>
          ← {copy.resultBack}
        </Link>
        <p className="eyebrow">{copy.resultTitle}</p>
        <h1>{attempt.examTitle}</h1>
        <p>
          {formatDateTime(attempt.submittedAt, locale)} ·{" "}
          {attempt.status === "submitted" ? copy.submitted : copy.autoSubmitted}
        </p>
      </header>
      <Card className="analytics-result-score-card">
        <span>{copy.score}</span>
        <strong>
          {formatNumber((result.score * 10) / Math.max(result.totalScore, 0.0001), locale)}
          <small>/10</small>
        </strong>
        <div className="analytics-result-counts">
          <span>
            {copy.correct}: {result.correctCount}
          </span>
          <span>
            {copy.partial}: {result.partialCount}
          </span>
          <span>
            {copy.incorrect}: {result.incorrectCount}
          </span>
          <span>
            {messages.exam.unansweredCount}: {result.unansweredCount}
          </span>
        </div>
      </Card>
      <section className="result-ai-next-steps" aria-labelledby="result-ai-heading">
        <div className="result-ai-heading">
          <p className="eyebrow">{locale === "vi" ? "BƯỚC TIẾP THEO" : "YOUR NEXT STEP"}</p>
          <h2 id="result-ai-heading">{messages.ai.resultNextTitle}</h2>
          <p>
            {weakCount ? messages.ai.resultWeakTopic : messages.ai.resultNoWeakTopic}
            {weakCount && weakest ? (
              <>
                : <strong>{weakest.topic}</strong>
              </>
            ) : null}
            {accuracy === null ? "" : ` · ${locale === "vi" ? "đúng" : "accuracy"} ${accuracy}%`}
          </p>
        </div>
        <div className="result-ai-cards">
          <Card className="result-ai-card result-ai-card--analysis">
            <span className="result-ai-card-icon" aria-hidden="true">
              ✳
            </span>
            <div>
              <h3>{locale === "vi" ? "Phân tích điểm yếu bằng AI" : "AI weakness analysis"}</h3>
              <p>
                {locale === "vi"
                  ? "Tìm chủ đề bạn nên ưu tiên và nhận gợi ý ôn tập dựa trên bài vừa làm."
                  : "Find topics to focus on and get a study plan based on this attempt."}
              </p>
            </div>
            <Link
              className="button button--secondary button--small"
              href={
                `/ai?mode=recommendation&attemptId=${encodeURIComponent(attempt.attemptId)}` as Route
              }
            >
              {messages.ai.getStudyAdvice}
              <span aria-hidden="true"> →</span>
            </Link>
          </Card>
          <Card className="result-ai-card result-ai-card--practice">
            <span className="result-ai-card-icon" aria-hidden="true">
              ↗
            </span>
            <div>
              <h3>{locale === "vi" ? "Luyện tập cùng AI" : "Practice with AI"}</h3>
              <p>
                {locale === "vi"
                  ? "Tạo câu tương tự để gỡ từng dạng bài, có lời giải sau khi bạn thử sức."
                  : "Try a similar problem, then review a step-by-step explanation."}
              </p>
            </div>
            <Link
              className="button button--primary button--small"
              href={`/ai?mode=practice&attemptId=${encodeURIComponent(attempt.attemptId)}` as Route}
            >
              {messages.ai.practiceWithAI}
              <span aria-hidden="true"> →</span>
            </Link>
          </Card>
        </div>
      </section>
      <section className="analytics-primary-grid">
        <Card className="analytics-panel">
          <p className="eyebrow">{copy.sectionBreakdown}</p>
          <h2>{copy.sectionBreakdown}</h2>
          <div className="analytics-result-section-list">
            {result.sectionOutcomes.map((section) => (
              <div key={section.sectionId}>
                <span>{section.title}</span>
                <strong>
                  {formatNumber(section.pointsEarned, locale)} /{" "}
                  {formatNumber(section.pointsPossible, locale)}
                </strong>
              </div>
            ))}
          </div>
        </Card>
        <Card className="analytics-panel">
          <p className="eyebrow">{copy.knowledgeBreakdown}</p>
          <h2>{copy.knowledgeBreakdown}</h2>
          {result.knowledgeOutcomes.length === 0 ? (
            <p className="analytics-empty-message">{copy.noTopicData}</p>
          ) : (
            <div className="analytics-result-section-list">
              {result.knowledgeOutcomes.map((topic, index) => {
                const correct = result.questionOutcomes.filter(
                  (item) =>
                    item.topic === topic.topic &&
                    item.subtopic === topic.subtopic &&
                    item.state === "correct",
                ).length;
                return (
                  <div key={`${topic.topic}-${topic.subtopic ?? ""}-${index}`}>
                    <span>
                      {topic.topic}
                      {topic.subtopic ? ` · ${topic.subtopic}` : ""}
                    </span>
                    <strong>
                      {correct}/{topic.questionCount} {copy.correct.toLowerCase()} ·{" "}
                      {topic.incorrectCount} {copy.incorrect.toLowerCase()}
                    </strong>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </section>
      <Card className="analytics-panel analytics-question-results">
        <p className="eyebrow">{messages.exam.question}</p>
        <h2>{messages.exam.resultHeading}</h2>
        <div className="analytics-question-result-grid">
          {result.questionOutcomes.map((question) => (
            <article
              key={question.questionId}
              className={`analytics-question-result analytics-question-result--${question.state}`}
            >
              <span>
                {messages.exam.question} {question.questionNumber}
              </span>
              <strong>
                {question.state === "correct"
                  ? copy.correct
                  : question.state === "partially_correct"
                    ? copy.partial
                    : question.state === "incorrect"
                      ? copy.incorrect
                      : messages.exam.unansweredCount}
              </strong>
              {question.topic ? (
                <small>
                  {question.topic}
                  {question.subtopic ? ` · ${question.subtopic}` : ""}
                </small>
              ) : null}
              <small>
                {formatNumber(question.pointsEarned, locale)} /{" "}
                {formatNumber(question.pointsPossible, locale)}
              </small>
              {question.review ? (
                <div className="analytics-question-review">
                  {question.review.statement ? <p>{question.review.statement}</p> : null}
                  {question.review.questionType === "multiple_choice" &&
                  !question.review.selectedAnswer ? (
                    <p>
                      <strong>{copy.yourAnswer}: </strong>
                      {copy.noAnswer}
                    </p>
                  ) : null}
                  {question.review.options.length ? (
                    <ul>
                      {question.review.options.map((option) => {
                        const selected = isSelectedOption(
                          question.review?.selectedAnswer,
                          option.key,
                        );
                        const correct = isCorrectOption(question.review?.correctAnswer, option.key);
                        return (
                          <li
                            key={option.key}
                            className={
                              correct ? "is-correct-answer" : selected ? "is-selected-answer" : ""
                            }
                          >
                            <strong>{option.key}.</strong> {option.text}
                            {selected ? ` · ${copy.yourAnswer}` : ""}
                            {correct ? ` · ${copy.correctAnswer}` : ""}
                          </li>
                        );
                      })}
                    </ul>
                  ) : null}
                  {question.review.questionType === "multiple_choice" &&
                  !question.review.correctAnswer ? (
                    <p>{copy.answerKeyUnavailable}</p>
                  ) : null}
                  {question.review.substatements.map((item) => {
                    const selected = getTrueFalseAnswer(question.review?.selectedAnswer, item.key);
                    const correct = getTrueFalseAnswer(question.review?.correctAnswer, item.key);
                    return (
                      <p key={item.key}>
                        <strong>{item.key.toUpperCase()}.</strong> {item.text}
                        <br />
                        {copy.yourAnswer}:{" "}
                        {selected === null ? copy.noAnswer : formatBoolean(selected, locale)}
                        {correct === null
                          ? ""
                          : ` · ${copy.correctAnswer}: ${formatBoolean(correct, locale)}`}
                      </p>
                    );
                  })}
                  {question.review.questionType === "true_false" &&
                  !question.review.correctAnswer ? (
                    <p>{copy.answerKeyUnavailable}</p>
                  ) : null}
                  {question.review.questionType === "short_answer" ? (
                    <p>
                      <strong>{copy.yourAnswer}: </strong>
                      {getShortAnswer(question.review.selectedAnswer) ?? copy.noAnswer}
                      {getAcceptedAnswers(question.review.correctAnswer).length ? (
                        <>
                          <br />
                          <strong>{copy.correctAnswer}: </strong>
                          {getAcceptedAnswers(question.review.correctAnswer).join(" / ")}
                        </>
                      ) : null}
                    </p>
                  ) : null}
                  {question.review.questionType === "short_answer" &&
                  !getAcceptedAnswers(question.review.correctAnswer).length ? (
                    <p>{copy.answerKeyUnavailable}</p>
                  ) : null}
                  <p>
                    <strong>{copy.explanation}: </strong>
                    {question.review.explanation || copy.noExplanation}
                  </p>
                </div>
              ) : null}
            </article>
          ))}
        </div>
      </Card>
    </main>
  );
}

function formatBoolean(value: boolean, locale: "vi" | "en") {
  return locale === "vi" ? (value ? "Đúng" : "Sai") : value ? "True" : "False";
}

function formatNumber(value: number, locale: "vi" | "en") {
  return value.toLocaleString(locale === "vi" ? "vi-VN" : "en-US", { maximumFractionDigits: 2 });
}

function formatDateTime(value: string, locale: "vi" | "en") {
  return new Intl.DateTimeFormat(locale === "vi" ? "vi-VN" : "en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(new Date(value));
}
