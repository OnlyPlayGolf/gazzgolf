import { supabase } from "@/integrations/supabase/client";

// Helper function to filter out orphaned pro_stats_rounds (where external_round_id points to a deleted round)
export async function filterValidProStatsRounds(proRounds: Array<{ id: string; external_round_id?: string | null }>): Promise<Array<{ id: string }>> {
  if (!proRounds || proRounds.length === 0) {
    return [];
  }

  const roundsWithExternalId = proRounds.filter(pr => pr.external_round_id);
  if (roundsWithExternalId.length === 0) {
    // All rounds are standalone (no external_round_id), so they're all valid
    return proRounds.map(pr => ({ id: pr.id }));
  }

  const externalRoundIds = roundsWithExternalId.map(pr => pr.external_round_id!);
  // Check which rounds still exist
  const { data: existingRounds } = await supabase
    .from('rounds')
    .select('id')
    .in('id', externalRoundIds);
  
  const existingRoundIds = new Set((existingRounds || []).map(r => r.id));
  
  // Filter to only include pro_stats_rounds where:
  // 1. external_round_id is null (standalone pro stats rounds), OR
  // 2. external_round_id exists AND the round still exists
  return proRounds
    .filter(pr => !pr.external_round_id || existingRoundIds.has(pr.external_round_id))
    .map(pr => ({ id: pr.id }));
}

// Stat performance levels
export type StatLevel = 'strength' | 'average' | 'needs-improvement';

export interface StatValue {
  value: number | null;
  label: string;
  level: StatLevel;
  context?: string;
}

export interface ScoringStats {
  scoringAverage: number | null;
  bestRound: number | null;
  worstRound: number | null;
  par3Average: number | null;
  par4Average: number | null;
  par5Average: number | null;
  totalRounds: number;
  totalHoles: number;
}

export interface StrokesGainedStats {
  total: number | null;
  offTheTee: number | null;
  approach: number | null;
  shortGame: number | null;
  putting: number | null;
  other: number | null;
  scoring: number | null;
}

export interface AccuracyStats {
  fairwaysHit: number | null;
  greensInRegulation: number | null;
  girPar3: number | null;
  girPar4: number | null;
  girPar5: number | null;
  scrambling: number | null;
  sandSaves: number | null;
  avgDriverDistance: number | null;
  leftMissPercentage: number | null;
  rightMissPercentage: number | null;
}

export interface PuttingStats {
  puttsPerHole: number | null;
  onePuttPercentage: number | null;
  twoPuttPercentage: number | null;
  threePuttPercentage: number | null;
  fourPlusPuttPercentage: number | null;
  threePuttAvoidance: number | null;
  puttsPerGIR: number | null;
}

export interface AllStats {
  scoring: ScoringStats;
  strokesGained: StrokesGainedStats;
  accuracy: AccuracyStats;
  putting: PuttingStats;
  roundsPlayed: number;
}

// Thresholds for determining stat level (based on amateur benchmarks)
const THRESHOLDS = {
  // Scoring (relative to par)
  scoringAverage: { strength: 2, average: 8 }, // +2 or better is strength, +8 or worse needs work
  
  // Strokes Gained (per round)
  sgTotal: { strength: 0.5, average: -0.5 },
  sgOffTheTee: { strength: 0.2, average: -0.2 },
  sgApproach: { strength: 0.2, average: -0.2 },
  sgShortGame: { strength: 0.1, average: -0.1 },
  sgPutting: { strength: 0.1, average: -0.1 },
  
  // Accuracy percentages
  fairwaysHit: { strength: 60, average: 45 },
  gir: { strength: 55, average: 35 },
  scrambling: { strength: 50, average: 30 },
  sandSaves: { strength: 40, average: 20 },
  
  // Putting
  puttsPerHole: { strength: 1.7, average: 1.9 }, // Lower is better (per hole instead of per round)
  onePutt: { strength: 35, average: 25 },
  threePuttAvoid: { strength: 95, average: 85 },
};

export const getStatLevel = (value: number | null, statType: keyof typeof THRESHOLDS, lowerIsBetter = false): StatLevel => {
  if (value === null) return 'average';
  
  const threshold = THRESHOLDS[statType];
  if (!threshold) return 'average';
  
  if (lowerIsBetter) {
    if (value <= threshold.strength) return 'strength';
    if (value >= threshold.average) return 'needs-improvement';
    return 'average';
  } else {
    if (value >= threshold.strength) return 'strength';
    if (value <= threshold.average) return 'needs-improvement';
    return 'average';
  }
};

export const getSGLevel = (value: number | null): StatLevel => {
  if (value === null) return 'average';
  if (value >= 0.1) return 'strength';
  if (value <= -0.1) return 'needs-improvement';
  return 'average';
};

export const formatScore = (score: number | null, showPlus = true): string => {
  if (score === null) return '-';
  if (score === 0) return 'E';
  if (score > 0 && showPlus) return `+${score.toFixed(1)}`;
  return score.toFixed(1);
};

export const formatSG = (value: number | null): string => {
  if (value === null) return '-';
  if (value >= 0) return `+${value.toFixed(2)}`;
  return value.toFixed(2);
};

export const formatPercentage = (value: number | null): string => {
  if (value === null) return '-';
  return `${value.toFixed(0)}%`;
};

export type StatsFilter = 'all' | 'year' | 'last5' | 'last10' | 'last20' | 'last50';

