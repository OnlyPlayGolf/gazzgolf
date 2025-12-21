import { supabase } from "@/integrations/supabase/client";
import { RoundCardData } from "@/components/RoundCard";

type GameType = 'round' | 'copenhagen' | 'skins' | 'best_ball' | 'scramble' | 'wolf' | 'umbriago' | 'match_play';

export interface UnifiedRound extends RoundCardData {
  gameType: GameType;
}

export async function loadUnifiedRounds(targetUserId: string): Promise<UnifiedRound[]> {
  const allRounds: UnifiedRound[] = [];

  // Fetch all data in parallel for efficiency
  const [
    participantRoundsRes,
    roundsDataRes,
    roundSummariesRes,
    copenhagenGamesRes,
    skinsGamesRes,
    bestBallGamesRes,
    scrambleGamesRes,
    wolfGamesRes,
    umbriagioGamesRes,
    matchPlayGamesRes
  ] = await Promise.all([
    supabase.from('round_players').select('round_id').eq('user_id', targetUserId),
    supabase.from('rounds').select('id, course_name, round_name, date_played, origin, user_id'),
    supabase.from('round_summaries').select('round_id, total_score, total_par, holes_played').eq('user_id', targetUserId),
    supabase.from('copenhagen_games').select('id, course_name, date_played, player_1, player_2, player_3, is_finished').eq('user_id', targetUserId),
    supabase.from('skins_games').select('id, course_name, date_played, players, is_finished').eq('user_id', targetUserId),
    supabase.from('best_ball_games').select('id, course_name, date_played, team_a_players, team_b_players, is_finished').eq('user_id', targetUserId),
    supabase.from('scramble_games').select('id, course_name, date_played, teams, is_finished').eq('user_id', targetUserId),
    supabase.from('wolf_games').select('id, course_name, date_played, player_1, player_2, player_3, player_4, player_5, is_finished').eq('user_id', targetUserId),
    supabase.from('umbriago_games').select('id, course_name, date_played, is_finished').eq('user_id', targetUserId),
    supabase.from('match_play_games').select('id, course_name, date_played, player_1, player_2, is_finished').eq('user_id', targetUserId)
  ]);

  const participantRoundIds = new Set(participantRoundsRes.data?.map(rp => rp.round_id) || []);
  const roundsData = roundsDataRes.data || [];
  const roundSummaries = roundSummariesRes.data || [];

  // Create a map of round summaries for quick lookup
  const summaryMap = new Map(roundSummaries.map(s => [s.round_id, s]));

  // Filter rounds where user is owner or participant
  const userRounds = roundsData.filter(round => {
    const isParticipant = round.user_id === targetUserId || participantRoundIds.has(round.id);
    const isPlayRound = !round.origin || round.origin === 'tracker' || round.origin === 'play';
    return isParticipant && isPlayRound;
  });

  // Get player counts for all rounds in one query
  const roundIds = userRounds.map(r => r.id);
  const { data: playerCountsData } = await supabase
    .from('round_players')
    .select('round_id')
    .in('round_id', roundIds);

  const playerCountMap = new Map<string, number>();
  for (const rp of playerCountsData || []) {
    playerCountMap.set(rp.round_id, (playerCountMap.get(rp.round_id) || 0) + 1);
  }

  // Process regular rounds
  for (const round of userRounds) {
    const summary = summaryMap.get(round.id);
    const scoreVsPar = summary ? (summary.total_score - summary.total_par) : 0;

    allRounds.push({
      id: round.id,
      course_name: round.course_name || 'Unknown Course',
      round_name: round.round_name,
      date: round.date_played,
      score: scoreVsPar,
      playerCount: playerCountMap.get(round.id) || 1,
      gameMode: 'Stroke Play',
      gameType: 'round'
    });
  }

  // Process Copenhagen games
  for (const game of copenhagenGamesRes.data || []) {
    allRounds.push({
      id: game.id,
      course_name: game.course_name,
      date: game.date_played,
      score: 0,
      playerCount: 3,
      gameMode: 'Copenhagen',
      gameType: 'copenhagen'
    });
  }

  // Process Skins games
  for (const game of skinsGamesRes.data || []) {
    const players = Array.isArray(game.players) ? game.players : [];
    allRounds.push({
      id: game.id,
      course_name: game.course_name,
      date: game.date_played,
      score: 0,
      playerCount: players.length || 2,
      gameMode: 'Skins',
      gameType: 'skins'
    });
  }

  // Process Best Ball games
  for (const game of bestBallGamesRes.data || []) {
    const teamA = Array.isArray(game.team_a_players) ? game.team_a_players : [];
    const teamB = Array.isArray(game.team_b_players) ? game.team_b_players : [];
    allRounds.push({
      id: game.id,
      course_name: game.course_name,
      date: game.date_played,
      score: 0,
      playerCount: teamA.length + teamB.length,
      gameMode: 'Best Ball',
      gameType: 'best_ball'
    });
  }

  // Process Scramble games
  for (const game of scrambleGamesRes.data || []) {
    const teams = Array.isArray(game.teams) ? game.teams : [];
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
      gameMode: 'Scramble',
      gameType: 'scramble'
    });
  }

  // Process Wolf games
  for (const game of wolfGamesRes.data || []) {
    const playerCount = [game.player_1, game.player_2, game.player_3, game.player_4, game.player_5]
      .filter(p => p && p.trim() !== '').length;
    allRounds.push({
      id: game.id,
      course_name: game.course_name,
      date: game.date_played,
      score: 0,
      playerCount,
      gameMode: 'Wolf',
      gameType: 'wolf'
    });
  }

  // Process Umbriago games
  for (const game of umbriagioGamesRes.data || []) {
    allRounds.push({
      id: game.id,
      course_name: game.course_name,
      date: game.date_played,
      score: 0,
      playerCount: 4,
      gameMode: 'Umbriago',
      gameType: 'umbriago'
    });
  }

  // Process Match Play games
  for (const game of matchPlayGamesRes.data || []) {
    allRounds.push({
      id: game.id,
      course_name: game.course_name,
      date: game.date_played,
      score: 0,
      playerCount: 2,
      gameMode: 'Match Play',
      gameType: 'match_play'
    });
  }

  // Sort all rounds by date (newest first)
  allRounds.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return allRounds;
}

export function getGameRoute(gameType: GameType, gameId: string): string {
  switch (gameType) {
    case 'round':
      return `/rounds/${gameId}/detail`;
    case 'copenhagen':
      return `/copenhagen/${gameId}/summary`;
    case 'skins':
      return `/skins/${gameId}/summary`;
    case 'best_ball':
      return `/best-ball/${gameId}/summary`;
    case 'scramble':
      return `/scramble/${gameId}/summary`;
    case 'wolf':
      return `/wolf/${gameId}/summary`;
    case 'umbriago':
      return `/umbriago/${gameId}/summary`;
    case 'match_play':
      return `/match-play/${gameId}/summary`;
    default:
      return `/rounds/${gameId}/detail`;
  }
}
