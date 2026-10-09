import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { buildVietQrUrl, createVietQrPaymentData, parseSePayWebhook, verifySePayWebhook } from "./provider-core";

describe("SePay signed bank transfer adapter", () => {
  it("builds the QR URL from the order amount and transfer code", () => {
    const qr = new URL(buildVietQrUrl("VCB", "0123456789", "MATHPATH TEST", "MP0123456789", 100000));
    expect(qr.origin).toBe("https://img.vietqr.io");
    expect(qr.pathname).toBe("/image/VCB-0123456789-compact2.png");
    expect(qr.searchParams.get("amount")).toBe("100000");
    expect(qr.searchParams.get("addInfo")).toBe("MP0123456789");
    expect(qr.searchParams.get("accountName")).toBe("MATHPATH TEST");
  });

  it("encodes Vietnamese account names and reports incomplete bank configuration without a QR", () => {
    const encodedQr = new URL(buildVietQrUrl("VCB", "0123456789", "MATH PATH ĐÀ NẴNG", "MP0123456789", 70000));
    expect(encodedQr.searchParams.get("accountName")).toBe("MATH PATH ĐÀ NẴNG");
    const payment = createVietQrPaymentData(
      { orderCode: "MP0123456789", amountVnd: 70000 },
      { bankCode: "VCB", accountNumber: "0123456789", webhookSecret: "test-only" },
    );
    expect(payment.qrImageUrl).toBeNull();
    expect(payment.accountName).toBeNull();
    expect(payment.providerReady).toBe(false);
    expect(payment.transferDescription).toBe("MP0123456789");
  });

  it("rejects invalid amount or order code before forming a VietQR link", () => {
    expect(() => buildVietQrUrl("VCB", "0123456789", "MATHPATH", "MP0123456789", 0)).toThrow("invalid_payment_amount");
    expect(() => buildVietQrUrl("VCB", "0123456789", "MATHPATH", "NOT-AN-ORDER", 70000)).toThrow("invalid_payment_order_code");
  });

  it("verifies SePay's timestamp.raw-body HMAC in constant time and rejects stale requests", () => {
    const now = 1_800_000_000;
    const timestamp = String(now);
    const raw = new TextEncoder().encode('{"content":"Chuyển khoản toán học ✓","id":12345,"transferType":"in"}');
    const digest = createHmac("sha256", "local-test-secret").update(timestamp).update(".").update(raw).digest("hex");
    const signature = `sha256=${digest}`;
    expect(verifySePayWebhook(raw, signature, timestamp, "local-test-secret", now)).toBe(true);
    expect(verifySePayWebhook(raw, `sha256=${"0".repeat(64)}`, timestamp, "local-test-secret", now)).toBe(false);
    expect(verifySePayWebhook(raw, signature, timestamp, "local-test-secret", now + 301)).toBe(false);
    expect(verifySePayWebhook(raw, signature, timestamp, "local-test-secret", now - 301)).toBe(false);
    expect(verifySePayWebhook(raw, signature, null, "local-test-secret", now)).toBe(false);
    expect(verifySePayWebhook(raw, signature, "not-a-timestamp", "local-test-secret", now)).toBe(false);
    expect(verifySePayWebhook(raw, `sha256=${"z".repeat(64)}`, timestamp, "local-test-secret", now)).toBe(false);
    expect(verifySePayWebhook(raw, signature, timestamp, undefined, now)).toBe(false);
  });

  it("maps SePay's documented incoming transfer payload without trusting content text as an order code", () => {
    const payload = {
      id: 12345, gateway: "MBBank", transactionDate: "2025-01-15 10:30:00",
      accountNumber: "0123456789", subAccount: null, code: "MP0123456789",
      content: "MP0123456789 thanh toan", transferType: "in", description: "NGUYEN VAN A chuyen tien",
      transferAmount: 125000, accumulated: 5000000, referenceCode: "FT25015ABC123",
    };
    expect(parseSePayWebhook(payload)).toEqual({
      eventId: "12345", orderCode: "MP0123456789", transactionId: "12345",
      providerReference: "FT25015ABC123", amountVnd: 125000, description: "MP0123456789 thanh toan",
    });
    expect(parseSePayWebhook({ ...payload, transferType: "out" })).toBeNull();
    expect(parseSePayWebhook({ ...payload, code: null })).toBeNull();
    expect(parseSePayWebhook({ ...payload, code: "MP0123456789", transferAmount: -1 })).toBeNull();
    expect(parseSePayWebhook({ ...payload, code: "MP012345678!" })).toBeNull();
    expect(parseSePayWebhook({ ...payload, content: "MP9999999999", code: "MP0123456789" })).toMatchObject({ orderCode: "MP0123456789" });
    expect(parseSePayWebhook({ ...payload, id: "12345" })).toBeNull();
    expect(parseSePayWebhook({ ...payload, transferAmount: 0 })).toBeNull();
    expect(parseSePayWebhook(null)).toBeNull();
  });
});
