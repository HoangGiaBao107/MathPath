import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const statusMigration = readFileSync("supabase/migrations/20261008000100_add_cancelled_payment_status.sql", "utf8");
const migration = readFileSync("supabase/migrations/20261008000200_phase10_payment_system.sql", "utf8");

describe("Phase 10 payment migration contract", () => {
  it("reuses the existing plans and orders and applies the catalog limits", () => {
    expect(statusMigration).toContain("add value if not exists 'cancelled'");
    expect(migration).toContain("alter table public.plans");
    expect(migration).toContain("alter table public.payment_orders");
    expect(migration).toContain("when 'pro_max' then 40");
    expect(migration).toContain("create or replace view public.subscription_plans");
    expect(migration).toContain("create or replace view public.orders");
  });

  it("keeps creation, verification, idempotency, amount checks and activation atomic and server-only", () => {
    expect(migration).toContain("perform private.assert_service_role()");
    expect(migration).toContain("create_payment_order");
    expect(migration).toContain("extensions.gen_random_bytes(5)");
    expect(migration).toContain("mathpath-payment-order:");
    expect(migration).toContain("process_payment_webhook");
    expect(migration).toContain("unique (provider, event_id)");
    expect(migration).toContain("payment_transactions_provider_id_unique");
    expect(migration).toContain("return jsonb_build_object('result', 'order_not_found')");
    expect(migration).toContain("return jsonb_build_object('result', 'amount_mismatch')");
    expect(migration).toContain("payment_order.amount_vnd <> p_amount_vnd");
    expect(migration).toContain("payment_order.expires_at <= now()");
    expect(migration).toContain("payment_order.status = 'paid'");
    expect(migration).toContain("return jsonb_build_object('result', 'already_paid')");
    expect(migration).toContain("return jsonb_build_object('result', 'order_expired')");
    expect(migration).toContain("return jsonb_build_object('result', 'duplicate')");
    expect(migration).toContain("duplicate_transaction");
    expect(migration).toContain("active_subscription.expires_at + make_interval(days => plan_length)");
    expect(migration).toContain("mathpath-subscription:");
    expect(migration).toContain("paid_plan_slug = excluded.paid_plan_slug");
    expect(migration).toContain("vip_expires_at = end_time");
    expect(migration).toContain("grant execute on function public.process_payment_webhook");
  });

  it("limits payment and subscription rows to owners or admins", () => {
    expect(migration).toContain("subscriptions_read_owner_or_admin");
    expect(migration).toContain("payment_transactions_read_owner_or_admin");
    expect(migration).toContain("payment_webhook_events_admin_read");
    expect(migration).toContain("revoke all on public.subscriptions, public.payment_transactions, public.payment_webhook_events");
  });
});
