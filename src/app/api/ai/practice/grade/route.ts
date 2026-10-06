import { z } from "zod";
import { NextResponse } from "next/server";
import { aiErrorResponse } from "@/lib/ai/http.server";
import { getAIIdentity } from "@/lib/ai/service.server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

const schema = z.object({
  practiceId: z.string().uuid(),
  answer: z.string().trim().min(1).max(500),
});

export async function POST(request: Request) {
  try {
    const body = schema.safeParse(await request.json().catch(() => null));
    if (!body.success) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
    const identity = await getAIIdentity();
    let query = getSupabaseAdminClient()
      .from("ai_practice_items")
      .select("id, user_id, guest_session_hash, correct_answer, explanation, expires_at")
      .eq("id", body.data.practiceId)
      .gt("expires_at", new Date().toISOString());
    query = identity.userId
      ? query.eq("user_id", identity.userId)
      : query.eq(
          "guest_session_hash",
          identity.owner.kind === "guest" ? identity.owner.guestSessionHash : "",
        );
    const { data, error } = await query.maybeSingle();
    if (error) throw new Error("practice_lookup_failed");
    if (!data) return NextResponse.json({ error: "practice_not_found" }, { status: 404 });
    const normalize = (value: string) =>
      value.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase();
    const correct = normalize(body.data.answer) === normalize(data.correct_answer);
    return NextResponse.json({
      correct,
      correctAnswer: data.correct_answer,
      explanation: data.explanation,
      message: correct ? "correct" : "review_answer",
    });
  } catch (error) {
    return aiErrorResponse(error);
  }
}
