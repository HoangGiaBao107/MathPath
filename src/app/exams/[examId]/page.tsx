import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { ExamExperience } from "@/components/exams/exam-experience";
import { toExamPublicSummary } from "@/lib/exams/demo-data.mock";
import { getAttemptRepository } from "@/lib/exams/repository-provider.server";
import { readExamOwner } from "@/lib/exams/guest-session.server";

export const metadata: Metadata = {
  title: "Bài làm | MathPath",
  description: "Làm bài và xem kết quả học tập trên MathPath.",
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
  if (!exam) {
    // Archiving a bank must not strand a student's existing attempt.
    // The repository checks ownership before returning archived content.
    const owner = await readExamOwner();
    const current = owner ? await getAttemptRepository().findCurrent(examId, owner) : null;
    if (current?.status === "in_progress") return <ExamExperience exam={current.exam} />;
    notFound();
  }
  if (exam.demo) redirect("/problems");
  return <ExamExperience exam={toExamPublicSummary(exam)} />;
}
