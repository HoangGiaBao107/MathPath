import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";

const guestSessionCookie = "mathpath_exam_session";
const cookieLifetimeSeconds = 60 * 60 * 24 * 90;

export async function GET() {
  if (process.env.NODE_ENV !== "development") {
    return new Response(null, { status: 404 });
  }

  const cookieStore = await cookies();
  cookieStore.set(guestSessionCookie, randomUUID(), {
    httpOnly: true,
    secure: false,
    sameSite: "lax",
    path: "/",
    maxAge: cookieLifetimeSeconds,
  });

  return Response.json(
    { ok: true, message: "A fresh guest session has been created for local testing." },
    {
      headers: { "Cache-Control": "no-store, private" },
    },
  );
}
