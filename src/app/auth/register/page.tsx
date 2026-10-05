import type { Metadata } from "next";
import { AuthExperience } from "@/components/auth/auth-experience";

export const metadata: Metadata = {
  title: "Create account",
  robots: { index: false, follow: false },
};
export default function RegisterPage() {
  return <AuthExperience mode="register" />;
}
