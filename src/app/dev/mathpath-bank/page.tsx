import { BankPreviewCatalog } from "@/components/exams/bank-preview-catalog";
import {notFound} from "next/navigation";
import {isExamLabEnabled} from "@/lib/exams/lab-exam.fixture";
import {bankLabExams} from "@/lib/exams/bank-lab.server";
export const dynamic="force-dynamic";
export default function Page(){
 if(!isExamLabEnabled())notFound();
 return <BankPreviewCatalog exams={bankLabExams().map(e => ({ id: e.id, title: e.title, count: e.questions.length, minutes: e.durationSeconds ? Math.round(e.durationSeconds / 60) : null, official: e.mode === "official_thptqg" }))} />;
}
