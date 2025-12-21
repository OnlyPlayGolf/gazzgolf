import { supabase } from "@/integrations/supabase/client";
import { RoundCardData } from "@/components/RoundCard";

type GameType = 'round' | 'copenhagen' | 'skins' | 'best_ball' | 'scramble' | 'wolf' | 'umbriago' | 'match_play';

export interface UnifiedRound extends RoundCardData {
  gameType: GameType;
}

export async function loadUnifiedRounds(targetUserId: string): Promise<UnifiedRound[]> {
  const allRounds: UnifiedRound[] = [];

  // 1. Load regular rounds (where user is owner or participant)
  const { data: participantRounds } = await supabase
    .from('round_players')
    .select('round_id')
    .eq('user_id', targetUserId);
  
  const participantRoundIds = participantRounds?.map(rp => rp.round_id) || [];

  const { data: roundsData } = await supabase
    .from('rounds')
    .select('id, course_name, round_name, date_played, origin, user_id')
    .order('date_played', { ascending: false });
  
  const userRounds = (roundsData || []).filter(round => {
    const isParticipant = round.user_id === targetUserId || participantRoundIds.includes(round.id);
    const isPlayRound = !round.origin || round.origin === 'tracker' || round.origin === 'play';
    return isParticipant && isPlayRound;
  });

  for (const round of userRounds) {
    const { data: holesData } = await supabase
      .from('holes')
      .select('score, par')
      .eq('round_id', round.id);

    const { count: playerCount } = await supabase
      .from('round_players')
      .select('*', { count: 'exact', head: true })
      .eq('round_id', round.id);

    const totalScore = holesData?.reduce((sum, hole) => sum + hole.score, 0) || 0;
    const totalPar = holesData?.reduce((sum, hole) => sum + hole.par, 0) || 0;

    allRounds.push({
      id: round.id,
      course_name: round.course_name || 'Unknown Course',
      round_name: round.round_name,
      date: round.date_played,
      score: totalScore - totalPar,
      playerCount: playerCount || 1,
      gameMode: 'Stroke Play',
      gameType: 'round'
    });
  }

  // 2. Load Copenhagen games
  const { data: copenhagenGames } = await supabase
    .from('copenhagen_games')
    .select('id, course_name, date_played, player_1, player_2, player_3, is_finished')
    .eq('user_id', targetUserId)
    .order('date_played', { ascending: false });

  for (const game of copenhagenGames || []) {
    allRounds.push({
      id: game.id,
      course_name: game.course_name,
      date: game.date_played,
      score: 0, // Copenhagen uses points, not strokes
      playerCount: 3,
      gameMode: 'Copenhagen',
      gameType: 'copenhagen'
    });
  }

  // 3. Load Skins games
  const { data: skinsGames } = await supabase
    .from('skins_games')
    .select('id, course_name, date_played, players, is_finished')
    .eq('user_id', targetUserId)
    .order('date_played', { ascending: false });

  for (const game of skinsGames || []) {
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

  // 4. Load Best Ball games
  const { data: bestBallGames } = await supabase
    .from('best_ball_games')
    .select('id, course_name, date_played, team_a_players, team_b_players, is_finished')
    .eq('user_id', targetUserId)
    .order('date_played', { ascending: false });

  for (const game of bestBallGames || []) {
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

  // 5. Load Scramble games
  const { data: scrambleGames } = await supabase
    .from('scramble_games')
    .select('id, course_name, date_played, teams, is_finished')
    .eq('user_id', targetUserId)
    .order('date_played', { ascending: false });

  for (const game of scrambleGames || []) {
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

  // 6. Load Wolf games
  const { data: wolfGames } = await supabase
    .from('wolf_games')
    .select('id, course_name, date_played, player_1, player_2, player_3, player_4, player_5, is_finished')
    .eq('user_id', targetUserId)
    .order('date_played', { ascending: false });

  for (const game of wolfGames || []) {
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

  // 7. Load Umbriago games
  const { data: umbriagioGames } = await supabase
    .from('umbriago_games')
    .select('id, course_name, date_played, is_finished')
    .eq('user_id', targetUserId)
    .order('date_played', { ascending: false });

  for (const game of umbriagioGames || []) {
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

  // 8. Load Match Play games
  const { data: matchPlayGames } = await supabase
    .from('match_play_games')
    .select('id, course_name, date_played, player_1, player_2, is_finished')
    .eq('user_id', targetUserId)
    .order('date_played', { ascending: false });

  for (const game of matchPlayGames || []) {
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
