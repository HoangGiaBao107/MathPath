import { describe, expect, it } from "vitest";
import { getAuthRedirectBaseUrl } from "./redirect-url";

describe("getAuthRedirectBaseUrl", () => {
  it("uses the configured canonical origin and strips paths", () => {
    expect(
      getAuthRedirectBaseUrl("https://mathpath.com.vn/account/", "http://localhost:3000"),
    ).toBe("https://mathpath.com.vn");
  });

  it("uses the current request origin when no canonical URL is set", () => {
    expect(getAuthRedirectBaseUrl(undefined, "https://preview.mathpath.com.vn/auth/login")).toBe(
      "https://preview.mathpath.com.vn",
    );
  });

  it("ignores a malformed canonical URL and uses the fallback", () => {
    expect(getAuthRedirectBaseUrl("not a url", "http://localhost:3315/auth/login")).toBe(
      "http://localhost:3315",
    );
  });
});
