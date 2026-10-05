import { readFile, realpath } from "node:fs/promises";
import path from "node:path";
import {
  getLocalIngestionImport,
  localIngestionReviewEnabled,
} from "@/lib/problems/ingestion-review.server";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ slug: string; assetPath: string[] }> },
) {
  if (!localIngestionReviewEnabled()) return new Response(null, { status: 404 });
  const { slug, assetPath } = await context.params;
  const ingestion = await getLocalIngestionImport(slug);
  if (
    !ingestion ||
    assetPath.length !== 2 ||
    !["questions", "illustrations", "source-pages"].includes(assetPath[0])
  ) {
    return new Response(null, { status: 404 });
  }
  const validAssetName =
    assetPath[0] === "source-pages"
      ? /^page-\d{2}\.png$/.test(assetPath[1])
      : /^q\d{2}\.png$/.test(assetPath[1]);
  if (!validAssetName) return new Response(null, { status: 404 });
  const resolved = path.resolve(ingestion.directory, ...assetPath);
  if (!resolved.startsWith(`${ingestion.directory}${path.sep}`))
    return new Response(null, { status: 404 });
  try {
    const realImagePath = await realpath(resolved);
    if (!realImagePath.startsWith(`${ingestion.directory}${path.sep}`)) {
      return new Response(null, { status: 404 });
    }
    const image = await readFile(realImagePath);
    return new Response(image, {
      headers: { "Content-Type": "image/png", "Cache-Control": "no-store" },
    });
  } catch {
    return new Response(null, { status: 404 });
  }
}
