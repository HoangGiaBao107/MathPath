import Link from "next/link";
import { notFound } from "next/navigation";
import { canAdminister } from "@/lib/auth/authorization";
import { getAuthenticatedActor } from "@/lib/analytics/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { AdminPaymentOrders, type AdminPaymentOrder } from "@/components/payments/admin-payment-orders";

export const metadata = { title: "Thanh toán · MathPath Admin", robots: { index: false, follow: false } };

const allowedStatuses = ["all", "pending", "paid", "expired", "cancelled"] as const;
type FilterStatus = (typeof allowedStatuses)[number];

export default async function AdminPaymentsPage({ searchParams }: PageProps<"/admin/payments">) {
  const actor = await getAuthenticatedActor();
  if (!actor || !canAdminister(actor, "payments:read")) notFound();
  const params = await searchParams;
  const status = allowedStatuses.includes(params.status as FilterStatus) ? params.status as FilterStatus : "all";
  const admin = getSupabaseAdminClient();
  const now = new Date().toISOString();

  await admin.from("payment_orders").update({ status: "expired", updated_at: now })
    .eq("status", "pending").lte("expires_at", now);

  const query = admin.from("payment_orders")
    .select("id, user_id, order_code, plan_code, plan_name_snapshot, amount_vnd, currency, status, provider, created_at, expires_at, paid_at, customer_reported_paid_at")
    .order("created_at", { ascending: false }).limit(100);
  let { data, error } = await query;
  let migrationReady = true;
  if (error?.code === "42703") {
    migrationReady = false;
    const fallback = admin.from("payment_orders")
      .select("id, user_id, order_code, plan_code, plan_name_snapshot, amount_vnd, currency, status, provider, created_at, expires_at, paid_at")
      .order("created_at", { ascending: false }).limit(100);
    const legacyResult = await fallback;
    data = legacyResult.data?.map((order) => ({ ...order, customer_reported_paid_at: null })) ?? null;
    error = legacyResult.error;
  }
  if (error) throw new Error("admin_payment_orders_unavailable");

  const orderIds = (data ?? []).map((order) => order.id);
  const reviewByOrder = new Map<string, AdminPaymentOrder["review"]>();
  const paymentReferenceByOrder = new Map<string, string>();
  if (orderIds.length) {
    const { data: transactions } = await admin.from("payment_transactions")
      .select("order_id, provider_transaction_id, provider_reference")
      .in("order_id", orderIds).order("created_at", { ascending: false });
    for (const transaction of transactions ?? []) {
      if (!paymentReferenceByOrder.has(transaction.order_id)) {
        const reference = transaction.provider_reference ?? transaction.provider_transaction_id;
        if (reference) paymentReferenceByOrder.set(transaction.order_id, reference);
      }
    }
  }
  if (migrationReady && orderIds.length) {
    const { data: reviews, error: reviewError } = await admin.from("payment_order_reviews")
      .select("order_id, action, transaction_reference, note, created_at").in("order_id", orderIds);
    if (reviewError) migrationReady = false;
    else for (const review of reviews ?? []) reviewByOrder.set(review.order_id, review);
  } else if (migrationReady && !orderIds.length) {
    const { error: reviewError } = await admin.from("payment_order_reviews").select("order_id").limit(1);
    if (reviewError) migrationReady = false;
  }

  const recentOrders: AdminPaymentOrder[] = await Promise.all((data ?? []).map(async (order) => {
    const { data: authUser } = await admin.auth.admin.getUserById(order.user_id);
    return {
      ...order,
      email: authUser.user?.email ?? "—",
      customer_reported_paid_at: order.customer_reported_paid_at,
      payment_reference: paymentReferenceByOrder.get(order.id) ?? null,
      review: reviewByOrder.get(order.id) ?? null,
    };
  }));
  const orders = status === "all" ? recentOrders : recentOrders.filter((order) => order.status === status);
  const stats = {
    pending: recentOrders.filter((order) => order.status === "pending").length,
    reported: recentOrders.filter((order) => order.customer_reported_paid_at && order.status !== "paid").length,
    paid: recentOrders.filter((order) => order.status === "paid").length,
    expired: recentOrders.filter((order) => order.status === "expired").length,
    cancelled: recentOrders.filter((order) => order.status === "cancelled").length,
  };
  const filters: [FilterStatus, string][] = [["all", "Tất cả"], ["pending", "Chờ xử lý"], ["paid", "Đã thanh toán"], ["expired", "Hết hạn"], ["cancelled", "Đã hủy"]];

  return <div className="admin-dashboard-layout">
    <aside className="admin-sidebar" aria-label="Điều hướng quản trị">
      <div className="admin-sidebar-brand"><span>MathPath<small>ADMIN</small></span></div>
      <p className="admin-sidebar-caption">QUẢN LÝ</p>
      <Link href="/admin/analytics">▦ <span>Tổng quan</span></Link>
      <Link className="is-active" href="/admin/payments">₫ <span>Thanh toán</span></Link>
      <Link href="/">← <span>Về trang học tập</span></Link>
    </aside>
    <main className="page-shell admin-payments-page" id="main-content">
      <header className="payment-admin-heading"><div><p className="eyebrow">ADMIN · MATHPATH</p><h1>Trung tâm thanh toán</h1><p>Theo dõi đơn hàng và đối soát giao dịch SePay trước khi kích hoạt gói học.</p></div><span className="payment-admin-heading-badge"><span /> Đơn chờ tự hết hạn sau 5 phút</span></header>
      {!migrationReady ? <p className="payment-admin-migration-note" role="status">Cần áp dụng migration `20261010000100_payment_admin_review_and_five_minute_expiry.sql` trên Supabase để bật báo đã chuyển, duyệt và hủy đơn.</p> : null}
      <section className="payment-admin-overview" aria-label="Tổng quan 100 đơn gần nhất">
        <article className="payment-admin-stat payment-admin-stat--attention"><span>Chờ xử lý</span><strong>{stats.pending}</strong><small>Đơn còn trong thời hạn</small></article>
        <article className="payment-admin-stat payment-admin-stat--reported"><span>Khách báo đã chuyển</span><strong>{stats.reported}</strong><small>Cần đối chiếu với giao dịch SePay</small></article>
        <article className="payment-admin-stat"><span>Đã thanh toán</span><strong>{stats.paid}</strong><small>Gói học đã được kích hoạt</small></article>
        <article className="payment-admin-stat"><span>Hết hạn</span><strong>{stats.expired}</strong><small>Có thể đối soát nếu tiền về trễ</small></article>
      </section>
      <section className="payment-admin-orders-panel">
        <div className="payment-admin-panel-heading"><div><h2>Giao dịch gần đây</h2><p>Hiển thị tối đa 100 đơn mới nhất · xác minh tiền vào trước khi duyệt</p></div><span className="payment-admin-live"><span /> Cập nhật mỗi 15 giây</span></div>
        <nav className="payment-admin-filters" aria-label="Lọc trạng thái">
          {filters.map(([value, label]) => <Link aria-current={status === value ? "page" : undefined} className={status === value ? "is-active" : ""} href={value === "all" ? "/admin/payments" : `/admin/payments?status=${value}`} key={value}>{label}{value !== "all" ? <span>{stats[value as keyof typeof stats] ?? 0}</span> : null}</Link>)}
        </nav>
        <AdminPaymentOrders orders={orders} migrationReady={migrationReady} />
      </section>
    </main>
  </div>;
}
