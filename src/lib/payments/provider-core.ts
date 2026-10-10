import { createHmac, timingSafeEqual } from "node:crypto";

export type ParsedPaymentWebhook = {
  eventId: string;
  orderCode: string;
  transactionId: string | null;
  providerReference: string | null;
  amountVnd: number;
  description: string;
};

export type VietQrOrder = { orderCode: string; amountVnd: number; orderId?: string };
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

export type SePayCheckoutFields = Record<string, string>;

export type SePayCheckoutConfig = {
  mode?: "disabled" | "sandbox" | "live";
  environment?: "sandbox" | "production";
  merchantId?: string;
  secretKey?: string;
  appUrl?: string;
};

export type SePayGatewayPaymentData = {
  provider: "sepay_gateway";
  checkoutUrl: string | null;
  checkoutFields: SePayCheckoutFields | null;
  providerReady: boolean;
  setupStatus: "ready" | "payments_disabled" | "gateway_credentials_missing" | "environment_mismatch";
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

const SEPAY_GATEWAY_SIGNED_FIELDS = [
  "order_amount",
  "merchant",
  "currency",
  "operation",
  "order_description",
  "order_invoice_number",
  "customer_id",
  "payment_method",
  "success_url",
  "error_url",
  "cancel_url",
] as const;

export function createSePayCheckoutFields(
  order: VietQrOrder,
  config: SePayCheckoutConfig,
): SePayGatewayPaymentData {
  const paymentEnabled = config.mode === "sandbox" || config.mode === "live";
  const credentialsReady = Boolean(config.merchantId && config.secretKey && config.appUrl);
  const environmentMatches = (config.mode === "sandbox" && config.environment === "sandbox") ||
    (config.mode === "live" && config.environment === "production");
  const providerReady = paymentEnabled && credentialsReady && environmentMatches;
  const setupStatus = !paymentEnabled
    ? "payments_disabled"
    : !credentialsReady
      ? "gateway_credentials_missing"
      : !environmentMatches
        ? "environment_mismatch"
        : "ready";

  if (!providerReady) {
    return { provider: "sepay_gateway", checkoutUrl: null, checkoutFields: null, providerReady, setupStatus };
  }

  if (!Number.isSafeInteger(order.amountVnd) || order.amountVnd <= 0 || !/^MP[A-F\d]{10}$/i.test(order.orderCode)) {
    throw new Error("invalid_sepay_checkout_order");
  }
  const appUrl = new URL(config.appUrl!);
  const resultOrderId = order.orderId;
  if (!resultOrderId || !/^[0-9a-f-]{36}$/i.test(resultOrderId)) throw new Error("invalid_sepay_checkout_order_id");
  const resultUrl = new URL(`/checkout/${encodeURIComponent(resultOrderId)}`, appUrl);
  // Browser return URLs are UX only. They never mark an order paid.
  const fields: SePayCheckoutFields = {
    order_amount: String(order.amountVnd),
    merchant: config.merchantId!,
    currency: "VND",
    operation: "PURCHASE",
    order_description: `MathPath ${order.orderCode.toUpperCase()}`,
    order_invoice_number: order.orderCode.toUpperCase(),
    payment_method: "BANK_TRANSFER",
    success_url: new URL("?payment=return", resultUrl).toString(),
    error_url: new URL("?payment=error", resultUrl).toString(),
    cancel_url: new URL("?payment=cancel", resultUrl).toString(),
  };
  const signedText = SEPAY_GATEWAY_SIGNED_FIELDS
    .filter((key) => fields[key] !== undefined && fields[key] !== "")
    .map((key) => `${key}=${fields[key]}`)
    .join(",");
  fields.signature = createHmac("sha256", config.secretKey!).update(signedText).digest("base64");

  return {
    provider: "sepay_gateway",
    checkoutUrl: config.environment === "sandbox"
      ? "https://pay-sandbox.sepay.vn/v1/checkout/init"
      : "https://pay.sepay.vn/v1/checkout/init",
    checkoutFields: fields,
    providerReady,
    setupStatus,
  };
}

export function verifySePayGatewayIpn(secretHeader: string | null, expectedSecret: string | undefined): boolean {
  if (!secretHeader || !expectedSecret) return false;
  const provided = Buffer.from(secretHeader);
  const expected = Buffer.from(expectedSecret);
  return provided.length === expected.length && timingSafeEqual(provided, expected);
}

export function parseSePayGatewayIpn(payload: unknown): ParsedPaymentWebhook | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  const root = payload as Record<string, unknown>;
  if (root.notification_type !== "ORDER_PAID") return null;
  if (!Number.isSafeInteger(root.timestamp) || (root.timestamp as number) <= 0) return null;
  const order = root.order;
  const transaction = root.transaction;
  if (!order || typeof order !== "object" || Array.isArray(order) || !transaction || typeof transaction !== "object" || Array.isArray(transaction)) return null;
  const orderData = order as Record<string, unknown>;
  const transactionData = transaction as Record<string, unknown>;
  const amount = parseVndAmount(orderData.order_amount);
  const transactionAmount = parseVndAmount(transactionData.transaction_amount);
  if (orderData.order_status !== "CAPTURED" || transactionData.payment_method !== "BANK_TRANSFER" || transactionData.transaction_type !== "PAYMENT" || transactionData.transaction_status !== "APPROVED") return null;
  if (orderData.order_currency !== "VND" || transactionData.transaction_currency !== "VND" || amount === null || amount !== transactionAmount) return null;
  const invoice = orderData.order_invoice_number;
  const transactionId = transactionData.transaction_id;
  const eventId = transactionData.id;
  if (typeof invoice !== "string" || !/^MP[A-F\d]{10}$/i.test(invoice)) return null;
  if (typeof transactionId !== "string" || transactionId.length < 1 || transactionId.length > 200) return null;
  if (typeof eventId !== "string" || eventId.length < 1 || eventId.length > 200) return null;
  return {
    eventId,
    orderCode: invoice.toUpperCase(),
    transactionId,
    providerReference: boundedString(orderData.order_id, 200),
    amountVnd: amount,
    description: boundedString(orderData.order_description, 500) ?? "",
  };
}

function parseVndAmount(value: unknown): number | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const text = String(value);
  if (!/^\d+(?:\.\d{1,2})?$/.test(text)) return null;
  const parsed = Number(text);
  return Number.isSafeInteger(parsed) ? parsed : null;
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
