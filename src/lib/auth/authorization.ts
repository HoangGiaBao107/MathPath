import type { AuthenticatedActor } from "./types";

export type AdminCapability =
  | "content:read"
  | "content:write"
  | "users:read"
  | "payments:read"
  | "feedback:manage"
  | "audit:read";

const adminCapabilities = new Set<AdminCapability>([
  "content:read",
  "content:write",
  "users:read",
  "payments:read",
  "feedback:manage",
  "audit:read",
]);

export function canAdminister(
  actor: AuthenticatedActor | null,
  capability: AdminCapability,
): boolean {
  return actor?.role === "admin" && adminCapabilities.has(capability);
}

export function requireAdmin(
  actor: AuthenticatedActor | null,
): asserts actor is AuthenticatedActor {
  if (!actor || actor.role !== "admin") {
    throw new Error("Admin access is required.");
  }
}
