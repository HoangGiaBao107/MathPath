import { describe, expect, it } from "vitest";
import { compareShortAnswer, normalizeShortAnswer, validateShortAnswer } from "./short-answer";

describe("short-answer input", () => {
  it("accepts the supported four-character numeric formats", () => {
    for (const value of ["15", "-3", "0,7", "0.7", "2,5", "2.5", "-0.3", "-123"]) {
      expect(validateShortAnswer(value)).toEqual({ valid: true, raw: value });
    }
  });

  it("rejects overlong input and unsupported characters", () => {
    expect(validateShortAnswer("12345")).toEqual({ valid: false, reason: "too_long" });
    expect(validateShortAnswer("1a")).toEqual({ valid: false, reason: "invalid_characters" });
    expect(validateShortAnswer("-,5")).toEqual({ valid: false, reason: "invalid_number" });
  });

  it("preserves raw input and normalizes comma or dot decimals for comparison", () => {
    expect(normalizeShortAnswer("0,50")).toBe("0.5");
    expect(normalizeShortAnswer("-0.30")).toBe("-0.3");
    expect(normalizeShortAnswer("-0,0")).toBe("0");
    expect(normalizeShortAnswer("015")).toBe("15");
  });

  it("accepts exact text answers with harmless spacing and math-symbol variants", () => {
    const policy = { kind: "text", maxLength: 256 } as const;
    expect(validateShortAnswer("AM = (12 - 3√3)/8, BN = (20 - 5√3)/8", policy).valid).toBe(true);
    expect(
      compareShortAnswer(
        "AM=(12-3sqrt(3))/8; BN=(20-5sqrt(3))/8",
        ["AM=(12−3√3)/8, BN=(20−5√3)/8"],
        policy,
      ),
    ).toBe("equivalent");
    expect(compareShortAnswer("hyperbol, 6", ["hypebol, 6", "hyperbol, 6"], policy)).toBe(
      "equivalent",
    );
    expect(compareShortAnswer("a=2/3, x-z=0", ["a=2/3, x−z=0."], policy)).toBe("equivalent");
  });
});
