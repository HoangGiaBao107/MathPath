"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useLocale } from "@/components/providers/locale-provider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { MathContentView } from "@/components/problems/math-content-view";
import type { LocalReviewQuestion } from "@/lib/problems/ingestion-review.server";

type PreviewQuestion = Pick<
  LocalReviewQuestion,
  | "id"
  | "section"
  | "question_number"
  | "order_index"
  | "statement"
  | "display_statement_vi"
  | "display_options_vi"
  | "display_true_false_statements_vi"
  | "question_type"
  | "options"
  | "substatements"
  | "source_page"
  | "image_path"
  | "illustration_status"
  | "extraction_warnings"
>;

export function LocalExamPreview({
  slug,
  title,
  questions,
}: {
  slug: string;
  title: string;
  questions: PreviewQuestion[];
}) {
  const { locale, messages } = useLocale();
  const copy = messages.pdfReview;
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string | Record<string, boolean>>>({});
  const [marked, setMarked] = useState<Record<string, boolean>>({});
  const [secondsLeft, setSecondsLeft] = useState(90 * 60);
  const current = questions[currentIndex];
  const answeredCount = useMemo(() => Object.keys(answers).length, [answers]);

  useEffect(() => {
    const deadline = Date.now() + 90 * 60 * 1000;
    const refresh = () => setSecondsLeft(Math.max(0, Math.ceil((deadline - Date.now()) / 1000)));
    refresh();
    const interval = window.setInterval(refresh, 1000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);

  if (!current) return null;

  const currentAnswer = answers[current.id];
  const sectionLabel = (section: string | null) => {
    if (locale === "vi") {
      return section === "part_1"
        ? "Phần I · Trắc nghiệm"
        : section === "part_2"
          ? "Phần II · Đúng / Sai"
          : "Phần III · Trả lời ngắn";
    }
    return section === "part_1"
      ? "Part I · Multiple choice"
      : section === "part_2"
        ? "Part II · True / False"
        : "Part III · Short answer";
  };
  const setChoice = (value: string) =>
    setAnswers((previous) => ({ ...previous, [current.id]: value }));
  const setStatementChoice = (key: string, value: boolean) => {
    const previous = currentAnswer && typeof currentAnswer === "object" ? currentAnswer : {};
    setAnswers((state) => ({ ...state, [current.id]: { ...previous, [key]: value } }));
  };

  return (
    <main className="exam-page local-exam-preview">
      <div className="page-shell exam-container">
        <div className="exam-demo-banner" role="note">
          <span aria-hidden="true">i</span>
          <div>
            <strong>{copy.previewOnly}</strong>
            <p>
              {locale === "vi"
                ? "Đây là bản xem trước nội bộ từ dữ liệu đang rà soát. Câu trả lời chỉ nằm trong phiên trình duyệt này; không được lưu, chấm điểm hay gửi đi."
                : "This is an internal preview of content under review. Answers stay in this browser session; nothing is saved, graded, or submitted."}
            </p>
          </div>
        </div>

        <header className="exam-toolbar">
          <div className="exam-toolbar-title">
            <p className="eyebrow">{copy.previewExamTitle}</p>
            <h1>{title}</h1>
            <span>
              {questions.length} {copy.questionCount.toLowerCase()}
            </span>
          </div>
          <div className="local-preview-toolbar-actions">
            <div
              className="exam-timer"
              aria-label={`${locale === "vi" ? "Đồng hồ xem trước" : "Preview timer"}: ${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, "0")}`}
            >
              <span>
                {locale === "vi" ? "Thời gian làm bài · xem trước" : "Exam time · preview"}
              </span>
              <time>
                {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, "0")}
              </time>
            </div>
            <Link className="button button--secondary" href={`/admin/ingestion-review/${slug}`}>
              {copy.exitPreview}
            </Link>
          </div>
        </header>

        <div className="exam-workspace">
          <section className="exam-question-column" aria-label={sectionLabel(current.section)}>
            <div className="exam-section-heading">
              <span>{sectionLabel(current.section)}</span>
              <span>
                {currentIndex + 1} / {questions.length}
              </span>
            </div>
            <Card className="exam-question-card">
              <div className="exam-question-header">
                <span className="exam-question-number">
                  {locale === "vi" ? "Câu" : "Question"} {current.question_number}
                </span>
                <Button
                  variant="secondary"
                  onClick={() =>
                    setMarked((state) => ({ ...state, [current.id]: !state[current.id] }))
                  }
                  aria-pressed={Boolean(marked[current.id])}
                >
                  {marked[current.id] ? copy.markedForReview : copy.markForReview}
                </Button>
              </div>

              <div className="exam-question-body">
                <h2 className="local-preview-statement">
                  <MathContentView value={current.display_statement_vi ?? current.statement} />
                </h2>
                {current.question_type === "multiple_choice" ? (
                  <fieldset className="exam-options">
                    <legend>{copy.chooseAnswer}</legend>
                    {current.options.map((option) => (
                      <label className="exam-option" key={`${current.id}-${option.key}`}>
                        <input
                          type="radio"
                          name={`answer-${current.id}`}
                          value={option.key}
                          checked={currentAnswer === option.key}
                          onChange={() => setChoice(option.key)}
                        />
                        <span className="exam-option-key">{option.key}</span>
                        <span>
                          <MathContentView
                            value={
                              current.display_options_vi?.find((item) => item.key === option.key)
                                ?.text ?? option.text
                            }
                          />
                        </span>
                      </label>
                    ))}
                    {current.options.length === 0 ? (
                      <p>
                        {locale === "vi"
                          ? "Chưa nhận diện được lựa chọn; xem ảnh crop và trang nguồn bên dưới."
                          : "Options were not extracted; compare the crop and source page below."}
                      </p>
                    ) : null}
                  </fieldset>
                ) : null}

                {current.question_type === "true_false" ? (
                  <div className="exam-tf-wrap">
                    <p>
                      {locale === "vi"
                        ? "Chọn Đúng hoặc Sai cho từng ý."
                        : "Choose True or False for each statement."}
                    </p>
                    <table className="exam-tf-table">
                      <thead>
                        <tr>
                          <th>{locale === "vi" ? "Mệnh đề" : "Statement"}</th>
                          <th>{locale === "vi" ? "Đúng" : "True"}</th>
                          <th>{locale === "vi" ? "Sai" : "False"}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {current.substatements.map((statement) => {
                          const value =
                            currentAnswer && typeof currentAnswer === "object"
                              ? currentAnswer[statement.key]
                              : undefined;
                          return (
                            <tr key={`${current.id}-${statement.key}`}>
                              <th>
                                <span className="exam-statement-key">{statement.key}</span>
                                <MathContentView
                                  value={
                                    current.display_true_false_statements_vi?.find(
                                      (item) => item.key === statement.key,
                                    )?.text ?? statement.text
                                  }
                                />
                              </th>
                              {[true, false].map((choice) => (
                                <td key={String(choice)}>
                                  <label
                                    className="exam-tf-choice"
                                    aria-label={`${statement.key} · ${choice ? "true" : "false"}`}
                                  >
                                    <input
                                      type="radio"
                                      name={`answer-${current.id}-${statement.key}`}
                                      checked={value === choice}
                                      onChange={() => setStatementChoice(statement.key, choice)}
                                    />
                                  </label>
                                </td>
                              ))}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : null}

                {current.question_type === "short_answer" ? (
                  <div className="exam-short-answer-field">
                    <label htmlFor={`answer-${current.id}`}>
                      {locale === "vi" ? "Câu trả lời" : "Your answer"}
                    </label>
                    <input
                      id={`answer-${current.id}`}
                      inputMode="decimal"
                      value={typeof currentAnswer === "string" ? currentAnswer : ""}
                      onChange={(event) => setChoice(event.target.value)}
                    />
                  </div>
                ) : null}
              </div>

              {current.image_path ? (
                <details className="local-preview-source-crop">
                  <summary>
                    {locale === "vi"
                      ? `Đối chiếu crop từ trang ${current.source_page}`
                      : `Compare source crop from page ${current.source_page}`}
                  </summary>
                  <img
                    src={`/api/dev/ingestion-review/${slug}/assets/${current.image_path}`}
                    alt={`${copy.question} ${current.question_number} ${locale === "vi" ? "cắt từ đề gốc" : "source crop"}`}
                    loading="lazy"
                  />
                </details>
              ) : null}

              <footer className="exam-question-navigation">
                <Button
                  variant="secondary"
                  disabled={currentIndex === 0}
                  onClick={() => setCurrentIndex((index) => Math.max(0, index - 1))}
                >
                  {copy.previousQuestion}
                </Button>
                <span>
                  {answeredCount} {copy.answeredCount}
                </span>
                <Button
                  variant="primary"
                  disabled={currentIndex >= questions.length - 1}
                  onClick={() =>
                    setCurrentIndex((index) => Math.min(questions.length - 1, index + 1))
                  }
                >
                  {copy.nextQuestion}
                </Button>
              </footer>
            </Card>
          </section>

          <aside className="exam-navigator" aria-label={copy.questionNavigator}>
            <div className="exam-navigator-heading">
              <h2>{copy.questionNavigator}</h2>
              <span>
                {answeredCount} / {questions.length} {copy.answeredCount}
              </span>
            </div>
            {Array.from(new Set(questions.map((question) => question.section))).map((section) => (
              <section className="exam-navigator-section" key={section ?? "unsectioned"}>
                <h3>{sectionLabel(section)}</h3>
                <div className="exam-question-grid">
                  {questions.map((question, index) =>
                    question.section === section ? (
                      <button
                        className={`exam-question-index${index === currentIndex ? " is-current" : ""}${answers[question.id] ? " is-answered" : ""}${marked[question.id] ? " is-marked" : ""}`}
                        key={question.id}
                        onClick={() => setCurrentIndex(index)}
                        aria-label={`${locale === "vi" ? "Câu" : "Question"} ${question.question_number}${answers[question.id] ? ` · ${copy.answeredCount}` : ""}${marked[question.id] ? ` · ${copy.markedForReview}` : ""}`}
                        aria-current={index === currentIndex ? "step" : undefined}
                      >
                        {question.question_number}
                        {marked[question.id] ? <span aria-hidden="true">•</span> : null}
                      </button>
                    ) : null,
                  )}
                </div>
              </section>
            ))}
            <p className="local-preview-note">
              {locale === "vi"
                ? "Bản xem trước không lưu câu trả lời. Muốn kiểm tra nội dung trích xuất, mở trang rà soát nguồn."
                : "This preview does not save answers. Open source review to inspect extraction."}
            </p>
          </aside>
        </div>
      </div>
    </main>
  );
}
