import { notFound, redirect } from "next/navigation";
import { StudentAttemptResultExperience } from "@/components/analytics/student-attempt-result";
import { getAuthenticatedActor, getStudentAttemptResult } from "@/lib/analytics/server";

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
  const attempt = await getStudentAttemptResult(actor.userId, attemptId);
  if (!attempt) notFound();
  return <StudentAttemptResultExperience attempt={attempt} />;
}
