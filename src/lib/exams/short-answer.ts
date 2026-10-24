import { canParseExactExpression, compareExactExpressions } from "./exact-expression";

export const SHORT_ANSWER_MAX_LENGTH = 4;
const SHORT_ANSWER_PATTERN = /^-?\d+(?:[,.]\d+)?$/;
export type ShortAnswerPolicy =
  | { kind: "thptqg_numeric" }
  | { kind: "numeric"; maxLength: number; absoluteTolerance?: number }
  | { kind: "expression"; maxLength: number };

export function shortAnswerMaxLength(policy?: ShortAnswerPolicy): number {
  return !policy || policy.kind === "thptqg_numeric" ? 4 : Math.min(256, policy.maxLength);
}

export type ShortAnswerValidation =
  | { valid: true; raw: string }
  | { valid: false; reason: "too_long" | "invalid_characters" | "invalid_number" | "unsupported_expression" };

/** Keep the user's original punctuation for storage; normalize only for comparison. */
export function validateShortAnswer(raw: string, policy?: ShortAnswerPolicy): ShortAnswerValidation {
  if (raw.length > shortAnswerMaxLength(policy)) return { valid: false, reason: "too_long" };
  if (policy?.kind === "expression") {
    return raw === "" || canParseExactExpression(raw)
      ? { valid: true, raw }
      : { valid: false, reason: "unsupported_expression" };
  }
  if ([...raw].some((character) => !/[0-9,.-]/.test(character))) {
    return { valid: false, reason: "invalid_characters" };
  }
  if (raw !== "" && !SHORT_ANSWER_PATTERN.test(raw)) {
    return { valid: false, reason: "invalid_number" };
  }
  return { valid: true, raw };
}

export function compareShortAnswer(raw: string, accepted: string[], policy?: ShortAnswerPolicy): "equivalent" | "different" | "unverified" {
  if (!validateShortAnswer(raw, policy).valid || !raw.trim() || !accepted.length) return "unverified";
  if (policy?.kind === "expression") {
    const comparisons = accepted.map(value => compareExactExpressions(raw, value));
    if (comparisons.includes("unverified")) return "unverified";
    return comparisons.includes("equivalent") ? "equivalent" : "different";
  }
  if (accepted.some(value => !SHORT_ANSWER_PATTERN.test(value))) return "unverified";
  if (accepted.some(value => normalizeShortAnswer(value) === normalizeShortAnswer(raw))) return "equivalent";
  if (policy?.kind === "numeric" && policy.absoluteTolerance !== undefined) {
    if (!Number.isFinite(policy.absoluteTolerance) || policy.absoluteTolerance < 0) return "unverified";
    const actual = Number(raw.replace(",", "."));
    if (!Number.isFinite(actual)) return "unverified";
    return accepted.some(value => Math.abs(actual - Number(value.replace(",", "."))) <= policy.absoluteTolerance!) ? "equivalent" : "different";
  }
  return "different";
}

export function normalizeShortAnswer(raw: string): string {
  const value = raw.trim().replace(",", ".");
  const negative = value.startsWith("-");
  const unsigned = negative ? value.slice(1) : value;
  const [integerPart = "0", fractionPart] = unsigned.split(".");
  const integer = integerPart.replace(/^0+(?=\d)/, "") || "0";
  const fraction = fractionPart?.replace(/0+$/, "");
  const normalized = fraction ? `${integer}.${fraction}` : integer;
  if (normalized === "0") return "0";
  return negative ? `-${normalized}` : normalized;
}
