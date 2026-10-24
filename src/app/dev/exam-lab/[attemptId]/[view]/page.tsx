import { notFound } from "next/navigation";
import { StudentAttemptResultExperience } from "@/components/analytics/student-attempt-result";
import { isExamLabEnabled, labResult } from "@/lib/exams/lab-exam.fixture";
import { getAttemptRepository } from "@/lib/exams/repository-provider.server";
import { readExamOwner } from "@/lib/exams/guest-session.server";
import { bankLabResult } from "@/lib/exams/bank-lab.server";
import { isResultDetailView } from "@/lib/analytics/result-view";

export const dynamic = "force-dynamic";
export default async function Page({ params }: { params: Promise<{ attemptId: string; view: string }> }) {
  if (!isExamLabEnabled()) notFound();
  const { attemptId, view } = await params;
  if (!isResultDetailView(view)) notFound();
  const owner = await readExamOwner();
  if (!owner) notFound();
  const attempt = await getAttemptRepository().get(attemptId, owner);
  const result = attempt ? labResult(attempt) ?? bankLabResult(attempt) : null;
  if (!result) notFound();
  return <StudentAttemptResultExperience attempt={result} historyBeforeAttemptCount={0} view={view} basePath={`/dev/exam-lab/${attemptId}`} />;
}
