import "server-only";

import { connection } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ProblemSetRow } from "./database.types";
import { filterAndSortProblemSets, paginateProblemSets } from "./catalog";
import { toPublicProblemSet } from "./catalog-mapping";
import type { ProblemSetPage, ProblemSetPageQuery } from "./types";

const QUESTION_PAGE_SIZE = 1000;

export async function getProblemBank(query: ProblemSetPageQuery = {}): Promise<ProblemSetPage> {
  // Published sets are request-time database data; do not query Supabase during build.
  await connection();
  const client = await createSupabaseServerClient();
  const { data: sets, error: setError } = await client
    .from("problem_sets")
    .select(
      "id,slug,title,description,language,source_year,timing_mode,time_limit_seconds,estimated_duration_seconds,difficulty,topic,category,exam_metadata,created_at",
    )
    .eq("review_status", "approved")
    .eq("publication_status", "published")
    .eq("rights_status", "approved_for_publication")
    .order("created_at", { ascending: false });

  if (setError) {
    console.error("Problem bank set query failed", {
      code: setError.code,
      message: setError.message,
      details: setError.details,
      hint: setError.hint,
    });
    throw new Error("problem_bank_unavailable");
  }

  const questionCounts = await loadPublishedQuestionCounts(client);
  const items = (sets ?? []).map((row) => {
    const problemSet = row as Pick<
      ProblemSetRow,
      | "id"
      | "slug"
      | "title"
      | "description"
      | "language"
      | "source_year"
      | "timing_mode"
      | "time_limit_seconds"
      | "estimated_duration_seconds"
      | "difficulty"
      | "topic"
      | "category"
      | "exam_metadata"
      | "created_at"
    >;
    return toPublicProblemSet(problemSet, questionCounts.get(problemSet.id) ?? 0);
  });

  return paginateProblemSets(filterAndSortProblemSets(items, query), query);
}

async function loadPublishedQuestionCounts(
  client: Awaited<ReturnType<typeof createSupabaseServerClient>>,
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  let offset = 0;

  while (true) {
    const { data, error } = await client
      .from("problems")
      .select("problem_set_id")
      .eq("review_status", "approved")
      .eq("publication_status", "published")
      .eq("rights_status", "approved_for_publication")
      .not("problem_set_id", "is", null)
      .order("problem_set_id", { ascending: true })
      .range(offset, offset + QUESTION_PAGE_SIZE - 1);

    if (error) {
      console.error("Problem bank question-count query failed", {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      });
      throw new Error("problem_bank_unavailable");
    }

    for (const row of data ?? []) {
      if (row.problem_set_id) {
        counts.set(row.problem_set_id, (counts.get(row.problem_set_id) ?? 0) + 1);
      }
    }

    if (!data || data.length < QUESTION_PAGE_SIZE) return counts;
    offset += QUESTION_PAGE_SIZE;
  }
}
