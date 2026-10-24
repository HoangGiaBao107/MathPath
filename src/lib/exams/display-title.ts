/** Keep editorial provenance in stored data, outside student-facing titles. */
export function examDisplayTitle(title: string): string {
  return title.replace(/\s*\(biên soạn mới\)/gi, "").trim();
}
