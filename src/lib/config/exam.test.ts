import { describe, expect, it } from "vitest";
import { getCountdownParts, THPTQG_2027_TIMESTAMP } from "./exam";

describe("THPTQG countdown", () => {
  it("breaks remaining time into day, hour, minute and second units", () => {
    expect(getCountdownParts(THPTQG_2027_TIMESTAMP - 90_061_000)).toEqual({
      days: 1,
      hours: 1,
      minutes: 1,
      seconds: 1,
      complete: false,
    });
  });

  it("clamps at the final state once the exam starts", () => {
    expect(getCountdownParts(THPTQG_2027_TIMESTAMP + 5_000)).toEqual({
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
      complete: true,
    });
  });
});
