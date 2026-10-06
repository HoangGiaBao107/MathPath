import { describe, expect, it } from "vitest";
import { hasRecoveryLinkError } from "./recovery-link-error";

describe("hasRecoveryLinkError", () => {
  it("detects an expired Supabase recovery token in the URL fragment", () => {
    expect(
      hasRecoveryLinkError("#error=access_denied&error_code=otp_expired&error_description=expired"),
    ).toBe(true);
  });

  it("does not treat a valid recovery fragment as an error", () => {
    expect(hasRecoveryLinkError("#access_token=secret&type=recovery")).toBe(false);
    expect(hasRecoveryLinkError("")).toBe(false);
  });
});
