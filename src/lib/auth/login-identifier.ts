import { z } from "zod";

export const loginIdentifierSchema = z.string().trim().min(3).max(254).refine((value) => {
  if (value.includes("@")) return z.string().email().safeParse(value).success;
  return /^[a-zA-Z0-9._-]{3,30}$/.test(value);
});

export function isEmailIdentifier(identifier: string): boolean {
  return identifier.includes("@");
}
