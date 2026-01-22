import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

function normalizeString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function computeDisplayName(user: User): string | null {
  const meta = (user.user_metadata || {}) as Record<string, unknown>;

  const displayName =
    normalizeString(meta["display_name"]) ??
    normalizeString(meta["full_name"]) ??
    normalizeString(meta["name"]);
  if (displayName) return displayName;

  const first = normalizeString(meta["first_name"]);
  const last = normalizeString(meta["last_name"]);
  const combined = normalizeString([first, last].filter(Boolean).join(" "));
  if (combined) return combined;

  const email = normalizeString(user.email);
  if (!email) return null;
  return normalizeString(email.split("@")[0] ?? null);
}

/**
 * Best-effort: ensure the current user's `profiles` row contains the signup-provided
 * public fields (display_name, country, home_club, handicap).
 *
 * This is a safety net for cases where the DB trigger didn't hydrate `profiles`
 * from `auth.users.raw_user_meta_data` as expected.
 */
export async function syncOwnProfileFromAuthUser(user: User): Promise<void> {
  const meta = (user.user_metadata || {}) as Record<string, unknown>;

  const desired = {
    display_name: computeDisplayName(user),
    country: normalizeString(meta["country"]),
    home_club: normalizeString(meta["home_club"] ?? meta["homeClub"]),
    handicap: normalizeString(meta["handicap"]),
  } as const;

  try {
    const { data: existing, error } = await supabase
      .from("profiles")
      .select("id, display_name, country, home_club, handicap")
      .eq("id", user.id)
      .maybeSingle();

    if (error) return;

    const patch: Record<string, string> = {};
    if (!existing) {
      // Try insert (may be blocked by RLS). If it fails, we'll just return.
      const insertPayload: Record<string, unknown> = {
        id: user.id,
        email: user.email ?? null,
      };
      if (desired.display_name) insertPayload.display_name = desired.display_name;
      if (desired.country) insertPayload.country = desired.country;
      if (desired.home_club) insertPayload.home_club = desired.home_club;
      if (desired.handicap) insertPayload.handicap = desired.handicap;

      const { error: insertError } = await supabase.from("profiles").insert(insertPayload as any);
      if (insertError) return;
      return;
    }

    if (!normalizeString(existing.display_name) && desired.display_name) {
      patch.display_name = desired.display_name;
    }
    if (!normalizeString(existing.country) && desired.country) {
      patch.country = desired.country;
    }
    if (!normalizeString(existing.home_club) && desired.home_club) {
      patch.home_club = desired.home_club;
    }
    if (!normalizeString(existing.handicap) && desired.handicap) {
      patch.handicap = desired.handicap;
    }

    if (Object.keys(patch).length === 0) return;

    await supabase.from("profiles").update(patch as any).eq("id", user.id);
  } catch {
    // Best-effort only; ignore.
  }
}

