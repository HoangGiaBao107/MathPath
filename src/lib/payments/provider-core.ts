import { createHmac, timingSafeEqual } from "node:crypto";

export type ParsedPaymentWebhook = {
  eventId: string;
  orderCode: string;
  transactionId: string | null;
  providerReference: string | null;
  amountVnd: number;
  description: string;
};

export type VietQrOrder = { orderCode: string; amountVnd: number };
export type VietQrConfig = {
  mode?: "disabled" | "sandbox" | "live";
  bankCode?: string;
  accountNumber?: string;
  accountName?: string;
  webhookSecret?: string;
};
export type VietQrPaymentData = {
  provider: "sepay";
  bankCode: string | null;
  accountNumber: string | null;
  accountName: string | null;
  transferDescription: string;
  qrImageUrl: string | null;
  providerReady: boolean;
  setupStatus: "ready" | "payments_disabled" | "bank_details_missing" | "webhook_secret_missing" | "bank_and_webhook_missing";
};

const SEPAY_CLOCK_SKEW_SECONDS = 300;

export function verifySePayWebhook(
  rawBody: Uint8Array,
  signature: string | null,
  timestamp: string | null,
  secret: string | undefined,
  nowSeconds = Math.floor(Date.now() / 1000),
): boolean {
  if (!secret || !signature || !timestamp || !/^\d{1,12}$/.test(timestamp)) return false;
  const timestampSeconds = Number(timestamp);
  if (!Number.isSafeInteger(timestampSeconds) || Math.abs(nowSeconds - timestampSeconds) > SEPAY_CLOCK_SKEW_SECONDS) return false;
  const match = /^sha256=([a-f\d]{64})$/i.exec(signature);
  if (!match) return false;
  const expected = createHmac("sha256", secret).update(timestamp).update(".").update(rawBody).digest();
  const actual = Buffer.from(match[1], "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function parseSePayWebhook(payload: unknown): ParsedPaymentWebhook | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  const record = payload as Record<string, unknown>;
  if (!Number.isSafeInteger(record.id) || (record.id as number) <= 0) return null;
  if (record.transferType !== "in" || !Number.isSafeInteger(record.transferAmount) || (record.transferAmount as number) <= 0) return null;
  if (typeof record.code !== "string" || !/^MP[A-F\d]{10}$/i.test(record.code)) return null;
  return {
    eventId: String(record.id),
    orderCode: record.code.toUpperCase(),
    transactionId: String(record.id),
    providerReference: boundedString(record.referenceCode, 200),
    amountVnd: record.transferAmount as number,
    description: boundedString(record.content, 500) ?? "",
  };
}

export function verifyHmacWebhook(rawBody: Uint8Array, signature: string | null, secret: string | undefined): boolean {
  if (!secret || !signature || !/^[a-f\d]{64}$/i.test(signature)) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest();
  const actual = Buffer.from(signature, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function parseGenericPaymentWebhook(payload: unknown): ParsedPaymentWebhook | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  const record = payload as Record<string, unknown>;
  if (
    typeof record.event_id !== "string" || record.event_id.length < 1 || record.event_id.length > 160 ||
    typeof record.order_code !== "string" || !/^MP[A-F\d]{10}$/i.test(record.order_code) ||
    !Number.isSafeInteger(record.amount_vnd) || (record.amount_vnd as number) <= 0 ||
    typeof record.status !== "string" || record.status.toLowerCase() !== "paid"
  ) return null;
  return {
    eventId: record.event_id,
    orderCode: record.order_code.toUpperCase(),
    transactionId: boundedString(record.transaction_id, 160),
    providerReference: boundedString(record.reference, 200),
    amountVnd: record.amount_vnd as number,
    description: boundedString(record.description, 500) ?? "",
  };
}

export function buildVietQrUrl(bankCode: string, account: string, accountName: string, orderCode: string, amountVnd: number) {
  if (!Number.isSafeInteger(amountVnd) || amountVnd <= 0) throw new Error("invalid_payment_amount");
  if (!/^MP[A-F\d]{10}$/i.test(orderCode)) throw new Error("invalid_payment_order_code");
  const imagePath = [bankCode, account, "print.png"].map(encodeURIComponent).join("-");
  const params = new URLSearchParams({ amount: String(amountVnd), addInfo: `MATHPATH ${orderCode.toUpperCase()}`, accountName });
  return `https://img.vietqr.io/image/${imagePath}?${params.toString()}`;
}

export function createVietQrPaymentData(order: VietQrOrder, config: VietQrConfig): VietQrPaymentData {
  const paymentEnabled = config.mode === "sandbox" || config.mode === "live";
  const bankConfigured = Boolean(config.bankCode && config.accountNumber && config.accountName);
  const webhookConfigured = Boolean(config.webhookSecret);
  const providerReady = paymentEnabled && bankConfigured && webhookConfigured;
  const setupStatus = !paymentEnabled
    ? "payments_disabled"
    : providerReady
    ? "ready"
    : bankConfigured
      ? "webhook_secret_missing"
      : webhookConfigured
        ? "bank_details_missing"
        : "bank_and_webhook_missing";
  return {
    provider: "sepay",
    bankCode: config.bankCode ?? null,
    accountNumber: config.accountNumber ?? null,
    accountName: config.accountName ?? null,
    transferDescription: `MATHPATH ${order.orderCode.toUpperCase()}`,
    // Do not invite a transfer unless the server can verify its webhook as well.
    qrImageUrl: providerReady
      ? buildVietQrUrl(config.bankCode!, config.accountNumber!, config.accountName!, order.orderCode, order.amountVnd)
      : null,
    providerReady,
    setupStatus,
  };
}

function boundedString(value: unknown, max: number): string | null {
  return typeof value === "string" && value.length > 0 && value.length <= max ? value : null;
}
