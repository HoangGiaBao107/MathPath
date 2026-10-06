import type { Metadata } from "next";
import { AuthExperience } from "@/components/auth/auth-experience";
import { safeNextPath } from "@/lib/auth/safe-next-path";

export const metadata: Metadata = { title: "Sign in", robots: { index: false, follow: false } };
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string; password_updated?: string }>;
}) {
  const query = await searchParams;
  return (
    <AuthExperience
      mode="login"
      nextPath={safeNextPath(query.next)}
      passwordUpdated={query.password_updated === "1"}
      initialError={query.error === "callback_failed" ? "callback_failed" : undefined}
    />
  );
}
