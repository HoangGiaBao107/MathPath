import Link from "next/link";
import type { Route } from "next";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { PreviewFrame } from "@/components/previews/preview-frame";
import { listSourcePreviews } from "@/lib/previews/data";

export const metadata = {
  title: "Đề thi thử | MathPath",
  description: "Xem trước các đề thi thử được trích từ tài liệu Word của MathPath.",
  robots: { index: false, follow: false },
};

export default function PreviewIndexPage() {
  const exams = listSourcePreviews();
  return (
    <PreviewFrame>
      <div className="student-preview container">
        <header className="student-preview-heading">
          <p className="eyebrow">
            <span className="eyebrow-dot" /> KHO ĐỀ MATHPATH
          </p>
          <h1>Đề thi thử</h1>
          <p>
            Tám đề trích từ file Word. Các phương án được biên tập và ký hiệu toán học được giữ từ
            cấu trúc công thức trong tài liệu; một số chỗ còn thiếu được đánh dấu để đối chiếu.
          </p>
          <Badge>Bản xem trước · Chưa chấm điểm</Badge>
        </header>
        <section aria-label="Danh sách đề thi thử">
          <div className="student-preview-grid">
            {exams.map((exam) => (
              <Card key={exam.slug} interactive className="student-preview-card">
                <div className="student-preview-card-top">
                  <Badge tone="primary">{exam.visibleQuestionCount} câu</Badge>
                  <span>Đề thi.docx</span>
                </div>
                <h2>{exam.title}</h2>
                <p>12 câu trắc nghiệm · 4 câu đúng/sai · 6 câu trả lời ngắn.</p>
                <Link
                  className="button button--secondary"
                  href={`/exams/preview/${exam.slug}` as Route}
                >
                  Mở đề <span aria-hidden="true">→</span>
                </Link>
              </Card>
            ))}
          </div>
        </section>
      </div>
    </PreviewFrame>
  );
}
