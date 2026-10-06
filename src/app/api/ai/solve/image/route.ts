import { NextResponse } from "next/server";
import { AIProviderRequestError } from "@/lib/ai/providers.server";
import { aiErrorResponse } from "@/lib/ai/http.server";
import { InvalidMathImageError, validateMathImageBytes } from "@/lib/ai/image-validation";
import { withAIReservation } from "@/lib/ai/service.server";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get("image");
    const prompt = form.get("prompt");
    const locale = form.get("locale");
    if (
      !(file instanceof File) ||
      (locale !== "vi" && locale !== "en") ||
      (prompt !== null && (typeof prompt !== "string" || prompt.length > 2000))
    ) {
      return NextResponse.json({ error: "invalid_request" }, { status: 400 });
    }
    if (file.size === 0 || file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: "image_too_large" }, { status: 400 });
    }
    const image = validateMathImageBytes(new Uint8Array(await file.arrayBuffer()), file.type);
    const result = await withAIReservation("solve_image", prompt ? "mixed" : "image", (provider) =>
      provider.solveImage({
        image: image.bytes,
        mimeType: image.mimeType,
        prompt: typeof prompt === "string" ? prompt : undefined,
        locale,
      }),
    );
    return NextResponse.json({ solution: result.data, quota: result.quota });
  } catch (error) {
    if (error instanceof InvalidMathImageError) {
      const message =
        error.reason === "unsupported"
          ? "unsupported_image"
          : error.reason === "size"
            ? "image_too_large"
            : error.reason === "dimensions"
              ? "image_dimensions_invalid"
              : "image_unreadable";
      return NextResponse.json({ error: message }, { status: 400 });
    }
    if (error instanceof TypeError || error instanceof RangeError)
      return NextResponse.json({ error: "invalid_request" }, { status: 400 });
    if (error instanceof AIProviderRequestError && error.message.includes("timeout")) {
      return aiErrorResponse(error);
    }
    return aiErrorResponse(error);
  }
}
