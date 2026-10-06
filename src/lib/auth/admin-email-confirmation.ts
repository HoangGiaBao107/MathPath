type AuthError = { code?: string; message?: string };

/** Email confirmation may be skipped only after Supabase verified the password and marked it unconfirmed. */
export function canSkipEmailConfirmation(error: AuthError): boolean {
  const code = error.code?.toLowerCase() ?? "";
  const message = error.message?.toLowerCase() ?? "";
  return code === "email_not_confirmed" || message.includes("email not confirmed");
}
