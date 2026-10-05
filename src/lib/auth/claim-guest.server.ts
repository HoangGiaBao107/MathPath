import "server-only";

import { getCurrentGuestSessionHash } from "@/lib/exams/guest-session.server";
import { getAttemptRepository } from "@/lib/exams/repository-provider.server";

export async function claimCurrentGuestAttempts(userId: string): Promise<number> {
  const guestHash = await getCurrentGuestSessionHash();
  if (!guestHash) return 0;
  return getAttemptRepository().claimGuestAttempts(guestHash, userId);
}
