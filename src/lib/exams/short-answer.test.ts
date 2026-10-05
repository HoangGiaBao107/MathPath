import { describe, expect, it } from "vitest";
import { normalizeShortAnswer, validateShortAnswer } from "./short-answer";

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
});
