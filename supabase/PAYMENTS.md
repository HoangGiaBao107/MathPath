# Phase 10 payment integration

## Data ownership

- `public.plans` remains the canonical plan catalog. Phase 10 adds `currency` and `duration_days`; `subscription_plans` is a compatibility view.
- `public.payment_orders` remains the canonical order table. It receives order code and immutable plan-name/code snapshots; `orders` is a compatibility view.
- `public.subscriptions` is the subscription history and current active-term ledger. `profiles.vip_*` and `credit_accounts.paid_plan_slug` are kept as an atomic compatibility projection for the existing server quota implementation.
- `payment_transactions` and `payment_webhook_events` record verified provider callbacks. Client roles cannot write these records.

## Current provider adapter

The repository contains a `generic_hmac` signed bank-transfer adapter and a VietQR image URL builder. This is an integration contract, not a production bank/payment provider. It expects a trusted server-to-server callback with the exact JSON shape below and an HMAC-SHA256 hex signature in `x-mathpath-signature` over the raw request bytes:

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

No production payment provider has been selected or configured. Do not point a provider at this generic endpoint until its signature and payload format have been mapped and validated in a provider-specific adapter. A provider credential/API key is not currently needed by the generic test contract; `PAYMENT_PROVIDER_API_KEY` is reserved for a future adapter.

## Required environment configuration

Configure these only in the deployment secret manager, never in client code or Git:

- `PAYMENT_PROVIDER=generic_hmac` only after the callback contract is implemented by a trusted sender.
- `PAYMENT_WEBHOOK_SECRET` as a unique random secret shared with that sender.
- `PAYMENT_BANK_CODE`, `PAYMENT_BANK_ACCOUNT`, and `PAYMENT_ACCOUNT_NAME` with the actual receiving account details.

When provider or bank configuration is incomplete, the system can still create an owned pending order, but checkout presents setup status, omits the QR/account details when unavailable, and never reports a payment as successful. Provider callbacks are rejected until the signature secret is set.

## Apply and verify

The migrations are additive and have not been applied to the production Supabase project by this code change. Review the Supabase migration history first, validate against a disposable local database, and apply once in order. After applying them, verify the new plan rows, owner/admin RLS, and RPC grants before enabling a provider callback.
