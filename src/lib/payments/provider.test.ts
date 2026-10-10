import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  buildVietQrUrl,
  createSePayCheckoutFields,
  createVietQrPaymentData,
  parseGenericPaymentWebhook,
  parseSePayGatewayIpn,
  parseSePayWebhook,
  verifyHmacWebhook,
  verifySePayGatewayIpn,
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

describe("SePay Payment Gateway hosted checkout and IPN", () => {
  const order = { orderId: "471d6c41-010d-4050-b7e5-1a75b8917b52", orderCode: "MPB795009345", amountVnd: 125000 };
  const config = {
    mode: "sandbox" as const,
    environment: "sandbox" as const,
    merchantId: "SP-TEST-MERCHANT",
    secretKey: "sandbox-test-secret",
    appUrl: "https://preview.mathpath.example",
  };

  it("creates a signed server-derived hosted checkout form for the exact order", () => {
    const result = createSePayCheckoutFields(order, config);
    expect(result).toMatchObject({
      provider: "sepay_gateway",
      providerReady: true,
      checkoutUrl: "https://pay-sandbox.sepay.vn/v1/checkout/init",
    });
    const fields = result.checkoutFields!;
    expect(fields.order_amount).toBe("125000");
    expect(fields.order_invoice_number).toBe("MPB795009345");
    expect(fields.payment_method).toBe("BANK_TRANSFER");
    expect(fields.currency).toBe("VND");
    expect(fields.success_url).toContain(order.orderId);
    expect(fields.signature).toBe(createHmac("sha256", config.secretKey)
      .update([
        `order_amount=${fields.order_amount}`,
        `merchant=${fields.merchant}`,
        `currency=${fields.currency}`,
        `operation=${fields.operation}`,
        `order_description=${fields.order_description}`,
        `order_invoice_number=${fields.order_invoice_number}`,
        `payment_method=${fields.payment_method}`,
        `success_url=${fields.success_url}`,
        `error_url=${fields.error_url}`,
        `cancel_url=${fields.cancel_url}`,
      ].join(","))
      .digest("base64"));
  });

  it.each([["PLUS", 70000], ["PRO", 100000], ["PRO MAX", 125000]])(
    "signs the database amount for the %s plan", (_plan, amount) => {
      const fields = createSePayCheckoutFields({ ...order, amountVnd: amount }, config).checkoutFields;
      expect(fields?.order_amount).toBe(String(amount));
    },
  );

  it("keeps the gateway fail-closed when credentials, mode, or environment are invalid", () => {
    expect(createSePayCheckoutFields(order, { ...config, mode: "disabled" }))
      .toMatchObject({ providerReady: false, checkoutUrl: null, checkoutFields: null, setupStatus: "payments_disabled" });
    expect(createSePayCheckoutFields(order, { ...config, secretKey: undefined }))
      .toMatchObject({ providerReady: false, setupStatus: "gateway_credentials_missing" });
    expect(createSePayCheckoutFields(order, { ...config, environment: "production" }))
      .toMatchObject({ providerReady: false, setupStatus: "environment_mismatch" });
    expect(() => createSePayCheckoutFields({ ...order, amountVnd: 0 }, config)).toThrow("invalid_sepay_checkout_order");
    expect(() => createSePayCheckoutFields({ ...order, orderId: undefined }, config)).toThrow("invalid_sepay_checkout_order_id");
  });

  it("authenticates SePay's configured IPN secret with constant-time comparison", () => {
    expect(verifySePayGatewayIpn("sandbox-test-secret", "sandbox-test-secret")).toBe(true);
    expect(verifySePayGatewayIpn("wrong-secret", "sandbox-test-secret")).toBe(false);
    expect(verifySePayGatewayIpn(null, "sandbox-test-secret")).toBe(false);
  });

  it("accepts only captured, approved VND payment IPNs whose order and transaction amounts match", () => {
    const payload = {
      timestamp: 1757058220,
      notification_type: "ORDER_PAID",
      order: {
        id: "e2c195be-c721-47eb-b323-99ab24e52d85",
        order_id: "NPSETVI00101000042R",
        order_status: "CAPTURED",
        order_currency: "VND",
        order_amount: "125000.00",
        order_invoice_number: order.orderCode,
        order_description: `MathPath ${order.orderCode}`,
      },
      transaction: {
        id: "384c66dd-41e6-4316-a544-b4141682595c",
        payment_method: "BANK_TRANSFER",
        transaction_id: "68ba94ac80123",
        transaction_type: "PAYMENT",
        transaction_status: "APPROVED",
        transaction_amount: "125000",
        transaction_currency: "VND",
      },
    };
    expect(parseSePayGatewayIpn(payload)).toMatchObject({
      eventId: payload.transaction.id,
      orderCode: order.orderCode,
      transactionId: payload.transaction.transaction_id,
      amountVnd: order.amountVnd,
    });
    expect(parseSePayGatewayIpn({ ...payload, transaction: { ...payload.transaction, transaction_amount: "1" } })).toBeNull();
    expect(parseSePayGatewayIpn({ ...payload, order: { ...payload.order, order_status: "PENDING" } })).toBeNull();
    expect(parseSePayGatewayIpn({ ...payload, transaction: { ...payload.transaction, payment_method: "CARD" } })).toBeNull();
    expect(parseSePayGatewayIpn({ ...payload, transaction: { ...payload.transaction, transaction_type: "REFUND" } })).toBeNull();
    expect(parseSePayGatewayIpn({ ...payload, notification_type: "TRANSACTION_VOID" })).toBeNull();
  });

  it("returns the same event key for repeated IPNs so the database can enforce idempotency", () => {
    const payload = {
      timestamp: 1757058220,
      notification_type: "ORDER_PAID",
      order: { order_status: "CAPTURED", order_currency: "VND", order_amount: 70000, order_invoice_number: "MP0123456789" },
      transaction: { id: "event-1", payment_method: "BANK_TRANSFER", transaction_id: "transaction-1", transaction_type: "PAYMENT", transaction_status: "APPROVED", transaction_amount: 70000, transaction_currency: "VND" },
    };
    expect(parseSePayGatewayIpn(payload)?.eventId).toBe(parseSePayGatewayIpn(payload)?.eventId);
  });
});
