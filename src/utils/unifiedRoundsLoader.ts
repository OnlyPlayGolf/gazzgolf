import { supabase } from "@/integrations/supabase/client";
import type { RoundCardData } from "@/components/RoundCard";

type GameType =
  | "round"
  | "copenhagen"
  | "skins"
  | "best_ball"
  | "scramble"
  | "wolf"
  | "umbriago"
  | "match_play";

export interface UnifiedRound extends RoundCardData {
  gameType: GameType;
}

type UnifiedRoundWithSort = UnifiedRound & {
  _sortCreatedAt: string;
};

const toSortTime = (isoLike: string) => {
  if (!isoLike) return 0;

  // Ensure YYYY-MM-DD sorts consistently regardless of timezone parsing quirks.
  if (/^\d{4}-\d{2}-\d{2}$/.test(isoLike)) {
    const t = new Date(`${isoLike}T12:00:00Z`).getTime();
    return Number.isFinite(t) ? t : 0;
  }

  const t = new Date(isoLike).getTime();
  return Number.isFinite(t) ? t : 0;
};

export async function loadUnifiedRounds(targetUserId: string): Promise<UnifiedRound[]> {
  const allRounds: UnifiedRoundWithSort[] = [];

  // 1) Participant round ids first (used to narrow the rounds query)
  const { data: participantRounds } = await supabase
    .from("round_players")
    .select("round_id")
    .eq("user_id", targetUserId);

  const participantRoundIds = participantRounds?.map((rp) => rp.round_id) || [];
  const participantRoundIdSet = new Set(participantRoundIds);

  // 2) Fetch the rest in parallel
  const [
    ownedRoundsRes,
    roundSummariesRes,
    copenhagenGamesRes,
    skinsGamesRes,
    bestBallGamesRes,
    scrambleGamesRes,
    wolfGamesRes,
    umbriagioGamesRes,
    matchPlayGamesRes,
  ] = await Promise.all([
    supabase
      .from("rounds")
      .select(
        "id, course_name, round_name, date_played, origin, user_id, created_at, holes_played, tee_set"
      )
      .eq("user_id", targetUserId)
      .or("origin.eq.play,origin.is.null,origin.eq.tracker")
      .order("date_played", { ascending: false }),

    supabase
      .from("round_summaries")
      .select("round_id, total_score, total_par")
      .eq("user_id", targetUserId),

    supabase
      .from("copenhagen_games")
      .select("id, course_name, date_played, created_at, holes_played, tee_set")
      .eq("user_id", targetUserId),
    supabase
      .from("skins_games")
      .select("id, course_name, date_played, created_at, holes_played, players")
      .eq("user_id", targetUserId),
    supabase
      .from("best_ball_games")
      .select(
        "id, course_name, date_played, created_at, holes_played, team_a_players, team_b_players"
      )
      .eq("user_id", targetUserId),
    supabase
      .from("scramble_games")
      .select("id, course_name, date_played, created_at, holes_played, tee_set, teams")
      .eq("user_id", targetUserId),
    supabase
      .from("wolf_games")
      .select(
        "id, course_name, date_played, created_at, holes_played, player_1, player_2, player_3, player_4, player_5"
      )
      .eq("user_id", targetUserId),
    supabase
      .from("umbriago_games")
      .select("id, course_name, date_played, created_at, holes_played, tee_set")
      .eq("user_id", targetUserId),
    supabase
      .from("match_play_games")
      .select(
        "id, course_name, date_played, created_at, holes_played, tee_set, player_1, player_2"
      )
      .eq("user_id", targetUserId),
  ]);

  const ownedRounds = ownedRoundsRes.data || [];
  const ownedRoundIdSet = new Set(ownedRounds.map((r) => r.id));

  // 3) If the user participated in rounds they do not own, fetch those rounds by id
  const missingParticipantIds = participantRoundIds.filter((id) => !ownedRoundIdSet.has(id));

  let participantRoundsData: any[] = [];
  if (missingParticipantIds.length > 0) {
    const { data } = await supabase
      .from("rounds")
      .select(
        "id, course_name, round_name, date_played, origin, user_id, created_at, holes_played, tee_set"
      )
      .in("id", missingParticipantIds);

    participantRoundsData = data || [];
  }

  const roundsData = [...ownedRounds, ...participantRoundsData];

  // Summaries map (only available for the user's own rounds via view)
  const roundSummaries = roundSummariesRes.data || [];
  const summaryMap = new Map(roundSummaries.map((s: any) => [s.round_id, s]));

  // Filter to just the target user's rounds (owned or participated) and allowed origins
  const userRounds = roundsData.filter((round) => {
    const isParticipant = round.user_id === targetUserId || participantRoundIdSet.has(round.id);
    const isValidOrigin = !round.origin || round.origin === "tracker" || round.origin === "play";
    return isParticipant && isValidOrigin;
  });

  // Player counts for rounds (single query)
  const roundIds = userRounds.map((r) => r.id);
  const playerCountMap = new Map<string, number>();

  if (roundIds.length > 0) {
    const { data: playerCountsData } = await supabase
      .from("round_players")
      .select("round_id")
      .in("round_id", roundIds);

    for (const rp of playerCountsData || []) {
      playerCountMap.set(rp.round_id, (playerCountMap.get(rp.round_id) || 0) + 1);
    }
  }

  // Regular rounds
  for (const round of userRounds) {
    const summary = summaryMap.get(round.id) as any | undefined;
    const totalScore = summary?.total_score ?? null;
    const totalPar = summary?.total_par ?? null;

    const scoreVsPar =
      typeof totalScore === "number" && typeof totalPar === "number" ? totalScore - totalPar : 0;

    allRounds.push({
      id: round.id,
      course_name: round.course_name || "Unknown Course",
      round_name: round.round_name,
      date: round.date_played,
      score: scoreVsPar,
      playerCount: playerCountMap.get(round.id) || 1,
      gameMode: "Stroke Play",
      gameType: "round",
      holesPlayed: round.holes_played,
      teeSet: round.tee_set,
      totalScore,
      totalPar,
      ownerUserId: round.user_id,
      _sortCreatedAt: round.created_at || `${round.date_played}T00:00:00Z`,
    });
  }

  // Copenhagen
  for (const game of copenhagenGamesRes.data || []) {
    allRounds.push({
      id: game.id,
      course_name: game.course_name,
      date: game.date_played,
      score: 0,
      playerCount: 3,
      gameMode: "Copenhagen",
      gameType: "copenhagen",
      holesPlayed: (game as any).holes_played,
      teeSet: (game as any).tee_set,
      ownerUserId: targetUserId,
      _sortCreatedAt: (game as any).created_at || `${game.date_played}T00:00:00Z`,
    });
  }

  // Skins
  for (const game of skinsGamesRes.data || []) {
    const players = Array.isArray((game as any).players) ? (game as any).players : [];
    allRounds.push({
      id: game.id,
      course_name: game.course_name,
      date: game.date_played,
      score: 0,
      playerCount: players.length || 2,
      gameMode: "Skins",
      gameType: "skins",
      holesPlayed: (game as any).holes_played,
      ownerUserId: targetUserId,
      _sortCreatedAt: (game as any).created_at || `${game.date_played}T00:00:00Z`,
    });
  }

  // Best Ball
  for (const game of bestBallGamesRes.data || []) {
    const teamA = Array.isArray((game as any).team_a_players) ? (game as any).team_a_players : [];
    const teamB = Array.isArray((game as any).team_b_players) ? (game as any).team_b_players : [];

    allRounds.push({
      id: game.id,
      course_name: game.course_name,
      date: game.date_played,
      score: 0,
      playerCount: teamA.length + teamB.length,
      gameMode: "Best Ball",
      gameType: "best_ball",
      holesPlayed: (game as any).holes_played,
      ownerUserId: targetUserId,
      _sortCreatedAt: (game as any).created_at || `${game.date_played}T00:00:00Z`,
    });
  }

  // Scramble
  for (const game of scrambleGamesRes.data || []) {
    const teams = Array.isArray((game as any).teams) ? (game as any).teams : [];
    const playerCount = teams.reduce((sum: number, team: any) => {
      const players = Array.isArray(team.players) ? team.players : [];
      return sum + players.length;
    }, 0);

    allRounds.push({
      id: game.id,
      course_name: game.course_name,
      date: game.date_played,
      score: 0,
      playerCount: playerCount || 2,
      gameMode: "Scramble",
      gameType: "scramble",
      holesPlayed: (game as any).holes_played,
      teeSet: (game as any).tee_set,
      ownerUserId: targetUserId,
      _sortCreatedAt: (game as any).created_at || `${game.date_played}T00:00:00Z`,
    });
  }

  // Wolf
  for (const game of wolfGamesRes.data || []) {
    const playerCount = [
      (game as any).player_1,
      (game as any).player_2,
      (game as any).player_3,
      (game as any).player_4,
      (game as any).player_5,
    ].filter((p) => p && String(p).trim() !== "").length;

    allRounds.push({
      id: game.id,
      course_name: game.course_name,
      date: game.date_played,
      score: 0,
      playerCount,
      gameMode: "Wolf",
      gameType: "wolf",
      holesPlayed: (game as any).holes_played,
      ownerUserId: targetUserId,
      _sortCreatedAt: (game as any).created_at || `${game.date_played}T00:00:00Z`,
    });
  }

  // Umbriago
  for (const game of umbriagioGamesRes.data || []) {
    allRounds.push({
      id: game.id,
      course_name: game.course_name,
      date: game.date_played,
      score: 0,
      playerCount: 4,
      gameMode: "Umbriago",
      gameType: "umbriago",
      holesPlayed: (game as any).holes_played,
      teeSet: (game as any).tee_set,
      ownerUserId: targetUserId,
      _sortCreatedAt: (game as any).created_at || `${game.date_played}T00:00:00Z`,
    });
  }

  // Match Play
  for (const game of matchPlayGamesRes.data || []) {
    allRounds.push({
      id: game.id,
      course_name: game.course_name,
      date: game.date_played,
      score: 0,
      playerCount: 2,
      gameMode: "Match Play",
      gameType: "match_play",
      holesPlayed: (game as any).holes_played,
      teeSet: (game as any).tee_set,
      ownerUserId: targetUserId,
      _sortCreatedAt: (game as any).created_at || `${game.date_played}T00:00:00Z`,
    });
  }

  // Sort by date (newest first), then created_at (newest first) for stable ordering
  allRounds.sort((a, b) => {
    const byDate = toSortTime(b.date) - toSortTime(a.date);
    if (byDate !== 0) return byDate;
    return toSortTime(b._sortCreatedAt) - toSortTime(a._sortCreatedAt);
  });

  return allRounds.map(({ _sortCreatedAt, ...rest }) => rest);
}

export function getGameRoute(gameType: GameType, gameId: string): string {
  switch (gameType) {
    case "round":
      return `/rounds/${gameId}/detail`;
    case "copenhagen":
      return `/copenhagen/${gameId}/summary`;
    case "skins":
      return `/skins/${gameId}/summary`;
    case "best_ball":
      return `/best-ball/${gameId}/summary`;
    case "scramble":
      return `/scramble/${gameId}/summary`;
    case "wolf":
      return `/wolf/${gameId}/summary`;
    case "umbriago":
      return `/umbriago/${gameId}/summary`;
    case "match_play":
      return `/match-play/${gameId}/summary`;
    default:
      return `/rounds/${gameId}/detail`;
  }
}
