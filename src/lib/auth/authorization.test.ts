import { describe, expect, it } from "vitest";
import { canAdminister, requireAdmin } from "./authorization";

describe("admin analytics authorization", () => {
  it("allows an admin capability for an admin actor", () => {
    expect(canAdminister({ userId: "admin-1", role: "admin" }, "users:read")).toBe(true);
  });

  it("denies students and unauthenticated visitors", () => {
    expect(canAdminister({ userId: "student-1", role: "student" }, "users:read")).toBe(false);
    expect(canAdminister(null, "users:read")).toBe(false);
    expect(() => requireAdmin({ userId: "student-1", role: "student" })).toThrow(
      "Admin access is required.",
    );
  });
});
