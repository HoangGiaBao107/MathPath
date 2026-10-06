import { describe, expect, it } from "vitest";
import { canSkipEmailConfirmation } from "./admin-email-confirmation";

describe("admin email confirmation fallback guard", () => {
  it("only activates for the explicit unconfirmed email response", () => {
    expect(canSkipEmailConfirmation({ code: "email_not_confirmed" })).toBe(true);
    expect(canSkipEmailConfirmation({ message: "Email not confirmed" })).toBe(true);
  });

  it("does not activate for wrong passwords or other auth errors", () => {
    expect(canSkipEmailConfirmation({ code: "invalid_credentials" })).toBe(false);
    expect(canSkipEmailConfirmation({ message: "Invalid login credentials" })).toBe(false);
    expect(canSkipEmailConfirmation({ code: "email_not_found" })).toBe(false);
  });
});
