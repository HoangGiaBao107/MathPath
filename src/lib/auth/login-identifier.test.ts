import { describe, expect, it } from "vitest";
import { isEmailIdentifier, loginIdentifierSchema } from "./login-identifier";

describe("login identifier", () => {
  it("accepts email addresses and usernames without at signs", () => {
    expect(loginIdentifierSchema.safeParse("student@example.com").success).toBe(true);
    expect(loginIdentifierSchema.safeParse("math.path_27").success).toBe(true);
    expect(isEmailIdentifier("student@example.com")).toBe(true);
    expect(isEmailIdentifier("math.path_27")).toBe(false);
  });

  it("rejects malformed email and usernames containing @ or unsupported characters", () => {
    expect(loginIdentifierSchema.safeParse("broken@email").success).toBe(false);
    expect(loginIdentifierSchema.safeParse("user@name").success).toBe(false);
    expect(loginIdentifierSchema.safeParse("bad name").success).toBe(false);
    expect(loginIdentifierSchema.safeParse("ab").success).toBe(false);
  });
});
