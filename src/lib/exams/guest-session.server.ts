import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import type { AttemptOwner } from "./types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseAttemptPersistenceConfigured } from "@/lib/supabase/config";

const COOKIE_NAME = "mathpath_exam_session";
const COOKIE_LIFETIME_SECONDS = 60 * 60 * 24 * 90;

export async function readExamOwner(): Promise<AttemptOwner | null> {
  if (isSupabaseAttemptPersistenceConfigured()) {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase.auth.getUser();
    if (data.user) return { kind: "user", userId: data.user.id };
  }
  return readGuestExamOwner();
}

export async function readGuestExamOwner(): Promise<AttemptOwner | null> {
  const cookieStore = await cookies();
  const value = cookieStore.get(COOKIE_NAME)?.value;
  if (!isSessionToken(value)) return null;
  return { kind: "guest", guestSessionHash: hashSession(value) };
}

export async function getOrCreateExamOwner(): Promise<AttemptOwner> {
  if (isSupabaseAttemptPersistenceConfigured()) {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase.auth.getUser();
    if (data.user) return { kind: "user", userId: data.user.id };
  }
  const currentOwner = await readGuestExamOwner();
  if (currentOwner) return currentOwner;
  const cookieStore = await cookies();
  const token = randomUUID();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_LIFETIME_SECONDS,
  });
  return { kind: "guest", guestSessionHash: hashSession(token) };
}

export async function getCurrentGuestSessionHash(): Promise<string | null> {
  const owner = await readGuestExamOwner();
  return owner?.kind === "guest" ? owner.guestSessionHash : null;
}

function isSessionToken(value: string | undefined): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  );
}

function hashSession(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
