"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export type AdminPaymentOrder = {
  id: string; order_code: string; email: string; plan_name_snapshot: string; amount_vnd: number;
  status: string; provider: string; created_at: string; expires_at: string; paid_at: string | null;
  customer_reported_paid_at: string | null;
  payment_reference: string | null;
  review: { action: string; transaction_reference: string | null; note: string; created_at: string } | null;
};

export function AdminPaymentOrders({ orders, migrationReady }: { orders: AdminPaymentOrder[]; migrationReady: boolean }) {
  const router = useRouter();
  const [selectedOrder, setSelectedOrder] = useState<string | null>(null);
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [verified, setVerified] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const timer = window.setInterval(() => router.refresh(), 15_000);
    return () => window.clearInterval(timer);
  }, [router]);

  async function review(orderId: string, action: "approve" | "cancel") {
    setBusy(orderId); setMessage("");
    try {
      const response = await fetch(`/api/admin/payments/${orderId}/review`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(action === "approve"
          ? { action, transactionReference: reference, note, verified }
          : { action, note: "Admin cancelled the pending payment order." }),
      });
      const payload = await response.json() as { result?: string; error?: string };
      if (!response.ok) throw new Error(payload.error ?? "payment_review_failed");
      setMessage(action === "approve" ? "Đã duyệt, gói học đã được kích hoạt." : "Đã hủy đơn hàng.");
      setSelectedOrder(null); setReference(""); setNote(""); setVerified(false); router.refresh();
    } catch (error) {
      setMessage(reviewError(error instanceof Error ? error.message : "payment_review_failed")); router.refresh();
    } finally { setBusy(null); }
  }

  return <>
    {message ? <p className="payment-admin-feedback" role="status">{message}</p> : null}
    {orders.length ? <div className="payment-admin-table-wrap"><table className="payment-admin-table">
      <thead><tr><th>Mã đơn</th><th>Người dùng</th><th>Gói</th><th>Số tiền</th><th>Trạng thái</th><th>Provider</th><th>Tạo lúc / hạn</th><th>Thanh toán / duyệt</th><th>Thao tác</th></tr></thead>
      <tbody>{orders.map((order) => <tr key={order.id}>
        <td><code>{order.order_code}</code></td><td>{order.email}</td><td>{order.plan_name_snapshot}</td>
        <td>{new Intl.NumberFormat("vi-VN").format(order.amount_vnd)} đ</td>
        <td><span className={`payment-status payment-status--${order.status}`}>{statusText(order.status)}</span>{order.customer_reported_paid_at ? <small className="payment-admin-reported">Khách báo đã chuyển</small> : null}</td>
        <td>{order.provider}</td><td>{dateText(order.created_at)}<small className="payment-admin-reported">Hạn: {dateText(order.expires_at)}</small></td>
        <td>{order.paid_at ? dateText(order.paid_at) : order.review ? `${order.review.action === "approved" ? "Duyệt" : "Hủy"} · ${dateText(order.review.created_at)}` : "—"}{order.payment_reference || order.review?.transaction_reference ? <small className="payment-admin-reported">Ref: {order.payment_reference ?? order.review?.transaction_reference}</small> : null}</td>
        <td className="payment-admin-actions">{(order.status === "pending" || order.status === "expired") && migrationReady ? <>
          {selectedOrder === order.id ? <form onSubmit={(event) => { event.preventDefault(); void review(order.id, "approve"); }} className="payment-review-form">
            {order.status === "expired" ? <small>Đơn đã hết hạn. Chỉ duyệt khi đã thấy giao dịch tiền vào khớp trong SePay.</small> : null}
            <label>Mã giao dịch / mã tham chiếu SePay<input value={reference} onChange={(event) => setReference(event.target.value)} maxLength={200} required /></label>
            <label>Ghi chú (không bắt buộc)<input value={note} onChange={(event) => setNote(event.target.value)} maxLength={1000} /></label>
            <label className="payment-review-verify"><input type="checkbox" checked={verified} onChange={(event) => setVerified(event.target.checked)} required /> Tôi đã kiểm tra tiền vào trong SePay</label>
            <button className="button button--primary" type="submit" disabled={busy === order.id || !verified || !reference.trim()}>{busy === order.id ? "Đang xử lý…" : "Xác nhận duyệt"}</button>
            <button className="button button--secondary" type="button" onClick={() => setSelectedOrder(null)}>Đóng</button>
          </form> : <div className="payment-review-buttons">
            <button className="button button--primary" type="button" onClick={() => { setSelectedOrder(order.id); setReference(""); setNote(""); setVerified(false); }}>{order.status === "expired" ? "Đối soát & duyệt" : "Duyệt"}</button>
            {order.status === "pending" ? <button className="button button--secondary" type="button" disabled={busy === order.id} onClick={() => { if (window.confirm(`Hủy đơn ${order.order_code}?`)) void review(order.id, "cancel"); }}>Hủy</button> : null}
          </div>}
        </> : order.status === "pending" ? <span>Chờ cập nhật database</span> : "—"}</td>
      </tr>)}</tbody>
    </table></div> : <p className="analytics-empty-message">Chưa có đơn thanh toán ở trạng thái này.</p>}
  </>;
}

function statusText(status: string) {
  return ({ pending: "Chờ xử lý", paid: "Đã thanh toán · đã kích hoạt", expired: "Hết hạn", cancelled: "Đã hủy" } as Record<string, string>)[status] ?? status;
}
function dateText(value: string) {
  return new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Ho_Chi_Minh" }).format(new Date(value));
}
function reviewError(error: string) {
  if (error === "order_expired") return "Đơn đã hết hạn; không thể duyệt thanh toán đơn này.";
  if (error === "order_not_pending") return "Đơn không còn ở trạng thái chờ xử lý. Danh sách đã được tải lại.";
  if (error === "payment_migration_required") return "Cần áp dụng migration payment mới trên Supabase trước khi duyệt đơn.";
  return "Không xử lý được đơn. Hãy tải lại và kiểm tra trạng thái giao dịch.";
}
