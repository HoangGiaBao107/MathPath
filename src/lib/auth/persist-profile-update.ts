import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/problems/database.types";

type ProfileUpdate = Database["public"]["Tables"]["profiles"]["Update"];

export async function persistProfileUpdate(
  client: SupabaseClient<Database>,
  userId: string,
  update: ProfileUpdate,
) {
  return client.from("profiles").update(update).eq("id", userId);
}