export async function fetchUserStats(userId: string, filter: StatsFilter = 'all'): Promise<AllStats> {
  const yearFilter = filter === 'year' ? new Date(new Date().getFullYear(), 0, 1).toISOString() : null;

  // Batch 1: Run all initial fetches in parallel
  const [
    summariesResult,
    userProfileResult,
    participantRoundsResult,
    ownedRoundsResult,
    bestBallResult,
    skinsResult,
    matchPlayResult,
    wolfResult,
    umbriagoResult,
    copenhagenResult,
    proStatsRoundsResult,
  ] = await Promise.all([
    (() => {
      let q = supabase.from('round_summaries').select('*').eq('user_id', userId).order('date_played', { ascending: false });
      if (yearFilter) q = q.gte('date_played', yearFilter);
      return q;
    })(),
    supabase.from('profiles').select('display_name, username').eq('id', userId).maybeSingle(),
    supabase.from('round_players').select('round_id').eq('user_id', userId),
    (() => {
      let q = supabase.from('rounds').select('id, date_played, holes_played, user_id, round_name, course_name').eq('user_id', userId);
      if (yearFilter) q = q.gte('date_played', yearFilter);
      return q;
    })(),
    (() => {
      let q = supabase.from('best_ball_games').select('id, date_played, holes_played, user_id, team_a_players, team_b_players, game_type').eq('user_id', userId);
      if (yearFilter) q = q.gte('date_played', yearFilter);
      return q;
    })(),
    (() => {
      let q = supabase.from('skins_games').select('id, date_played, holes_played, user_id, players').eq('user_id', userId);
      if (yearFilter) q = q.gte('date_played', yearFilter);
      return q;
    })(),
    (() => {
      let q = supabase.from('match_play_games').select('id, date_played, holes_played, user_id, player_1, player_2').eq('user_id', userId);
      if (yearFilter) q = q.gte('date_played', yearFilter);
      return q;
    })(),
    (() => {
      let q = supabase.from('wolf_games').select('id, date_played, holes_played, user_id, player_1, player_2, player_3, player_4, player_5, player_6').eq('user_id', userId);
      if (yearFilter) q = q.gte('date_played', yearFilter);
      return q;
    })(),
    (() => {
      let q = supabase.from('umbriago_games').select('id, date_played, holes_played, user_id, team_a_player_1, team_a_player_2, team_b_player_1, team_b_player_2').eq('user_id', userId);
      if (yearFilter) q = q.gte('date_played', yearFilter);
      return q;
    })(),
    (() => {
      let q = supabase.from('copenhagen_games').select('id, date_played, holes_played, user_id, player_1, player_2, player_3').eq('user_id', userId);
      if (yearFilter) q = q.gte('date_played', yearFilter);
      return q;
    })(),
    supabase.from('pro_stats_rounds').select('id, holes_played, external_round_id').eq('user_id', userId),
  ]);

  const summaries = summariesResult.data;
  if (summariesResult.error) console.error('Error fetching round summaries:', summariesResult.error);
  let validSummaries = summaries?.filter((s: any) => s.total_score && s.total_score > 0) || [];
  if (filter === 'last5') validSummaries = validSummaries.slice(0, 5);
  else if (filter === 'last10') validSummaries = validSummaries.slice(0, 10);
  else if (filter === 'last20') validSummaries = validSummaries.slice(0, 20);
  else if (filter === 'last50') validSummaries = validSummaries.slice(0, 50);

  const userProfile = userProfileResult.data;
  const userNames = [userProfile?.display_name, userProfile?.username]
    .filter((n): n is string => typeof n === 'string' && n.trim().length > 0)
    .map((n: string) => n.trim());

  const participantRoundIds = (participantRoundsResult.data || []).map((rp: any) => rp.round_id);
  const ownedRounds = ownedRoundsResult.data || [];
  const bestBallGames = bestBallResult.data || [];
  const skinsGames = skinsResult.data || [];
  const matchPlayGames = matchPlayResult.data || [];
  const wolfGames = wolfResult.data || [];
  const umbriagoGames = umbriagoResult.data || [];
  const copenhagenGames = copenhagenResult.data || [];
  const allProRounds = proStatsRoundsResult.data || [];

  // Batch 2: Participant rounds data (needed to build allRounds)
  let participantRoundsData: any[] = [];
  if (participantRoundIds.length > 0) {
    let participantRoundsQuery = supabase
      .from('rounds')
      .select('id, date_played, holes_played, user_id, round_name, course_name')
      .in('id', participantRoundIds)
      .order('date_played', { ascending: false });
    if (yearFilter) participantRoundsQuery = participantRoundsQuery.gte('date_played', yearFilter);
    const { data } = await participantRoundsQuery;
    participantRoundsData = data || [];
  }

  // Combine all rounds/games into a unified list (each Silicon Valley Amateur - Rond 1/2/3 etc. is a separate round)
  const allRoundsMap = new Map<string, { id: string; date_played: string; holes_played: number; gameType: string; gameData?: any; round_name?: string | null; course_name?: string }>();
  
  // Add regular rounds (includes all multiround/event rounds – e.g. Silicon Valley Amateur - Rond 1, 2, 3)
  (ownedRounds || []).forEach(r => allRoundsMap.set(r.id, { ...r, gameType: 'round' }));
  (participantRoundsData || []).forEach(r => allRoundsMap.set(r.id, { ...r, gameType: 'round' }));
  
  // Add best ball games (both stroke play and match play have stroke play scores)
  (bestBallGames || []).forEach(g => {
    allRoundsMap.set(g.id, { id: g.id, date_played: g.date_played, holes_played: g.holes_played, gameType: 'best_ball', gameData: g });
  });
  
  // Add skins games
  (skinsGames || []).forEach(g => {
    allRoundsMap.set(g.id, { id: g.id, date_played: g.date_played, holes_played: g.holes_played, gameType: 'skins', gameData: g });
  });
  
  // Add match play games
  (matchPlayGames || []).forEach(g => {
    allRoundsMap.set(g.id, { id: g.id, date_played: g.date_played, holes_played: g.holes_played, gameType: 'match_play', gameData: g });
  });
  
  // Add wolf games
  (wolfGames || []).forEach(g => {
    allRoundsMap.set(g.id, { id: g.id, date_played: g.date_played, holes_played: g.holes_played, gameType: 'wolf', gameData: g });
  });
  
  // Add umbriago games
  (umbriagoGames || []).forEach(g => {
    allRoundsMap.set(g.id, { id: g.id, date_played: g.date_played, holes_played: g.holes_played, gameType: 'umbriago', gameData: g });
  });
  
  // Add copenhagen games
  (copenhagenGames || []).forEach(g => {
    allRoundsMap.set(g.id, { id: g.id, date_played: g.date_played, holes_played: g.holes_played, gameType: 'copenhagen', gameData: g });
  });
  
  const allRounds = Array.from(allRoundsMap.values()).sort((a, b) => {
    const dateA = new Date(a.date_played || 0).getTime();
    const dateB = new Date(b.date_played || 0).getTime();
    return dateB - dateA;
  });
  
  // Apply round count filters
  let filteredRounds = allRounds || [];
  if (filter === 'last5') {
    filteredRounds = filteredRounds.slice(0, 5);
  } else if (filter === 'last10') {
    filteredRounds = filteredRounds.slice(0, 10);
  } else if (filter === 'last20') {
    filteredRounds = filteredRounds.slice(0, 20);
  } else if (filter === 'last50') {
    filteredRounds = filteredRounds.slice(0, 50);
  }
  
  // Batch 2: Player lookup + all holes data in parallel
  const ownedRoundIdsSet = new Set((ownedRounds || []).map(r => r.id));
  const allRoundIdsForPlayerLookup = Array.from(new Set([...participantRoundIds, ...Array.from(ownedRoundIdsSet)]));
  const regularRoundIds = filteredRounds.filter(r => r.gameType === 'round').map(r => r.id);
  const bestBallGameIds = filteredRounds.filter(r => r.gameType === 'best_ball').map(r => r.id);
  const skinsGameIds = filteredRounds.filter(r => r.gameType === 'skins').map(r => r.id);
  const matchPlayGameIds = filteredRounds.filter(r => r.gameType === 'match_play').map(r => r.id);
  const wolfGameIds = filteredRounds.filter(r => r.gameType === 'wolf').map(r => r.id);
  const umbriagoGameIds = filteredRounds.filter(r => r.gameType === 'umbriago').map(r => r.id);
  const copenhagenGameIds = filteredRounds.filter(r => r.gameType === 'copenhagen').map(r => r.id);

  const [
    roundPlayersResult,
    allHolesResult,
    bestBallHolesResult,
    skinsHolesResult,
    matchPlayHolesResult,
    wolfHolesResult,
    umbriagoHolesResult,
    copenhagenHolesResult,
    validProRoundsResult,
  ] = await Promise.all([
    allRoundIdsForPlayerLookup.length > 0
      ? supabase.from('round_players').select('id, round_id').eq('user_id', userId).in('round_id', allRoundIdsForPlayerLookup)
      : Promise.resolve({ data: [] as any[] }),
    regularRoundIds.length > 0
      ? supabase.from('holes').select('round_id, player_id, score, par').in('round_id', regularRoundIds).gt('score', 0)
      : Promise.resolve({ data: [] as any[] }),
    bestBallGameIds.length > 0
      ? supabase.from('best_ball_holes').select('game_id, hole_number, par, team_a_scores, team_b_scores').in('game_id', bestBallGameIds).order('hole_number')
      : Promise.resolve({ data: [] as any[] }),
    skinsGameIds.length > 0
      ? supabase.from('skins_holes').select('game_id, hole_number, par, player_scores').in('game_id', skinsGameIds).order('hole_number')
      : Promise.resolve({ data: [] as any[] }),
    matchPlayGameIds.length > 0
      ? supabase.from('match_play_holes').select('game_id, hole_number, par, player_1_gross_score, player_2_gross_score').in('game_id', matchPlayGameIds).order('hole_number')
      : Promise.resolve({ data: [] as any[] }),
    wolfGameIds.length > 0
      ? supabase.from('wolf_holes').select('game_id, hole_number, par, player_1_score, player_2_score, player_3_score, player_4_score, player_5_score, player_6_score').in('game_id', wolfGameIds).order('hole_number')
      : Promise.resolve({ data: [] as any[] }),
    umbriagoGameIds.length > 0
      ? supabase.from('umbriago_holes').select('game_id, hole_number, par, team_a_player_1_score, team_a_player_2_score, team_b_player_1_score, team_b_player_2_score').in('game_id', umbriagoGameIds).order('hole_number')
      : Promise.resolve({ data: [] as any[] }),
    copenhagenGameIds.length > 0
      ? supabase.from('copenhagen_holes').select('game_id, hole_number, par, player_1_gross_score, player_2_gross_score, player_3_gross_score').in('game_id', copenhagenGameIds).order('hole_number')
      : Promise.resolve({ data: [] as any[] }),
    filterValidProStatsRounds(allProRounds),
  ]);

  const roundPlayers = (roundPlayersResult.data ?? (roundPlayersResult as { data?: any[] }).data) ?? [];
  const allHoles = (allHolesResult.data ?? (allHolesResult as { data?: any[] }).data) ?? [];
  const bestBallHoles = (bestBallHolesResult.data ?? (bestBallHolesResult as { data?: any[] }).data) ?? [];
  const skinsHoles = (skinsHolesResult.data ?? (skinsHolesResult as { data?: any[] }).data) ?? [];
  const matchPlayHoles = (matchPlayHolesResult.data ?? (matchPlayHolesResult as { data?: any[] }).data) ?? [];
  const wolfHoles = (wolfHolesResult.data ?? (wolfHolesResult as { data?: any[] }).data) ?? [];
  const umbriagoHoles = (umbriagoHolesResult.data ?? (umbriagoHolesResult as { data?: any[] }).data) ?? [];
  const copenhagenHoles = (copenhagenHolesResult.data ?? (copenhagenHolesResult as { data?: any[] }).data) ?? [];
  const validProRounds = validProRoundsResult;
  const proRounds = validProRounds.map((pr: { id: string }) => ({ id: pr.id, holes_played: allProRounds?.find(apr => apr.id === pr.id)?.holes_played || 18 }));

  const playerIdByRoundId = new Map(roundPlayers.map((rp: any) => [rp.round_id, rp.id]));
  const ownedRoundIds = ownedRoundIdsSet;

  // Calculate user's scores per round from all game formats
  const userScoresByRound = new Map<string, { totalScore: number; totalPar: number; holesCount: number }>();

  const isUserName = (name: string | null | undefined): boolean => {
    if (!name) return false;
    return userNames.some(un => un.toLowerCase() === name.toLowerCase().trim());
  };

  // Process regular rounds (holes table)
  if (allHoles.length > 0) {
    (allHoles || []).forEach((hole: any) => {
      const roundId = hole.round_id;
      const isOwnedRound = ownedRoundIds.has(roundId);
      const userPlayerId = playerIdByRoundId.get(roundId);
      
      const isUserHole = isOwnedRound 
        ? (!hole.player_id || (userPlayerId && hole.player_id === userPlayerId))
        : (userPlayerId && hole.player_id === userPlayerId);
      
      if (isUserHole) {
        const existing = userScoresByRound.get(roundId) || { totalScore: 0, totalPar: 0, holesCount: 0 };
        existing.totalScore += hole.score || 0;
        existing.totalPar += hole.par || 0;
        existing.holesCount += 1;
        userScoresByRound.set(roundId, existing);
      }
    });
  }

  // Process Best Ball games (both stroke play and match play have stroke play scores)
  if (bestBallHoles.length > 0) {
    const bestBallGamesMap = new Map((bestBallGames || []).map(g => [g.id, g]));

    (bestBallHoles || []).forEach((hole: any) => {
      const gameId = hole.game_id;
      const game = bestBallGamesMap.get(gameId);
      if (!game) return;
      
      // Find user in team_a or team_b
      const teamAPlayers = Array.isArray(game.team_a_players) ? game.team_a_players : [];
      const teamBPlayers = Array.isArray(game.team_b_players) ? game.team_b_players : [];
      
      const teamAScores = Array.isArray(hole.team_a_scores) ? hole.team_a_scores : [];
      const teamBScores = Array.isArray(hole.team_b_scores) ? hole.team_b_scores : [];
      
      let userScore: number | null = null;
      let par = hole.par || 4;
      
      // Check team A
      for (let i = 0; i < teamAPlayers.length; i++) {
        const player = teamAPlayers[i];
        const playerName = typeof player === 'string' ? player : (player?.displayName || player?.name);
        if (isUserName(playerName)) {
          const scoreData = teamAScores[i];
          if (scoreData && typeof scoreData === 'object' && 'grossScore' in scoreData) {
            userScore = scoreData.grossScore as number;
            break;
          }
        }
      }
      
      // Check team B if not found in A
      if (userScore === null) {
        for (let i = 0; i < teamBPlayers.length; i++) {
          const player = teamBPlayers[i];
          const playerName = typeof player === 'string' ? player : (player?.displayName || player?.name);
          if (isUserName(playerName)) {
            const scoreData = teamBScores[i];
            if (scoreData && typeof scoreData === 'object' && 'grossScore' in scoreData) {
              userScore = scoreData.grossScore as number;
              break;
            }
          }
        }
      }
      
      if (userScore !== null && userScore > 0) {
        const existing = userScoresByRound.get(gameId) || { totalScore: 0, totalPar: 0, holesCount: 0 };
        existing.totalScore += userScore;
        existing.totalPar += par;
        existing.holesCount += 1;
        userScoresByRound.set(gameId, existing);
      }
    });
  }

  // Process Skins games
  if (skinsHoles.length > 0) {
    (skinsHoles || []).forEach((hole: any) => {
      const gameId = hole.game_id;
      const playerScores = typeof hole.player_scores === 'object' && hole.player_scores !== null ? hole.player_scores as Record<string, any> : {};
      
      // Find user's score in player_scores
      for (const [playerName, scoreData] of Object.entries(playerScores)) {
        if (isUserName(playerName)) {
          const grossScore = scoreData?.gross || scoreData?.grossScore || null;
          if (grossScore !== null && grossScore > 0) {
            const existing = userScoresByRound.get(gameId) || { totalScore: 0, totalPar: 0, holesCount: 0 };
            existing.totalScore += grossScore;
            existing.totalPar += (hole.par || 4);
            existing.holesCount += 1;
            userScoresByRound.set(gameId, existing);
            break;
          }
        }
      }
    });
  }

  // Process Match Play games
  if (matchPlayHoles.length > 0) {
    const matchPlayGamesMap = new Map((matchPlayGames || []).map(g => [g.id, g]));

    (matchPlayHoles || []).forEach((hole: any) => {
      const gameId = hole.game_id;
      const game = matchPlayGamesMap.get(gameId);
      if (!game) return;
      
      let userScore: number | null = null;
      const par = hole.par || 4;
      
      if (isUserName(game.player_1)) {
        userScore = hole.player_1_gross_score;
      } else if (isUserName(game.player_2)) {
        userScore = hole.player_2_gross_score;
      }
      
      if (userScore !== null && userScore > 0) {
        const existing = userScoresByRound.get(gameId) || { totalScore: 0, totalPar: 0, holesCount: 0 };
        existing.totalScore += userScore;
        existing.totalPar += par;
        existing.holesCount += 1;
        userScoresByRound.set(gameId, existing);
      }
    });
  }

  // Process Wolf games
  if (wolfHoles.length > 0) {
    const wolfGamesMap = new Map((wolfGames || []).map(g => [g.id, g]));

    (wolfHoles || []).forEach((hole: any) => {
      const gameId = hole.game_id;
      const game = wolfGamesMap.get(gameId);
      if (!game) return;
      
      let userScore: number | null = null;
      const par = hole.par || 4;
      
      const players = [game.player_1, game.player_2, game.player_3, game.player_4, game.player_5, game.player_6];
      const scores = [hole.player_1_score, hole.player_2_score, hole.player_3_score, hole.player_4_score, hole.player_5_score, hole.player_6_score];
      
      for (let i = 0; i < players.length; i++) {
        if (isUserName(players[i])) {
          userScore = scores[i];
          break;
        }
      }
      
      if (userScore !== null && userScore > 0) {
        const existing = userScoresByRound.get(gameId) || { totalScore: 0, totalPar: 0, holesCount: 0 };
        existing.totalScore += userScore;
        existing.totalPar += par;
        existing.holesCount += 1;
        userScoresByRound.set(gameId, existing);
      }
    });
  }

  // Process Umbriago games
  if (umbriagoHoles.length > 0) {
    const umbriagoGamesMap = new Map((umbriagoGames || []).map(g => [g.id, g]));

    (umbriagoHoles || []).forEach((hole: any) => {
      const gameId = hole.game_id;
      const game = umbriagoGamesMap.get(gameId);
      if (!game) return;
      
      let userScore: number | null = null;
      const par = hole.par || 4;
      
      if (isUserName(game.team_a_player_1)) {
        userScore = hole.team_a_player_1_score;
      } else if (isUserName(game.team_a_player_2)) {
        userScore = hole.team_a_player_2_score;
      } else if (isUserName(game.team_b_player_1)) {
        userScore = hole.team_b_player_1_score;
      } else if (isUserName(game.team_b_player_2)) {
        userScore = hole.team_b_player_2_score;
      }
      
      if (userScore !== null && userScore > 0) {
        const existing = userScoresByRound.get(gameId) || { totalScore: 0, totalPar: 0, holesCount: 0 };
        existing.totalScore += userScore;
        existing.totalPar += par;
        existing.holesCount += 1;
        userScoresByRound.set(gameId, existing);
      }
    });
  }

  // Process Copenhagen games
  if (copenhagenHoles.length > 0) {
    const copenhagenGamesMap = new Map((copenhagenGames || []).map(g => [g.id, g]));

    (copenhagenHoles || []).forEach((hole: any) => {
      const gameId = hole.game_id;
      const game = copenhagenGamesMap.get(gameId);
      if (!game) return;
      
      let userScore: number | null = null;
      const par = hole.par || 4;
      
      if (isUserName(game.player_1)) {
        userScore = hole.player_1_gross_score;
      } else if (isUserName(game.player_2)) {
        userScore = hole.player_2_gross_score;
      } else if (isUserName(game.player_3)) {
        userScore = hole.player_3_gross_score;
      }
      
      if (userScore !== null && userScore > 0) {
        const existing = userScoresByRound.get(gameId) || { totalScore: 0, totalPar: 0, holesCount: 0 };
        existing.totalScore += userScore;
        existing.totalPar += par;
        existing.holesCount += 1;
        userScoresByRound.set(gameId, existing);
      }
    });
  }
  
  // Filter to only 18-hole rounds with valid scores (60-80 range as user mentioned)
  const roundsWith18Holes = filteredRounds.filter(r => r.holes_played === 18);
  console.log(`[Scoring Stats] Found ${roundsWith18Holes.length} rounds with holes_played=18 out of ${filteredRounds.length} total rounds`);
  
  const eighteenHoleRounds = filteredRounds
    .map(round => {
      const userScore = userScoresByRound.get(round.id);
      
      if (round.holes_played === 18) {
        const label = [round.round_name, round.course_name].filter(Boolean).join(', ') || round.id;
        if (!userScore) {
          console.log(`[Scoring Stats] Round ${round.id} (${label}): No user score found (round has ${round.holes_played} holes)`);
        } else if (userScore.holesCount !== 18) {
          console.log(`[Scoring Stats] Round ${round.id} (${label}): User has ${userScore.holesCount} holes, not 18 (score: ${userScore.totalScore})`);
        }
      }
      
      if (!userScore || userScore.holesCount !== 18) return null;
      
      const score = userScore.totalScore;
      const par = userScore.totalPar;
      const scoreVsPar = score - par;
      
      // Validate score is reasonable for 18 holes (user mentioned 60-80, but allow wider range 45-150)
      const isValid18HoleScore = score >= 45 && score <= 150;
      
      if (!isValid18HoleScore) {
        console.log(`[Scoring Stats] Round ${round.id}: Score ${score} outside valid range (45-150)`);
      }
      
      if (round.holes_played === 18 && isValid18HoleScore) {
        const label = [round.round_name, round.course_name].filter(Boolean).join(', ') || round.id;
        console.log(`[Scoring Stats] Round ${round.id} (${label}): INCLUDED - Score: ${score}, Par: ${par}, Score vs Par: ${scoreVsPar}`);
        return {
          roundId: round.id,
          score,
          scoreVsPar,
          par
        };
      }
      return null;
    })
    .filter((r): r is { roundId: string; score: number; scoreVsPar: number; par: number } => r !== null);
  
  console.log(`[Scoring Stats] Total 18-hole rounds counted: ${eighteenHoleRounds.length}`);
  
  const eighteenHoleScores = eighteenHoleRounds.map(r => r.score);
  const eighteenHoleScoresToPar = eighteenHoleRounds.map(r => r.scoreVsPar);
  
  const scoring: ScoringStats = {
    scoringAverage: eighteenHoleScoresToPar.length > 0
      ? eighteenHoleScoresToPar.reduce((a, b) => a + b, 0) / eighteenHoleScoresToPar.length
      : null,
    bestRound: eighteenHoleScores.length > 0 ? Math.min(...eighteenHoleScores) : null,
    worstRound: eighteenHoleScores.length > 0 ? Math.max(...eighteenHoleScores) : null,
    par3Average: null, // Would need hole-by-hole data
    par4Average: null,
    par5Average: null,
    totalRounds: eighteenHoleRounds.length,
    totalHoles: filteredRounds.reduce((sum, r) => {
      const userScore = userScoresByRound.get(r.id);
      return sum + (userScore?.holesCount || 0);
    }, 0),
  };

  // Calculate accuracy stats - start with basic values from summaries
  let accuracy: AccuracyStats = {
    fairwaysHit: null, // Will be calculated from all rounds
    greensInRegulation: validSummaries.length > 0 
      ? validSummaries.reduce((sum, s) => sum + (s.gir_percentage || 0), 0) / validSummaries.length 
      : null,
    girPar3: null,
    girPar4: null,
    girPar5: null,
    scrambling: (() => {
      // Only calculate if we have summaries with actual updown_percentage values
      const summariesWithUpDown = validSummaries.filter(s => s.updown_percentage !== null && s.updown_percentage !== undefined);
      if (summariesWithUpDown.length === 0) {
        return null;
      }
      return summariesWithUpDown.reduce((sum, s) => sum + (s.updown_percentage || 0), 0) / summariesWithUpDown.length;
    })(),
    sandSaves: null,
    avgDriverDistance: null,
    leftMissPercentage: null, // Will be calculated from all rounds
    rightMissPercentage: null, // Will be calculated from all rounds
  };

  // Use ownedRounds for accuracy (same filter already applied) - no extra rounds query
  let filteredRoundIds: string[] = [];
  if (ownedRounds.length > 0) {
    if (filter === 'last5') filteredRoundIds = ownedRounds.slice(0, 5).map(r => r.id);
    else if (filter === 'last10') filteredRoundIds = ownedRounds.slice(0, 10).map(r => r.id);
    else if (filter === 'last20') filteredRoundIds = ownedRounds.slice(0, 20).map(r => r.id);
    else if (filter === 'last50') filteredRoundIds = ownedRounds.slice(0, 50).map(r => r.id);
    else filteredRoundIds = ownedRounds.map(r => r.id);
  }

  // Batch 3: Accuracy holes, GIR holes, putt holes, pro_stats_holes in parallel
  const roundIdsForGIR = validSummaries.map((s: any) => s.round_id);
  const [teeResultRes, holesGIRRes, puttHolesRes, proStatsHolesRes] = await Promise.all([
    filteredRoundIds.length > 0
      ? supabase.from('holes').select('tee_result, par').in('round_id', filteredRoundIds).not('tee_result', 'is', null)
      : Promise.resolve({ data: [] as any[] }),
    validSummaries.length > 0
      ? supabase.from('holes').select('par, score, putts').in('round_id', roundIdsForGIR)
      : Promise.resolve({ data: [] as any[] }),
    validSummaries.length > 0
      ? supabase.from('holes').select('putts').in('round_id', roundIdsForGIR).not('putts', 'is', null)
      : Promise.resolve({ data: [] as any[] }),
    proRounds.length > 0
      ? supabase.from('pro_stats_holes').select('pro_round_id, par, score, putts, pro_shot_data').in('pro_round_id', proRounds.map(r => r.id))
      : Promise.resolve({ data: [] as any[] }),
  ]);

  const teeResultData = teeResultRes.data || [];
  const holesData = holesGIRRes.data || [];
  const puttHolesData = puttHolesRes.data || [];

  if (filteredRoundIds.length > 0 && teeResultData.length > 0) {
      let fairwaysHitCount = 0;
      let leftMissCount = 0;
      let rightMissCount = 0;
      let totalFairwayOpportunities = 0; // Total par 4s and 5s

      teeResultData.forEach(hole => {
        // Only count par 4s and 5s as fairway opportunities
        if (hole.par && hole.par >= 4) {
          totalFairwayOpportunities++;
          if (hole.tee_result === 'FIR') {
            fairwaysHitCount++;
          } else if (hole.tee_result === 'MissL') {
            leftMissCount++;
          } else if (hole.tee_result === 'MissR') {
            rightMissCount++;
          }
        }
      });

      if (totalFairwayOpportunities > 0) {
        accuracy = {
          ...accuracy,
          fairwaysHit: (fairwaysHitCount / totalFairwayOpportunities) * 100,
          leftMissPercentage: (leftMissCount / totalFairwayOpportunities) * 100,
          rightMissPercentage: (rightMissCount / totalFairwayOpportunities) * 100,
        };
      }
  }

  // GIR by par type from batch 3 holesData
  if (holesData.length > 0) {
    const girByPar = {
      par3: { gir: 0, total: 0 },
      par4: { gir: 0, total: 0 },
      par5: { gir: 0, total: 0 },
    };

    holesData.forEach((hole: any) => {
      if (hole.score && hole.par && hole.putts !== null) {
        const strokesBeforePutt = hole.score - hole.putts;
        const isGIR = strokesBeforePutt <= hole.par - 2;

        if (hole.par === 3) {
          girByPar.par3.total++;
          if (isGIR) girByPar.par3.gir++;
        } else if (hole.par === 4) {
          girByPar.par4.total++;
          if (isGIR) girByPar.par4.gir++;
        } else if (hole.par === 5) {
          girByPar.par5.total++;
          if (isGIR) girByPar.par5.gir++;
        }
      }
    });

    accuracy = {
      ...accuracy,
      girPar3: girByPar.par3.total > 0 ? (girByPar.par3.gir / girByPar.par3.total) * 100 : null,
      girPar4: girByPar.par4.total > 0 ? (girByPar.par4.gir / girByPar.par4.total) * 100 : null,
      girPar5: girByPar.par5.total > 0 ? (girByPar.par5.gir / girByPar.par5.total) * 100 : null,
    };
  }

  // Calculate putting stats - including putt distribution from hole data
  const totalPutts = validSummaries.reduce((sum, s) => sum + (s.total_putts || 0), 0);
  const totalHoles = validSummaries.reduce((sum, s) => sum + (s.holes_played || 0), 0);
  
  let putting: PuttingStats = {
    puttsPerHole: totalHoles > 0 
      ? totalPutts / totalHoles 
      : null,
    onePuttPercentage: null,
    twoPuttPercentage: null,
    threePuttPercentage: null,
    fourPlusPuttPercentage: null,
    threePuttAvoidance: validSummaries.length > 0 
      ? 100 - (validSummaries.reduce((sum, s) => sum + (s.three_putts || 0), 0) / validSummaries.reduce((sum, s) => sum + (s.holes_played || 0), 0)) * 100
      : null,
    puttsPerGIR: null,
  };

  // Putt distribution from batch 3 puttHolesData
  if (puttHolesData.length > 0) {
    let onePutts = 0, twoPutts = 0, threePutts = 0, fourPlusPutts = 0;

    puttHolesData.forEach((hole: any) => {
      if (hole.putts === 1) onePutts++;
      else if (hole.putts === 2) twoPutts++;
      else if (hole.putts === 3) threePutts++;
      else if (hole.putts !== null && hole.putts >= 4) fourPlusPutts++;
    });

    const totalHolesWithPutts = puttHolesData.length;
    putting = {
      ...putting,
      onePuttPercentage: totalHolesWithPutts > 0 ? (onePutts / totalHolesWithPutts) * 100 : null,
      twoPuttPercentage: totalHolesWithPutts > 0 ? (twoPutts / totalHolesWithPutts) * 100 : null,
      threePuttPercentage: totalHolesWithPutts > 0 ? (threePutts / totalHolesWithPutts) * 100 : null,
      fourPlusPuttPercentage: totalHolesWithPutts > 0 ? (fourPlusPutts / totalHolesWithPutts) * 100 : null,
    };
  }

  let strokesGained: StrokesGainedStats = {
    total: null,
    offTheTee: null,
    approach: null,
    shortGame: null,
    putting: null,
    other: null,
    scoring: null,
  };

  // Variables to accumulate pro stats data for Basic Stats
  // Fairways: compute as % per round (average of each round's fairway%)
  const proFairwaysByRound = new Map<string, { attempts: number; hits: number }>();
  let proGIRCount = 0;
  let proGIRAttempts = 0;
  let proScramblingSuccess = 0;
  let proScramblingAttempts = 0;
  let proTotalPutts = 0;
  let proHolesWithPutts = 0;
  let proOnePutts = 0;
  let proTwoPutts = 0;
  let proThreePutts = 0;
  let proFourPlusPutts = 0;
  let proLeftMissCount = 0;
  let proRightMissCount = 0;

  const proStatsHoles = proStatsHolesRes.data || [];
  if (proRounds.length > 0 && proStatsHoles.length > 0) {
    const holes = proStatsHoles;
      let sgTee = 0, sgApproach = 0, sgShort = 0, sgPutt = 0, sgOther = 0, sgScoring = 0;
      let totalDriverDistance = 0;
      let driverDistanceCount = 0;

      holes.forEach(hole => {
        const par = hole.par ?? 4;
        const putts = hole.putts;
        const shotData = hole.pro_shot_data as any;
        const shots = Array.isArray(shotData) ? shotData : null;

        // Left/right miss from basicStats (basic stats mode: fairwayResult 'hit'|'left'|'right')
        if (par >= 4 && shotData && typeof shotData === 'object' && !Array.isArray(shotData) && shotData.basicStats?.fairwayResult) {
          const fr = shotData.basicStats.fairwayResult;
          if (fr === 'left') { proLeftMissCount++; }
          else if (fr === 'right') { proRightMissCount++; }
        }

        // Left/right miss from shots array (pro stats: tee shot missed fairway = rough, bunker/sand, recovery, hazard, other, OB)
        const missedFairwayEndLies = ['rough', 'sand', 'bunker', 'recovery', 'hazard', 'other', 'OB'];
        if (par >= 4 && shots && Array.isArray(shots)) {
          const teeShot = shots.find((s: any) => s.type === 'tee');
          if (teeShot && teeShot.endLie && missedFairwayEndLies.includes(String(teeShot.endLie)) && (teeShot as any).missedSide) {
            const side = (teeShot as any).missedSide;
            if (side === 'left') proLeftMissCount++;
            else if (side === 'right') proRightMissCount++;
          }
        }

        if (shots && Array.isArray(shots)) {
          // Calculate strokes gained by category
          shots.forEach((shot, idx) => {
            const sg = shot.strokesGained || 0;
            const type = shot.type;
            const dist = shot.startDistance || 0;
            const startLie = shot.startLie;
            // Note: category field may not exist on all shots, so we categorize based on shot properties
            const category = (shot as any).category;
            
            // Calculate driver distance from tee shots
            if (type === 'tee' && shot.startDistance && shot.endDistance !== undefined) {
              const driverDist = shot.startDistance - shot.endDistance;
              if (driverDist > 0) {
                totalDriverDistance += driverDist;
                driverDistanceCount++;
              }
            }
            
            // Categorize strokes gained
            // First check if explicit category exists (for backwards compatibility)
            if (category === 'other') {
              sgOther += sg;
            } else if (category === 'scoring') {
              sgScoring += sg;
            } else if (type === 'putt' || startLie === 'green') {
              // Putting shots
              sgPutt += sg;
            } else if (idx === 0 && dist >= 200) {
              // First shot from 200m+ = tee shot
              sgTee += sg;
            } else if (dist >= 40) {
              // Shots from 40m+ = approach shots
              sgApproach += sg;
            } else if (dist > 0) {
              // Shots under 40m = short game
              sgShort += sg;
            } else {
              // Fallback to other
              sgOther += sg;
            }
          });

          // Calculate fairways hit (for par 4s and 5s)
          if (par >= 4) {
            const teeShot = shots.find(s => s.type === 'tee');
            if (teeShot && teeShot.endLie) {
              const proRoundId = (hole as any).pro_round_id as string | undefined;
              if (proRoundId) {
                const existing = proFairwaysByRound.get(proRoundId) ?? { attempts: 0, hits: 0 };
                existing.attempts += 1;
                if (teeShot.endLie === 'fairway') {
                  existing.hits += 1;
                }
                proFairwaysByRound.set(proRoundId, existing);
              }
            }
          }

          // Calculate GIR
          let strokeCount = 0;
          let hitGreen = false;
          const girTarget = par - 2;
          
          for (const shot of shots) {
            if (shot.isOB || shot.type === 'penalty') continue;
            strokeCount++;
            if (shot.endLie === 'green' || shot.holed) {
              hitGreen = true;
              break;
            }
          }
          
          if (hitGreen || shots.some(s => s.endLie === 'green' || s.holed)) {
            proGIRAttempts++;
            if (strokeCount <= girTarget) {
              proGIRCount++;
            }
          }

          // Calculate scrambling (up and down when missed GIR)
          const missedGIR = strokeCount > girTarget || !hitGreen;
          if (missedGIR) {
            // Find if they got up and down
            const nonGreenShots = shots.filter(s => s.startLie !== 'green' && s.type !== 'putt');
            const lastNonGreenShotIdx = shots.findIndex(s => s.endLie === 'green' || s.holed);
            
            if (lastNonGreenShotIdx > 0) {
              proScramblingAttempts++;
              // Check if they holed out in 2 strokes or less after reaching green area
              const shotsAfterMiss = shots.slice(lastNonGreenShotIdx);
              const puttCount = shotsAfterMiss.filter(s => s.type === 'putt' || s.startLie === 'green').length;
              if (puttCount <= 1 || shotsAfterMiss.some(s => s.holed && puttCount <= 1)) {
                proScramblingSuccess++;
              }
            }
          }
        }

        // Calculate putting stats
        if (putts !== null && putts !== undefined) {
          proTotalPutts += putts;
          proHolesWithPutts++;
          if (putts === 1) proOnePutts++;
          else if (putts === 2) proTwoPutts++;
          else if (putts === 3) proThreePutts++;
          else if (putts >= 4) proFourPlusPutts++;
        }
      });

      const roundCount = proRounds.length;
      if (roundCount > 0) {
        const total = sgTee + sgApproach + sgShort + sgPutt + sgOther + sgScoring;
        strokesGained = {
          total: total / roundCount,
          offTheTee: sgTee / roundCount,
          approach: sgApproach / roundCount,
          shortGame: sgShort / roundCount,
          putting: sgPutt / roundCount,
          other: sgOther !== 0 ? sgOther / roundCount : null,
          scoring: sgScoring !== 0 ? sgScoring / roundCount : null,
        };
        
        // Update accuracy with driver distance
        if (driverDistanceCount > 0) {
          accuracy = {
            ...accuracy,
            avgDriverDistance: totalDriverDistance / driverDistanceCount,
          };
        }
      }
  }

  // Merge pro stats into accuracy and putting if we have pro data
  // Pro stats take precedence if available, otherwise fall back to regular round data
  if (proFairwaysByRound.size > 0) {
    const perRoundPercentages: number[] = [];
    for (const { attempts, hits } of proFairwaysByRound.values()) {
      if (attempts > 0) {
        perRoundPercentages.push((hits / attempts) * 100);
      }
    }
    accuracy = {
      ...accuracy,
      fairwaysHit: perRoundPercentages.length > 0
        ? perRoundPercentages.reduce((sum, pct) => sum + pct, 0) / perRoundPercentages.length
        : null,
    };
  }

  // Calculate left/right miss percentages as percentages of total fairway opportunities (par 4s and 5s)
  let proTotalFairwayOpportunities = 0;
  for (const { attempts } of proFairwaysByRound.values()) {
    proTotalFairwayOpportunities += attempts;
  }
  // If no fairway data in pro_shot_data, use par from batch 3 pro_stats_holes
  if (proTotalFairwayOpportunities === 0 && proStatsHoles.length > 0) {
    proTotalFairwayOpportunities = proStatsHoles.filter((h: any) => (h.par ?? 4) >= 4).length;
  }

  if (proTotalFairwayOpportunities > 0) {
    accuracy = {
      ...accuracy,
      leftMissPercentage: (proLeftMissCount / proTotalFairwayOpportunities) * 100,
      rightMissPercentage: (proRightMissCount / proTotalFairwayOpportunities) * 100,
    };
  }
  
  if (proGIRAttempts > 0) {
    accuracy = {
      ...accuracy,
      greensInRegulation: (proGIRCount / proGIRAttempts) * 100,
    };
  }
  
  if (proScramblingAttempts > 0) {
    // Check if all greens were hit (no scramble opportunities)
    if (proGIRAttempts > 0 && proGIRCount === proGIRAttempts) {
      // All greens hit = no scramble opportunities = N/A
      accuracy = {
        ...accuracy,
        scrambling: null,
      };
    } else {
    accuracy = {
      ...accuracy,
      scrambling: (proScramblingSuccess / proScramblingAttempts) * 100,
    };
    }
  } else {
    // No scramble attempts at all = N/A
    // Only set to null if we have pro stats data, otherwise keep existing value
    if (proRounds && proRounds.length > 0) {
      accuracy = {
        ...accuracy,
        scrambling: null,
      };
    }
  }
  
  if (proHolesWithPutts > 0) {
    putting = {
      ...putting,
      puttsPerHole: proTotalPutts / proHolesWithPutts,
      onePuttPercentage: (proOnePutts / proHolesWithPutts) * 100,
      twoPuttPercentage: (proTwoPutts / proHolesWithPutts) * 100,
      threePuttPercentage: (proThreePutts / proHolesWithPutts) * 100,
      fourPlusPuttPercentage: (proFourPlusPutts / proHolesWithPutts) * 100,
      threePuttAvoidance: 100 - ((proThreePutts + proFourPlusPutts) / proHolesWithPutts) * 100,
    };
  }

  // Update roundsPlayed to include pro stats rounds if no regular rounds.
  // Use 18-hole count when we have round summaries so it matches Total Rounds / Scoring Average.
  const totalRoundsPlayed = validSummaries.length > 0 ? eighteenHoleRounds.length : (proRounds?.length || 0);

  return {
    scoring,
    strokesGained,
    accuracy,
    putting,
    roundsPlayed: totalRoundsPlayed,
  };
}

