import { describe, expect, it } from "vitest";
import { InvalidMathImageError, validateMathImageBytes } from "./image-validation";

function png(width: number, height: number) {
  const bytes = new Uint8Array(24);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  bytes.set([0x49, 0x48, 0x44, 0x52], 12);
  new DataView(bytes.buffer).setUint32(16, width);
  new DataView(bytes.buffer).setUint32(20, height);
  return bytes;
}

describe("math image validation", () => {
  it("accepts a supported, bounded PNG and returns bytes without retaining a file", () => {
    const bytes = png(1200, 900);
    expect(validateMathImageBytes(bytes, "image/png")).toEqual({ bytes, mimeType: "image/png" });
  });

  it("rejects unsupported types, malformed headers, and unsafe dimensions", () => {
    expect(() => validateMathImageBytes(png(20, 20), "image/gif")).toThrow(InvalidMathImageError);
    expect(() => validateMathImageBytes(new Uint8Array([1, 2, 3]), "image/png")).toThrow(
      InvalidMathImageError,
    );
    expect(() => validateMathImageBytes(png(9000, 200), "image/png")).toThrow(
      InvalidMathImageError,
    );
    expect(() => validateMathImageBytes(png(8000, 5000), "image/png")).toThrow(
      InvalidMathImageError,
    );
  });
});
