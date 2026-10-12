import { creditPolicy } from "@/lib/credits/types";

export type PaidPlan = {
  slug: "plus" | "pro" | "pro_max";
  name: string;
  amount_vnd: number;
  currency: string;
  duration_days: number;
  daily_ai_limit: number;
};

export const paidPlanCatalog: PaidPlan[] = creditPolicy.paidPlans.map((plan) => ({
  slug: plan.slug,
  name: plan.name,
  amount_vnd: plan.monthlyPriceVnd,
  currency: "VND",
  duration_days: 30,
  daily_ai_limit: plan.requestsPerDay,
}));

export function mergeAvailablePlans(databasePlans: readonly PaidPlan[]) {
  const plansBySlug = new Map(databasePlans.map((plan) => [plan.slug, plan]));

  return paidPlanCatalog.map((fallbackPlan) => ({
    ...fallbackPlan,
    ...plansBySlug.get(fallbackPlan.slug),
    available: plansBySlug.has(fallbackPlan.slug),
  }));
}
