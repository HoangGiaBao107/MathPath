import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20261008000300_enable_published_exam_runtime.sql",
  "utf8",
);
const repository = readFileSync("src/lib/exams/attempt-repository.supabase.ts", "utf8");
const experience = readFileSync("src/components/exams/exam-experience.tsx", "utf8");
const stylesheet = readFileSync("src/app/globals.css", "utf8");

describe("published exam runtime contract", () => {
  it("preserves explicit demo flags while allowing approved published sets into the exam player", () => {
    expect(migration).toContain(
      "where slug = p_slug and review_status = 'approved' and publication_status = 'published'",
    );
    expect(migration).toContain("and rights_status = 'approved_for_publication'");
    expect(migration).toContain(
      "'demo', coalesce(set_row.exam_metadata ->> 'demo' = 'true', false)",
    );
    expect(migration).not.toContain("'demo', true");
    expect(repository).toContain("demo: z.boolean()");
  });

  it("loads an existing in-progress attempt instead of abandoning it on page entry", () => {
    expect(experience).toContain("loadCurrent(), 0");
    expect(experience).not.toContain("loadCurrent(true)");
    expect(experience).not.toContain("restartPreviousAttempt");
  });

  it("lets the problem bank filter menu extend beyond its main and filter containers", () => {
    expect(stylesheet).toMatch(/\.site-main\.problem-bank-page\s*\{\s*overflow:\s*visible;/);
    expect(stylesheet).toMatch(/\.problem-bank-tools\s*\{\s*position:\s*relative;\s*overflow:\s*visible;/);
  });
});
