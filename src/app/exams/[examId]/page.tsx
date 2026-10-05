import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ExamExperience } from "@/components/exams/exam-experience";
import { toExamPublicSummary } from "@/lib/exams/demo-data.mock";
import { getAttemptRepository } from "@/lib/exams/repository-provider.server";

export const metadata: Metadata = {
  title: "Demo Exam | MathPath",
  description: "Try the MathPath exam engine with clearly labeled mock questions.",
  robots: { index: false, follow: false },
};

export default async function ExamPage({ params }: PageProps<"/exams/[examId]">) {
  const { examId } = await params;
  let exam;
  try {
    exam = await getAttemptRepository().getExam(examId);
  } catch (error) {
    if (error instanceof Error && error.message.includes("Supabase")) throw error;
    exam = null;
  }
  if (!exam) notFound();
  return <ExamExperience exam={toExamPublicSummary(exam)} />;
}
