import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { StudentProgressExperience } from "@/components/analytics/student-progress-experience";
import { getAuthenticatedActor, getStudentProgress } from "@/lib/analytics/server";

export const metadata: Metadata = {
  title: "Lịch sử làm bài | MathPath",
  description: "Theo dõi điểm số, lịch sử làm bài và kiến thức cần ôn.",
  robots: { index: false, follow: false },
};

export default async function ProgressPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const actor = await getAuthenticatedActor();
  if (!actor) redirect("/auth/login?next=%2Fprogress");
  const query = await searchParams;
  const requestedPage = Number(query.page ?? 1);
  const page = Number.isFinite(requestedPage) ? Math.max(1, Math.floor(requestedPage)) : 1;
  const data = await getStudentProgress(actor.userId, page);
  const pageCount = Math.max(1, Math.ceil(data.historyTotal / 10));
  const visiblePage = Math.min(page, pageCount);
  const visibleData =
    visiblePage === page ? data : await getStudentProgress(actor.userId, visiblePage);
  return <StudentProgressExperience data={visibleData} page={visiblePage} />;
}