// Drill recommendations based on stats
export interface DrillRecommendation {
  drillId: string;
  drillTitle: string;
  category: string;
  reason: string;
  path: string;
}

export const getDrillRecommendations = (stats: AllStats): DrillRecommendation[] => {
  const recommendations: DrillRecommendation[] = [];

  // Putting recommendations
  if (stats.putting.puttsPerHole && stats.putting.puttsPerHole > 1.9) {
    recommendations.push({
      drillId: 'pga-tour-18',
      drillTitle: 'PGA Tour 18-hole',
      category: 'Putting',
      reason: 'Improve distance control and consistency',
      path: '/drill/pga-tour-18'
    });
    recommendations.push({
      drillId: 'aggressive-putting',
      drillTitle: 'Aggressive Putting 4-6m',
      category: 'Putting',
      reason: 'Build confidence on mid-range putts',
      path: '/drill/aggressive-putting'
    });
  }

  if (stats.strokesGained.putting !== null && stats.strokesGained.putting < -0.1) {
    recommendations.push({
      drillId: 'short-putting-test',
      drillTitle: 'Short Putt Test',
      category: 'Putting',
      reason: 'Losing strokes on the green - focus on short putts',
      path: '/drill/short-putting-test'
    });
    recommendations.push({
      drillId: 'jason-day-lag',
      drillTitle: 'Lag Putting Drill 8-20m',
      category: 'Putting',
      reason: 'Improve lag putting to reduce 3-putts',
      path: '/drill/jason-day-lag'
    });
  }

  // Short game recommendations
  if (stats.accuracy.scrambling !== null && stats.accuracy.scrambling < 40) {
    recommendations.push({
      drillId: '8-ball-drill',
      drillTitle: '8-Ball Circuit',
      category: 'Short Game',
      reason: 'Improve up-and-down percentage',
      path: '/drill/8-ball-drill'
    });
    recommendations.push({
      drillId: 'easy-chip',
      drillTitle: 'Easy Chip',
      category: 'Short Game',
      reason: 'Master basic chip shots',
      path: '/drill/easy-chip'
    });
  }

  if (stats.strokesGained.shortGame !== null && stats.strokesGained.shortGame < -0.1) {
    recommendations.push({
      drillId: 'up-downs-test',
      drillTitle: 'Up & Downs Test',
      category: 'Short Game',
      reason: 'Losing strokes around the green',
      path: '/drill/up-downs-test'
    });
  }

  // Approach recommendations
  if (stats.accuracy.greensInRegulation !== null && stats.accuracy.greensInRegulation < 40) {
    recommendations.push({
      drillId: 'approach-control',
      drillTitle: 'Approach Control 130-180m',
      category: 'Approach',
      reason: 'Hit more greens in regulation',
      path: '/drill/approach-control'
    });
    recommendations.push({
      drillId: 'wedges-progression',
      drillTitle: 'Wedge Ladder 60-120m',
      category: 'Wedges',
      reason: 'Improve wedge distance control',
      path: '/drill/wedges-progression'
    });
  }

  // Tee shot recommendations
  if (stats.accuracy.fairwaysHit !== null && stats.accuracy.fairwaysHit < 50) {
    recommendations.push({
      drillId: 'driver-control',
      drillTitle: 'Driver Control',
      category: 'Driving',
      reason: 'Find more fairways off the tee',
      path: '/drill/driver-control'
    });
    recommendations.push({
      drillId: 'shot-shape-master',
      drillTitle: 'Shot Shape Master',
      category: 'Full Swing',
      reason: 'Control your ball flight',
      path: '/drill/shot-shape-master'
    });
  }

  // Limit to top 4 recommendations
  return recommendations.slice(0, 4);
};

