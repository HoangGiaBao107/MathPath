export const SHORT_ANSWER_MAX_LENGTH = 4;
const SHORT_ANSWER_PATTERN = /^-?\d+(?:[,.]\d+)?$/;

export type ShortAnswerValidation =
  | { valid: true; raw: string }
  | { valid: false; reason: "too_long" | "invalid_characters" | "invalid_number" };

/** Keep the user's original punctuation for storage; normalize only for comparison. */
export function validateShortAnswer(raw: string): ShortAnswerValidation {
  if (raw.length > SHORT_ANSWER_MAX_LENGTH) return { valid: false, reason: "too_long" };
  if ([...raw].some((character) => !/[0-9,.-]/.test(character))) {
    return { valid: false, reason: "invalid_characters" };
  }
  if (raw !== "" && !SHORT_ANSWER_PATTERN.test(raw)) {
    return { valid: false, reason: "invalid_number" };
  }
  return { valid: true, raw };
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
