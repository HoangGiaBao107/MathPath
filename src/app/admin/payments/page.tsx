import Link from "next/link";
import { notFound } from "next/navigation";
import { canAdminister } from "@/lib/auth/authorization";
import { getAuthenticatedActor } from "@/lib/analytics/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export const metadata = { title: "Thanh toán · MathPath Admin", robots: { index: false, follow: false } };

const allowedStatuses = ["all", "pending", "paid", "expired", "cancelled"] as const;
type FilterStatus = (typeof allowedStatuses)[number];

export default async function AdminPaymentsPage({ searchParams }: PageProps<"/admin/payments">) {
  const actor = await getAuthenticatedActor();
  if (!actor || !canAdminister(actor, "payments:read")) notFound();
  const params = await searchParams;
  const status = allowedStatuses.includes(params.status as FilterStatus) ? params.status as FilterStatus : "all";
  let query = getSupabaseAdminClient().from("payment_orders")
    .select("id, user_id, order_code, plan_code, plan_name_snapshot, amount_vnd, currency, status, provider, created_at, paid_at")
    .order("created_at", { ascending: false }).limit(100);
  if (status !== "all") query = query.eq("status", status);
  const { data, error } = await query;
  if (error) throw new Error("admin_payment_orders_unavailable");
  const orders = await Promise.all((data ?? []).map(async (order) => {
    const { data: authUser } = await getSupabaseAdminClient().auth.admin.getUserById(order.user_id);
    return { ...order, email: authUser.user?.email ?? "—" };
  }));
  const filters: [FilterStatus, string][] = [["all", "Tất cả"], ["pending", "Chờ thanh toán"], ["paid", "Đã thanh toán"], ["expired", "Hết hạn"], ["cancelled", "Đã hủy"]];
  const amount = (value: number) => `${new Intl.NumberFormat("vi-VN").format(value)} đ`;

  return <div className="admin-dashboard-layout">
    <aside className="admin-sidebar" aria-label="Điều hướng quản trị">
      <div className="admin-sidebar-brand"><span>MathPath<small>ADMIN</small></span></div>
      <p className="admin-sidebar-caption">QUẢN LÝ</p>
      <Link href="/admin/analytics">▦ <span>Tổng quan</span></Link>
      <Link className="is-active" href="/admin/payments">₫ <span>Thanh toán</span></Link>
      <Link href="/">← <span>Về trang học tập</span></Link>
    </aside>
    <main className="page-shell admin-payments-page" id="main-content">
      <header className="analytics-page-heading"><p className="eyebrow">ADMIN · MATHPATH</p><h1>Đơn thanh toán</h1><p>Quản lý đơn hàng và trạng thái thanh toán.</p></header>
      <nav className="payment-admin-filters" aria-label="Lọc trạng thái">
        {filters.map(([value, label]) => <Link aria-current={status === value ? "page" : undefined} className={status === value ? "is-active" : ""} href={value === "all" ? "/admin/payments" : `/admin/payments?status=${value}`} key={value}>{label}</Link>)}
      </nav>
      {orders.length ? <div className="payment-admin-table-wrap"><table className="payment-admin-table"><thead><tr><th>Mã đơn</th><th>Người dùng</th><th>Gói</th><th>Số tiền</th><th>Trạng thái</th><th>Provider</th><th>Tạo lúc</th><th>Thanh toán lúc</th></tr></thead><tbody>
        {orders.map((order) => <tr key={order.id}><td><code>{order.order_code}</code></td><td>{order.email}</td><td>{order.plan_name_snapshot}</td><td>{amount(order.amount_vnd)}</td><td><span className={`payment-status payment-status--${order.status}`}>{statusText(order.status)}</span></td><td>{order.provider}</td><td>{dateText(order.created_at)}</td><td>{order.paid_at ? dateText(order.paid_at) : "—"}</td></tr>)}
      </tbody></table></div> : <p className="analytics-empty-message">Chưa có đơn thanh toán ở trạng thái này.</p>}
    </main>
  </div>;
}

function statusText(status: string) { return ({ pending: "Đang chờ", paid: "Đã thanh toán", expired: "Hết hạn", cancelled: "Đã hủy" } as Record<string, string>)[status] ?? status; }
function dateText(value: string) { return new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Ho_Chi_Minh" }).format(new Date(value)); }
