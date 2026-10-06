import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { AccountExperience } from "@/components/auth/account-experience";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabasePublicConfigured } from "@/lib/supabase/config";
import { getStudentProgress } from "@/lib/analytics/server";

export const metadata = { title: "Account", robots: { index: false, follow: false } };

export default async function AccountPage() {
  await cookies();
  if (!isSupabasePublicConfigured())
    return <AccountExperience email={null} username={null} configured={false} />;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");
  let profile = {
    username: null as string | null,
    display_name: null as string | null,
    language: null as string | null,
    target_score: null as number | null,
    birth_date: null as string | null,
    gender: null as string | null,
    avatar_path: null as string | null,
  };
  const { data: extendedProfile, error: extendedProfileError } = await supabase
    .from("profiles")
    .select("username, display_name, language, target_score, birth_date, gender, avatar_path")
    .eq("id", user.id)
    .maybeSingle();
  if (!extendedProfileError && extendedProfile) {
    profile = extendedProfile;
  } else {
    // Keep the account page readable until the additive profile migration is applied.
    const { data: legacyProfile } = await supabase
      .from("profiles")
      .select("display_name, language, target_score")
      .eq("id", user.id)
      .maybeSingle();
    if (legacyProfile) profile = { ...profile, ...legacyProfile };
  }
  const metadataUsername =
    typeof user.user_metadata?.username === "string" ? user.user_metadata.username : null;
  const avatarPath = profile?.avatar_path ?? null;
  const { data: signedAvatar } = avatarPath
    ? await supabase.storage.from("profile-avatars").createSignedUrl(avatarPath, 3600)
    : { data: null };
  return (
    <AccountExperience
      email={user.email ?? null}
      username={profile.username ?? metadataUsername}
      targetScore={profile?.target_score ?? null}
      birthDate={profile?.birth_date ?? null}
      gender={profile?.gender ?? null}
      avatarPath={avatarPath}
      avatarUrl={signedAvatar?.signedUrl ?? null}
      progress={await getStudentProgress(user.id, 1)}
      configured
    />
  );
}
