import type { Metadata } from "next";
import { ProblemBankExperience } from "@/components/problems/problem-bank-experience";
import { getProblemBank } from "@/lib/problems/server-catalog";

export const metadata: Metadata = {
  title: "Problem Bank — MathPath",
  description: "Find MathPath practice sets by category, topic, and difficulty.",
  alternates: { canonical: "/problems" },
};

export default async function ProblemBankPage() {
  const problemBank = await getProblemBank({ limit: 12, sort: "newest" });

  return <ProblemBankExperience problemSets={problemBank.items} />;
}
