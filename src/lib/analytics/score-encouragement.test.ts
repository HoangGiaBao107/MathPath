import { describe, expect, it } from "vitest";
import { getScoreGoalMessage } from "./score-encouragement";

describe("getScoreGoalMessage", () => {
  it("celebrates a score above the goal", () => {
    expect(getScoreGoalMessage(8.5, 8, "vi").title).toContain("vượt mục tiêu 8/10");
  });

  it("celebrates reaching the goal", () => {
    expect(getScoreGoalMessage(8, 8, "vi").title).toContain("chạm mục tiêu 8/10");
  });

  it("encourages the student with the remaining score gap", () => {
    expect(getScoreGoalMessage(6.5, 8, "vi").title).toContain("Còn 1,5 điểm");
  });

  it("encourages setting a goal when one is not set", () => {
    expect(getScoreGoalMessage(7.5, null, "en").body).toContain("latest score is 7.5/10");
  });

  it("invites a first attempt when there is no score or goal", () => {
    expect(getScoreGoalMessage(undefined, null, "vi").body).toContain("Làm thử một đề");
  });
});
