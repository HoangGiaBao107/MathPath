import {notFound} from "next/navigation";
import {ExamExperience} from "@/components/exams/exam-experience";
import {getBankLabExam} from "@/lib/exams/bank-lab.server";
import {toExamPublicSummary} from "@/lib/exams/demo-data.mock";
export const dynamic="force-dynamic";
export default async function Page({params}:{params:Promise<{examId:string}>}){
 const exam=getBankLabExam((await params).examId);if(!exam)notFound();
 return <><p role="note">Kiểm thử bộ MathPath mới trên Local.</p><ExamExperience exam={toExamPublicSummary(exam)} resultPathPrefix="/dev/exam-lab/" /></>;
}
