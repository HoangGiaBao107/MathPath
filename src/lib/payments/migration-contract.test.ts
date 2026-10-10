import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const statusMigration = readFileSync("supabase/migrations/20261008000100_add_cancelled_payment_status.sql", "utf8");
const migration = readFileSync("supabase/migrations/20261008000200_phase10_payment_system.sql", "utf8");
const adminReviewMigration = readFileSync("supabase/migrations/20261010000100_payment_admin_review_and_five_minute_expiry.sql", "utf8");
const historicalSubscriptionMigration = readFileSync("supabase/migrations/20261010000200_admin_historical_subscription_metrics.sql", "utf8");

describe("Phase 10 payment migration contract", () => {
  it("reuses the existing plans and orders and applies the catalog limits", () => {
    expect(statusMigration).toContain("add value if not exists 'cancelled'");
    expect(migration).toContain("alter table public.plans");
    expect(migration).toContain("alter table public.payment_orders");
    expect(migration).toContain("when 'pro_max' then 40");
    expect(migration).toContain("when 'plus' then 70000");
    expect(migration).toContain("when 'pro' then 100000");
    expect(migration).toContain("when 'pro_max' then 125000");
    expect(migration).toContain("when 'plus' then 15");
    expect(migration).toContain("when 'pro' then 25");
    expect(migration).toContain("create or replace view public.subscription_plans");
    expect(migration).toContain("create or replace view public.orders");
  });

  it("keeps creation, verification, idempotency, amount checks and activation atomic and server-only", () => {
    expect(migration).toContain("perform private.assert_service_role()");
    expect(migration).toContain("create_payment_order");
    expect(migration).toContain("mathpath-payment-order:");
    expect(migration).toContain("process_payment_webhook");
    expect(migration).toContain("unique (provider, event_id)");
    expect(migration).toContain("payment_transactions_provider_id_unique");
    expect(migration).toContain("on conflict (provider, event_id) do nothing");
    expect(migration).toContain("if event_row_id is null then");
    expect(migration).toContain("'result', 'duplicate'");
    expect(migration).toContain("payment_order.amount_vnd <> p_amount_vnd");
    expect(migration).toContain("where order_code = p_order_code for update");
    expect(migration).toContain("payment_order.expires_at <= now()");
    expect(migration).toContain("payment_order.status <> 'pending'");
    expect(migration).toContain("where provider = p_provider and provider_transaction_id = p_transaction_id");
    expect(migration).toContain("active_subscription.expires_at + make_interval(days => plan_length)");
    expect(migration).toContain("mathpath-subscription:");
    expect(migration).toContain("grant execute on function public.process_payment_webhook");
  });

  it("checks the payment transaction before activating an order", () => {
    const processing = migration.slice(migration.indexOf("create or replace function public.process_payment_webhook"));
    expect(processing.indexOf("payment_order.amount_vnd <> p_amount_vnd")).toBeLessThan(processing.indexOf("set status = 'paid'"));
    expect(processing.indexOf("payment_order.expires_at <= now()")).toBeLessThan(processing.indexOf("set status = 'paid'"));
    expect(processing.indexOf("payment_order.status = 'paid'")).toBeLessThan(processing.indexOf("set status = 'paid'"));
  });

  it("limits payment and subscription rows to owners or admins", () => {
    expect(migration).toContain("subscriptions_read_owner_or_admin");
    expect(migration).toContain("payment_transactions_read_owner_or_admin");
    expect(migration).toContain("payment_webhook_events_admin_read");
    expect(migration).toContain("revoke all on public.subscriptions, public.payment_transactions, public.payment_webhook_events");
  });
});

describe("payment admin review and expiry migration contract", () => {
  it("sets a five-minute server-side order expiry and records customer payment notices", () => {
    expect(adminReviewMigration).toContain("now() + interval '5 minutes'");
    expect(adminReviewMigration).toContain("customer_reported_paid_at timestamptz");
    expect(adminReviewMigration).toContain("status = 'expired'");
  });

  it("restricts review RPC to authenticated admin identities and active pending orders", () => {
    expect(adminReviewMigration).toContain("perform private.assert_service_role()");
    expect(adminReviewMigration).toContain("where id = p_admin_user_id and role = 'admin'");
    expect(adminReviewMigration).toContain("payment_order.status not in ('pending', 'expired')");
    expect(adminReviewMigration).toContain("payment_order.expires_at <= now()");
    expect(adminReviewMigration).toContain("public.process_payment_webhook(");
    expect(adminReviewMigration).toContain("grant execute on function public.admin_review_payment_order");
    expect(adminReviewMigration).toContain("payment_order_reviews");
  });
});

describe("admin historical subscription metrics migration contract", () => {
  it("counts accounts that ever received a paid plan, including expired subscriptions", () => {
    expect(historicalSubscriptionMigration).toContain("get_admin_historical_subscription_metrics");
    expect(historicalSubscriptionMigration).toContain("ca.paid_plan_slug is not null");
    expect(historicalSubscriptionMigration).toContain("p.vip_started_at is not null");
    expect(historicalSubscriptionMigration).not.toContain("vip_expires_at > now()");
    expect(historicalSubscriptionMigration).toContain("po.status = 'paid'");
    expect(historicalSubscriptionMigration).toContain("grant execute on function public.get_admin_historical_subscription_metrics(uuid) to service_role");
  });
});
