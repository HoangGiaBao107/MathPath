import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PreviewQuestionnaire } from "@/components/previews/preview-questionnaire";
import { PreviewFrame } from "@/components/previews/preview-frame";
import { ElapsedPracticeTimer } from "@/components/exams/elapsed-practice-timer";
import {
  getTopicPracticePreview,
  listTopicPracticePreviews,
  toPreviewQuestions,
} from "@/lib/previews/topic-practice-data";

export const dynamicParams = false;

export function generateStaticParams() {
  return listTopicPracticePreviews().map((exam) => ({ slug: exam.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const exam = getTopicPracticePreview(slug);
  return {
    title: exam ? `${exam.title} | MathPath` : "Đề ôn tập | MathPath",
    description: exam?.description ?? "Đề ôn tập theo chuyên đề trên MathPath.",
  };
}

export default async function TopicPracticePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const exam = getTopicPracticePreview(slug);
  if (!exam) notFound();

  const questions = toPreviewQuestions(exam);

  return (
    <PreviewFrame showBanner={false}>
      <div className="student-preview topic-practice-shell container">
        <Link className="student-preview-back" href="/problems">
          ← Về Ngân hàng câu hỏi
        </Link>
        <header className="student-preview-heading topic-practice-heading">
          <p className="eyebrow">
            <span className="eyebrow-dot" /> ÔN TẬP {exam.topic.toLocaleUpperCase("vi-VN")}
          </p>
          <h1>{exam.title}</h1>
          <p>
            {exam.questionCount} câu · {exam.totalScore} điểm · Tính thời gian đã học
          </p>
          <ElapsedPracticeTimer />
        </header>
        <PreviewQuestionnaire
          questions={questions}
          showAnswerNotice={false}
          showSourceDetails={false}
        />
      </div>
    </PreviewFrame>
  );
}
