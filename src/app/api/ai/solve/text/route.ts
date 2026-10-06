import { z } from "zod";
import { NextResponse } from "next/server";
import { aiErrorResponse } from "@/lib/ai/http.server";
import { withAIReservation } from "@/lib/ai/service.server";

const schema = z.object({
  prompt: z.string().trim().min(3).max(8000),
  locale: z.enum(["vi", "en"]),
});

export async function POST(request: Request) {
  try {
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
    const result = await withAIReservation("solve_text", "text", (provider) =>
      provider.solveText(parsed.data),
    );
    return NextResponse.json({ solution: result.data, quota: result.quota });
  } catch (error) {
    return aiErrorResponse(error);
  }
}
