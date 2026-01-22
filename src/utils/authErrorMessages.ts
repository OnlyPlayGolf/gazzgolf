export type AuthErrorContext = "signIn" | "resetPassword";

type AuthErrorLike = {
  message?: unknown;
  status?: unknown;
  code?: unknown;
  name?: unknown;
};

function toAuthErrorLike(err: unknown): AuthErrorLike | null {
  if (!err || typeof err !== "object") return null;
  return err as AuthErrorLike;
}

function toStringOrEmpty(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function includesInsensitive(haystack: string, needle: string): boolean {
  return haystack.toLowerCase().includes(needle.toLowerCase());
}

/**
 * Turn a Supabase auth error into a short, user-friendly message.
 *
 * Important: Supabase intentionally returns "Invalid login credentials" for both
 * wrong password and non-existent email to avoid account enumeration, so we do not
 * try to distinguish those cases unless Supabase explicitly provides a different
 * error code/message.
 */
export function getFriendlyAuthErrorMessage(
  err: unknown,
  context: AuthErrorContext
): string {
  const e = toAuthErrorLike(err);
  const msg = toStringOrEmpty(e?.message).trim();
  const code = toStringOrEmpty(e?.code).trim();

  // Common "wrong password OR email doesn't exist" response for sign-in
  if (includesInsensitive(msg, "invalid login credentials")) {
    return "Incorrect email or password.";
  }

  // If Supabase explicitly signals a missing user, map it (mostly relevant for reset).
  if (
    includesInsensitive(msg, "user not found") ||
    includesInsensitive(msg, "email not found") ||
    code === "user_not_found"
  ) {
    return "No account found with this email.";
  }

  // Reset flow sometimes hits rate limits or similar.
  if (context === "resetPassword" && includesInsensitive(msg, "rate")) {
    return "Please wait a moment and try again.";
  }

  return "Something went wrong. Please try again.";
}

