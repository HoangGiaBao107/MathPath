import type { Metadata } from "next";
import { AIWorkspace } from "@/components/ai/ai-workspace";

export const metadata: Metadata = {
  title: "AI Solver | MathPath",
  description: "Hỏi đáp Toán, giải đề bằng chữ hoặc ảnh và luyện tập với AI.",
};

export default async function AIPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string; attemptId?: string }>;
}) {
  const query = await searchParams;
  const initialMode =
    query.mode === "practice" || query.mode === "recommendation" || query.mode === "solver"
      ? query.mode
      : "chat";
  return <AIWorkspace initialMode={initialMode} attemptId={query.attemptId ?? null} />;
}
