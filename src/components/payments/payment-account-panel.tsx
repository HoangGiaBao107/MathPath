"use client";

import { useEffect, useState } from "react";
import { useLocale } from "@/components/providers/locale-provider";
import { Card } from "@/components/ui/card";

type AccountPaymentData = {
  subscription: { plan_code: string; status: string; started_at: string; expires_at: string } | null;
  activePlan: { name: string; daily_ai_limit: number | null; duration_days: number | null } | null;
  orders: { id: string; order_code: string; plan_name_snapshot: string; amount_vnd: number; currency: string; status: string; created_at: string; paid_at: string | null }[];
};

export function PaymentAccountPanel() {
  const { locale } = useLocale();
  const vi = locale === "vi";
  const [data, setData] = useState<AccountPaymentData | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    void fetch("/api/payments/account", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error();
        const payload = await response.json() as AccountPaymentData;
        if (active) setData(payload);
      })
      .catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, []);

  const formatDate = (value: string) => new Intl.DateTimeFormat(vi ? "vi-VN" : "en-US", { dateStyle: "medium", timeZone: "Asia/Ho_Chi_Minh" }).format(new Date(value));
  const formatMoney = (amount: number) => `${new Intl.NumberFormat(vi ? "vi-VN" : "en-US").format(amount)} ${vi ? "đ" : "VND"}`;

  return (
    <Card className="account-panel payment-account-panel">
      <div className="account-panel-heading"><div><p className="eyebrow">{vi ? "GÓI HỌC" : "SUBSCRIPTION"}</p><h2>{vi ? "Gói và thanh toán" : "Plan and payments"}</h2></div></div>
      {error ? <p role="status">{vi ? "Chưa tải được thông tin thanh toán." : "Payment details are unavailable."}</p> : !data ? <p role="status">{vi ? "Đang tải…" : "Loading…"}</p> : (
        <>
          {data.subscription ? <p className="payment-subscription-summary">
            <strong>{data.activePlan?.name ?? data.subscription.plan_code.replaceAll("_", " ").toUpperCase()}</strong>
            <span>{vi ? `Bắt đầu ${formatDate(data.subscription.started_at)} · hết hạn ${formatDate(data.subscription.expires_at)} · ${data.activePlan?.daily_ai_limit ?? "—"} lượt AI/ngày` : `Started ${formatDate(data.subscription.started_at)} · expires ${formatDate(data.subscription.expires_at)} · ${data.activePlan?.daily_ai_limit ?? "—"} AI requests/day`}</span>
          </p> : <p>{vi ? "Bạn đang dùng gói Starter miễn phí." : "You are on the free Starter plan."}</p>}
          <h3 className="payment-history-heading">{vi ? "Lịch sử thanh toán" : "Payment history"}</h3>
          {data.orders.length ? <div className="payment-history-list">
            {data.orders.map((order) => <div className="payment-history-row" key={order.id}>
              <span><strong>{order.order_code}</strong><small>{order.plan_name_snapshot} · {formatDate(order.created_at)}</small></span>
              <span><strong>{formatMoney(order.amount_vnd)}</strong><small className={`payment-status payment-status--${order.status}`}>{statusLabel(order.status, vi)}</small></span>
            </div>)}
          </div> : <p>{vi ? "Chưa có đơn thanh toán nào." : "No payment orders yet."}</p>}
        </>
      )}
    </Card>
  );
}

function statusLabel(status: string, vi: boolean) {
  const labels: Record<string, [string, string]> = {
    pending: ["Đang chờ", "Pending"], paid: ["Đã thanh toán", "Paid"],
    expired: ["Đã hết hạn", "Expired"], cancelled: ["Đã hủy", "Cancelled"],
  };
  return labels[status]?.[vi ? 0 : 1] ?? status;
}
