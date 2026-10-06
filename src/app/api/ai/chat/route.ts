import { z } from "zod";
import { NextResponse } from "next/server";
import { aiErrorResponse } from "@/lib/ai/http.server";
import { withAIReservation } from "@/lib/ai/service.server";

const schema = z.object({
  locale: z.enum(["vi", "en"]),
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().trim().min(1).max(5000),
      }),
    )
    .min(1)
    .max(12),
});

export async function POST(request: Request) {
  try {
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success || parsed.data.messages.at(-1)?.role !== "user") {
      return NextResponse.json({ error: "invalid_request" }, { status: 400 });
    }
    const result = await withAIReservation("chat", "text", (provider) =>
      provider.chat(parsed.data),
    );
    return NextResponse.json({ answer: result.data, quota: result.quota });
  } catch (error) {
    return aiErrorResponse(error);
  }
}
