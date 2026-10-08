import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { buildVietQrUrl, parseGenericPaymentWebhook, verifyHmacWebhook } from "./provider-core";

describe("generic signed bank transfer adapter", () => {
  it("builds the QR URL from the order amount and transfer code", () => {
    const qr = buildVietQrUrl("VCB", "0123456789", "MATHPATH TEST", "MP0123456789", 100000);
    expect(qr).toContain("amount=100000");
    expect(qr).toContain("addInfo=MP0123456789");
  });

  it("requires a valid signature and a paid event with an exact order code and amount", () => {
    const raw = new TextEncoder().encode(JSON.stringify({
      event_id: "event-1", status: "paid", order_code: "MP0123456789", amount_vnd: 125000,
    }));
    const signature = createHmac("sha256", "local-test-secret").update(raw).digest("hex");
    expect(verifyHmacWebhook(raw, signature, "local-test-secret")).toBe(true);
    expect(verifyHmacWebhook(raw, "0".repeat(64), "local-test-secret")).toBe(false);
    expect(parseGenericPaymentWebhook(JSON.parse(new TextDecoder().decode(raw)))).toMatchObject({
      eventId: "event-1", orderCode: "MP0123456789", amountVnd: 125000,
    });
    expect(parseGenericPaymentWebhook({ event_id: "event-2", order_code: "MP0123456789", amount_vnd: 1, status: "pending" })).toBeNull();
    expect(parseGenericPaymentWebhook({ event_id: "event-3", order_code: "invalid", amount_vnd: 1, status: "paid" })).toBeNull();
  });
});
