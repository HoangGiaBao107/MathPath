import { describe, expect, it, vi } from "vitest";
import {
  formatTargetScore,
  parseTargetScore,
  readGuestTargetScore,
  saveGuestTargetScore,
  targetScoreStorageKey,
} from "./target-score";

describe("guest target score storage", () => {
  it("formats preset goals and custom decimal goals in the selected locale", () => {
    expect(formatTargetScore(8, "vi")).toBe("8+");
    expect(formatTargetScore(10, "en")).toBe("10");
    expect(formatTargetScore(7.5, "vi")).toBe("7,5");
  });

  it("accepts scores only in the inclusive 0–10 range", () => {
    expect(parseTargetScore("0")).toBe(0);
    expect(parseTargetScore("7.5")).toBe(7.5);
    expect(parseTargetScore("10")).toBe(10);
    expect(parseTargetScore("10.1")).toBeNull();
    expect(parseTargetScore("nope")).toBeNull();
  });

  it("persists a valid score through an injected browser-storage adapter", () => {
    const data = new Map<string, string>();
    const storage = {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => data.set(key, value),
    };
    expect(saveGuestTargetScore(storage, 8)).toBe(true);
    expect(data.get(targetScoreStorageKey)).toBe("8");
    expect(readGuestTargetScore(storage)).toBe(8);
  });

  it("fails safely when browser storage throws", () => {
    const storage = {
      getItem: vi.fn(() => {
        throw new Error("blocked");
      }),
      setItem: vi.fn(() => {
        throw new Error("blocked");
      }),
    };
    expect(readGuestTargetScore(storage)).toBeNull();
    expect(saveGuestTargetScore(storage, 8)).toBe(false);
  });
});
