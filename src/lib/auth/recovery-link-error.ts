export function hasRecoveryLinkError(hash: string): boolean {
  if (!hash.startsWith("#")) return false;
  const params = new URLSearchParams(hash.slice(1));
  return Boolean(params.get("error") || params.get("error_code"));
}
