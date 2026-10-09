# Phase 10 payment integration

## Data ownership

- `public.plans` remains the canonical plan catalog. Phase 10 adds `currency` and `duration_days`; `subscription_plans` is a compatibility view.
- `public.payment_orders` remains the canonical order table. It receives order code and immutable plan-name/code snapshots; `orders` is a compatibility view.
- `public.subscriptions` is the subscription history and current active-term ledger. `profiles.vip_*` and `credit_accounts.paid_plan_slug` are kept as an atomic compatibility projection for the existing server quota implementation.
- `payment_transactions` and `payment_webhook_events` record verified provider callbacks. Client roles cannot write these records.

## Provider adapter: SePay Webhooks

The working-tree adapter being prepared for Phase 10B is `sepay`; the version on `main` is still the earlier `generic_hmac` contract. SePay is intended for Vietnamese bank transfer with a VietQR payment image. The adapter follows SePay's documented webhook payload, headers, signature construction and success response:

- Payload fields: numeric transaction `id`, `code`, `content`, `transferType`, `transferAmount`, `referenceCode`.
- The adapter accepts only an incoming (`transferType: "in"`) transfer with a parsed code exactly matching `MP` plus ten hexadecimal characters and a positive integer amount.
- SePay signs `timestamp + "." + raw_body` with HMAC-SHA256. The `X-SePay-Signature` header is `sha256=<hex>`; `X-SePay-Timestamp` is checked within a five-minute window. The raw request bytes are verified before JSON parsing.
- The database still validates exact order code, exact amount, order status/expiry and idempotency atomically. The SePay transaction ID is stored as both event ID and transaction ID.
- Successful webhook deliveries, including validly signed duplicates or non-matching payment notifications, return HTTP 200 with `{"success":true}` as SePay requires. A mismatched payment never activates a subscription.
- Configure SePay's payment-code recognition with prefix `MP`, suffix length exactly 10, alphanumeric, and enable “only send when payment code exists”.

The production endpoint, once the SePay branch is merged and deployed, is `https://mathpath.com.vn/api/payments/webhook/sepay`. For Phase 10B sandbox testing, use the exact Vercel Preview URL followed by `/api/payments/webhook/sepay`; Preview deployments can have different URLs, so do not point SePay at localhost or production for this test.

In SePay Test mode, create a Test bank account and webhook, choose JSON, incoming transfers, and HMAC-SHA256. Use the Preview URL and the same HMAC secret in Vercel Preview's `PAYMENT_WEBHOOK_SECRET`. SePay Test mode supports HMAC; do not select “no authentication” for this integration. Enable payment-code recognition with prefix `MP`, a suffix of exactly 10 characters, and letters/numbers; enable “only send when payment code exists”. Simulate an incoming transfer using the exact order code and amount shown at checkout. SePay documents Test mode as separate from Live; simulated transactions do not affect real accounts.

QR generation remains server-derived from the stored order amount, order code, and configured receiving bank account. SePay does not need to create an order through its API for this bank-transfer flow.

## Required environment configuration

Configure these in Vercel **Preview** for sandbox testing and separately in **Production** only after the sandbox flow passes. Never put secrets in client code or Git:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (or legacy `NEXT_PUBLIC_SUPABASE_ANON_KEY`)
- `SUPABASE_SERVICE_ROLE_KEY` (server-only)
- `MATHPATH_ATTEMPT_STORE=supabase`
- `NEXT_PUBLIC_APP_URL` — the exact Preview deployment origin during sandbox testing; `https://mathpath.com.vn` only for Production.
- `PAYMENT_PROVIDER=sepay`
- `PAYMENT_WEBHOOK_SECRET` — the exact HMAC Secret Key configured on the SePay webhook. Use a separate value for Test mode and Live if possible.
- `PAYMENT_BANK_CODE`, `PAYMENT_BANK_ACCOUNT`, `PAYMENT_ACCOUNT_NAME` — receiving account details used to generate QR and shown in checkout.

