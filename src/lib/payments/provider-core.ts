import { createHmac, timingSafeEqual } from "node:crypto";

export type ParsedPaymentWebhook = {
  eventId: string;
  orderCode: string;
  transactionId: string | null;
  providerReference: string | null;
  amountVnd: number;
  description: string;
};

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
  const params = new URLSearchParams({ amount: String(amountVnd), addInfo: orderCode, accountName });
  return `https://img.vietqr.io/image/${encodeURIComponent(bankCode)}-${encodeURIComponent(account)}-compact2.png?${params}`;
}

function boundedString(value: unknown, max: number): string | null {
  return typeof value === "string" && value.length > 0 && value.length <= max ? value : null;
}
