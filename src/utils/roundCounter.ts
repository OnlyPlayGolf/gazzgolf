import { supabase } from "@/integrations/supabase/client";

/**
 * Counts all rounds across all game types for a user.
 * This includes: rounds, copenhagen_games, skins_games, best_ball_games,
 * scramble_games, wolf_games, umbriago_games, and match_play_games.
 */
export async function getTotalRoundCount(userId: string): Promise<number> {
  // Run all count queries in parallel for efficiency
  const [
    roundsResult,
    copenhagenResult,
    skinsResult,
    bestBallResult,
    scrambleResult,
    wolfResult,
    umbriagioResult,
    matchPlayResult,
  ] = await Promise.all([
    supabase
      .from("rounds")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId),
    supabase
      .from("copenhagen_games")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId),
    supabase
      .from("skins_games")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId),
    supabase
      .from("best_ball_games")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId),
    supabase
      .from("scramble_games")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId),
    supabase
      .from("wolf_games")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId),
    supabase
      .from("umbriago_games")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId),
    supabase
      .from("match_play_games")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId),
  ]);

  const total =
    (roundsResult.count || 0) +
    (copenhagenResult.count || 0) +
    (skinsResult.count || 0) +
    (bestBallResult.count || 0) +
    (scrambleResult.count || 0) +
    (wolfResult.count || 0) +
    (umbriagioResult.count || 0) +
    (matchPlayResult.count || 0);

  return total;
}

/**
 * Generates the default round name based on the user's total round count.
 * Returns "Round X" where X is the next round number.
 */
export async function getDefaultRoundName(userId: string): Promise<string> {
  const count = await getTotalRoundCount(userId);
  return `Round ${count + 1}`;
}
