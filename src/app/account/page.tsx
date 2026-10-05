import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { AccountExperience } from "@/components/auth/account-experience";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabasePublicConfigured } from "@/lib/supabase/config";

export const metadata = { title: "Account", robots: { index: false, follow: false } };

export default async function AccountPage() {
  await cookies();
  if (!isSupabasePublicConfigured())
    return <AccountExperience email={null} displayName={null} configured={false} />;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, language, target_score")
    .eq("id", user.id)
    .maybeSingle();
  return (
    <AccountExperience
      email={user.email ?? null}
      displayName={profile?.display_name ?? null}
      language={profile?.language ?? null}
      targetScore={profile?.target_score ?? null}
      configured
    />
  );
}
