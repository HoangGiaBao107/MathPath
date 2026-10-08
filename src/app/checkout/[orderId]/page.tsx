import { redirect } from "next/navigation";
import { CheckoutExperience } from "@/components/payments/checkout-experience";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabasePublicConfigured } from "@/lib/supabase/config";

export const metadata = { title: "Thanh toán gói học", robots: { index: false, follow: false } };

export default async function CheckoutPage({ params }: PageProps<"/checkout/[orderId]">) {
  const { orderId } = await params;
  if (!isSupabasePublicConfigured()) return <main className="page-shell"><p>Thanh toán hiện chưa được cấu hình.</p></main>;
  const client = await createSupabaseServerClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) redirect(`/auth/login?next=${encodeURIComponent(`/checkout/${orderId}`)}`);
  return <CheckoutExperience orderId={orderId} />;
}