`PAYMENT_PROVIDER_API_KEY` is not used for SePay Webhooks with HMAC and should remain unset. Never prefix the webhook secret or service role key with `NEXT_PUBLIC_`.

When provider or bank configuration is incomplete, the system can still create an owned pending order, but checkout presents setup status, omits the QR when bank details are incomplete, and never reports a payment as successful. Provider callbacks are rejected until the signature secret is set.

## Phase 10B sandbox checklist

1. Deploy `feat/vietqr-sepay-sandbox` as a Vercel Preview; do not merge to `main` yet.
2. Set the variables above under Vercel Preview. Use a SePay Test-mode account's bank details, not Live credentials.
3. Create a SePay Test-mode webhook at `<PREVIEW_ORIGIN>/api/payments/webhook/sepay`, JSON, incoming transfers, HMAC-SHA256, and enable payment-code filtering for `MP` plus 10 alphanumeric characters.
4. Put the exact same Test-mode HMAC secret in Preview `PAYMENT_WEBHOOK_SECRET`. Do not send it in chat or commit it.
5. Buy a plan in Preview, then simulate an incoming transaction matching the displayed `order_code` and amount.
6. Inspect SePay Test-mode delivery logs and the matching Supabase test/Preview records. Verify order, transaction, webhook event, subscription expiry and server-side AI quota. Replay the event and test wrong amount/order code and expired/already-paid orders; none may grant a second or invalid subscription.

No SePay Test-mode delivery or payment has been verified by this repository change. E2E remains a manual step after Preview deployment and dashboard setup.

Provider documentation checked for this integration:

- [SePay webhook authentication](https://developer.sepay.vn/vi/sepay-webhooks/xac-thuc)
- [SePay Test mode quick start](https://developer.sepay.vn/vi/sepay-webhooks/test-mode/bat-dau-nhanh)
- [SePay webhook integration and payload](https://developer.sepay.vn/vi/sepay-webhooks/tich-hop-webhook)
- [SePay payment-code recognition](https://developer.sepay.vn/vi/sepay-webhooks/cau-hinh-ma-thanh-toan)
- [VietQR Quick Link introduction](https://www.vietqr.io/en/intro/)

## Apply and verify

As of 2026-10-08, the owner applied the reconciled SQL manually in Supabase Dashboard and repaired the migration ledger. `npx supabase migration list --linked` confirmed the earlier versions through `20261006000800` and payment migrations `20261008000100` and `20261008000200` match between local and remote. The owner verified these production invariants:

- PLUS: 70,000 VND, 15 AI requests/day, 30 days, active.
- PRO: 100,000 VND, 25 AI requests/day, 30 days, active.
- PRO MAX: 125,000 VND, 40 AI requests/day, 30 days, active.
- Backfill candidate count: 0.
- Payment tables exist with RLS enabled; payment RPCs are executable by `service_role` only.

The new migration `20261008000300_enable_published_exam_runtime.sql` fixes a separate exam-start issue: production exam runtime always returned `demo: true`, causing the exam page to redirect users back to `/problems`. It now derives the demo flag from `problem_sets.exam_metadata.demo`, preserving synthetic demo fixtures while allowing approved published sets to open. This migration has **not** been applied or recorded in production yet.

Do not run `supabase db push` blindly. Before enabling real purchases, configure SePay Test mode and Vercel Preview values, deploy the tested code, and complete the sandbox end-to-end cases. Configure Live secrets and the production webhook only after the sandbox flow passes. `PAYMENT_PROVIDER_API_KEY` is not used for the HMAC webhook flow.

To apply the exam runtime fix, run the full contents of `20261008000300_enable_published_exam_runtime.sql` in Supabase Dashboard → SQL Editor. After it succeeds, run `npx supabase migration repair --linked --status applied 20261008000300` from the repository terminal, then confirm it with `npx supabase migration list --linked`. Do not mark the new version applied before the SQL succeeds.
