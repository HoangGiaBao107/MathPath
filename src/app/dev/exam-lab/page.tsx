import { notFound } from "next/navigation";
import { ExamExperience } from "@/components/exams/exam-experience";
import { isExamLabEnabled, labExam } from "@/lib/exams/lab-exam.fixture";
import { toExamPublicSummary } from "@/lib/exams/demo-data.mock";

export const dynamic = "force-dynamic";
export default function ExamLabPage() {
  if (!isExamLabEnabled()) notFound();
  return <><p role="note">Môi trường kiểm thử cục bộ · dữ liệu tự tạo · lưu trong bộ nhớ.</p><ExamExperience exam={toExamPublicSummary(labExam)} resultPathPrefix="/dev/exam-lab/" /></>;
}
