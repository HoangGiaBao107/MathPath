export type SupportedMathImage = "image/jpeg" | "image/png" | "image/webp";

const maxImageBytes = 5 * 1024 * 1024;
const maxImageDimension = 8000;
const maxImagePixels = 32_000_000;

export function validateMathImageBytes(
  data: Uint8Array,
  mimeType: string,
): { bytes: Uint8Array; mimeType: SupportedMathImage } {
  if (!(mimeType === "image/jpeg" || mimeType === "image/png" || mimeType === "image/webp")) {
    throw new InvalidMathImageError("unsupported");
  }
  if (!data.byteLength || data.byteLength > maxImageBytes) throw new InvalidMathImageError("size");
  const dimensions = getImageDimensions(data, mimeType);
  if (!dimensions || dimensions.width < 1 || dimensions.height < 1)
    throw new InvalidMathImageError("invalid");
  if (
    dimensions.width > maxImageDimension ||
    dimensions.height > maxImageDimension ||
    dimensions.width * dimensions.height > maxImagePixels
  ) {
    throw new InvalidMathImageError("dimensions");
  }
  return { bytes: data, mimeType };
}

export class InvalidMathImageError extends Error {
  constructor(readonly reason: "unsupported" | "size" | "dimensions" | "invalid") {
    super(`invalid_math_image_${reason}`);
    this.name = "InvalidMathImageError";
  }
}

function getImageDimensions(
  bytes: Uint8Array,
  mime: SupportedMathImage,
): { width: number; height: number } | null {
  if (mime === "image/png") {
    if (
      bytes.length < 24 ||
      bytes[0] !== 0x89 ||
      bytes[1] !== 0x50 ||
      bytes[2] !== 0x4e ||
      bytes[3] !== 0x47
    )
      return null;
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    return { width: view.getUint32(16), height: view.getUint32(20) };
  }
  if (mime === "image/webp") {
    if (bytes.length < 30 || ascii(bytes, 0, 4) !== "RIFF" || ascii(bytes, 8, 4) !== "WEBP")
      return null;
    const kind = ascii(bytes, 12, 4);
    if (kind === "VP8X") return { width: 1 + read24(bytes, 24), height: 1 + read24(bytes, 27) };
    if (kind === "VP8L" && bytes[20] === 0x2f) {
      return {
        width: 1 + bytes[21]! + ((bytes[22]! & 0x3f) << 8),
        height: 1 + (bytes[22]! >> 6) + (bytes[23]! << 2) + ((bytes[24]! & 0x0f) << 10),
      };
    }
    if (kind === "VP8 " && bytes.length >= 30) {
      return {
        width: (bytes[26]! | (bytes[27]! << 8)) & 0x3fff,
        height: (bytes[28]! | (bytes[29]! << 8)) & 0x3fff,
      };
    }
    return null;
  }
  return jpegDimensions(bytes);
}

function jpegDimensions(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  let offset = 2;
  while (offset + 4 <= bytes.length) {
    if (bytes[offset] !== 0xff) return null;
    const marker = bytes[offset + 1]!;
    offset += 2;
    if (marker === 0xd9 || marker === 0xda) return null;
    const size = (bytes[offset]! << 8) | bytes[offset + 1]!;
    if (size < 2 || offset + size > bytes.length) return null;
    if (
      [0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(
        marker,
      )
    ) {
      return {
        height: (bytes[offset + 3]! << 8) | bytes[offset + 4]!,
        width: (bytes[offset + 5]! << 8) | bytes[offset + 6]!,
      };
    }
    offset += size;
  }
  return null;
}

function ascii(bytes: Uint8Array, offset: number, length: number) {
  return String.fromCharCode(...bytes.slice(offset, offset + length));
}

function read24(bytes: Uint8Array, offset: number) {
  return bytes[offset]! | (bytes[offset + 1]! << 8) | (bytes[offset + 2]! << 16);
}
