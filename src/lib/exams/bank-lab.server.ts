import { readFileSync } from "node:fs";
import path from "node:path";
import { isExamLabEnabled } from "./lab-exam.fixture";
import type { ExamDefinition, PublicExamAttempt } from "./types";
import type { StudentAttemptResult } from "../analytics/types";

export function bankLabExams(): ExamDefinition[] {
  if (!isExamLabEnabled()) return [];
  try { return JSON.parse(readFileSync(path.join(process.cwd(), "tmp/mathpath-new/runtime-exams.json"), "utf8")); }
  catch { return []; }
}
export function getBankLabExam(id: string) { return bankLabExams().find(e => e.id === id) ?? null; }
export function bankLabResult(attempt: PublicExamAttempt): StudentAttemptResult | null {
  const exam=getBankLabExam(attempt.examId);
  if(!exam||!attempt.result||!attempt.submittedAt||!["submitted","auto_submitted"].includes(attempt.status))return null;
  const bank=JSON.parse(readFileSync(path.join(process.cwd(),"content/extracted/mathpath-new-20261022/questions.json"),"utf8")) as {questions:{exam_id:string;solution:string;answer:{display?:string}}[]};
  const source=bank.questions.filter(q=>q.exam_id===exam.id);
  return {attemptId:attempt.id,examSlug:exam.id,examTitle:exam.title,submittedAt:attempt.submittedAt,durationSeconds:attempt.durationSeconds,status:attempt.status as "submitted"|"auto_submitted",
    result:{...attempt.result,questionOutcomes:attempt.result.questionOutcomes.map((outcome,i)=>{
      const q=exam.questions[i];return {...outcome,review:{questionType:q.type,statement:q.stem,options:q.type==="multiple_choice"?q.options:[],substatements:q.type==="true_false"?q.statements:[],assets:(q.figures??[]).map(f=>({path:f.url,altText:f.alt,placement:"stem"})),selectedAnswer:attempt.answers[q.id]?.answer as Record<string,unknown>|null,correctAnswer:q.type==="multiple_choice"?{option_key:q.correctOptionKey}:q.type==="true_false"?{statements:q.correctStatements}:{accepted_values:[source[i].answer.display?.replace(/^\$|\$$/g,"")??q.canonicalAnswer],input_policy:q.inputPolicy},explanation:source[i].solution}};
    })}};
}
