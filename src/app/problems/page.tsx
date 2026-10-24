import type { Metadata } from "next";
import { connection } from "next/server";
import { ProblemBankExperience } from "@/components/problems/problem-bank-experience";
import { getPublishedProblemSets } from "@/lib/problems/server-catalog";

export const metadata: Metadata = {
  title: "Problem Bank — MathPath",
  description: "Find MathPath practice sets by category, topic, and difficulty.",
  alternates: { canonical: "/problems" },
};

export default async function ProblemBankPage() {
  await connection();
  const problemSets = await getPublishedProblemSets();

  return <ProblemBankExperience problemSets={problemSets} />;
}
