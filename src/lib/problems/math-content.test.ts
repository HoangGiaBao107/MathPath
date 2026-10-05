import { describe, expect, it } from "vitest";
import {
  cleanupDisplayText,
  delimitUnwrappedMath,
  extractDelimitedMath,
  preservesDelimitedMath,
  renderMathToHtml,
  validateMathContent,
} from "./math-content";

describe("MathPath math display and validation", () => {
  it("adds math delimiters only to clear unwrapped formulas and leaves existing formulas intact", () => {
    expect(delimitUnwrappedMath(String.raw`Cho \vec{u}, x^2 và x_{n+1}.`)).toBe(
      String.raw`Cho $\vec{u}$, $x^2$ và $x_{n+1}$.`,
    );
    expect(delimitUnwrappedMath(String.raw`Đã có $x^2$ và \(\frac{1}{2}\).`)).toBe(
      String.raw`Đã có $x^2$ và \(\frac{1}{2}\).`,
    );
  });
  it("renders vector arrows, roots, powers, subscripts, fractions, integrals and Greek letters as MathML", () => {
    const math = renderMathToHtml(
      String.raw`\overrightarrow{AB}=\frac{\sqrt{x^2}}{x_1}+\int_a^b \alpha\,dx`,
    );
    expect(math).toContain('class="katex"');
    expect(math).toContain("<mover");
    expect(math).toContain("<mfrac>");
    expect(math).toContain("<msqrt>");
    expect(math).toContain("<msup>");
    expect(math).toContain("<msub>");
    expect(math).toContain("∫");
    expect(math).toContain("α");
  });

  it("renders matrix environments without emitting source markup", () => {
    const math = renderMathToHtml(String.raw`\begin{pmatrix}a&b\\c&d\end{pmatrix}`);
    expect(math).toContain("<mtable ");
    expect(math).toContain('<mo fence="true">(</mo>');
    expect(math).toContain("<mtd>");
  });

  it("escapes untrusted TeX text instead of accepting embedded HTML", () => {
    const html = renderMathToHtml(String.raw`\text{<img src=x onerror=alert(1)>}`);
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;img");
  });

  it("detects unmatched delimiters, braces, broken scripts, and unknown commands", () => {
    expect(validateMathContent("$x^2").valid).toBe(false);
    expect(validateMathContent("$\\frac{1}{2$").valid).toBe(false);
    expect(validateMathContent("$x^$").valid).toBe(false);
    expect(validateMathContent("$\\mystery{x}$").valid).toBe(false);
    expect(validateMathContent("$\\frac{1}{2}$").valid).toBe(true);
  });

  it("applies only exact, conservative spacing suggestions outside formulas", () => {
    expect(cleanupDisplayText("Câu1: Cho hàmsố f(x), vàđiểm A.")).toBe(
      "Câu 1: Cho hàm số f(x), và điểm A.",
    );
    expect(cleanupDisplayText(String.raw`Câu1: $x , y$ hàmsố`)).toBe(
      String.raw`Câu 1: $x , y$ hàm số`,
    );
  });

  it("compares math tokens exactly when reviewing English translations", () => {
    const vi = String.raw`Cho vectơ $\vec{a}=(1;2;3)$ và $x^2$`;
    const en = String.raw`Let vector $\vec{a}=(1;2;3)$ and $x^2$`;
    expect(extractDelimitedMath(vi)).toEqual([String.raw`\vec{a}=(1;2;3)`, "x^2"]);
    expect(preservesDelimitedMath(vi, en)).toBe(true);
    expect(preservesDelimitedMath(vi, String.raw`Let vector $a=(1;2;3)$ and $x^2$`)).toBe(false);
  });
});
