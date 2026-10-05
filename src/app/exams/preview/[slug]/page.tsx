import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { PreviewFrame } from "@/components/previews/preview-frame";
import { PreviewQuestionnaire } from "@/components/previews/preview-questionnaire";
import { getSourcePreview, listSourcePreviews } from "@/lib/previews/data";

export const dynamicParams = false;

export function generateStaticParams() {
  return listSourcePreviews().map((exam) => ({ slug: exam.slug }));
}

export default async function SourcePreviewPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const exam = getSourcePreview(slug);
  if (!exam) notFound();
  return (
    <PreviewFrame>
      <div className="student-preview container">
        <Link className="student-preview-back" href="/exams/preview">
          ← Tất cả đề thi thử
        </Link>
        <header className="student-preview-heading">
          <p className="eyebrow">
            <span className="eyebrow-dot" /> ĐỀ THI.DOCX
          </p>
          <h1>{exam.title}</h1>
          <p>{exam.visibleQuestionCount} câu · 90 phút · Bản xem trước, chưa chấm điểm.</p>
          <Badge>Chưa xác minh chính thức</Badge>
        </header>
        <PreviewQuestionnaire questions={exam.questions} />
      </div>
    </PreviewFrame>
  );
}
