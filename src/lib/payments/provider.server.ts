import "server-only";

import { readServerEnv } from "@/lib/config/env";
import { createVietQrPaymentData, parseSePayWebhook, verifySePayWebhook, type ParsedPaymentWebhook } from "./provider-core";

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
  verifyWebhook(rawBody: Uint8Array, signature: string | null, timestamp: string | null): boolean;
  parseTransaction(payload: unknown): ParsedPaymentWebhook | null;
}

export function getPaymentProvider(name: string | undefined = readServerEnv().PAYMENT_PROVIDER): PaymentProvider | null {
  if (name !== "sepay") return null;
  return new SePayBankTransferProvider();
}

class SePayBankTransferProvider implements PaymentProvider {
  readonly name = "sepay";

  createPayment(order: PaymentOrderForProvider): PaymentDisplayData {
    const env = readServerEnv();
    return createVietQrPaymentData(order, {
      bankCode: env.PAYMENT_BANK_CODE,
      accountNumber: env.PAYMENT_BANK_ACCOUNT,
      accountName: env.PAYMENT_ACCOUNT_NAME,
      webhookSecret: env.PAYMENT_WEBHOOK_SECRET,
    });
  }

  verifyWebhook(rawBody: Uint8Array, signature: string | null, timestamp: string | null): boolean {
    return verifySePayWebhook(rawBody, signature, timestamp, readServerEnv().PAYMENT_WEBHOOK_SECRET);
  }

  parseTransaction(payload: unknown): ParsedPaymentWebhook | null {
    return parseSePayWebhook(payload);
  }
}
