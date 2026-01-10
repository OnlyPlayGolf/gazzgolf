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
      .select("id, user_id, course_name, round_name, date_played, created_at, holes_played, tee_set, player_1, player_2, player_3, player_1_total_points, player_2_total_points, player_3_total_points")
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
      .select("id, user_id, course_name, round_name, date_played, created_at, holes_played, team_a_players, team_b_players, game_type, winner_team, final_result, is_finished")
      .eq("user_id", targetUserId)
      .then((r) => r),

    // 5: scramble owned
    supabase
      .from("scramble_games")
      .select("id, user_id, course_name, round_name, date_played, created_at, holes_played, tee_set, teams, winning_team")
      .eq("user_id", targetUserId)
      .then((r) => r),

    // 6: wolf owned
    supabase
      .from("wolf_games")
      .select("id, user_id, course_name, round_name, date_played, created_at, holes_played, player_1, player_2, player_3, player_4, player_5, player_1_points, player_2_points, player_3_points, player_4_points, player_5_points, player_6_points, is_finished")
      .eq("user_id", targetUserId)
      .then((r) => r),

    // 7: umbriago owned
    supabase
      .from("umbriago_games")
      .select("id, user_id, course_name, round_name, date_played, created_at, holes_played, tee_set, team_a_player_1, team_a_player_2, team_b_player_1, team_b_player_2, team_a_total_points, team_b_total_points, is_finished")
      .eq("user_id", targetUserId)
      .then((r) => r),

    // 8: match play owned
    supabase
      .from("match_play_games")
      .select("id, user_id, course_name, round_name, date_played, created_at, holes_played, tee_set, player_1, player_2, winner_player, final_result, is_finished, match_status")
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
      .select("id, user_id, course_name, round_name, date_played, created_at, holes_played, tee_set, player_1, player_2, player_3, player_1_total_points, player_2_total_points, player_3_total_points")
      .eq("player_1", name)
      .then((r) => r),
    supabase
      .from("copenhagen_games")
      .select("id, user_id, course_name, round_name, date_played, created_at, holes_played, tee_set, player_1, player_2, player_3, player_1_total_points, player_2_total_points, player_3_total_points")
      .eq("player_2", name)
      .then((r) => r),
    supabase
      .from("copenhagen_games")
      .select("id, user_id, course_name, round_name, date_played, created_at, holes_played, tee_set, player_1, player_2, player_3, player_1_total_points, player_2_total_points, player_3_total_points")
      .eq("player_3", name)
      .then((r) => r),
  ]);

  // Best Ball: team_a_players and team_b_players jsonb arrays with { name: ... }
  const bestBallParticipantPromises = participantNames.flatMap((name) => [
    supabase
      .from("best_ball_games")
      .select("id, user_id, course_name, round_name, date_played, created_at, holes_played, team_a_players, team_b_players, game_type, winner_team, final_result, is_finished")
      .contains("team_a_players", [{ name }])
      .then((r) => r),
    supabase
      .from("best_ball_games")
      .select("id, user_id, course_name, round_name, date_played, created_at, holes_played, team_a_players, team_b_players, game_type, winner_team, final_result, is_finished")
      .contains("team_b_players", [{ name }])
      .then((r) => r),
  ]);

  // Scramble: teams jsonb - we'll fetch all accessible and filter in code
  const scrambleParticipantPromises = participantNames.length > 0
    ? [
        supabase
          .from("scramble_games")
          .select("id, user_id, course_name, round_name, date_played, created_at, holes_played, tee_set, teams, winning_team")
          .then((r) => r),
      ]
    : [];

  // Wolf: player_1 through player_5 text columns
  const wolfParticipantPromises = participantNames.flatMap((name) => [
    supabase
      .from("wolf_games")
      .select("id, user_id, course_name, round_name, date_played, created_at, holes_played, player_1, player_2, player_3, player_4, player_5, player_1_points, player_2_points, player_3_points, player_4_points, player_5_points, player_6_points, is_finished")
      .eq("player_1", name)
      .then((r) => r),
    supabase
      .from("wolf_games")
      .select("id, user_id, course_name, round_name, date_played, created_at, holes_played, player_1, player_2, player_3, player_4, player_5, player_1_points, player_2_points, player_3_points, player_4_points, player_5_points, player_6_points, is_finished")
      .eq("player_2", name)
      .then((r) => r),
    supabase
      .from("wolf_games")
      .select("id, user_id, course_name, round_name, date_played, created_at, holes_played, player_1, player_2, player_3, player_4, player_5, player_1_points, player_2_points, player_3_points, player_4_points, player_5_points, player_6_points, is_finished")
      .eq("player_3", name)
      .then((r) => r),
    supabase
      .from("wolf_games")
      .select("id, user_id, course_name, round_name, date_played, created_at, holes_played, player_1, player_2, player_3, player_4, player_5, player_1_points, player_2_points, player_3_points, player_4_points, player_5_points, player_6_points, is_finished")
      .eq("player_4", name)
      .then((r) => r),
    supabase
      .from("wolf_games")
      .select("id, user_id, course_name, round_name, date_played, created_at, holes_played, player_1, player_2, player_3, player_4, player_5, player_1_points, player_2_points, player_3_points, player_4_points, player_5_points, player_6_points, is_finished")
      .eq("player_5", name)
      .then((r) => r),
  ]);

  // Umbriago: team_a_player_1, team_a_player_2, team_b_player_1, team_b_player_2
  const umbriagioParticipantPromises = participantNames.flatMap((name) => [
    supabase
      .from("umbriago_games")
      .select("id, user_id, course_name, round_name, date_played, created_at, holes_played, tee_set, team_a_player_1, team_a_player_2, team_b_player_1, team_b_player_2, team_a_total_points, team_b_total_points, is_finished")
      .eq("team_a_player_1", name)
      .then((r) => r),
    supabase
      .from("umbriago_games")
      .select("id, user_id, course_name, round_name, date_played, created_at, holes_played, tee_set, team_a_player_1, team_a_player_2, team_b_player_1, team_b_player_2, team_a_total_points, team_b_total_points, is_finished")
      .eq("team_a_player_2", name)
      .then((r) => r),
    supabase
      .from("umbriago_games")
      .select("id, user_id, course_name, round_name, date_played, created_at, holes_played, tee_set, team_a_player_1, team_a_player_2, team_b_player_1, team_b_player_2, team_a_total_points, team_b_total_points, is_finished")
      .eq("team_b_player_1", name)
      .then((r) => r),
    supabase
      .from("umbriago_games")
      .select("id, user_id, course_name, round_name, date_played, created_at, holes_played, tee_set, team_a_player_1, team_a_player_2, team_b_player_1, team_b_player_2, team_a_total_points, team_b_total_points, is_finished")
      .eq("team_b_player_2", name)
      .then((r) => r),
  ]);

  // Match Play: player_1, player_2 text columns
  const matchPlayParticipantPromises = participantNames.flatMap((name) => [
    supabase
      .from("match_play_games")
      .select("id, user_id, course_name, round_name, date_played, created_at, holes_played, tee_set, player_1, player_2, winner_player, final_result, is_finished, match_status")
      .eq("player_1", name)
      .then((r) => r),
    supabase
      .from("match_play_games")
      .select("id, user_id, course_name, round_name, date_played, created_at, holes_played, tee_set, player_1, player_2, winner_player, final_result, is_finished, match_status")
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

  // Copenhagen - calculate position based on points
  for (const game of copenhagenGames) {
    // Find which player the target user is
    let userPlayerIndex: number | null = null;
    if (participantNames.some((n) => n === game.player_1)) userPlayerIndex = 1;
    else if (participantNames.some((n) => n === game.player_2)) userPlayerIndex = 2;
    else if (participantNames.some((n) => n === game.player_3)) userPlayerIndex = 3;
    else if (game.user_id === targetUserId) userPlayerIndex = 1; // Owner defaults to player 1
    
    // Calculate position based on points and normalized final score
    let position: number | null = null;
    const rawPoints = [
      { player: 1, pts: game.player_1_total_points || 0 },
      { player: 2, pts: game.player_2_total_points || 0 },
      { player: 3, pts: game.player_3_total_points || 0 },
    ];
    
    // Normalize points (subtract minimum so lowest is 0)
    const minPts = Math.min(...rawPoints.map(p => p.pts));
    const normalizedPoints = rawPoints.map(p => ({ ...p, pts: p.pts - minPts }));
    
    // Sort by points descending for position calculation
    const sortedPoints = [...normalizedPoints].sort((a, b) => b.pts - a.pts);
    
    if (userPlayerIndex) {
      position = sortedPoints.findIndex((p) => p.player === userPlayerIndex) + 1;
    }
    
    // Create final score string (e.g., "8-3-0") from sorted normalized points
    const copenhagenFinalScore = sortedPoints.map(p => p.pts).join('-');
    
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
      position,
      copenhagenFinalScore,
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

    // Determine match result for match play best ball games
    let matchResult: 'W' | 'L' | 'T' | null = null;
    let matchFinalScore: string | null = null;
    
    if (game.game_type === 'match_play' && game.is_finished) {
      // Find which team the user is on
      const userInTeamA = teamA.some((p: any) => 
        participantNames.includes(typeof p === 'string' ? p : p?.name)
      );
      const userInTeamB = teamB.some((p: any) => 
        participantNames.includes(typeof p === 'string' ? p : p?.name)
      );
      
      if (game.winner_team === null || game.winner_team === '') {
        matchResult = 'T';
      } else if (userInTeamA) {
        matchResult = game.winner_team === 'team_a' ? 'W' : 'L';
      } else if (userInTeamB) {
        matchResult = game.winner_team === 'team_b' ? 'W' : 'L';
      } else if (game.user_id === targetUserId) {
        // Owner defaults to team A
        matchResult = game.winner_team === 'team_a' ? 'W' : 'L';
      }
      
      matchFinalScore = game.final_result || null;
    }

    allRounds.push({
      id: game.id,
      course_name: game.course_name,
      round_name: game.round_name,
      date: game.date_played,
      score: 0,
      playerCount: teamA.length + teamB.length,
      gameMode: game.game_type === 'match_play' ? "Best Ball Match Play" : "Best Ball",
      gameType: "best_ball",
      holesPlayed: game.holes_played,
      ownerUserId: game.user_id || targetUserId,
      matchResult,
      matchFinalScore,
      _sortCreatedAt: game.created_at || `${game.date_played}T00:00:00Z`,
    });
  }

  // Scramble - fetch holes data to calculate positions and scores
  const scrambleGameIds = scrambleGames.map((g: any) => g.id);
  let scrambleHolesMap = new Map<string, any[]>();
  
  if (scrambleGameIds.length > 0) {
    const { data: scrambleHoles } = await supabase
      .from("scramble_holes")
      .select("game_id, par, team_scores")
      .in("game_id", scrambleGameIds);
    
    for (const hole of scrambleHoles || []) {
      const existing = scrambleHolesMap.get(hole.game_id) || [];
      existing.push(hole);
      scrambleHolesMap.set(hole.game_id, existing);
    }
  }
  
  for (const game of scrambleGames) {
    const teams = Array.isArray(game.teams) ? game.teams : [];
    const playerCount = teams.reduce((sum: number, team: any) => {
      const players = Array.isArray(team.players) ? team.players : [];
      return sum + players.length;
    }, 0);

    // Find which team the user is on
    let userTeamId: string | null = null;
    for (const team of teams) {
      const players = Array.isArray(team.players) ? team.players : [];
      for (const p of players) {
        const pName = typeof p === "string" ? p : p?.name;
        if (pName && participantNames.includes(pName)) {
          userTeamId = team.id;
          break;
        }
      }
      if (userTeamId) break;
    }
    
    // If not found in teams but user owns the game, default to first team
    if (!userTeamId && game.user_id === targetUserId && teams.length > 0) {
      userTeamId = teams[0].id;
    }

    // Calculate team scores from holes
    const holes = scrambleHolesMap.get(game.id) || [];
    const teamTotals: Record<string, { score: number; par: number }> = {};
    
    for (const hole of holes) {
      const teamScores = hole.team_scores || {};
      for (const [teamId, score] of Object.entries(teamScores)) {
        if (!teamTotals[teamId]) {
          teamTotals[teamId] = { score: 0, par: 0 };
        }
        teamTotals[teamId].score += score as number;
        teamTotals[teamId].par += hole.par;
      }
    }
    
    // Calculate score to par for each team and sort for position
    const teamResults = Object.entries(teamTotals).map(([teamId, data]) => ({
      teamId,
      scoreToPar: data.score - data.par,
    })).sort((a, b) => a.scoreToPar - b.scoreToPar); // Lower is better
    
    // Find user's position and score
    let scramblePosition: number | null = null;
    let scrambleScoreToPar: number | null = null;
    
    if (userTeamId) {
      const userTeamIndex = teamResults.findIndex(t => t.teamId === userTeamId);
      if (userTeamIndex !== -1) {
        scramblePosition = userTeamIndex + 1;
        scrambleScoreToPar = teamResults[userTeamIndex].scoreToPar;
      }
    }

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
      scramblePosition,
      scrambleScoreToPar,
      _sortCreatedAt: game.created_at || `${game.date_played}T00:00:00Z`,
    });
  }

  // Wolf - calculate position based on points (like Copenhagen)
  for (const game of wolfGames) {
    const players = [
      { name: game.player_1, pts: game.player_1_points || 0 },
      { name: game.player_2, pts: game.player_2_points || 0 },
      { name: game.player_3, pts: game.player_3_points || 0 },
      { name: game.player_4, pts: game.player_4_points || 0 },
      { name: game.player_5, pts: game.player_5_points || 0 },
      { name: game.player_6, pts: game.player_6_points || 0 },
    ].filter((p) => p.name && String(p.name).trim() !== "");

    const playerCount = players.length;
    
    // Find which player the target user is
    let userPlayerIndex: number | null = null;
    for (let i = 0; i < players.length; i++) {
      if (participantNames.some((n) => n === players[i].name)) {
        userPlayerIndex = i;
        break;
      }
    }
    if (userPlayerIndex === null && game.user_id === targetUserId) {
      userPlayerIndex = 0; // Owner defaults to player 1
    }
    
    // Calculate position and normalized final score
    let wolfPosition: number | null = null;
    let wolfFinalScore: string | null = null;
    
    if (game.is_finished && players.length > 0) {
      // Normalize points (subtract minimum so lowest is 0)
      const minPts = Math.min(...players.map(p => p.pts));
      const normalizedPoints = players.map(p => ({ ...p, pts: p.pts - minPts }));
      
      // Sort by points descending for position calculation
      const sortedPoints = [...normalizedPoints].sort((a, b) => b.pts - a.pts);
      
      if (userPlayerIndex !== null) {
        const userPts = normalizedPoints[userPlayerIndex].pts;
        // Find position (1-based, accounting for ties)
        let pos = 1;
        for (const p of sortedPoints) {
          if (p.pts > userPts) pos++;
          else break;
        }
        wolfPosition = pos;
      }
      
      // Final score string: sorted points descending (e.g., "8-5-3-0")
      wolfFinalScore = sortedPoints.map(p => p.pts).join("-");
    }

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
      wolfPosition,
      wolfFinalScore,
      _sortCreatedAt: game.created_at || `${game.date_played}T00:00:00Z`,
    });
  }

  // Umbriago - calculate W/L/T result and normalized score
  for (const game of umbriagioGames) {
    // Determine user's team based on player names only
    const userInTeamA = participantNames.includes(game.team_a_player_1) || 
                        participantNames.includes(game.team_a_player_2);
    const userInTeamB = participantNames.includes(game.team_b_player_1) || 
                        participantNames.includes(game.team_b_player_2);
    
    // Calculate result and normalized score
    let umbriagioResult: 'W' | 'L' | 'T' | null = null;
    let umbriagioFinalScore: string | null = null;
    
    if (game.is_finished) {
      const teamAPoints = game.team_a_total_points || 0;
      const teamBPoints = game.team_b_total_points || 0;
      
      // Normalize points (lower becomes 0)
      const minPoints = Math.min(teamAPoints, teamBPoints);
      const normalizedA = teamAPoints - minPoints;
      const normalizedB = teamBPoints - minPoints;
      umbriagioFinalScore = `${normalizedA}-${normalizedB}`;
      
      // Determine user's result (W/L/T)
      if (teamAPoints === teamBPoints) {
        umbriagioResult = 'T';
      } else if (userInTeamA && !userInTeamB) {
        umbriagioResult = teamAPoints > teamBPoints ? 'W' : 'L';
      } else if (userInTeamB && !userInTeamA) {
        umbriagioResult = teamBPoints > teamAPoints ? 'W' : 'L';
      } else {
        // Owner defaults to Team A
        umbriagioResult = teamAPoints > teamBPoints ? 'W' : 'L';
      }
    }
    
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
      umbriagioResult,
      umbriagioFinalScore,
      _sortCreatedAt: game.created_at || `${game.date_played}T00:00:00Z`,
    });
  }

  // Match Play
  for (const game of matchPlayGames) {
    // Determine match result
    let matchResult: 'W' | 'L' | 'T' | null = null;
    let matchFinalScore: string | null = null;
    
    if (game.is_finished) {
      // Check if user is player 1 or player 2
      const isPlayer1 = participantNames.includes(game.player_1) || game.user_id === targetUserId;
      const isPlayer2 = participantNames.includes(game.player_2);
      
      // Get match status from user's perspective
      // match_status > 0 means player 1 is winning
      const matchStatus = game.match_status || 0;
      
      if (game.winner_player === null || game.winner_player === '') {
        matchResult = 'T';
        // No score displayed for ties
      } else if (isPlayer1 && !isPlayer2) {
        matchResult = game.winner_player === game.player_1 ? 'W' : 'L';
        // From player 1's perspective: positive status = UP, negative = DOWN
        if (matchStatus !== 0) {
          matchFinalScore = matchStatus > 0 ? `${matchStatus} UP` : `${Math.abs(matchStatus)} DOWN`;
        }
      } else if (isPlayer2 && !isPlayer1) {
        matchResult = game.winner_player === game.player_2 ? 'W' : 'L';
        // From player 2's perspective: invert the status
        if (matchStatus !== 0) {
          matchFinalScore = matchStatus < 0 ? `${Math.abs(matchStatus)} UP` : `${matchStatus} DOWN`;
        }
      } else if (isPlayer1) {
        // Default to player 1 perspective for owner
        matchResult = game.winner_player === game.player_1 ? 'W' : 'L';
        if (matchStatus !== 0) {
          matchFinalScore = matchStatus > 0 ? `${matchStatus} UP` : `${Math.abs(matchStatus)} DOWN`;
        }
      }
    }

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
      matchResult,
      matchFinalScore,
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

export function getGameRoute(gameType: GameType, gameId: string, returnTo?: string): string {
  // Store return path for spectator back navigation
  if (returnTo) {
    sessionStorage.setItem(`spectator_return_${gameId}`, returnTo);
  }
  
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

export function getSpectatorReturnPath(gameId: string): string {
  return sessionStorage.getItem(`spectator_return_${gameId}`) || '/';
}
