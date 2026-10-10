"use client";

import Link from "next/link";
import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { useLocale } from "@/components/providers/locale-provider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type CheckoutOrder = {
  id: string; plan_code: string; plan_name_snapshot: string; amount_vnd: number; currency: string;
  order_code: string; status: string; expires_at: string; paid_at: string | null; duration_days: number; daily_ai_limit: number;
};
type PaymentData = {
  provider: string | null;
  bankCode: string | null;
  accountNumber: string | null;
  accountName: string | null;
  transferDescription: string;
  qrImageUrl: string | null;
  providerReady: boolean;
  setupStatus: "ready" | "provider_not_configured" | "payments_disabled" | "bank_details_missing" | "webhook_secret_missing" | "bank_and_webhook_missing";
};

export function CheckoutExperience({ orderId }: { orderId: string }) {
  const { locale } = useLocale();
  const vi = locale === "vi";
  const [order, setOrder] = useState<CheckoutOrder | null>(null);
  const [payment, setPayment] = useState<PaymentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [copied, setCopied] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch(`/api/payments/orders/${orderId}`, { cache: "no-store" });
      if (!response.ok) throw new Error();
      const payload = await response.json() as { order: CheckoutOrder; payment: PaymentData };
      setOrder(payload.order); setPayment(payload.payment); setFailed(false);
    } catch { setFailed(true); }
    finally { setLoading(false); }
  }, [orderId]);

  useEffect(() => {
    const timer = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(timer);
  }, [refresh]);

  useEffect(() => {
    if (!order || order.status !== "pending") return;
    const timer = window.setInterval(() => void refresh(), 5000);
    return () => window.clearInterval(timer);
  }, [order?.status, order, refresh]);

  async function copyCode() {
    if (!payment) return;
    try { await navigator.clipboard.writeText(payment.transferDescription); setCopied(true); window.setTimeout(() => setCopied(false), 1800); }
    catch { setCopied(false); }
  }

  const money = order ? new Intl.NumberFormat(vi ? "vi-VN" : "en-US").format(order.amount_vnd) : "";
  const date = order ? new Intl.DateTimeFormat(vi ? "vi-VN" : "en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Ho_Chi_Minh" }).format(new Date(order.expires_at)) : "";

  return (
    <main className="site-main page-shell checkout-page" id="main-content">
      <Card className="checkout-card">
        <p className="eyebrow"><span className="eyebrow-dot" aria-hidden="true" />MATHPATH · {vi ? "THANH TOÁN" : "CHECKOUT"}</p>
        <h1>{vi ? "Thanh toán gói học" : "Complete your plan payment"}</h1>
        {loading ? <p role="status">{vi ? "Đang tải thông tin đơn hàng…" : "Loading order details…"}</p> : null}
        {failed ? <p className="auth-message auth-message--error" role="alert">{vi ? "Không tìm thấy đơn hàng này trong tài khoản của bạn." : "This order could not be found for your account."}</p> : null}
        {order ? (
          <>
            {order.status === "paid" ? <div className="checkout-result checkout-result--success" role="status">
              <span aria-hidden="true">✓</span><div><strong>{vi ? "Thanh toán thành công" : "Payment successful"}</strong>
                <p>{vi ? `Gói ${order.plan_name_snapshot} đã được kích hoạt. Hạn dùng được cập nhật trong tài khoản.` : `${order.plan_name_snapshot} is active. Your account shows the updated term.`}</p>
                <Link className="button button--primary" href="/account">{vi ? "Về tài khoản" : "Back to account"}</Link></div>
            </div> : order.status === "expired" || order.status === "cancelled" ? <div className="checkout-result" role="status">
              <strong>{order.status === "expired" ? (vi ? "Đơn hàng đã hết hạn" : "Order expired") : (vi ? "Đơn hàng đã hủy" : "Order cancelled")}</strong>
              <Link className="button button--secondary" href="/#plans">{vi ? "Quay lại chọn gói" : "Choose another plan"}</Link>
            </div> : (
              <>
                <div className="checkout-order-summary">
                  <span>{vi ? "Gói" : "Plan"}<strong>{order.plan_name_snapshot}</strong></span>
                  <span>{vi ? "Thời hạn" : "Duration"}<strong>{order.duration_days} {vi ? "ngày" : "days"}</strong></span>
                  <span>{vi ? "Lượt AI" : "AI requests"}<strong>{order.daily_ai_limit}/{vi ? "ngày" : "day"}</strong></span>
                  <span>{vi ? "Số tiền" : "Amount"}<strong>{money} {vi ? "VNĐ" : "VND"}</strong></span>
                </div>
                <div className="checkout-payment-grid">
                  <div className="checkout-qr-box">
                    {payment?.providerReady && payment.qrImageUrl ? <Image className="checkout-qr-image" src={payment.qrImageUrl} alt={vi ? "Mã QR chuyển khoản" : "Bank transfer QR code"} width={300} height={300} unoptimized /> : <div className="checkout-qr-placeholder" aria-label={vi ? "Mã QR chưa khả dụng" : "QR code unavailable"}><span>MP</span><small>{vi ? "Chưa thể tạo QR thanh toán" : "Payment QR is unavailable"}</small></div>}
                    <p>{payment?.providerReady ? (vi ? "Quét QR bằng ứng dụng ngân hàng" : "Scan with your banking app") : (vi ? "Chưa thể thanh toán: cấu hình VietQR/SePay chưa đầy đủ." : "Payment is unavailable because VietQR/SePay setup is incomplete.")}</p>
                  </div>
                  <div className="checkout-bank-details">
                    <h2>{vi ? "Thông tin chuyển khoản" : "Transfer details"}</h2>
                    <dl>
                      <div><dt>{vi ? "Ngân hàng" : "Bank"}</dt><dd>{payment?.bankCode ?? "—"}</dd></div>
                      <div><dt>{vi ? "Số tài khoản" : "Account number"}</dt><dd>{payment?.accountNumber ?? "—"}</dd></div>
                      <div><dt>{vi ? "Chủ tài khoản" : "Account name"}</dt><dd>{payment?.accountName ?? "—"}</dd></div>
                      <div><dt>{vi ? "Mã đơn hàng" : "Order code"}</dt><dd><code>{order.order_code}</code></dd></div>
                      <div><dt>{vi ? "Nội dung chuyển khoản" : "Transfer description"}</dt><dd><code>{payment?.transferDescription ?? `MATHPATH ${order.order_code}`}</code><Button size="small" variant="secondary" onClick={() => void copyCode()}>{copied ? (vi ? "Đã chép" : "Copied") : (vi ? "Sao chép" : "Copy")}</Button></dd></div>
                    </dl>
                  </div>
                </div>
                <p className="checkout-pending" role="status"><span />{vi ? "Đang chờ thanh toán hợp lệ…" : "Waiting for a verified payment…"}</p>
                {!payment?.providerReady ? <p className="checkout-setup-note" role="alert">{setupMessage(payment?.setupStatus, vi)}</p> : null}
                <p className="checkout-expiry">{vi ? "Đơn hết hạn lúc" : "Order expires"} {date}</p>
              </>
            )}
          </>
        ) : null}
        <div className="checkout-footer"><Link href="/#plans">{vi ? "← Quay lại chọn gói" : "← Back to plans"}</Link>{order?.status === "pending" ? <Link href="/account">{vi ? "Tài khoản" : "Account"}</Link> : null}</div>
      </Card>
    </main>
  );
}