// Identify key insights
export interface StatInsight {
  area: string;
  status: 'strength' | 'weakness';
  message: string;
  value: string;
  category: 'putting' | 'short-game' | 'approach' | 'driving' | 'scoring';
}

export const getStatInsights = (stats: AllStats): StatInsight[] => {
  const insights: StatInsight[] = [];

  // Strokes Gained insights
  if (stats.strokesGained.putting !== null) {
    if (stats.strokesGained.putting >= 0.1) {
      insights.push({
        area: 'Putting',
        status: 'strength',
        message: 'You\'re gaining strokes on the greens',
        value: formatSG(stats.strokesGained.putting),
        category: 'putting'
      });
    } else if (stats.strokesGained.putting <= -0.1) {
      insights.push({
        area: 'Putting',
        status: 'weakness',
        message: 'You\'re losing strokes on the greens',
        value: formatSG(stats.strokesGained.putting),
        category: 'putting'
      });
    }
  }

  if (stats.strokesGained.shortGame !== null) {
    if (stats.strokesGained.shortGame >= 0.1) {
      insights.push({
        area: 'Short Game',
        status: 'strength',
        message: 'Strong around the green',
        value: formatSG(stats.strokesGained.shortGame),
        category: 'short-game'
      });
    } else if (stats.strokesGained.shortGame <= -0.1) {
      insights.push({
        area: 'Short Game',
        status: 'weakness',
        message: 'Losing strokes around the green',
        value: formatSG(stats.strokesGained.shortGame),
        category: 'short-game'
      });
    }
  }

  if (stats.strokesGained.approach !== null) {
    if (stats.strokesGained.approach >= 0.2) {
      insights.push({
        area: 'Approach Play',
        status: 'strength',
        message: 'Excellent iron play',
        value: formatSG(stats.strokesGained.approach),
        category: 'approach'
      });
    } else if (stats.strokesGained.approach <= -0.2) {
      insights.push({
        area: 'Approach Play',
        status: 'weakness',
        message: 'Iron play needs work',
        value: formatSG(stats.strokesGained.approach),
        category: 'approach'
      });
    }
  }

  if (stats.strokesGained.offTheTee !== null) {
    if (stats.strokesGained.offTheTee >= 0.2) {
      insights.push({
        area: 'Off the Tee',
        status: 'strength',
        message: 'Strong driving',
        value: formatSG(stats.strokesGained.offTheTee),
        category: 'driving'
      });
    } else if (stats.strokesGained.offTheTee <= -0.2) {
      insights.push({
        area: 'Off the Tee',
        status: 'weakness',
        message: 'Losing strokes off the tee',
        value: formatSG(stats.strokesGained.offTheTee),
        category: 'driving'
      });
    }
  }

  // Accuracy insights
  if (stats.accuracy.greensInRegulation !== null) {
    if (stats.accuracy.greensInRegulation >= 55) {
      insights.push({
        area: 'Greens in Regulation',
        status: 'strength',
        message: 'Hitting greens consistently',
        value: formatPercentage(stats.accuracy.greensInRegulation),
        category: 'approach'
      });
    } else if (stats.accuracy.greensInRegulation <= 35) {
      insights.push({
        area: 'Greens in Regulation',
        status: 'weakness',
        message: 'Missing too many greens',
        value: formatPercentage(stats.accuracy.greensInRegulation),
        category: 'approach'
      });
    }
  }

  if (stats.accuracy.scrambling !== null) {
    if (stats.accuracy.scrambling >= 50) {
      insights.push({
        area: 'Scrambling',
        status: 'strength',
        message: 'Great at saving par',
        value: formatPercentage(stats.accuracy.scrambling),
        category: 'short-game'
      });
    } else if (stats.accuracy.scrambling <= 30) {
      insights.push({
        area: 'Scrambling',
        status: 'weakness',
        message: 'Struggling to save par',
        value: formatPercentage(stats.accuracy.scrambling),
        category: 'short-game'
      });
    }
  }

  // Separate strengths and weaknesses
  const strengths = insights.filter(i => i.status === 'strength');
  const weaknesses = insights.filter(i => i.status === 'weakness');
  
  // Sort strengths by value (highest first) and keep only the best one
  strengths.sort((a, b) => {
    const aVal = parseFloat(a.value.replace('+', '').replace('%', ''));
    const bVal = parseFloat(b.value.replace('+', '').replace('%', ''));
    return bVal - aVal;
  });
  
  const bestStrength = strengths.length > 0 ? [strengths[0]] : [];
  
  // Return best strength first, then weaknesses
  return [...bestStrength, ...weaknesses];
};
