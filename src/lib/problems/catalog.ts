import type {
  ProblemSetFilters,
  ProblemSetPage,
  ProblemSetPageQuery,
  ProblemSetRepository,
  PublicProblemSet,
} from "./types";

function normalizeSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/đ/g, "d");
}

export function filterAndSortProblemSets(
  problemSets: readonly PublicProblemSet[],
  filters: ProblemSetFilters = {},
): PublicProblemSet[] {
  const query = normalizeSearch(filters.query?.trim() ?? "");
  const filtered = problemSets.filter((problemSet) => {
    const text = normalizeSearch(
      [problemSet.title, problemSet.description, ...problemSet.topicNames].join(" "),
    );

    return (
      (!query || text.includes(query)) &&
      (!filters.category ||
        filters.category === "all" ||
        problemSet.category === filters.category) &&
      (!filters.difficulty ||
        filters.difficulty === "all" ||
        problemSet.difficulty === filters.difficulty)
    );
  });

  const locale = filters.locale === "en" ? "en" : "vi";
  switch (filters.sort ?? "newest") {
    case "title":
      return filtered.sort((left, right) => left.title.localeCompare(right.title, locale));
    case "question_count":
      return filtered.sort(
        (left, right) =>
          right.questionCount - left.questionCount || left.title.localeCompare(right.title, locale),
      );
    case "duration":
      return filtered.sort(
        (left, right) =>
          (left.timeLimitMinutes ?? left.estimatedDurationMinutes ?? 0) -
            (right.timeLimitMinutes ?? right.estimatedDurationMinutes ?? 0) ||
          left.title.localeCompare(right.title, locale),
      );
    case "newest":
    default:
      return filtered.sort((left, right) => right.publishedAt.localeCompare(left.publishedAt));
  }
}

export function paginateProblemSets(
  problemSets: readonly PublicProblemSet[],
  query: Pick<ProblemSetPageQuery, "limit" | "cursor"> = {},
): ProblemSetPage {
  const limit = Number.isFinite(query.limit)
    ? Math.min(Math.max(Math.floor(query.limit ?? 12), 1), 50)
    : 12;
  const requestedOffset = Number.parseInt(query.cursor ?? "0", 10);
  const offset = Number.isFinite(requestedOffset) ? Math.max(0, requestedOffset) : 0;
  const items = problemSets.slice(offset, offset + limit);
  const nextOffset = offset + items.length;

  return {
    items,
    nextCursor: nextOffset < problemSets.length ? String(nextOffset) : null,
    totalCount: problemSets.length,
  };
}

/** Demo adapter only. Replace with a server-side Supabase repository after project approval. */
export class DemoProblemSetRepository implements ProblemSetRepository {
  constructor(private readonly demoRecords: readonly PublicProblemSet[]) {}

  async listPublicProblemSets(query: ProblemSetPageQuery = {}): Promise<ProblemSetPage> {
    const sorted = filterAndSortProblemSets(this.demoRecords, query);
    return paginateProblemSets(sorted, query);
  }
}
