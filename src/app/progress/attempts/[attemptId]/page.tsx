import { notFound, redirect } from "next/navigation";
import { StudentAttemptResultExperience } from "@/components/analytics/student-attempt-result";
import {
  getAuthenticatedActor,
  getStudentAttemptResult,
  getStudentProgress,
} from "@/lib/analytics/server";

export const metadata = {
  title: "Kết quả lượt làm | MathPath",
  robots: { index: false, follow: false },
};

export default async function StudentAttemptResultPage({
  params,
}: {
  params: Promise<{ attemptId: string }>;
}) {
  const actor = await getAuthenticatedActor();
  if (!actor) redirect("/auth/login?next=%2Fprogress");
  const { attemptId } = await params;
  const [attempt, progress] = await Promise.all([
    getStudentAttemptResult(actor.userId, attemptId),
    getStudentProgress(actor.userId),
  ]);
  if (!attempt) notFound();
  return (
    <StudentAttemptResultExperience
      attempt={attempt}
      historyBeforeAttemptCount={Math.max(0, progress.totalAttempts - 1)}
    />
  );
}
