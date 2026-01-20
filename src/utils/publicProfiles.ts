import type { SupabaseClient } from "@supabase/supabase-js";

export type PublicProfile = {
  id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  handicap: string | null;
  home_club: string | null;
  country: string | null;
};

export async function getPublicProfile(
  supabase: SupabaseClient,
  userId: string
): Promise<PublicProfile | null> {
  const { data, error } = await supabase.rpc("get_public_profile", {
    target_user_id: userId,
  });

  if (error) throw error;

  const row = (data || [])[0] as any;
  if (!row?.id) return null;

  return {
    id: row.id,
    display_name: row.display_name ?? null,
    username: row.username ?? null,
    avatar_url: row.avatar_url ?? null,
    handicap: row.handicap ?? null,
    home_club: row.home_club ?? null,
    country: row.country ?? null,
  };
}

export async function getPublicProfilesMap(
  supabase: SupabaseClient,
  userIds: string[]
): Promise<Map<string, PublicProfile>> {
  const uniqueIds = Array.from(new Set(userIds.filter(Boolean)));
  const map = new Map<string, PublicProfile>();

  await Promise.all(
    uniqueIds.map(async (id) => {
      try {
        const profile = await getPublicProfile(supabase, id);
        if (profile) map.set(id, profile);
      } catch (e) {
        // Don't fail the whole screen if one lookup fails.
        console.warn("get_public_profile failed for", id, e);
      }
    })
  );

  return map;
}

