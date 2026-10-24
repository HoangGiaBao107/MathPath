import { notFound, redirect } from "next/navigation";
import { StudentAttemptResultExperience } from "@/components/analytics/student-attempt-result";
import { getAuthenticatedActor, getStudentAttemptResult, getStudentProgress } from "@/lib/analytics/server";
import { isResultDetailView } from "@/lib/analytics/result-view";

export const metadata = { title: "Chi tiết kết quả | MathPath", robots: { index: false, follow: false } };
export default async function Page({ params }: { params: Promise<{ attemptId: string; view: string }> }) {
  const { attemptId, view } = await params;
  if (!isResultDetailView(view)) notFound();
  const actor = await getAuthenticatedActor();
  if (!actor) redirect(`/auth/login?next=${encodeURIComponent(`/progress/attempts/${attemptId}/${view}`)}`);
  const [attempt, progress] = await Promise.all([getStudentAttemptResult(actor.userId, attemptId), getStudentProgress(actor.userId)]);
  if (!attempt) notFound();
  return <StudentAttemptResultExperience attempt={attempt} historyBeforeAttemptCount={Math.max(0, progress.totalAttempts - 1)} view={view} />;
}
