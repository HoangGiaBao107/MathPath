import { describe, expect, it } from "vitest";
import { validateMathContent } from "@/lib/problems/math-content";
import { solverResponseSchema } from "./validation";

describe("structured solver output", () => {
  it("accepts all required solution sections and uncertainty", () => {
    const result = solverResponseSchema.safeParse({
      problemSummary: "Solve $x^2=4$.",
      problemType: "Quadratic equation",
      method: "Take square roots",
      steps: [{ title: "Step 1", content: "$x=\\pm2$" }],
      verification: "Both values satisfy the equation.",
      finalAnswer: "$x=\\pm2$",
      confidenceNote: null,
    });
    expect(result.success).toBe(true);
    if (result.success) expect(validateMathContent(result.data.finalAnswer).valid).toBe(true);
  });

  it("rejects missing fields and malformed delimited LaTeX", () => {
    expect(solverResponseSchema.safeParse({ finalAnswer: "42" }).success).toBe(false);
    expect(validateMathContent("$\\frac{1}{2$").valid).toBe(false);
  });
});
