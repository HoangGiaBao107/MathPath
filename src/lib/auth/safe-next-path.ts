export function safeNextPath(value: string | null | undefined, fallback = "/account"): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
    return fallback;
  }
  const target = new URL(value, "http://mathpath.invalid");
  return target.origin === "http://mathpath.invalid"
    ? `${target.pathname}${target.search}${target.hash}`
    : fallback;
}
