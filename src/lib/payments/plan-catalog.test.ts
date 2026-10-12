import { describe, expect, it } from "vitest";
import { mergeAvailablePlans, paidPlanCatalog } from "@/lib/payments/plan-catalog";

describe("paid plan catalog fallback", () => {
  it("keeps all three approved paid plans visible with the approved quota and price", () => {
    expect(paidPlanCatalog.map(({ slug, amount_vnd, daily_ai_limit }) => [slug, amount_vnd, daily_ai_limit])).toEqual([
      ["plus", 70_000, 20],
      ["pro", 100_000, 30],
      ["pro_max", 125_000, 50],
    ]);
  });

  it("marks missing database plans unavailable and uses live values when present", () => {
    const plans = mergeAvailablePlans([
      { slug: "plus", name: "Plus", amount_vnd: 70_000, currency: "VND", duration_days: 30, daily_ai_limit: 20 },
    ]);

    expect(plans.map(({ slug, available }) => [slug, available])).toEqual([
      ["plus", true],
      ["pro", false],
      ["pro_max", false],
    ]);
    expect(plans[0]).toMatchObject({ amount_vnd: 70_000, daily_ai_limit: 20 });
  });
});
