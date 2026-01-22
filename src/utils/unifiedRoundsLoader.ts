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

const UNIFIED_ROUNDS_CACHE_TTL_MS = 30_000;
const unifiedRoundsCache = new Map<string, { ts: number; data: UnifiedRound[] }>();

export function invalidateUnifiedRoundsCache(userId?: string) {
  if (userId) {
    unifiedRoundsCache.delete(userId);
  } else {
    unifiedRoundsCache.clear();
  }
}

export async function loadUnifiedRounds(targetUserId: string): Promise<UnifiedRound[]> {
  // Guard: return empty array if no userId
  if (!targetUserId) return [];

  const cached = unifiedRoundsCache.get(targetUserId);
  const now = Date.now();
  if (cached && now - cached.ts < UNIFIED_ROUNDS_CACHE_TTL_MS) {
    return cached.data;
  }
  
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
  
  // Fetch round_players entries to get player_id for each participant round
  // This is needed to calculate individual player scores in multi-group rounds
  const participantPlayerMap = new Map<string, string>(); // round_id -> player_id
  if (participantRoundIds.length > 0) {
    const { data: participantPlayerEntries } = await supabase
      .from("round_players")
      .select("id, round_id")
      .eq("user_id", targetUserId)
      .in("round_id", participantRoundIds);
    
    for (const entry of participantPlayerEntries || []) {
      participantPlayerMap.set(entry.round_id, entry.id);
    }
  }

  const participantNamesRaw = [targetProfile?.display_name, targetProfile?.username]
    .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
    .map((v) => v.trim());

  const participantNames = Array.from(new Set(participantNamesRaw));
  
  // Prepare JSON string for cs filter - use userId as JSON array
  const userIdNeedle = JSON.stringify([targetUserId]);

  // 2) Core owned-game queries
  const corePromises = [
    // 0: rounds owned
    supabase
      .from("rounds")
      .select(
        "id, course_name, round_name, date_played, origin, user_id, created_at, holes_played, tee_set, event_id"
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
      .then((r) => {
        // #region agent log
        if(r.error) fetch('http://127.0.0.1:7242/ingest/04be59d6-47f1-4996-9a2e-5e7d80a7add1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'unifiedRoundsLoader.ts:95',message:'skins_games owned ERROR',data:{targetUserId,errorCode:r.error.code,errorMessage:r.error.message,errorDetails:r.error.details},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
        // #endregion
        // Handle 400 errors gracefully
        if (r.error && (r.error.code === '400' || r.error.code === 'PGRST116')) {
          console.warn('Error fetching skins_games owned, returning empty:', r.error);
          return { data: [], error: null };
        }
        return r;
      }),

    // 4: best ball owned
    supabase
      .from("best_ball_games")
      .select("id, user_id, course_name, round_name, date_played, created_at, holes_played, team_a_players, team_b_players, game_type, winner_team, final_result, is_finished, match_status")
      .eq("user_id", targetUserId)
      .then((r) => {
        // #region agent log
        if(r.error) fetch('http://127.0.0.1:7242/ingest/04be59d6-47f1-4996-9a2e-5e7d80a7add1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'unifiedRoundsLoader.ts:103',message:'best_ball_games owned ERROR',data:{targetUserId,errorCode:r.error.code,errorMessage:r.error.message,errorDetails:r.error.details},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
        // #endregion
        // Handle 400 errors gracefully
        if (r.error && (r.error.code === '400' || r.error.code === 'PGRST116')) {
          console.warn('Error fetching best_ball_games owned, returning empty:', r.error);
          return { data: [], error: null };
        }
        return r;
      }),

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

  // Skins: players jsonb array - use cs filter with JSON string
  const skinsParticipantPromises = [supabase
    .from("skins_games")
    .select("id, user_id, course_name, round_name, date_played, created_at, holes_played, players")
    .filter("players", "cs", userIdNeedle)
    .then((r) => {
      // #region agent log
      if(r.error) fetch('http://127.0.0.1:7242/ingest/04be59d6-47f1-4996-9a2e-5e7d80a7add1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'unifiedRoundsLoader.ts:143',message:'skins_games.cs() ERROR',data:{targetUserId,errorCode:r.error.code,errorMessage:r.error.message,errorDetails:r.error.details},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
      // #endregion
      // Handle errors gracefully
      if (r.error && (r.error.code === '22P02' || r.error.code === '400' || r.error.message?.includes('invalid input syntax for type json'))) {
        console.warn('Error fetching skins_games participant, skipping:', r.error);
        return { data: [], error: null };
      }
      return r;
    })
  ];

  const escapeOrVal = (v: string) => `"${String(v).replace(/"/g, '\\"')}"`;
  const participantOrInList = participantNames.map(escapeOrVal).join(",");

  // Copenhagen: single query using OR across participant columns (avoid 3 requests)
  const copenhagenParticipantPromises =
    participantNames.length > 0
      ? [
          supabase
            .from("copenhagen_games")
            .select(
              "id, user_id, course_name, round_name, date_played, created_at, holes_played, tee_set, player_1, player_2, player_3, player_1_total_points, player_2_total_points, player_3_total_points"
            )
            .or(
              `player_1.in.(${participantOrInList}),player_2.in.(${participantOrInList}),player_3.in.(${participantOrInList})`
            )
            .then((r) => r),
        ]
      : [];

  // Best Ball: team_a_players and team_b_players jsonb arrays - use cs filter with JSON string
  const bestBallParticipantPromises = [supabase
    .from("best_ball_games")
    .select("id, user_id, course_name, round_name, date_played, created_at, holes_played, team_a_players, team_b_players, game_type, winner_team, final_result, is_finished, match_status")
    .or(`team_a_players.cs.${userIdNeedle},team_b_players.cs.${userIdNeedle}`)
    .then((r) => {
      // #region agent log
      if(r.error) fetch('http://127.0.0.1:7242/ingest/04be59d6-47f1-4996-9a2e-5e7d80a7add1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'unifiedRoundsLoader.ts:170',message:'best_ball_games.cs() ERROR',data:{targetUserId,errorCode:r.error.code,errorMessage:r.error.message,errorDetails:r.error.details},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
      // #endregion
      // Handle errors gracefully
      if (r.error && (r.error.code === '22P02' || r.error.code === '400' || r.error.message?.includes('invalid input syntax for type json'))) {
        console.warn('Error fetching best_ball_games participant, skipping:', r.error);
        return { data: [], error: null };
      }
      return r;
    })
  ];

  // Scramble: teams jsonb - we'll fetch all accessible and filter in code
  const scrambleParticipantPromises = participantNames.length > 0
    ? [
        supabase
          .from("scramble_games")
          .select("id, user_id, course_name, round_name, date_played, created_at, holes_played, tee_set, teams, winning_team")
          .then((r) => r),
      ]
    : [];

  // Wolf: single query using OR across participant columns (avoid 5 requests)
  const wolfParticipantPromises =
    participantNames.length > 0
      ? [
          supabase
            .from("wolf_games")
            .select(
              "id, user_id, course_name, round_name, date_played, created_at, holes_played, player_1, player_2, player_3, player_4, player_5, player_1_points, player_2_points, player_3_points, player_4_points, player_5_points, player_6_points, is_finished"
            )
            .or(
              `player_1.in.(${participantOrInList}),player_2.in.(${participantOrInList}),player_3.in.(${participantOrInList}),player_4.in.(${participantOrInList}),player_5.in.(${participantOrInList})`
            )
            .then((r) => r),
        ]
      : [];

  // Umbriago: single query using OR across participant columns (avoid 4 requests)
  const umbriagioParticipantPromises =
    participantNames.length > 0
      ? [
          supabase
            .from("umbriago_games")
            .select(
              "id, user_id, course_name, round_name, date_played, created_at, holes_played, tee_set, team_a_player_1, team_a_player_2, team_b_player_1, team_b_player_2, team_a_total_points, team_b_total_points, is_finished"
            )
            .or(
              `team_a_player_1.in.(${participantOrInList}),team_a_player_2.in.(${participantOrInList}),team_b_player_1.in.(${participantOrInList}),team_b_player_2.in.(${participantOrInList})`
            )
            .then((r) => r),
        ]
      : [];

  // Match Play: single query using OR across participant columns (avoid 2 requests)
  const matchPlayParticipantPromises =
    participantNames.length > 0
      ? [
          supabase
            .from("match_play_games")
            .select(
              "id, user_id, course_name, round_name, date_played, created_at, holes_played, tee_set, player_1, player_2, winner_player, final_result, is_finished, match_status"
            )
            .or(`player_1.in.(${participantOrInList}),player_2.in.(${participantOrInList})`)
            .then((r) => r),
        ]
      : [];

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

  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/04be59d6-47f1-4996-9a2e-5e7d80a7add1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'unifiedRoundsLoader.ts:290',message:'Before Promise.all',data:{promiseCount:allPromises.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
  // #endregion
  const results = await Promise.all(allPromises.map((p, idx) => 
    Promise.resolve(p).catch((err: any) => {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/04be59d6-47f1-4996-9a2e-5e7d80a7add1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'unifiedRoundsLoader.ts:290',message:'Promise.all error',data:{promiseIndex:idx,errorCode:err?.code,errorMessage:err?.message,errorDetails:err?.details},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
      // #endregion
      return { data: null, error: err };
    })
  ));

  // Parse results back
  let idx = 0;
  const ownedRoundsRes = results[idx++];
  const roundSummariesRes = results[idx++];
  const copenhagenOwnedRes = results[idx++];
  const skinsOwnedRes = results[idx++];
  // #region agent log
  if(skinsOwnedRes?.error) fetch('http://127.0.0.1:7242/ingest/04be59d6-47f1-4996-9a2e-5e7d80a7add1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'unifiedRoundsLoader.ts:297',message:'skinsOwnedRes ERROR',data:{errorCode:skinsOwnedRes.error.code,errorMessage:skinsOwnedRes.error.message},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
  // #endregion
  const bestBallOwnedRes = results[idx++];
  const scrambleOwnedRes = results[idx++];
  const wolfOwnedRes = results[idx++];
  const umbriagioOwnedRes = results[idx++];
  const matchPlayOwnedRes = results[idx++];
  // #region agent log
  if(matchPlayOwnedRes?.error) fetch('http://127.0.0.1:7242/ingest/04be59d6-47f1-4996-9a2e-5e7d80a7add1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'unifiedRoundsLoader.ts:301',message:'matchPlayOwnedRes ERROR',data:{errorCode:matchPlayOwnedRes.error.code,errorMessage:matchPlayOwnedRes.error.message},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
  // #endregion

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
  
  // Fetch skins holes data to calculate position and skins won
  const skinsGameIds = skinsGames.map((g: any) => g.id);
  let skinsHolesMap = new Map<string, any[]>();
  
  if (skinsGameIds.length > 0) {
    const { data: skinsHoles } = await supabase
      .from("skins_holes")
      .select("game_id, winner_player, skins_available")
      .in("game_id", skinsGameIds);
    
    for (const hole of skinsHoles || []) {
      const existing = skinsHolesMap.get(hole.game_id) || [];
      existing.push(hole);
      skinsHolesMap.set(hole.game_id, existing);
    }
  }
  
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
        "id, course_name, round_name, date_played, origin, user_id, created_at, holes_played, tee_set, event_id"
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

  // Batch fetch holes for participant rounds to calculate individual player scores
  // This ensures we show the correct score for each player in multi-group rounds
  const participantPlayerIds = Array.from(participantPlayerMap.values());
  const playerHolesMap = new Map<string, Array<{ score: number; par: number }>>(); // player_id -> holes
  
  if (participantPlayerIds.length > 0) {
    const { data: playerHoles } = await supabase
      .from("holes")
      .select("player_id, score, par")
      .in("player_id", participantPlayerIds)
      .gt("score", 0);
    
    for (const hole of playerHoles || []) {
      const existing = playerHolesMap.get(hole.player_id) || [];
      existing.push({ score: hole.score || 0, par: hole.par || 0 });
      playerHolesMap.set(hole.player_id, existing);
    }
  }
  
  // Calculate per-player scores
  const playerScoreMap = new Map<string, { totalScore: number; totalPar: number }>(); // player_id -> { totalScore, totalPar }
  for (const [playerId, holes] of playerHolesMap.entries()) {
    const totalScore = holes.reduce((sum, h) => sum + h.score, 0);
    const totalPar = holes.reduce((sum, h) => sum + h.par, 0);
    playerScoreMap.set(playerId, { totalScore, totalPar });
  }

  // Regular rounds
  for (const round of userRounds) {
    // Check if targetUserId is a participant in this round
    const playerId = participantPlayerMap.get(round.id);
    let totalScore: number | null = null;
    let totalPar: number | null = null;
    
    if (playerId) {
      // Calculate individual player's score from their holes
      const playerScore = playerScoreMap.get(playerId);
      if (playerScore) {
        totalScore = playerScore.totalScore;
        totalPar = playerScore.totalPar;
      }
    } else {
      // Fallback to round_summaries for owner-only rounds (when user owns but doesn't participate)
      const summary = summaryMap.get(round.id) as any | undefined;
      totalScore = summary?.total_score ?? null;
      totalPar = summary?.total_par ?? null;
    }

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
      event_id: round.event_id || null,
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
      ownerUserId: game.user_id,
      position,
      copenhagenFinalScore,
      _sortCreatedAt: game.created_at || `${game.date_played}T00:00:00Z`,
    });
  }

  // Skins - calculate position and skins won
  for (const game of skinsGames) {
    const players = Array.isArray(game.players) ? game.players : [];
    
    // Build player ID map: playerId (odId || id || name) -> player info
    const playerIdMap = new Map<string, { id: string; name: string }>();
    for (const p of players) {
      const pName = typeof p === 'string' ? p : (p?.name || p?.displayName || '');
      const pId = typeof p === 'string' ? p : (p?.odId || p?.id || p?.name || '');
      if (pId) {
        playerIdMap.set(pId, { id: pId, name: pName });
      }
    }
    
    // Find which player the target user is
    let userPlayerId: string | null = null;
    for (const [playerId, playerInfo] of playerIdMap) {
      if (participantNames.includes(playerInfo.name)) {
        userPlayerId = playerId;
        break;
      }
    }
    
    // If not found but user owns the game, default to first player
    if (!userPlayerId && game.user_id === targetUserId && playerIdMap.size > 0) {
      userPlayerId = Array.from(playerIdMap.keys())[0];
    }
    
    // Calculate skins won for each player
    const holes = skinsHolesMap.get(game.id) || [];
    const playerSkinsMap = new Map<string, number>();
    
    // Initialize all players with 0 skins
    for (const playerId of playerIdMap.keys()) {
      playerSkinsMap.set(playerId, 0);
    }
    
    // Count skins won
    for (const hole of holes) {
      const winner = hole.winner_player;
      const skinsAvailable = hole.skins_available || 0;
      
      if (winner && playerSkinsMap.has(winner)) {
        playerSkinsMap.set(winner, (playerSkinsMap.get(winner) || 0) + skinsAvailable);
      }
    }
    
    // Calculate position for the user
    const allSkins = Array.from(playerSkinsMap.entries()).map(([playerId, skins]) => ({
      playerId,
      skins,
    }));
    
    // Sort by skins descending
    const sortedBySkins = [...allSkins].sort((a, b) => b.skins - a.skins);
    
    let skinsPosition: number | null = null;
    let skinsWon: number | null = null;
    
    if (userPlayerId) {
      const userEntry = allSkins.find(e => e.playerId === userPlayerId);
      
      if (userEntry) {
        skinsWon = userEntry.skins;
        // Find position (1-based, accounting for ties)
        let pos = 1;
        for (const entry of sortedBySkins) {
          if (entry.skins > userEntry.skins) {
            pos++;
          } else if (entry.playerId === userPlayerId) {
            break;
          }
        }
        skinsPosition = pos;
      }
    }
    
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
      ownerUserId: game.user_id,
      skinsPosition,
      skinsWon,
      _sortCreatedAt: game.created_at || `${game.date_played}T00:00:00Z`,
    });
  }

  // Best Ball - fetch holes data for stroke play games to calculate scores
  const bestBallGameIds = bestBallGames.map((g: any) => g.id);
  let bestBallHolesMap = new Map<string, any[]>();
  
  if (bestBallGameIds.length > 0) {
    const { data: bestBallHoles } = await supabase
      .from("best_ball_holes")
      .select("game_id, par, team_a_best_gross, team_b_best_gross")
      .in("game_id", bestBallGameIds);
    
    for (const hole of bestBallHoles || []) {
      const existing = bestBallHolesMap.get(hole.game_id) || [];
      existing.push(hole);
      bestBallHolesMap.set(hole.game_id, existing);
    }
  }
  
  for (const game of bestBallGames) {
    const teamA = Array.isArray(game.team_a_players) ? game.team_a_players : [];
    const teamB = Array.isArray(game.team_b_players) ? game.team_b_players : [];

    // Determine match result for match play best ball games
    // game_type can be 'match', 'match_play', or 'stroke_play'
    let matchResult: 'W' | 'L' | 'T' | null = null;
    let matchFinalScore: string | null = null;
    let bestBallTotalScore: number | null = null;
    let bestBallScoreToPar: number | null = null;
    const isMatchPlayFormat = game.game_type === 'match_play' || game.game_type === 'match';
    
    // Find which team the user is on - check both name and displayName
    const userInTeamA = teamA.some((p: any) => {
      const pName = typeof p === 'string' ? p : (p?.name || p?.displayName);
      return pName && participantNames.includes(pName);
    });
    const userInTeamB = teamB.some((p: any) => {
      const pName = typeof p === 'string' ? p : (p?.name || p?.displayName);
      return pName && participantNames.includes(pName);
    });
    
    // Default to team A if user owns the game but isn't in either team list
    const userTeam = userInTeamA ? 'A' : userInTeamB ? 'B' : (game.user_id === targetUserId ? 'A' : null);
    
    if (isMatchPlayFormat && game.is_finished) {
      // Get match status (positive = team A winning, negative = team B winning)
      // Use match_status as source of truth since winner_team can be inconsistent
      const matchStatus = game.match_status || 0;
      
      // Determine winner based on match_status (more reliable than winner_team)
      const isTie = matchStatus === 0;
      const teamAWon = matchStatus > 0;
      const teamBWon = matchStatus < 0;
      
      if (isTie) {
        matchResult = 'T';
        // No score displayed for ties
      } else if (userInTeamA && !userInTeamB) {
        matchResult = teamAWon ? 'W' : 'L';
        // From Team A's perspective: positive status = UP, negative = DOWN
        matchFinalScore = teamAWon ? `${matchStatus} UP` : `${Math.abs(matchStatus)} DOWN`;
      } else if (userInTeamB && !userInTeamA) {
        matchResult = teamBWon ? 'W' : 'L';
        // From Team B's perspective: invert the status
        matchFinalScore = teamBWon ? `${Math.abs(matchStatus)} UP` : `${matchStatus} DOWN`;
      } else if (game.user_id === targetUserId) {
        // Owner defaults to team A
        matchResult = teamAWon ? 'W' : 'L';
        matchFinalScore = teamAWon ? `${matchStatus} UP` : `${Math.abs(matchStatus)} DOWN`;
      }
    } else if (!isMatchPlayFormat && userTeam) {
      // Stroke play Best Ball - calculate total score and score to par for user's team
      const holes = bestBallHolesMap.get(game.id) || [];
      
      if (holes.length > 0) {
        let totalScore = 0;
        let totalPar = 0;
        
        for (const hole of holes) {
          const teamScore = userTeam === 'A' ? hole.team_a_best_gross : hole.team_b_best_gross;
          if (teamScore !== null && teamScore > 0) {
            totalScore += teamScore;
            totalPar += hole.par || 0;
          }
        }
        
        if (totalScore > 0) {
          bestBallTotalScore = totalScore;
          bestBallScoreToPar = totalScore - totalPar;
        }
      }
    }

    allRounds.push({
      id: game.id,
      course_name: game.course_name,
      round_name: game.round_name,
      date: game.date_played,
      score: 0,
      playerCount: teamA.length + teamB.length,
      gameMode: isMatchPlayFormat ? "Best Ball Match Play" : "Best Ball",
      gameType: "best_ball",
      holesPlayed: game.holes_played,
      ownerUserId: game.user_id,
      matchResult,
      matchFinalScore,
      bestBallTotalScore,
      bestBallScoreToPar,
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
      ownerUserId: game.user_id,
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
      ownerUserId: game.user_id,
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
      ownerUserId: game.user_id,
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
      ownerUserId: game.user_id,
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

  const finalRounds = allRounds.map(({ _sortCreatedAt, ...rest }) => rest);
  unifiedRoundsCache.set(targetUserId, { ts: now, data: finalRounds });
  return finalRounds;
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
