import { describe, expect, it } from "vitest";
import { safeNextPath } from "./safe-next-path";

describe("safeNextPath", () => {
  it("preserves a local dashboard return path", () => {
    expect(safeNextPath("/progress?page=2#history")).toBe("/progress?page=2#history");
  });

  it("uses a safe fallback for external or malformed paths", () => {
    expect(safeNextPath("https://example.com")).toBe("/account");
    expect(safeNextPath("//example.com")).toBe("/account");
    expect(safeNextPath("/\\\\example.com")).toBe("/account");
    expect(safeNextPath(null, "/progress")).toBe("/progress");
  });
});