function setupMessage(status: PaymentData["setupStatus"] | undefined, vi: boolean): string {
  if (vi) {
    switch (status) {
      case "payments_disabled": return "Thanh toán đang được tắt. MathPath chỉ mở nhận thanh toán sau khi kiểm thử SePay thành công.";
      case "bank_details_missing": return "Chưa cấu hình đủ mã ngân hàng, số tài khoản hoặc tên chủ tài khoản. Chưa thể chuyển khoản.";
      case "webhook_secret_missing": return "Thiếu SePay webhook secret. QR đang được ẩn để tránh nhận tiền mà chưa thể xác minh giao dịch.";
      case "bank_and_webhook_missing": return "Chưa cấu hình thông tin ngân hàng và SePay webhook. Đơn hàng đã lưu nhưng chưa thể thanh toán.";
      default: return "Chưa chọn/cấu hình nhà cung cấp thanh toán. Đơn hàng đã lưu nhưng chưa thể thanh toán.";
    }
  }
  switch (status) {
    case "payments_disabled": return "Payments are disabled until SePay sandbox verification is complete.";
    case "bank_details_missing": return "Bank code, account number, or account name is missing. Transfer is unavailable.";
    case "webhook_secret_missing": return "The SePay webhook secret is missing. The QR is hidden until payments can be verified.";
    case "bank_and_webhook_missing": return "Bank details and SePay webhook are not configured. The order is saved but cannot be paid.";
    default: return "No payment provider is configured. The order is saved but cannot be paid.";
  }
}
