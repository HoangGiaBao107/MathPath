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

export function buildVietQrUrl(bankCode: string, account: string, accountName: string, orderCode: string, amountVnd: number) {
  if (!Number.isSafeInteger(amountVnd) || amountVnd <= 0) throw new Error("invalid_payment_amount");
  if (!/^MP[A-F\d]{10}$/i.test(orderCode)) throw new Error("invalid_payment_order_code");
  const imagePath = [bankCode, account, "compact2.png"].map(encodeURIComponent).join("-");
  const url = new URL(`https://img.vietqr.io/image/${imagePath}`);
  url.search = new URLSearchParams({ amount: String(amountVnd), addInfo: orderCode, accountName }).toString();
  return url.toString();
}

export function createVietQrPaymentData(order: VietQrOrder, config: VietQrConfig): VietQrPaymentData {
  const bankConfigured = Boolean(config.bankCode && config.accountNumber && config.accountName);
  return {
    provider: "sepay",
    bankCode: config.bankCode ?? null,
    accountNumber: config.accountNumber ?? null,
    accountName: config.accountName ?? null,
    transferDescription: order.orderCode,
    qrImageUrl: bankConfigured
      ? buildVietQrUrl(config.bankCode!, config.accountNumber!, config.accountName!, order.orderCode, order.amountVnd)
      : null,
    providerReady: bankConfigured && Boolean(config.webhookSecret),
  };
}

function boundedString(value: unknown, max: number): string | null {
  return typeof value === "string" && value.length > 0 && value.length <= max ? value : null;
}
