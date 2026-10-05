"use client";

import Image from "next/image";
import { useState } from "react";
import { MathContentView } from "@/components/problems/math-content-view";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { PreviewQuestion } from "@/lib/previews/types";

export function PreviewQuestionnaire({
  questions,
  showSourceDetails = true,
  showAnswerNotice = true,
}: {
  questions: PreviewQuestion[];
  showSourceDetails?: boolean;
  showAnswerNotice?: boolean;
}) {
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const question = questions[current];
  const section = question.sectionLabel.vi;
  const sections = [...new Set(questions.map((item) => item.sectionLabel.vi))];
  if (!question) return null;
  return (
    <div className="preview-workspace">
      <Card className="preview-question-card">
        <div className="preview-question-progress">
          <span>{section}</span>
          <span>
            Câu {current + 1} / {questions.length}
          </span>
          <div className="preview-progress-track">
            <i style={{ width: `${((current + 1) / questions.length) * 100}%` }} />
          </div>
        </div>
        <div className="student-preview-question-heading">
          <Badge tone="primary">
            Câu {question.practiceOrder ?? question.questionNumber ?? current + 1}
          </Badge>
          {showSourceDetails ? (
            <span>
              {question.source.file} · câu gốc {question.source.questionNumber}
              {question.source.pages.length ? ` · trang ${question.source.pages.join(", ")}` : ""}
            </span>
          ) : null}
        </div>
        <div className="student-preview-statement">
          <MathContentView value={question.statement} />
        </div>
        {question.source.crop ? (
          <figure className="student-preview-crop">
            <Image
              src={question.source.crop}
              alt={
                question.source.figureKind === "generated_illustration"
                  ? `Hình minh họa AI cho câu ${question.source.questionNumber}`
                  : `Hình từ ${question.source.file}, câu ${question.source.questionNumber}`
              }
              width={question.source.cropWidth ?? 900}
              height={question.source.cropHeight ?? 520}
            />
            <figcaption>
              {question.source.figureKind === "generated_illustration"
                ? "Hình minh họa AI theo prompt trong Word · chờ kiểm tra nội dung."
                : "Hình gốc trích từ nguồn."}
            </figcaption>
          </figure>
        ) : question.source.figureStatus === "ai_prompt_pending" ? (
          <p className="student-preview-figure-missing">
            Câu này có prompt hình trong file Word; hình AI chưa được tạo nên đang chờ bổ sung.
          </p>
        ) : (
          question.source.figureStatus !== "not_required" && (
            <p className="student-preview-figure-missing">
              Hình chưa có trong bản trích xuất · cần đối chiếu đề gốc.
            </p>
          )
        )}
        {question.questionType === "multiple_choice" &&
          (question.options.length ? (
            <div
              className="preview-choice-list"
              role="group"
              aria-label={`Các lựa chọn câu ${current + 1}`}
            >
              {question.options.map((option, index) => (
                <button
                  key={option.key}
                  type="button"
                  className={`preview-choice${answers[question.id] === option.key ? " is-selected" : ""}`}
                  aria-pressed={answers[question.id] === option.key}
                  onClick={() => setAnswers((old) => ({ ...old, [question.id]: option.key }))}
                >
                  <strong>{option.key || String.fromCharCode(65 + index)}</strong>
                  <span>
                    <MathContentView value={option.text} />
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <p className="student-preview-figure-missing" role="status">
              Phần phương án bị thiếu trong file Word. Câu này đang chờ nội dung gốc nên chưa thể
              chọn đáp án.
            </p>
          ))}
        {question.questionType === "true_false" && (
          <div className="preview-tf-list">
            {question.substatements.map((item) => (
              <div className="preview-tf-row" key={item.key}>
                <strong>{item.key.toUpperCase()}.</strong>
                <span>
                  <MathContentView value={item.text} />
                </span>
                <div role="group" aria-label={`Chọn đúng sai cho ý ${item.key}`}>
                  <button
                    type="button"
                    aria-pressed={answers[`${question.id}-${item.key}`] === "true"}
                    onClick={() =>
                      setAnswers((old) => ({ ...old, [`${question.id}-${item.key}`]: "true" }))
                    }
                  >
                    Đúng
                  </button>
                  <button
                    type="button"
                    aria-pressed={answers[`${question.id}-${item.key}`] === "false"}
                    onClick={() =>
                      setAnswers((old) => ({ ...old, [`${question.id}-${item.key}`]: "false" }))
                    }
                  >
                    Sai
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
        {question.questionType === "short_answer" && (
          <label className="student-preview-answer">
            Câu trả lời của bạn
            <input
              value={answers[question.id] ?? ""}
              onChange={(event) =>
                setAnswers((old) => ({ ...old, [question.id]: event.target.value }))
              }
              aria-label={`Câu trả lời câu ${current + 1}`}
              placeholder="Nhập câu trả lời…"
            />
          </label>
        )}
        {question.source.warnings.length > 0 && (
          <details className="student-preview-warning">
            <summary>Ghi chú trích xuất ({question.source.warnings.length})</summary>
            <ul>
              {question.source.warnings.map((warning, index) => (
                <li key={index}>{warning}</li>
              ))}
            </ul>
          </details>
        )}
        <nav className="preview-question-nav" aria-label="Điều hướng câu hỏi">
          <button
            type="button"
            disabled={current === 0}
            onClick={() => setCurrent((index) => index - 1)}
          >
            ← Câu trước
          </button>
          <span>
            {current + 1} / {questions.length}
          </span>
          <button
            type="button"
            disabled={current === questions.length - 1}
            onClick={() => setCurrent((index) => index + 1)}
          >
            Câu tiếp theo →
          </button>
        </nav>
      </Card>
      <aside className="preview-question-navigator">
        <h2>Danh sách câu</h2>
        {sections.map((label) => (
          <section key={label}>
            <h3>{label}</h3>
            <div>
              {questions.map((item, index) =>
                item.sectionLabel.vi === label ? (
                  <button
                    type="button"
                    key={`${item.source.slug}-${item.id}`}
                    className={`preview-question-index${index === current ? " is-current" : ""}${Object.keys(answers).some((key) => key === item.id || key.startsWith(`${item.id}-`)) ? " is-answered" : ""}`}
                    aria-current={index === current ? "step" : undefined}
                    aria-label={`${item.sectionLabel.vi}, câu ${item.questionNumber}${Object.keys(answers).some((key) => key === item.id || key.startsWith(`${item.id}-`)) ? ", đã chọn câu trả lời" : ""}`}
                    onClick={() => setCurrent(index)}
                  >
                    {item.questionNumber}
                  </button>
                ) : null,
              )}
            </div>
          </section>
        ))}
        {showAnswerNotice ? <p>Câu trả lời trong trang này chưa được lưu.</p> : null}
      </aside>
    </div>
  );
}
