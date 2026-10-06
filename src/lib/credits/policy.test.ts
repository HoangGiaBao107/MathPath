import { describe, expect, it } from "vitest";
import { creditPolicy } from "./types";

describe("credit policy", () => {
  it("defines the approved free and paid-plan allowances as configuration only", () => {
    expect(creditPolicy).toEqual({
      timezone: "Asia/Ho_Chi_Minh",
      guestTotalRequests: 5,
      registeredFreeDailyRequests: 5,
      paidPlans: [
        { slug: "plus", name: "Plus", monthlyPriceVnd: 70_000, requestsPerDay: 15 },
        { slug: "pro", name: "Pro", monthlyPriceVnd: 100_000, requestsPerDay: 25 },
        { slug: "pro_max", name: "Pro Max", monthlyPriceVnd: 125_000, requestsPerDay: 50 },
      ],
    });
    expect(creditPolicy).not.toHaveProperty("registrationBonusRequests");
  });

  it("does not grant guest signup bonus requests", () => {
    expect(creditPolicy.guestTotalRequests).toBe(5);
    expect(creditPolicy.registeredFreeDailyRequests).toBe(5);
    expect(creditPolicy).not.toHaveProperty("registrationBonusRequests");
  });
});
