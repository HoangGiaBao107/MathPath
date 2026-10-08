import "server-only";

import { readServerEnv } from "@/lib/config/env";
import { buildVietQrUrl, parseGenericPaymentWebhook, verifyHmacWebhook, type ParsedPaymentWebhook } from "./provider-core";

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
};

export interface PaymentProvider {
  readonly name: string;
  createPayment(order: PaymentOrderForProvider): PaymentDisplayData;
  verifyWebhook(rawBody: Uint8Array, signature: string | null): boolean;
  parseTransaction(payload: unknown): ParsedPaymentWebhook | null;
}

export function getPaymentProvider(name: string | undefined = readServerEnv().PAYMENT_PROVIDER): PaymentProvider | null {
  if (name !== "generic_hmac") return null;
  return new GenericHmacBankTransferProvider();
}

class GenericHmacBankTransferProvider implements PaymentProvider {
  readonly name = "generic_hmac";

  createPayment(order: PaymentOrderForProvider): PaymentDisplayData {
    const env = readServerEnv();
    const bankReady = Boolean(env.PAYMENT_BANK_CODE && env.PAYMENT_BANK_ACCOUNT && env.PAYMENT_ACCOUNT_NAME);
    const qrImageUrl = bankReady
      ? buildVietQrUrl(env.PAYMENT_BANK_CODE!, env.PAYMENT_BANK_ACCOUNT!, env.PAYMENT_ACCOUNT_NAME!, order.orderCode, order.amountVnd)
      : null;
    return {
      provider: this.name,
      bankCode: env.PAYMENT_BANK_CODE ?? null,
      accountNumber: env.PAYMENT_BANK_ACCOUNT ?? null,
      accountName: env.PAYMENT_ACCOUNT_NAME ?? null,
      transferDescription: order.orderCode,
      qrImageUrl,
      providerReady: bankReady && Boolean(env.PAYMENT_WEBHOOK_SECRET),
    };
  }

  verifyWebhook(rawBody: Uint8Array, signature: string | null): boolean {
    return verifyHmacWebhook(rawBody, signature, readServerEnv().PAYMENT_WEBHOOK_SECRET);
  }

  parseTransaction(payload: unknown): ParsedPaymentWebhook | null {
    return parseGenericPaymentWebhook(payload);
  }
}
