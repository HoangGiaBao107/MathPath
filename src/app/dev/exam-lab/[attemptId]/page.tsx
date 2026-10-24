import { notFound } from "next/navigation";
import { StudentAttemptResultExperience } from "@/components/analytics/student-attempt-result";
import { isExamLabEnabled, labResult } from "@/lib/exams/lab-exam.fixture";
import { getAttemptRepository } from "@/lib/exams/repository-provider.server";
import { readExamOwner } from "@/lib/exams/guest-session.server";
import { bankLabResult } from "@/lib/exams/bank-lab.server";

export const dynamic = "force-dynamic";
export default async function ExamLabResultPage({params}:{params:Promise<{attemptId:string}>}) {
  if (!isExamLabEnabled()) notFound();
  const owner = await readExamOwner();
  if (!owner) notFound();
  const attempt = await getAttemptRepository().get((await params).attemptId,owner);
  const result = attempt ? labResult(attempt) ?? bankLabResult(attempt) : null;
  if (!result) notFound();
  return <StudentAttemptResultExperience attempt={result} historyBeforeAttemptCount={0} basePath={`/dev/exam-lab/${attempt!.id}`} />;
}
