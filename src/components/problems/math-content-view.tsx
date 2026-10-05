import { delimitUnwrappedMath, renderValidatedMathToHtml } from "@/lib/problems/math-content";

const mathToken = /\$\$([\s\S]+?)\$\$|\$([^$]+)\$|\\\(([\s\S]+?)\\\)|\\\[([\s\S]+?)\\\]/g;

function renderText(input: string) {
  const source = delimitUnwrappedMath(input);
  const chunks: Array<{ text?: string; math?: string }> = [];
  let last = 0;
  for (const match of source.matchAll(mathToken)) {
    const index = match.index ?? 0;
    if (index > last) chunks.push({ text: source.slice(last, index) });
    chunks.push({ math: match[1] ?? match[2] ?? match[3] ?? match[4] ?? "" });
    last = index + match[0].length;
  }
  if (last < source.length) chunks.push({ text: source.slice(last) });
  return chunks.map((chunk, index) =>
    chunk.math !== undefined ? (
      <MathFormula key={`math-${index}`} source={chunk.math} />
    ) : (
      <span key={`text-${index}`}>{chunk.text}</span>
    ),
  );
}

export function MathContentView({ value }: { value: string }) {
  return <span className="math-content-view">{renderText(value)}</span>;
}

function MathFormula({ source }: { source: string }) {
  const html = renderValidatedMathToHtml(source);
  if (!html) {
    return (
      <span
        className="math-content-warning"
        role="img"
        aria-label="Công thức cần đối chiếu bản gốc"
        title="Công thức cần đối chiếu bản gốc"
      >
        Công thức cần đối chiếu bản gốc
      </span>
    );
  }
  return (
    <span
      className="math-content-formula"
      aria-label={`Biểu thức toán học: ${source}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
