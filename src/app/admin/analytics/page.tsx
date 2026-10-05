import { notFound } from "next/navigation";
import { AdminAnalyticsExperience } from "@/components/analytics/admin-analytics-experience";
import { canAdminister } from "@/lib/auth/authorization";
import { getAdminAnalytics, getAuthenticatedActor } from "@/lib/analytics/server";

export const metadata = { title: "Phân tích MathPath", robots: { index: false, follow: false } };

export default async function AdminAnalyticsPage() {
  const actor = await getAuthenticatedActor();
  if (!actor || !canAdminister(actor, "users:read")) notFound();
  const analytics = await getAdminAnalytics(actor.userId);
  return <AdminAnalyticsExperience data={analytics} />;
}
