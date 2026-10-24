import { describe, expect, it } from "vitest";
import { canParseExactExpression, compareExactExpressions } from "./exact-expression";
import { compareShortAnswer, validateShortAnswer } from "./short-answer";
import { scoreExam } from "./scoring";
import { mockExams } from "./demo-data.mock";
import type { ExamDefinition } from "./types";

describe("bounded exact expression grading", () => {
  it.each([
    ["1/2", "0,5"], ["sqrt(20)/2", "sqrt(5)"], ["1/(sqrt(2)+1)", "sqrt(2)-1"],
    ["pi/2-2/3", "(3π-4)/6"], ["\\frac{3\\pi-4}{6}", "(3*pi-4)/6"],
    ["sqrt(8/9)", "2sqrt(2)/3"], ["(sqrt(2)+sqrt(3))^2", "5+2sqrt(6)"],
    ["-2^2", "-4"], ["2^-2", "1/4"], ["2^3^2", "512"], ["√5", "\\sqrt{5}"],
  ])("proves %s = %s without floating point sampling", (a, b) => {
    expect(compareExactExpressions(a, b)).toBe("equivalent");
  });
  it.each([["3.141592653589793", "pi"], ["sqrt(2)", "1.4142135623730951"], ["-2^2", "4"], ["1/3", "0.3333333333333333"]])("does not use approximate equality for %s", (a, b) => {
    expect(compareExactExpressions(a, b)).toBe("different");
  });
  it.each(["process.exit()", "globalThis", "sqrt(-1)", "1/0", "1/(sqrt(8)-2sqrt(2))", "sin(pi)", "sqrt(2+sqrt(3))", "x+x", "1 2", "2**3", "9^999", "(".repeat(300)])("fails closed for %s", value => {
    expect(canParseExactExpression(value)).toBe(false);
    expect(compareExactExpressions(value, value)).toBe("unverified");
  });
  it("keeps official answers at four numeric characters and requires opt-in", () => {
    expect(validateShortAnswer("1/2").valid).toBe(false);
    expect(validateShortAnswer("12345").valid).toBe(false);
    expect(validateShortAnswer("sqrt(5)", {kind: "expression", maxLength: 128}).valid).toBe(true);
    expect(compareShortAnswer("1.41", ["1.414"], {kind: "numeric", maxLength: 10, absoluteTolerance: 0.005})).toBe("equivalent");
    expect(compareShortAnswer("1.41", ["1.414"], {kind: "numeric", maxLength: 10})).toBe("different");
  });
  it("persists a provisional zero for unsupported keys, never a false positive", () => {
    const exam: ExamDefinition = {...mockExams[1], questions: [{id:"e", sectionId:"practice", number:"1", type:"short_answer", stem:"", points:1, canonicalAnswer:"sin(pi)", inputPolicy:{kind:"expression",maxLength:128}}]};
    expect(scoreExam(exam, {e:{type:"short_answer",raw:"0"}}).questionOutcomes[0]).toMatchObject({pointsEarned:0,gradingStatus:"needs_review"});
    if (exam.questions[0].type !== "short_answer") throw new Error("fixture type");
    exam.questions[0] = {...exam.questions[0], canonicalAnswer:"(3*pi-4)/6"};
    expect(scoreExam(exam, {e:{type:"short_answer",raw:"pi/2-2/3"}}).score).toBe(1);
  });
});
