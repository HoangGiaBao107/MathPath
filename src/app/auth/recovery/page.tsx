import type { Metadata } from "next";
import { AuthExperience } from "@/components/auth/auth-experience";

export const metadata: Metadata = {
  title: "Password recovery",
  robots: { index: false, follow: false },
};
export default async function RecoveryPage(props: PageProps<"/auth/recovery">) {
  const searchParams = await props.searchParams;
  return (
    <AuthExperience
      mode="recovery"
      updatingPassword={searchParams.update === "1"}
      initialError={
        searchParams.error === "recovery_link_invalid" ? "recovery_link_expired" : undefined
      }
    />
  );
}
