# Phase 10 payment integration

## Data ownership

- `public.plans` remains the canonical plan catalog. Phase 10 adds `currency` and `duration_days`; `subscription_plans` is a compatibility view.
- `public.payment_orders` remains the canonical order table. It receives order code and immutable plan-name/code snapshots; `orders` is a compatibility view.
- `public.subscriptions` is the subscription history and current active-term ledger. `profiles.vip_*` and `credit_accounts.paid_plan_slug` are kept as an atomic compatibility projection for the existing server quota implementation.
- `payment_transactions` and `payment_webhook_events` record verified provider callbacks. Client roles cannot write these records.

## Current provider adapters

The app supports two different SePay integrations and keeps `generic_hmac` only as a legacy contract:

- `PAYMENT_PROVIDER=sepay` is SePay's bank-balance webhook adapter. It verifies `X-SePay-Signature` and `X-SePay-Timestamp` over `{timestamp}.{raw_body}` and parses bank transaction events.
- `PAYMENT_PROVIDER=sepay_gateway` is SePay's hosted Payment Gateway. MathPath creates the signed `BANK_TRANSFER` form on the server from the saved order, then the browser posts those signed fields to SePay's Sandbox or Production checkout URL. The IPN endpoint is `/api/payments/webhook/sepay_gateway`; it verifies the configured `X-Secret-Key` using constant-time comparison and accepts only `ORDER_PAID`, `CAPTURED`, `PAYMENT`, `APPROVED`, VND callbacks whose order and transaction amounts agree. The database RPC still checks the actual MathPath order code, amount, pending status, expiry and duplicate event/transaction IDs before activating a subscription.

SePay browser return URLs are only navigation; they never activate a subscription. The hosted gateway, not MathPath, presents the bank-transfer QR.

The VietQR Quick Link is assembled on the server from the saved order's amount and unique code, plus server environment bank configuration. The description is `MATHPATH <ORDER_CODE>`. No client-provided price or status is used. A QR is not returned unless the bank details and webhook secret are all present; checkout says which configuration is missing and never marks an order paid by itself.

The legacy `generic_hmac` adapter expects this JSON shape and an HMAC-SHA256 hex signature in `x-mathpath-signature` over the raw request bytes:

```json
{
  "event_id": "unique-provider-event-id",
  "status": "paid",
  "order_code": "MP0123456789",
  "amount_vnd": 100000,
  "transaction_id": "unique-bank-transaction-id",
  "reference": "provider-reference",
  "description": "MP0123456789"
}
```

The generic adapter is not SePay-compatible. Do not point SePay at it. A provider credential/API key is not required for the SePay HMAC webhook; `PAYMENT_PROVIDER_API_KEY` is unused by this integration.

## Required environment configuration

Configure these only in the deployment secret manager, never in client code or Git:

- Choose exactly one provider: `PAYMENT_PROVIDER=sepay_gateway` for SePay's hosted checkout (the integration shown by the PHP sample) or `PAYMENT_PROVIDER=sepay` for direct bank transfer plus balance webhooks.
- `PAYMENT_MODE=disabled` by default; use `sandbox` only with SePay Test mode and an isolated test database. Set `live` only after end-to-end sandbox verification and the owner's production go-live decision.
- For the hosted gateway, set `PAYMENT_PROVIDER=sepay_gateway`, `SEPAY_ENVIRONMENT=sandbox`, `SEPAY_MERCHANT_ID`, and `SEPAY_SECRET_KEY` from the SePay Sandbox integration panel. Keep credentials server-only. `PAYMENT_MODE=sandbox` is required to enable the hosted form.
- Configure the gateway IPN authentication as `SECRET_KEY` and the endpoint `https://<preview-host>/api/payments/webhook/sepay_gateway`. SePay's IPN `X-Secret-Key` must match the server-side `SEPAY_SECRET_KEY`.
- For bank-balance webhooks only, `PAYMENT_WEBHOOK_SECRET` is the SePay webhook signing secret; it is not interchangeable with the Payment Gateway secret.
- `PAYMENT_BANK_CODE`, `PAYMENT_BANK_ACCOUNT`, and `PAYMENT_ACCOUNT_NAME` with the receiving account details.
- Gateway Live uses `SEPAY_ENVIRONMENT=production`, production merchant credentials, `PAYMENT_MODE=live`, and IPN URL `https://mathpath.com.vn/api/payments/webhook/sepay_gateway`. Do not enable this until Sandbox end-to-end tests pass.

When provider configuration is incomplete, or `PAYMENT_MODE=disabled`, the system can still create an owned pending order, but checkout hides the SePay form/QR. It never reports a payment as successful from the browser. Provider callbacks are rejected while payment mode is disabled or authentication credentials are missing. A sandbox webhook must be tested against an isolated sandbox database; do not use Production credentials for simulated transactions.

## Apply and verify

The payment migrations were previously reconciled and recorded as applied on Production by the project owner. This code change does not modify database schema or data. Before accepting real payments, configure the Live Vercel variables and SePay webhook, then complete sandbox end-to-end verification with an isolated database. Do not treat unit/contract tests as a verified SePay delivery.
