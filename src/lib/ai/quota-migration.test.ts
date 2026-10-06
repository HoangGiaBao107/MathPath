import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { creditPolicy } from "@/lib/credits/types";

const migration = readFileSync("supabase/migrations/20261006000100_phase9_ai_system.sql", "utf8");

describe("Phase 9 quota contract", () => {
  it("uses the approved guest, free, and paid limits", () => {
    expect(creditPolicy.guestTotalRequests).toBe(5);
    expect(creditPolicy.registeredFreeDailyRequests).toBe(5);
    expect(
      creditPolicy.paidPlans.map(({ slug, requestsPerDay }) => [slug, requestsPerDay]),
    ).toEqual([
      ["plus", 15],
      ["pro", 25],
      ["pro_max", 50],
    ]);
  });

  it("reserves atomically on the existing credit account and checks admin from profiles", () => {
    expect(migration).toContain("perform private.assert_service_role()");
    expect(migration).toContain("pg_advisory_xact_lock(hashtextextended('mathpath-ai:'");
    expect(migration).toMatch(/from public\.credit_accounts[\s\S]*?for update/i);
    expect(migration).toContain("profile_role = 'admin'");
    expect(migration).toContain("'Asia/Ho_Chi_Minh'");
  });

  it("supports request consume/refund and keeps generated practice answers private", () => {
    expect(migration).toContain("'phase9_ai_success'");
    expect(migration).toContain("'phase9_provider_failure'");
    expect(migration).toContain(
      "revoke all on public.ai_practice_items from public, anon, authenticated",
    );
    expect(migration).toContain("correct_answer text not null");
  });
});
