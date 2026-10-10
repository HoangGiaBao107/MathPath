import { describe, expect, it } from "vitest";
import { readServerEnv } from "./env-schema";

describe("server environment parsing", () => {
  it("treats blank Supabase placeholders as unconfigured", () => {
    const env = readServerEnv({
      NODE_ENV: "test",
      NEXT_PUBLIC_APP_URL: "http://localhost:3000",
      NEXT_PUBLIC_SUPABASE_URL: "",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "",
      SUPABASE_SERVICE_ROLE_KEY: "",
    });
    expect(env.NEXT_PUBLIC_SUPABASE_URL).toBeUndefined();
    expect(env.NEXT_PUBLIC_SUPABASE_ANON_KEY).toBeUndefined();
    expect(env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY).toBeUndefined();
    expect(env.SUPABASE_SERVICE_ROLE_KEY).toBeUndefined();
  });

  it("rejects an invalid Supabase URL instead of hiding a configuration error", () => {
    expect(() =>
      readServerEnv({
        NODE_ENV: "test",
        NEXT_PUBLIC_APP_URL: "http://localhost:3000",
        NEXT_PUBLIC_SUPABASE_URL: "not-a-url",
      }),
    ).toThrow();
  });

  it("accepts SePay as an explicitly configured server-side payment provider", () => {
    const env = readServerEnv({
      NODE_ENV: "test",
      NEXT_PUBLIC_APP_URL: "http://localhost:3000",
      PAYMENT_PROVIDER: "sepay",
      PAYMENT_BANK_CODE: "VCB",
      PAYMENT_BANK_ACCOUNT: "0123456789",
      PAYMENT_ACCOUNT_NAME: "MATHPATH TEST",
      PAYMENT_WEBHOOK_SECRET: "test-only-secret",
      PAYMENT_MODE: "sandbox",
    });
    expect(env.PAYMENT_PROVIDER).toBe("sepay");
    expect(env.PAYMENT_BANK_CODE).toBe("VCB");
    expect(env.PAYMENT_MODE).toBe("sandbox");
  });

  it("keeps payments disabled by default", () => {
    expect(readServerEnv({ NODE_ENV: "test", NEXT_PUBLIC_APP_URL: "http://localhost:3000" }).PAYMENT_MODE).toBe("disabled");
  });
});
