import { describe, expect, it } from "vitest";
import { devReviewActionSchema } from "./review-action-schema";

describe("development ingestion review API actions", () => {
  it("does not accept legacy raw edits that can overwrite source statements or answer keys", () => {
    expect(
      devReviewActionSchema.safeParse({
        action: "edit",
        statement: "changed",
        correct_answer: "B",
      }).success,
    ).toBe(false);
    expect(devReviewActionSchema.safeParse({ action: "approve" }).success).toBe(false);
  });

  it("accepts locale-scoped display drafts only", () => {
    expect(
      devReviewActionSchema.safeParse({
        action: "save_display",
        locale: "vi",
        display: {
          statement: "x",
          options: [],
          statements: [],
          shortAnswerPrompt: "",
          explanation: null,
        },
      }).success,
    ).toBe(true);
    expect(
      devReviewActionSchema.safeParse({
        action: "save_display",
        locale: "vi",
        display: {
          statement: "x",
          options: [],
          statements: [],
          shortAnswerPrompt: "",
          explanation: null,
        },
        correct_answer: "B",
      }).success,
    ).toBe(false);
  });
});
