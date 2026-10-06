import { describe, expect, it } from "vitest";
import {
  getAcceptedAnswers,
  getShortAnswer,
  getTrueFalseAnswer,
  isCorrectOption,
  isSelectedOption,
} from "./question-review";

describe("submitted question review", () => {
  it("matches a selected multiple-choice option and its verified key", () => {
    expect(isSelectedOption({ type: "multiple_choice", optionKey: "B" }, "B")).toBe(true);
    expect(isCorrectOption({ option_key: "C" }, "C")).toBe(true);
    expect(isCorrectOption(null, "B")).toBe(false);
  });

  it("reads true/false selections and answer-key values by statement", () => {
    expect(getTrueFalseAnswer({ statements: { a: true } }, "a")).toBe(true);
    expect(getTrueFalseAnswer({ statements: { a: "true" } }, "a")).toBeNull();
  });

  it("shows typed short answers and only string accepted values", () => {
    expect(getShortAnswer({ raw: "x + 1" })).toBe("x + 1");
    expect(getAcceptedAnswers({ accepted_values: ["2", 3, "3"] })).toEqual(["2", "3"]);
    expect(getAcceptedAnswers(null)).toEqual([]);
  });
});
