import { describe, expect, it } from "vitest";
import { createPaymentOrderSchema } from "./validation";

describe("create payment order request", () => {
  it("accepts only the paid plan identifier", () => {
    expect(createPaymentOrderSchema.parse({ planCode: "pro" })).toEqual({ planCode: "pro" });
    expect(createPaymentOrderSchema.safeParse({ planCode: "free" }).success).toBe(false);
  });

  it("rejects client supplied price, currency, status, and user id fields", () => {
    for (const extra of [
      { amountVnd: 1 }, { price: 1 }, { currency: "USD" }, { status: "paid" }, { userId: "other-user" },
    ]) {
      expect(createPaymentOrderSchema.safeParse({ planCode: "pro", ...extra }).success).toBe(false);
    }
  });
});
