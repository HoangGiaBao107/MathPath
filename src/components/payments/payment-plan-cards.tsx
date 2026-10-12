"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { Button } from "@/components/ui/button";
import { useLocale } from "@/components/providers/locale-provider";
import { mergeAvailablePlans, type PaidPlan } from "@/lib/payments/plan-catalog";

export function PaymentPlanCards({ currentPlan }: { currentPlan?: string }) {
  const router = useRouter();
  const { locale } = useLocale();
  const vi = locale === "vi";
  const [databasePlans, setDatabasePlans] = useState<PaidPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyPlan, setBusyPlan] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void fetch("/api/payments/plans", { cache: "no-store" })
      .then(async (response) => {
        const result = await response.json() as { plans?: PaidPlan[] };
        if (response.ok && active) {
          setDatabasePlans(result.plans ?? []);
          if (!result.plans?.length) {
            setError(vi ? "Máy chủ chưa cung cấp cấu hình gói trả phí. Nút mua đang tạm khóa." : "Paid plan configuration is unavailable. Purchasing is temporarily disabled.");
          }
        }
        else if (active) setError(vi ? "Chưa tải được danh sách gói. Thử lại sau nhé." : "Plans are unavailable. Please try again later.");
      })
      .catch(() => { if (active) setError(vi ? "Kết nối chưa ổn định." : "Connection unavailable."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [vi]);

  async function buy(planCode: PaidPlan["slug"]) {
    setError(""); setBusyPlan(planCode);
    try {
      const response = await fetch("/api/payments/orders", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ planCode }),
      });
      const payload = await response.json() as { checkoutUrl?: string; error?: string; diagnosticCode?: string };
      if (response.status === 401) { router.push(`/auth/login?next=${encodeURIComponent(location.pathname + "#plans")}`); return; }
      if (!response.ok || !payload.checkoutUrl) {
        if (payload.error === "plan_unavailable") {
          setError(vi ? "Gói này đang tạm thời chưa khả dụng. Bạn thử lại sau nhé." : "This plan is temporarily unavailable. Please try again later.");
          return;
        }
        if (payload.error === "admin_subscription_not_required") {
          setError(vi ? "Tài khoản quản trị không cần mua gói học." : "Admin accounts do not need a learning plan.");
          return;
        }
        const code = payload.diagnosticCode ? ` (${payload.diagnosticCode})` : "";
        setError(vi
          ? `Chưa tạo được đơn hàng${code}. Gửi mã này cho MathPath để kiểm tra nhé.`
          : `We couldn't create the order${code}. Send this code to MathPath for help.`);
        return;
      }
      router.push(payload.checkoutUrl as Route);
    } catch (error) {
      setError(error instanceof TypeError
        ? (vi ? "Không kết nối được máy chủ. Bạn kiểm tra mạng rồi thử lại nhé." : "Could not reach the server. Check your connection and retry.")
        : (vi ? "Phản hồi từ máy chủ chưa đúng định dạng. Vui lòng thử lại sau." : "The server response was invalid. Please try again later."));
    } finally { setBusyPlan(""); }
  }

  const formatMoney = (amount: number) => new Intl.NumberFormat(vi ? "vi-VN" : "en-US").format(amount);
  const plans = mergeAvailablePlans(databasePlans);

  return (
    <>
      <div className="account-plan-grid home-plan-grid">
        <article className="account-plan-card is-current">
          <div className="account-plan-card-heading"><h3>Starter</h3><span>{vi ? "MIỄN PHÍ" : "FREE"}</span></div>
          <p className="account-plan-price">{vi ? "0đ" : "Free"}</p>
          <p className="account-plan-quota"><strong>10</strong> {vi ? "lượt AI mỗi ngày" : "AI requests per day"}</p>
        </article>
        {loading ? <p role="status">{vi ? "Đang tải gói học…" : "Loading plans…"}</p> : null}
        {plans.map((plan) => (
          <article className={`account-plan-card${currentPlan === plan.slug ? " is-current" : ""}`} key={plan.slug}>
            <div className="account-plan-card-heading"><h3>{plan.name}</h3>{currentPlan === plan.slug ? <span>{vi ? "ĐANG DÙNG" : "CURRENT"}</span> : null}</div>
            <p className="account-plan-price">{formatMoney(plan.amount_vnd)} <small>{vi ? `đ / ${plan.duration_days} ngày` : `VND / ${plan.duration_days} days`}</small></p>
            <p className="account-plan-quota"><strong>{plan.daily_ai_limit}</strong> {vi ? "lượt AI mỗi ngày" : "AI requests per day"}</p>
            <Button className="home-plan-action" size="small" disabled={Boolean(busyPlan) || loading || !plan.available} onClick={() => void buy(plan.slug)}>
              {busyPlan === plan.slug ? (vi ? "Đang tạo đơn…" : "Creating order…") : !plan.available ? (vi ? "Tạm thời chưa khả dụng" : "Temporarily unavailable") : currentPlan === plan.slug ? (vi ? "Gia hạn gói" : "Renew plan") : (vi ? "Mua gói" : "Choose plan")}
            </Button>
          </article>
        ))}
      </div>
      {error ? <p className="auth-message auth-message--error" role="alert">{error}</p> : null}
    </>
  );
}
