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
  customer_reported_paid_at: string | null;
};
type PaymentData = {
  provider: string | null;
  bankCode: string | null;
  accountNumber: string | null;
  accountName: string | null;
  transferDescription: string;
  qrImageUrl: string | null;
  providerReady: boolean;
  setupStatus: "ready" | "provider_not_configured" | "payments_disabled" | "bank_details_missing" | "webhook_secret_missing" | "bank_and_webhook_missing" | "gateway_credentials_missing" | "environment_mismatch";
  checkoutUrl?: string | null;
  checkoutFields?: Record<string, string> | null;
};

export function CheckoutExperience({ orderId }: { orderId: string }) {
  const { locale } = useLocale();
  const vi = locale === "vi";
  const [order, setOrder] = useState<CheckoutOrder | null>(null);
  const [payment, setPayment] = useState<PaymentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [confirmationAvailable, setConfirmationAvailable] = useState(false);
  const [returnedFromProvider, setReturnedFromProvider] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [reportError, setReportError] = useState("");

  const refresh = useCallback(async () => {
    try {
      const response = await fetch(`/api/payments/orders/${orderId}`, { cache: "no-store" });
      if (!response.ok) throw new Error();
      const payload = await response.json() as { order: CheckoutOrder; payment: PaymentData; confirmationAvailable?: boolean };
      setOrder(payload.order); setPayment(payload.payment); setConfirmationAvailable(payload.confirmationAvailable === true); setFailed(false);
    } catch { setFailed(true); }
    finally { setLoading(false); }
  }, [orderId]);

  useEffect(() => {
    const timer = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(timer);
  }, [refresh]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const paymentReturn = new URLSearchParams(window.location.search).get("payment");
      setReturnedFromProvider(paymentReturn === "return");
      if (paymentReturn === "error") setReportError(vi ? "SePay báo giao dịch chưa hoàn tất. Bạn có thể thử lại nếu đơn còn hạn." : "SePay reports that payment was not completed. Retry while the order is active.");
      if (paymentReturn === "cancel") setReportError(vi ? "Bạn đã hủy bước thanh toán tại SePay." : "You cancelled the SePay checkout.");
    }, 0);
    return () => window.clearTimeout(timer);
  }, [vi]);

  useEffect(() => {
    if (!order || (order.status !== "pending" && !(order.status === "expired" && order.customer_reported_paid_at))) return;
    const timer = window.setInterval(() => void refresh(), 5000);
    return () => window.clearInterval(timer);
  }, [order?.status, order, refresh]);

  async function copyCode() {
    if (!payment) return;
    try { await navigator.clipboard.writeText(payment.transferDescription); setCopied(true); window.setTimeout(() => setCopied(false), 1800); }
    catch { setCopied(false); }
  }

  async function reportPayment() {
    setReporting(true); setReportError("");
    try {
      const response = await fetch(`/api/payments/orders/${orderId}/confirm`, { method: "POST" });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "payment_confirmation_failed");
      await refresh();
    } catch (error) {
      const code = error instanceof Error ? error.message : "payment_confirmation_failed";
      setReportError(code === "order_not_pending"
        ? (vi ? "Đơn đã hết hạn hoặc đã được xử lý. Đang cập nhật trạng thái…" : "This order expired or was already processed. Refreshing status…")
        : code === "payment_migration_required"
          ? (vi ? "Cần cập nhật cơ sở dữ liệu thanh toán trước khi dùng chức năng này." : "The payment database migration is required for this action.")
          : (vi ? "Chưa gửi được xác nhận. Vui lòng thử lại." : "Could not send the confirmation. Please retry."));
      await refresh();
    } finally { setReporting(false); }
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
              <strong>{order.status === "expired" ? (vi ? "Đơn thanh toán đã hết hạn sau 5 phút." : "This payment order expired after five minutes.") : (vi ? "Đơn hàng đã hủy" : "Order cancelled")}</strong>
              {order.status === "expired" && (returnedFromProvider || order.customer_reported_paid_at) ? <div className="checkout-return-confirmation">
                <h2>{vi ? "Bạn đã thanh toán?" : "Did you complete the payment?"}</h2>
                <p>{vi ? "Cảm ơn bạn. Hãy báo MathPath để admin đối soát mã giao dịch trong SePay. Đơn hết hạn không tự kích hoạt gói; chỉ admin xác minh giao dịch thật mới có thể duyệt." : "Thank you. Notify MathPath so an admin can reconcile the transaction in SePay. An expired order never activates a plan automatically; an admin must verify the real transaction."}</p>
                {confirmationAvailable && !order.customer_reported_paid_at ? <Button type="button" onClick={() => void reportPayment()} disabled={reporting}>{reporting ? (vi ? "Đang gửi…" : "Sending…") : (vi ? "Tôi đã thanh toán – báo MathPath" : "I paid – notify MathPath")}</Button> : null}
                {reportError ? <p className="checkout-setup-note" role="alert">{reportError}</p> : null}
              </div> : null}
              <Link className="button button--secondary" href="/#plans">{vi ? "Quay lại chọn gói" : "Choose another plan"}</Link>
            </div> : (
              <>
                <div className="checkout-order-summary">
                  <span>{vi ? "Gói" : "Plan"}<strong>{order.plan_name_snapshot}</strong></span>
                  <span>{vi ? "Thời hạn" : "Duration"}<strong>{order.duration_days} {vi ? "ngày" : "days"}</strong></span>
                  <span>{vi ? "Lượt AI" : "AI requests"}<strong>{order.daily_ai_limit}/{vi ? "ngày" : "day"}</strong></span>
                  <span>{vi ? "Số tiền" : "Amount"}<strong>{money} {vi ? "VNĐ" : "VND"}</strong></span>
                </div>
                {payment?.provider === "sepay_gateway" ? (
                  <div className="checkout-payment-grid">
                    <div className="checkout-qr-box">
                      <div className="checkout-qr-placeholder" aria-label={vi ? "Thanh toán qua SePay" : "Pay through SePay"}><span>SePay</span><small>{vi ? "SePay sẽ hiển thị mã QR ở bước tiếp theo" : "SePay shows the payment QR on the next step"}</small></div>
                      <p>{vi ? "Bạn sẽ được chuyển tới cổng thanh toán SePay." : "You will continue to SePay's hosted checkout."}</p>
                    </div>
                    <div className="checkout-bank-details">
                      <h2>{vi ? "Thanh toán an toàn qua SePay" : "Secure payment with SePay"}</h2>
                      <dl>
                        <div><dt>{vi ? "Mã đơn hàng" : "Order code"}</dt><dd><code>{order.order_code}</code></dd></div>
                        <div><dt>{vi ? "Nội dung" : "Description"}</dt><dd><code>MATHPATH {order.order_code}</code></dd></div>
                      </dl>
                      {payment.providerReady && payment.checkoutUrl && payment.checkoutFields ? <form action={payment.checkoutUrl} method="post">
                        {Object.entries(payment.checkoutFields).map(([name, value]) => <input key={name} type="hidden" name={name} value={value} />)}
                        <Button type="submit">{vi ? "Tiếp tục tới SePay" : "Continue to SePay"}</Button>
                      </form> : <p className="checkout-setup-note" role="alert">{setupMessage(payment.setupStatus, vi)}</p>}
                    </div>
                  </div>
                ) : <div className="checkout-payment-grid">
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
                </div>}
                {order.customer_reported_paid_at || returnedFromProvider ? <section className="checkout-return-confirmation" aria-live="polite">
                  <p className="checkout-pending"><span />{order.customer_reported_paid_at
                    ? (vi ? "MathPath đã nhận thông báo của bạn." : "MathPath received your payment notice.")
                    : (vi ? "Bạn đã quay lại từ SePay. MathPath đang chờ xác nhận giao dịch." : "You returned from SePay. MathPath is waiting to verify the payment.")}</p>
                  <h2>{vi ? "Cảm ơn bạn đã thanh toán!" : "Thank you for your payment!"}</h2>
                  <p>{vi ? "Gói học sẽ được cập nhật sau khi SePay gửi xác nhận hoặc admin đối soát giao dịch. Nút này chỉ báo cho MathPath biết bạn đã chuyển tiền; nó không tự xác nhận thanh toán." : "Your plan will update after SePay confirms the transaction or an admin reconciles it. This button only notifies MathPath; it does not mark a payment as successful."}</p>
                  {confirmationAvailable && !order.customer_reported_paid_at ? <Button type="button" onClick={() => void reportPayment()} disabled={reporting}>
                    {reporting ? (vi ? "Đang gửi…" : "Sending…") : (vi ? "Tôi đã thanh toán – báo MathPath" : "I paid – notify MathPath")}
                  </Button> : null}
                  {reportError ? <p className="checkout-setup-note" role="alert">{reportError}</p> : null}
                  {!confirmationAvailable ? <p className="checkout-setup-note" role="alert">{vi ? "Chức năng xác nhận đang chờ cập nhật cơ sở dữ liệu." : "Payment confirmation is waiting for a database update."}</p> : null}
                </section> : <p className="checkout-pending" role="status"><span />{vi ? "Đang chờ thanh toán hợp lệ…" : "Waiting for a verified payment…"}</p>}
                {payment?.provider !== "sepay_gateway" && !payment?.providerReady ? <p className="checkout-setup-note" role="alert">{setupMessage(payment?.setupStatus, vi)}</p> : null}
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
      case "payments_disabled": return "Thanh toán hiện đang tạm tắt. Vui lòng quay lại sau.";
      case "gateway_credentials_missing": return "Thiếu Merchant ID hoặc Secret Key SePay cho môi trường thanh toán này. Vui lòng liên hệ MathPath.";
      case "environment_mismatch": return "Cấu hình SePay không khớp chế độ thanh toán. Kiểm tra PAYMENT_MODE và SEPAY_ENVIRONMENT.";
      case "bank_details_missing": return "Chưa cấu hình đủ mã ngân hàng, số tài khoản hoặc tên chủ tài khoản. Chưa thể chuyển khoản.";
      case "webhook_secret_missing": return "Thiếu SePay webhook secret. QR đang được ẩn để tránh nhận tiền mà chưa thể xác minh giao dịch.";
      case "bank_and_webhook_missing": return "Chưa cấu hình thông tin ngân hàng và SePay webhook. Đơn hàng đã lưu nhưng chưa thể thanh toán.";
      default: return "Chưa chọn/cấu hình nhà cung cấp thanh toán. Đơn hàng đã lưu nhưng chưa thể thanh toán.";
    }
  }
  switch (status) {
    case "payments_disabled": return "Payments are temporarily disabled. Please try again later.";
    case "gateway_credentials_missing": return "The SePay Merchant ID or Secret Key for this payment environment is missing. Contact MathPath.";
    case "environment_mismatch": return "SePay environment does not match the payment mode.";
    case "bank_details_missing": return "Bank code, account number, or account name is missing. Transfer is unavailable.";
    case "webhook_secret_missing": return "The SePay webhook secret is missing. The QR is hidden until payments can be verified.";
    case "bank_and_webhook_missing": return "Bank details and SePay webhook are not configured. The order is saved but cannot be paid.";
    default: return "No payment provider is configured. The order is saved but cannot be paid.";
  }
}
