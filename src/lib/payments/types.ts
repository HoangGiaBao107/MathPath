export type PaymentOrderRequest = {
  orderId: string;
  paymentCode: string;
  amountVnd: number;
  description: string;
  expiresAt: string;
};

export type PaymentOrderResult = {
  providerOrderId: string;
  qrPayload: string;
  checkoutUrl?: string;
};

export type ProviderTransaction = {
  transactionId: string;
  paymentCode: string;
  amountVnd: number;
  occurredAt: string;
};

export interface PaymentProvider {
  createPaymentOrder(request: PaymentOrderRequest): Promise<PaymentOrderResult>;
  verifyWebhook(rawBody: Uint8Array, signature: string | null): Promise<boolean>;
  parseTransaction(rawBody: Uint8Array): Promise<ProviderTransaction>;
}

export class PaymentProviderNotConfiguredError extends Error {
  constructor(providerName: string) {
    super(`The ${providerName} payment provider is not configured.`);
    this.name = "PaymentProviderNotConfiguredError";
  }
}
