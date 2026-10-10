import "server-only";

import { readServerEnv } from "@/lib/config/env";
import {
  buildVietQrUrl,
  createVietQrPaymentData,
  parseGenericPaymentWebhook,
  parseSePayWebhook,
  verifyHmacWebhook,
  verifySePayWebhook,
  type ParsedPaymentWebhook,
} from "./provider-core";

export type PaymentOrderForProvider = {
  id: string;
  orderCode: string;
  amountVnd: number;
  expiresAt: string;
};

export type PaymentDisplayData = {
  provider: string | null;
  bankCode: string | null;
  accountNumber: string | null;
  accountName: string | null;
  transferDescription: string;
  qrImageUrl: string | null;
  providerReady: boolean;
  setupStatus: "ready" | "provider_not_configured" | "payments_disabled" | "bank_details_missing" | "webhook_secret_missing" | "bank_and_webhook_missing";
};

export interface PaymentProvider {
  readonly name: string;
  createPayment(order: PaymentOrderForProvider): PaymentDisplayData;
  verifyWebhook(rawBody: Uint8Array, signature: string | null, timestamp?: string | null): boolean;
  parseTransaction(payload: unknown): ParsedPaymentWebhook | null;
}

export function getPaymentProvider(name: string | undefined = readServerEnv().PAYMENT_PROVIDER): PaymentProvider | null {
  if (name === "sepay") return new SePayBankTransferProvider();
  if (name === "generic_hmac") return new GenericHmacBankTransferProvider();
  return null;
}

class SePayBankTransferProvider implements PaymentProvider {
  readonly name = "sepay";

  createPayment(order: PaymentOrderForProvider): PaymentDisplayData {
    const env = readServerEnv();
    return createVietQrPaymentData(order, {
      mode: env.PAYMENT_MODE,
      bankCode: env.PAYMENT_BANK_CODE,
      accountNumber: env.PAYMENT_BANK_ACCOUNT,
      accountName: env.PAYMENT_ACCOUNT_NAME,
      webhookSecret: env.PAYMENT_WEBHOOK_SECRET,
    });
  }

  verifyWebhook(rawBody: Uint8Array, signature: string | null, timestamp: string | null = null): boolean {
    const env = readServerEnv();
    return env.PAYMENT_MODE !== "disabled" &&
      verifySePayWebhook(rawBody, signature, timestamp, env.PAYMENT_WEBHOOK_SECRET);
  }

  parseTransaction(payload: unknown): ParsedPaymentWebhook | null {
    return parseSePayWebhook(payload);
  }
}

class GenericHmacBankTransferProvider implements PaymentProvider {
  readonly name = "generic_hmac";

  createPayment(order: PaymentOrderForProvider): PaymentDisplayData {
    const env = readServerEnv();
    const bankReady = Boolean(env.PAYMENT_BANK_CODE && env.PAYMENT_BANK_ACCOUNT && env.PAYMENT_ACCOUNT_NAME);
    const providerReady = env.PAYMENT_MODE !== "disabled" && bankReady && Boolean(env.PAYMENT_WEBHOOK_SECRET);
    const qrImageUrl = providerReady
      ? buildVietQrUrl(env.PAYMENT_BANK_CODE!, env.PAYMENT_BANK_ACCOUNT!, env.PAYMENT_ACCOUNT_NAME!, order.orderCode, order.amountVnd)
      : null;
    const setupStatus = env.PAYMENT_MODE === "disabled"
      ? "payments_disabled"
      : providerReady
        ? "ready"
        : bankReady
        ? "webhook_secret_missing"
        : env.PAYMENT_WEBHOOK_SECRET
          ? "bank_details_missing"
          : "bank_and_webhook_missing";
    return {
      provider: this.name,
      bankCode: env.PAYMENT_BANK_CODE ?? null,
      accountNumber: env.PAYMENT_BANK_ACCOUNT ?? null,
      accountName: env.PAYMENT_ACCOUNT_NAME ?? null,
      transferDescription: `MATHPATH ${order.orderCode.toUpperCase()}`,
      qrImageUrl,
      providerReady,
      setupStatus,
    };
  }

  verifyWebhook(rawBody: Uint8Array, signature: string | null): boolean {
    const env = readServerEnv();
    return env.PAYMENT_MODE !== "disabled" && verifyHmacWebhook(rawBody, signature, env.PAYMENT_WEBHOOK_SECRET);
  }

  parseTransaction(payload: unknown): ParsedPaymentWebhook | null {
    return parseGenericPaymentWebhook(payload);
  }
}
