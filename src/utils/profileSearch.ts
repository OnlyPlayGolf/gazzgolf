import type { SupabaseClient } from "@supabase/supabase-js";

export type PublicProfileSearchResult = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
};

export async function searchProfilesTypeahead(
  supabase: SupabaseClient,
  q: string,
  options?: { limit?: number }
): Promise<PublicProfileSearchResult[]> {
  const limit = options?.limit ?? 20;

  const { data, error } = await supabase.rpc("search_profiles", {
    q,
    max_results: limit,
  });

  if (error) throw error;

  return ((data || []) as any[]).map((row) => ({
    id: row.id,
    username: row.username ?? null,
    display_name: row.display_name ?? null,
    avatar_url: row.avatar_url ?? null,
  }));
}

