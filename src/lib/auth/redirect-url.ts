/** Use the canonical application URL when configured, otherwise the request's own origin. */
export function getAuthRedirectBaseUrl(configuredUrl: string | undefined, fallbackUrl: string) {
  for (const candidate of [configuredUrl, fallbackUrl]) {
    if (!candidate) continue;
    try {
      const url = new URL(candidate);
      if (url.protocol === "https:" || url.protocol === "http:") return url.origin;
    } catch {
      // Try the request origin if the optional canonical URL is malformed.
    }
  }
  throw new Error("A valid application URL is required for authentication redirects.");
}
