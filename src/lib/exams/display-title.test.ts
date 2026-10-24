import { describe, it, expect } from "vitest";
import { examDisplayTitle } from "./display-title";

describe("student-facing exam title", () => {
  it("removes the editorial suffix without changing the exam identity", () => {
    expect(examDisplayTitle("Đề thi thử Toán 03 – MathPath (biên soạn mới)")).toBe("Đề thi thử Toán 03 – MathPath");
  });
  it("keeps other parentheses and titles intact", () => {
    expect(examDisplayTitle("Ôn tập (chương 1)")).toBe("Ôn tập (chương 1)");
  });
});
