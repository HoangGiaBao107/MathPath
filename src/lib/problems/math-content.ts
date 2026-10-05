import katex from "katex";

export type MathValidation = { valid: boolean; issues: string[] };

const mathToken = /\$\$([\s\S]+?)\$\$|\$([^$]+)\$|\\\(([\s\S]+?)\\\)|\\\[([\s\S]+?)\\\]/g;

export function renderMathToHtml(source: string): string {
  return katex.renderToString(source, {
    output: "htmlAndMathml",
    throwOnError: false,
    trust: false,
    strict: "warn",
  });
}

export function renderValidatedMathToHtml(source: string): string | null {
  try {
    return katex.renderToString(source, {
      output: "htmlAndMathml",
      throwOnError: true,
      trust: false,
      strict: "error",
    });
  } catch {
    return null;
  }
}

/** Add delimiters only around unmistakable TeX commands or explicit powers/subscripts. */
export function delimitUnwrappedMath(value: string): string {
  const protectedParts = value.split(
    /(\$\$[\s\S]*?\$\$|\$[^$]*\$|\\\([\s\S]*?\\\)|\\\[[\s\S]*?\\\])/g,
  );
  const simpleScripts =
    /(?<![\p{L}\p{N}])(?:[A-Za-z]|\d+)(?:[_^](?:\{[^{}\n]+\}|[A-Za-z0-9+-]+))+(?![\p{L}\p{N}])/gu;
  const explicitCommand =
    /\\(?:frac\s*\{(?:[^{}]|\{[^{}]*\})*\}\s*\{(?:[^{}]|\{[^{}]*\})*\}|(?:sqrt|vec|overrightarrow|overline|mathbb|mathrm|mathbf|mathcal|operatorname)\s*(?:\[[^\]]+\])?\s*\{(?:[^{}]|\{[^{}]*\})*\}|(?:int|sum|lim)\s*(?:_\{[^}]+\}|_[^\s^]+)?\s*(?:\^\{[^}]+\}|\^[^\s]+)?|(?:alpha|beta|gamma|delta|epsilon|varepsilon|zeta|eta|theta|vartheta|iota|kappa|lambda|mu|nu|xi|pi|rho|sigma|tau|upsilon|phi|varphi|chi|psi|omega|Gamma|Delta|Theta|Lambda|Xi|Pi|Sigma|Phi|Psi|Omega|infty|leq|geq|neq|approx|equiv|to|mapsto|cdot|times|pm|mp|Rightarrow|Leftrightarrow|leftarrow|rightarrow|in|notin|subset|subseteq|cup|cap|forall|exists|emptyset|log|ln|sin|cos|tan|cot|arcsin|arccos|arctan|sec|csc|sinh|cosh|tanh))(?=[\s([{_^.,;:!?)]|$)/gu;
  const delimitScriptsOutsideMath = (part: string) =>
    part
      .split(/(\$\$[\s\S]*?\$\$|\$[^$]*\$|\\\([\s\S]*?\\\)|\\\[[\s\S]*?\\\])/g)
      .map((segment) =>
        segment.startsWith("$") || segment.startsWith("\\(") || segment.startsWith("\\[")
          ? segment
          : segment.replace(simpleScripts, (formula) => `$${formula}$`),
      )
      .join("");
  return protectedParts
    .map((part) => {
      if (part.startsWith("$") || part.startsWith("\\(") || part.startsWith("\\[")) return part;
      return delimitScriptsOutsideMath(part.replace(explicitCommand, (formula) => `$${formula}$`));
    })
    .join("");
}

export function validateMathContent(value: string): MathValidation {
  const issues: string[] = [];
  const formulas = [...value.matchAll(mathToken)].map(
    (match) => match[1] ?? match[2] ?? match[3] ?? match[4] ?? "",
  );
  const covered = value.replace(mathToken, "");
  const dollarCount = (value.match(/\$/g) ?? []).length;
  if (dollarCount % 2 !== 0) issues.push("Unmatched $ delimiter.");
  if ((value.match(/\\\(/g) ?? []).length !== (value.match(/\\\)/g) ?? []).length)
    issues.push("Unmatched \\( delimiter.");
  if ((value.match(/\\\[/g) ?? []).length !== (value.match(/\\\]/g) ?? []).length)
    issues.push("Unmatched \\[ delimiter.");
  let braceDepth = 0;
  for (const match of value.replace(/\\[{}]/g, "").matchAll(/[{}]/g)) {
    braceDepth += match[0] === "{" ? 1 : -1;
    if (braceDepth < 0) break;
  }
  if (braceDepth !== 0) issues.push("Unbalanced curly braces.");
  if (/\\[A-Za-z]+/.test(covered)) issues.push("Wrap LaTeX expressions in $...$ or \\(...\\).");
  for (const formula of formulas) {
    try {
      katex.renderToString(formula, { throwOnError: true, trust: false, strict: "error" });
    } catch (error) {
      issues.push(error instanceof Error ? error.message : "Invalid LaTeX expression.");
    }
  }
  return { valid: issues.length === 0, issues: [...new Set(issues)] };
}

export function cleanupDisplayText(value: string): string {
  return value
    .split(/(\$\$[\s\S]*?\$\$|\$[^$]*\$|\\\([\s\S]*?\\\)|\\\[[\s\S]*?\\\])/g)
    .map((part) =>
      part.startsWith("$") || part.startsWith("\\(") || part.startsWith("\\[")
        ? part
        : part
            .replace(/\bCâu(?=\d)/gu, "Câu ")
            .replace(/hàm(?=số)/giu, "hàm ")
            .replace(/và(?=điểm)/giu, "và "),
    )
    .join("");
}

export function extractDelimitedMath(value: string): string[] {
  return [...value.matchAll(mathToken)].map(
    (match) => match[1] ?? match[2] ?? match[3] ?? match[4] ?? "",
  );
}

export function preservesDelimitedMath(vietnamese: string, english: string): boolean {
  const source = extractDelimitedMath(vietnamese);
  const translated = extractDelimitedMath(english);
  return (
    source.length === translated.length && source.every((math, index) => math === translated[index])
  );
}
