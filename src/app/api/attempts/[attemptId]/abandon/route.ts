import { NextResponse } from "next/server";
import { getAttemptRepository } from "@/lib/exams/repository-provider.server";
import { readExamOwner } from "@/lib/exams/guest-session.server";

export async function POST(request: Request, context: { params: Promise<{ attemptId: string }> }) {
  try {
    const { attemptId } = await context.params;
    const owner = await readExamOwner(request);
    if (!owner) return NextResponse.json({ ok: false }, { status: 404, headers: noStoreHeaders });
    const abandoned = await getAttemptRepository().abandon(attemptId, owner);
    return NextResponse.json({ ok: abandoned }, { headers: noStoreHeaders });
  } catch {
    return NextResponse.json(
      { error: { code: "attempt_storage_unavailable" } },
      { status: 503, headers: noStoreHeaders },
    );
  }
}

const noStoreHeaders = { "Cache-Control": "no-store, private" };
