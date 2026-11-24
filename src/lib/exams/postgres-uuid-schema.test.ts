import { describe, expect, it } from "vitest";
import { postgresUuidSchema } from "./postgres-uuid-schema";

describe("PostgreSQL UUID schema", () => {
  it("accepts UUIDs without RFC version and variant bits", () => {
    expect(postgresUuidSchema.safeParse("00000000-0000-0000-0000-000000000001").success).toBe(
      true,
    );
  });

  it("accepts RFC UUIDs and rejects malformed identifiers", () => {
    expect(postgresUuidSchema.safeParse("b6c7f401-2f1d-49b8-84ba-e2f1ebdf1111").success).toBe(
      true,
    );
    expect(postgresUuidSchema.safeParse("question-1").success).toBe(false);
  });
});
