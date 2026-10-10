# Phase 10 payment integration

## Data ownership

- `public.plans` remains the canonical plan catalog. Phase 10 adds `currency` and `duration_days`; `subscription_plans` is a compatibility view.
- `public.payment_orders` remains the canonical order table. It receives order code and immutable plan-name/code snapshots; `orders` is a compatibility view.
- `public.subscriptions` is the subscription history and current active-term ledger. `profiles.vip_*` and `credit_accounts.paid_plan_slug` are kept as an atomic compatibility projection for the existing server quota implementation.
- `payment_transactions` and `payment_webhook_events` record verified provider callbacks. Client roles cannot write these records.

## Current provider adapters

The app supports `sepay` and keeps `generic_hmac` only as a legacy integration contract. Select `PAYMENT_PROVIDER=sepay` for the SePay webhook adapter. It verifies SePay's `X-SePay-Signature` and `X-SePay-Timestamp` HMAC-SHA256 headers over `{timestamp}.{raw_body}` and accepts the documented JSON fields `id`, `code`, `content`, `transferType`, `transferAmount`, and `referenceCode`. It rejects outgoing transfers and payment codes that are not exactly `MP` plus ten hexadecimal characters. The server-side payment RPC remains responsible for exact order/amount/status/expiry checks and idempotent subscription activation.

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

- `PAYMENT_PROVIDER=sepay`.
- `PAYMENT_MODE=disabled` by default; use `sandbox` only with SePay Test mode and an isolated test database. Set `live` only after end-to-end sandbox verification and the owner's production go-live decision.
- `PAYMENT_WEBHOOK_SECRET` as the exact SePay HMAC Secret Key; keep it server-only.
- `PAYMENT_BANK_CODE`, `PAYMENT_BANK_ACCOUNT`, and `PAYMENT_ACCOUNT_NAME` with the receiving account details.
- SePay webhook URL: `https://mathpath.com.vn/api/payments/webhook/sepay` for Live, or the equivalent route on the explicitly selected sandbox host during isolated sandbox testing.

When provider or bank configuration is incomplete, or `PAYMENT_MODE=disabled`, the system can still create an owned pending order, but checkout omits the QR. It never reports a payment as successful from the browser. Provider callbacks are rejected while payment mode is disabled or the signature secret is unset. A sandbox webhook must be tested against an isolated sandbox database; do not use Production credentials for simulated transactions.

## Apply and verify

The payment migrations were previously reconciled and recorded as applied on Production by the project owner. This code change does not modify database schema or data. Before accepting real payments, configure the Live Vercel variables and SePay webhook, then complete sandbox end-to-end verification with an isolated database. Do not treat unit/contract tests as a verified SePay delivery.
