import { z } from "zod";

// PostgreSQL UUID accepts all 128-bit values. Do not require RFC version or
// variant bits: older MathPath problem IDs are valid database UUIDs without them.
export const postgresUuidSchema = z
  .string()
  .regex(/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i);
