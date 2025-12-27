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

// Helper to dedupe games by id
function dedupeById<T extends { id: string }>(games: T[]): T[] {
  const map = new Map<string, T>();
  for (const g of games) {
    map.set(g.id, g);
  }
  return Array.from(map.values());
}

export async function loadUnifiedRounds(targetUserId: string): Promise<UnifiedRound[]> {
  const allRounds: UnifiedRoundWithSort[] = [];

  // 1) Participant round ids + participant name(s) (used for shared games)
  const [{ data: participantRounds }, { data: targetProfile }] = await Promise.all([
    supabase.from("round_players").select("round_id").eq("user_id", targetUserId),
    supabase
      .from("profiles")
      .select("display_name, username")
      .eq("id", targetUserId)
      .maybeSingle(),
  ]);

  const participantRoundIds = participantRounds?.map((rp) => rp.round_id) || [];
  const participantRoundIdSet = new Set(participantRoundIds);

  const participantNamesRaw = [targetProfile?.display_name, targetProfile?.username]
    .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
    .map((v) => v.trim());

  const participantNames = Array.from(new Set(participantNamesRaw));

  // 2) Core owned-game queries
  const corePromises = [
    // 0: rounds owned
    supabase
      .from("rounds")
      .select(
        "id, course_name, round_name, date_played, origin, user_id, created_at, holes_played, tee_set"
      )
      .eq("user_id", targetUserId)
      .or("origin.eq.play,origin.is.null,origin.eq.tracker")
      .order("date_played", { ascending: false })
      .then((r) => r),

    // 1: round summaries
    supabase
      .from("round_summaries")
      .select("round_id, total_score, total_par")
      .eq("user_id", targetUserId)
      .then((r) => r),

    // 2: copenhagen owned
    supabase
      .from("copenhagen_games")
      .select("id, user_id, course_name, round_name, date_played, created_at, holes_played, tee_set, player_1, player_2, player_3")
      .eq("user_id", targetUserId)
      .then((r) => r),

    // 3: skins owned
    supabase
      .from("skins_games")
      .select("id, user_id, course_name, round_name, date_played, created_at, holes_played, players")
      .eq("user_id", targetUserId)
      .then((r) => r),

    // 4: best ball owned
    supabase
      .from("best_ball_games")
      .select("id, user_id, course_name, round_name, date_played, created_at, holes_played, team_a_players, team_b_players")
      .eq("user_id", targetUserId)
      .then((r) => r),

    // 5: scramble owned
    supabase
      .from("scramble_games")
      .select("id, user_id, course_name, round_name, date_played, created_at, holes_played, tee_set, teams")
      .eq("user_id", targetUserId)
      .then((r) => r),

    // 6: wolf owned
    supabase
      .from("wolf_games")
      .select("id, user_id, course_name, round_name, date_played, created_at, holes_played, player_1, player_2, player_3, player_4, player_5")
      .eq("user_id", targetUserId)
      .then((r) => r),

    // 7: umbriago owned
    supabase
      .from("umbriago_games")
      .select("id, user_id, course_name, round_name, date_played, created_at, holes_played, tee_set, team_a_player_1, team_a_player_2, team_b_player_1, team_b_player_2")
      .eq("user_id", targetUserId)
      .then((r) => r),

    // 8: match play owned
    supabase
      .from("match_play_games")
      .select("id, user_id, course_name, round_name, date_played, created_at, holes_played, tee_set, player_1, player_2")
      .eq("user_id", targetUserId)
      .then((r) => r),
  ];

  // 3) Participant queries (games where user's name appears in player fields)
  // We'll fetch for each name and merge later

  // Skins: players jsonb array with { name: ... }
  const skinsParticipantPromises = participantNames.map((name) =>
    supabase
      .from("skins_games")
      .select("id, user_id, course_name, round_name, date_played, created_at, holes_played, players")
      .contains("players", [{ name }])
      .then((r) => r)
  );

  // Copenhagen: player_1, player_2, player_3 text columns
  const copenhagenParticipantPromises = participantNames.flatMap((name) => [
    supabase
      .from("copenhagen_games")
      .select("id, user_id, course_name, round_name, date_played, created_at, holes_played, tee_set, player_1, player_2, player_3")
      .eq("player_1", name)
      .then((r) => r),
    supabase
      .from("copenhagen_games")
      .select("id, user_id, course_name, round_name, date_played, created_at, holes_played, tee_set, player_1, player_2, player_3")
      .eq("player_2", name)
      .then((r) => r),
    supabase
      .from("copenhagen_games")
      .select("id, user_id, course_name, round_name, date_played, created_at, holes_played, tee_set, player_1, player_2, player_3")
      .eq("player_3", name)
      .then((r) => r),
  ]);

  // Best Ball: team_a_players and team_b_players jsonb arrays with { name: ... }
  const bestBallParticipantPromises = participantNames.flatMap((name) => [
    supabase
      .from("best_ball_games")
      .select("id, user_id, course_name, round_name, date_played, created_at, holes_played, team_a_players, team_b_players")
      .contains("team_a_players", [{ name }])
      .then((r) => r),
    supabase
      .from("best_ball_games")
      .select("id, user_id, course_name, round_name, date_played, created_at, holes_played, team_a_players, team_b_players")
      .contains("team_b_players", [{ name }])
      .then((r) => r),
  ]);

  // Scramble: teams jsonb - we'll fetch all accessible and filter in code
  const scrambleParticipantPromises = participantNames.length > 0
    ? [
        supabase
          .from("scramble_games")
          .select("id, user_id, course_name, round_name, date_played, created_at, holes_played, tee_set, teams")
          .then((r) => r),
      ]
    : [];

  // Wolf: player_1 through player_5 text columns
  const wolfParticipantPromises = participantNames.flatMap((name) => [
    supabase
      .from("wolf_games")
      .select("id, user_id, course_name, round_name, date_played, created_at, holes_played, player_1, player_2, player_3, player_4, player_5")
      .eq("player_1", name)
      .then((r) => r),
    supabase
      .from("wolf_games")
      .select("id, user_id, course_name, round_name, date_played, created_at, holes_played, player_1, player_2, player_3, player_4, player_5")
      .eq("player_2", name)
      .then((r) => r),
    supabase
      .from("wolf_games")
      .select("id, user_id, course_name, round_name, date_played, created_at, holes_played, player_1, player_2, player_3, player_4, player_5")
      .eq("player_3", name)
      .then((r) => r),
    supabase
      .from("wolf_games")
      .select("id, user_id, course_name, round_name, date_played, created_at, holes_played, player_1, player_2, player_3, player_4, player_5")
      .eq("player_4", name)
      .then((r) => r),
    supabase
      .from("wolf_games")
      .select("id, user_id, course_name, round_name, date_played, created_at, holes_played, player_1, player_2, player_3, player_4, player_5")
      .eq("player_5", name)
      .then((r) => r),
  ]);

  // Umbriago: team_a_player_1, team_a_player_2, team_b_player_1, team_b_player_2
  const umbriagioParticipantPromises = participantNames.flatMap((name) => [
    supabase
      .from("umbriago_games")
      .select("id, user_id, course_name, round_name, date_played, created_at, holes_played, tee_set, team_a_player_1, team_a_player_2, team_b_player_1, team_b_player_2")
      .eq("team_a_player_1", name)
      .then((r) => r),
    supabase
      .from("umbriago_games")
      .select("id, user_id, course_name, round_name, date_played, created_at, holes_played, tee_set, team_a_player_1, team_a_player_2, team_b_player_1, team_b_player_2")
      .eq("team_a_player_2", name)
      .then((r) => r),
    supabase
      .from("umbriago_games")
      .select("id, user_id, course_name, round_name, date_played, created_at, holes_played, tee_set, team_a_player_1, team_a_player_2, team_b_player_1, team_b_player_2")
      .eq("team_b_player_1", name)
      .then((r) => r),
    supabase
      .from("umbriago_games")
      .select("id, user_id, course_name, round_name, date_played, created_at, holes_played, tee_set, team_a_player_1, team_a_player_2, team_b_player_1, team_b_player_2")
      .eq("team_b_player_2", name)
      .then((r) => r),
  ]);

  // Match Play: player_1, player_2 text columns
  const matchPlayParticipantPromises = participantNames.flatMap((name) => [
    supabase
      .from("match_play_games")
      .select("id, user_id, course_name, round_name, date_played, created_at, holes_played, tee_set, player_1, player_2")
      .eq("player_1", name)
      .then((r) => r),
    supabase
      .from("match_play_games")
      .select("id, user_id, course_name, round_name, date_played, created_at, holes_played, tee_set, player_1, player_2")
      .eq("player_2", name)
      .then((r) => r),
  ]);

  const allPromises = [
    ...corePromises,
    ...skinsParticipantPromises,
    ...copenhagenParticipantPromises,
    ...bestBallParticipantPromises,
    ...scrambleParticipantPromises,
    ...wolfParticipantPromises,
    ...umbriagioParticipantPromises,
    ...matchPlayParticipantPromises,
  ];

  const results = await Promise.all(allPromises);

  // Parse results back
  let idx = 0;
  const ownedRoundsRes = results[idx++];
  const roundSummariesRes = results[idx++];
  const copenhagenOwnedRes = results[idx++];
  const skinsOwnedRes = results[idx++];
  const bestBallOwnedRes = results[idx++];
  const scrambleOwnedRes = results[idx++];
  const wolfOwnedRes = results[idx++];
  const umbriagioOwnedRes = results[idx++];
  const matchPlayOwnedRes = results[idx++];

  const skinsParticipantRes = results.slice(idx, idx + skinsParticipantPromises.length);
  idx += skinsParticipantPromises.length;

  const copenhagenParticipantRes = results.slice(idx, idx + copenhagenParticipantPromises.length);
  idx += copenhagenParticipantPromises.length;

  const bestBallParticipantRes = results.slice(idx, idx + bestBallParticipantPromises.length);
  idx += bestBallParticipantPromises.length;

  const scrambleParticipantRes = results.slice(idx, idx + scrambleParticipantPromises.length);
  idx += scrambleParticipantPromises.length;

  const wolfParticipantRes = results.slice(idx, idx + wolfParticipantPromises.length);
  idx += wolfParticipantPromises.length;

  const umbriagioParticipantRes = results.slice(idx, idx + umbriagioParticipantPromises.length);
  idx += umbriagioParticipantPromises.length;

  const matchPlayParticipantRes = results.slice(idx, idx + matchPlayParticipantPromises.length);

  // Merge and dedupe games
  const mergeGames = (ownedRes: any, participantResArr: any[]): any[] => {
    const all: any[] = [...(ownedRes?.data || [])];
    for (const res of participantResArr) {
      all.push(...(res?.data || []));
    }
    return dedupeById(all);
  };

  const skinsGames = mergeGames(skinsOwnedRes, skinsParticipantRes);
  const copenhagenGames = mergeGames(copenhagenOwnedRes, copenhagenParticipantRes);
  const bestBallGames = mergeGames(bestBallOwnedRes, bestBallParticipantRes);
  const wolfGames = mergeGames(wolfOwnedRes, wolfParticipantRes);
  const umbriagioGames = mergeGames(umbriagioOwnedRes, umbriagioParticipantRes);
  const matchPlayGames = mergeGames(matchPlayOwnedRes, matchPlayParticipantRes);

  // Scramble: filter in code to check if user's name is in any team
  const scrambleAllGames: any[] = [
    ...(scrambleOwnedRes?.data || []),
    ...scrambleParticipantRes.flatMap((r: any) => r?.data || []),
  ];
  const scrambleGames = dedupeById(
    scrambleAllGames.filter((game: any) => {
      // Owned by user
      if (game.user_id === targetUserId) return true;
      // Or user's name in teams
      const teams = Array.isArray(game.teams) ? game.teams : [];
      for (const team of teams) {
        const players = Array.isArray(team.players) ? team.players : [];
        for (const p of players) {
          const pName = typeof p === "string" ? p : p?.name;
          if (pName && participantNames.includes(pName)) return true;
        }
      }
      return false;
    })
  );

  const ownedRounds = ownedRoundsRes?.data || [];
  const ownedRoundIdSet = new Set(ownedRounds.map((r: any) => r.id));

  // 4) If the user participated in rounds they do not own, fetch those rounds by id
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
  const roundSummaries = roundSummariesRes?.data || [];
  const summaryMap = new Map<string, any>();
  for (const s of roundSummaries as any[]) {
    summaryMap.set(s.round_id, s);
  }

  // Filter to just the target user's rounds (owned or participated) and allowed origins
  const userRounds = roundsData.filter((round: any) => {
    const isParticipant = round.user_id === targetUserId || participantRoundIdSet.has(round.id);
    const isValidOrigin = !round.origin || round.origin === "tracker" || round.origin === "play";
    return isParticipant && isValidOrigin;
  });

  // Player counts for rounds (single query)
  const roundIds = userRounds.map((r: any) => r.id);
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
  for (const game of copenhagenGames) {
    allRounds.push({
      id: game.id,
      course_name: game.course_name,
      round_name: game.round_name,
      date: game.date_played,
      score: 0,
      playerCount: 3,
      gameMode: "Copenhagen",
      gameType: "copenhagen",
      holesPlayed: game.holes_played,
      teeSet: game.tee_set,
      ownerUserId: game.user_id || targetUserId,
      _sortCreatedAt: game.created_at || `${game.date_played}T00:00:00Z`,
    });
  }

  // Skins
  for (const game of skinsGames) {
    const players = Array.isArray(game.players) ? game.players : [];
    allRounds.push({
      id: game.id,
      course_name: game.course_name,
      round_name: game.round_name,
      date: game.date_played,
      score: 0,
      playerCount: players.length || 2,
      gameMode: "Skins",
      gameType: "skins",
      holesPlayed: game.holes_played,
      ownerUserId: game.user_id || targetUserId,
      _sortCreatedAt: game.created_at || `${game.date_played}T00:00:00Z`,
    });
  }

  // Best Ball
  for (const game of bestBallGames) {
    const teamA = Array.isArray(game.team_a_players) ? game.team_a_players : [];
    const teamB = Array.isArray(game.team_b_players) ? game.team_b_players : [];

    allRounds.push({
      id: game.id,
      course_name: game.course_name,
      round_name: game.round_name,
      date: game.date_played,
      score: 0,
      playerCount: teamA.length + teamB.length,
      gameMode: "Best Ball",
      gameType: "best_ball",
      holesPlayed: game.holes_played,
      ownerUserId: game.user_id || targetUserId,
      _sortCreatedAt: game.created_at || `${game.date_played}T00:00:00Z`,
    });
  }

  // Scramble
  for (const game of scrambleGames) {
    const teams = Array.isArray(game.teams) ? game.teams : [];
    const playerCount = teams.reduce((sum: number, team: any) => {
      const players = Array.isArray(team.players) ? team.players : [];
      return sum + players.length;
    }, 0);

    allRounds.push({
      id: game.id,
      course_name: game.course_name,
      round_name: game.round_name,
      date: game.date_played,
      score: 0,
      playerCount: playerCount || 2,
      gameMode: "Scramble",
      gameType: "scramble",
      holesPlayed: game.holes_played,
      teeSet: game.tee_set,
      ownerUserId: game.user_id || targetUserId,
      _sortCreatedAt: game.created_at || `${game.date_played}T00:00:00Z`,
    });
  }

  // Wolf
  for (const game of wolfGames) {
    const playerCount = [
      game.player_1,
      game.player_2,
      game.player_3,
      game.player_4,
      game.player_5,
    ].filter((p) => p && String(p).trim() !== "").length;

    allRounds.push({
      id: game.id,
      course_name: game.course_name,
      round_name: game.round_name,
      date: game.date_played,
      score: 0,
      playerCount,
      gameMode: "Wolf",
      gameType: "wolf",
      holesPlayed: game.holes_played,
      ownerUserId: game.user_id || targetUserId,
      _sortCreatedAt: game.created_at || `${game.date_played}T00:00:00Z`,
    });
  }

  // Umbriago
  for (const game of umbriagioGames) {
    allRounds.push({
      id: game.id,
      course_name: game.course_name,
      round_name: game.round_name,
      date: game.date_played,
      score: 0,
      playerCount: 4,
      gameMode: "Umbriago",
      gameType: "umbriago",
      holesPlayed: game.holes_played,
      teeSet: game.tee_set,
      ownerUserId: game.user_id || targetUserId,
      _sortCreatedAt: game.created_at || `${game.date_played}T00:00:00Z`,
    });
  }

  // Match Play
  for (const game of matchPlayGames) {
    allRounds.push({
      id: game.id,
      course_name: game.course_name,
      round_name: game.round_name,
      date: game.date_played,
      score: 0,
      playerCount: 2,
      gameMode: "Match Play",
      gameType: "match_play",
      holesPlayed: game.holes_played,
      teeSet: game.tee_set,
      ownerUserId: game.user_id || targetUserId,
      _sortCreatedAt: game.created_at || `${game.date_played}T00:00:00Z`,
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
      return `/rounds/${gameId}/leaderboard`;
    case "copenhagen":
      return `/copenhagen/${gameId}/leaderboard`;
    case "skins":
      return `/skins/${gameId}/leaderboard`;
    case "best_ball":
      return `/best-ball/${gameId}/leaderboard`;
    case "scramble":
      return `/scramble/${gameId}/leaderboard`;
    case "wolf":
      return `/wolf/${gameId}/leaderboard`;
    case "umbriago":
      return `/umbriago/${gameId}/leaderboard`;
    case "match_play":
      return `/match-play/${gameId}/leaderboard`;
    default:
      return `/rounds/${gameId}/leaderboard`;
  }
}
