import { NextResponse } from "next/server";
import { aiErrorResponse } from "@/lib/ai/http.server";
import { readAIQuota } from "@/lib/ai/service.server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const quota = await readAIQuota();
    return NextResponse.json({ quota }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return aiErrorResponse(error);
  }
}
