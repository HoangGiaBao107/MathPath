export type ResultView = "overview" | "review" | "analysis" | "study";
export function isResultDetailView(value: string): value is Exclude<ResultView, "overview"> {
  return value === "review" || value === "analysis" || value === "study";
}
