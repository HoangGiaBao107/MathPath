import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  buildVietQrUrl,
  createVietQrPaymentData,
  parseGenericPaymentWebhook,
  parseSePayWebhook,
  verifyHmacWebhook,
  verifySePayWebhook,
} from "./provider-core";

describe("VietQR Quick Link", () => {
  it.each([
    ["PLUS", "MP0123456789", 70000],
    ["PRO", "MPABCDEF1234", 100000],
    ["PRO MAX", "MPB795009345", 125000],
  ])("builds a server-derived %s QR with its exact amount and unique order code", (_plan, orderCode, amount) => {
    const qr = new URL(buildVietQrUrl("VCB", "0123456789", "MATHPATH TEST", orderCode, amount));
    expect(qr.origin).toBe("https://img.vietqr.io");
    expect(qr.pathname).toBe("/image/VCB-0123456789-print.png");
    expect(qr.searchParams.get("amount")).toBe(String(amount));
    expect(qr.searchParams.get("addInfo")).toBe(`MATHPATH ${orderCode}`);
    expect(qr.searchParams.get("accountName")).toBe("MATHPATH TEST");
  });

  it("encodes the Vietnamese account name and description as URL query parameters", () => {
    const url = new URL(buildVietQrUrl("VCB", "0123456789", "MATH PATH ĐÀ NẴNG", "MP0123456789", 70000));
    expect(url.searchParams.get("accountName")).toBe("MATH PATH ĐÀ NẴNG");
    expect(url.searchParams.get("addInfo")).toBe("MATHPATH MP0123456789");
    expect(url.search).toContain("%C4%90");
  });

  it("does not create a QR when bank or webhook configuration is incomplete", () => {
    const order = { orderCode: "MP0123456789", amountVnd: 70000 };
    const missingBank = createVietQrPaymentData(order, { mode: "sandbox", accountNumber: "0123456789", accountName: "TEST", webhookSecret: "test-only" });
    const missingWebhook = createVietQrPaymentData(order, { mode: "sandbox", bankCode: "VCB", accountNumber: "0123456789", accountName: "TEST" });
    const missingBoth = createVietQrPaymentData(order, { mode: "sandbox" });
    const disabled = createVietQrPaymentData(order, { mode: "disabled", bankCode: "VCB", accountNumber: "0123456789", accountName: "TEST", webhookSecret: "test-only" });
    expect(missingBank).toMatchObject({ qrImageUrl: null, providerReady: false, setupStatus: "bank_details_missing" });
    expect(missingWebhook).toMatchObject({ qrImageUrl: null, providerReady: false, setupStatus: "webhook_secret_missing" });
    expect(missingBoth).toMatchObject({ qrImageUrl: null, providerReady: false, setupStatus: "bank_and_webhook_missing" });
    expect(disabled).toMatchObject({ qrImageUrl: null, providerReady: false, setupStatus: "payments_disabled" });
  });

  it("rejects malformed order codes and invalid amounts before creating a QR", () => {
    expect(() => buildVietQrUrl("VCB", "0123456789", "TEST", "MP0123456789", 0)).toThrow("invalid_payment_amount");
    expect(() => buildVietQrUrl("VCB", "0123456789", "TEST", "NOT-AN-ORDER", 70000)).toThrow("invalid_payment_order_code");
  });
});

describe("SePay signed bank transfer adapter", () => {
  const now = 1_800_000_000;
  const timestamp = String(now);
  const payload = {
    id: 12345,
    gateway: "MBBank",
    transactionDate: "2025-01-15 10:30:00",
    accountNumber: "0123456789",
    subAccount: null,
    code: "MPB795009345",
    content: "MATHPATH MPB795009345",
    transferType: "in",
    description: "NGUYEN VAN A chuyen tien",
    transferAmount: 125000,
    accumulated: 5000000,
    referenceCode: "FT25015ABC123",
  };

  it("verifies SePay's timestamp.raw-body HMAC and rejects stale or invalid signatures", () => {
    const raw = new TextEncoder().encode(JSON.stringify(payload));
    const digest = createHmac("sha256", "test-secret").update(timestamp).update(".").update(raw).digest("hex");
    const signature = `sha256=${digest}`;
    expect(verifySePayWebhook(raw, signature, timestamp, "test-secret", now)).toBe(true);
    expect(verifySePayWebhook(raw, signature, timestamp, "test-secret", now + 301)).toBe(false);
    expect(verifySePayWebhook(raw, signature, null, "test-secret", now)).toBe(false);
    expect(verifySePayWebhook(raw, `sha256=${"0".repeat(64)}`, timestamp, "test-secret", now)).toBe(false);
    expect(verifySePayWebhook(raw, signature, timestamp, undefined, now)).toBe(false);
  });

  it("parses only incoming transactions with the expected unique payment code", () => {
    expect(parseSePayWebhook(payload)).toMatchObject({
      eventId: "12345",
      orderCode: "MPB795009345",
      transactionId: "12345",
      amountVnd: 125000,
      description: "MATHPATH MPB795009345",
    });
    expect(parseSePayWebhook({ ...payload, transferType: "out" })).toBeNull();
    expect(parseSePayWebhook({ ...payload, transferAmount: 0 })).toBeNull();
    expect(parseSePayWebhook({ ...payload, code: "MPNOTVALID!" })).toBeNull();
    expect(parseSePayWebhook({ ...payload, id: "12345" })).toBeNull();
  });

  it("retains the previous generic HMAC contract without treating it as SePay", () => {
    const raw = new TextEncoder().encode(JSON.stringify({
      event_id: "event-1", status: "paid", order_code: "MP0123456789", amount_vnd: 125000,
    }));
    const signature = createHmac("sha256", "generic-test-secret").update(raw).digest("hex");
    expect(verifyHmacWebhook(raw, signature, "generic-test-secret")).toBe(true);
    expect(parseGenericPaymentWebhook(JSON.parse(new TextDecoder().decode(raw)))).toMatchObject({
      eventId: "event-1", orderCode: "MP0123456789", amountVnd: 125000,
    });
  });
});
