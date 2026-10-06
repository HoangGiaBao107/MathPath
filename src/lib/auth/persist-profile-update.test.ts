import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/problems/database.types";
import { persistProfileUpdate } from "./persist-profile-update";

describe("persistProfileUpdate", () => {
  it("writes validated profile fields through the server client for the signed-in user", async () => {
    const eq = vi.fn().mockResolvedValue({ error: null });
    const update = vi.fn().mockReturnValue({ eq });
    const from = vi.fn().mockReturnValue({ update });
    const client = { from } as unknown as SupabaseClient<Database>;
    const values: Database["public"]["Tables"]["profiles"]["Update"] = {
      username: "math_learner",
      display_name: "math_learner",
      birth_date: "2008-06-12",
      gender: "female",
      avatar_path: "user-123/avatar",
    };

    await persistProfileUpdate(client, "user-123", values);

    expect(from).toHaveBeenCalledWith("profiles");
    expect(update).toHaveBeenCalledWith(values);
    expect(eq).toHaveBeenCalledWith("id", "user-123");
  });
});
