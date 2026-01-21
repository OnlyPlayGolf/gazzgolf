import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { User as SupabaseUser } from '@supabase/supabase-js';

/**
 * Extracts the round number from a round name pattern like "Event Name - Round 3"
 * Returns null if pattern doesn't match
 */
function extractRoundNumber(roundName: string | null | undefined): number | null {
  if (!roundName) return null;
  
  // Match patterns like "Event - Round 3" or "Event - Round 1"
  const match = roundName.match(/- Round (\d+)$/i);
  if (match && match[1]) {
    const roundNum = parseInt(match[1], 10);
    return isNaN(roundNum) ? null : roundNum;
  }
  
  return null;
}

/**
 * Filters stroke play rounds to show only the latest round from each multi-round game (same event_id)
 */
function filterMultiRoundOngoingGames(
  rounds: Array<{ id: string; event_id: string | null; round_name: string | null; created_at: string; user_id: string; course_name: string }>,
  games: OngoingGame[]
): OngoingGame[] {
  // Create a map of round id to event_id
  const roundEventMap = new Map<string, string | null>();
  for (const round of rounds) {
    roundEventMap.set(round.id, round.event_id);
  }
  
  // Separate stroke play games with event_id from others
  const strokePlayGamesWithEvent: Array<{ game: OngoingGame; eventId: string }> = [];
  const otherGames: OngoingGame[] = [];
  
  for (const game of games) {
    if (game.gameType === 'round') {
      const eventId = roundEventMap.get(game.id);
      if (eventId) {
        strokePlayGamesWithEvent.push({ game, eventId });
      } else {
        // Single round game (no event_id) - keep it
        otherGames.push(game);
      }
    } else {
      otherGames.push(game);
    }
  }
  
  // Group by event_id
  const gamesByEvent = new Map<string, OngoingGame[]>();
  
  for (const { game, eventId } of strokePlayGamesWithEvent) {
    if (!gamesByEvent.has(eventId)) {
      gamesByEvent.set(eventId, []);
    }
    gamesByEvent.get(eventId)!.push(game);
  }
  
  // For each event, keep only the latest round
  const filteredStrokePlayGames: OngoingGame[] = [];
  
  for (const [eventId, eventGames] of gamesByEvent.entries()) {
    if (eventGames.length === 1) {
      // Single round in event - keep it
      filteredStrokePlayGames.push(eventGames[0]);
    } else {
      // Multiple rounds - find the latest one
      let latestGame: OngoingGame | null = null;
      let highestRoundNumber: number | null = null;
      let latestCreatedAt: string | null = null;
      
      for (const game of eventGames) {
        const roundNumber = extractRoundNumber(game.roundName);
        
        if (roundNumber !== null) {
          // Use round number to determine latest
          if (highestRoundNumber === null || roundNumber > highestRoundNumber) {
            highestRoundNumber = roundNumber;
            latestGame = game;
          } else if (roundNumber === highestRoundNumber) {
            // Tie on round number - use created_at as tiebreaker
            if (!latestCreatedAt || game.createdAt > latestCreatedAt) {
              latestCreatedAt = game.createdAt;
              latestGame = game;
            }
          }
        } else {
          // Can't extract round number - use created_at
          if (latestCreatedAt === null || game.createdAt > latestCreatedAt) {
            latestCreatedAt = game.createdAt;
            latestGame = game;
          }
        }
      }
      
      // If we found a latest game, add it
      if (latestGame) {
        filteredStrokePlayGames.push(latestGame);
      }
    }
  }
  
  // Combine filtered stroke play games with other games
  return [...filteredStrokePlayGames, ...otherGames];
}

type GameType = 'round' | 'copenhagen' | 'skins' | 'best_ball' | 'scramble' | 'wolf' | 'umbriago' | 'match_play';

export interface OngoingGame {
  id: string;
  gameType: GameType;
  roundName: string | null;
  courseName: string;
  playerCount: number;
  createdAt: string;
  isOwner: boolean;
}

export function useOngoingGames(user: SupabaseUser | null): { ongoingGames: OngoingGame[]; loading: boolean; refresh: () => Promise<void> } {
  const [ongoingGames, setOngoingGames] = useState<OngoingGame[]>(() => []);
  const [loading, setLoading] = useState<boolean>(() => true);

  const loadOngoingGames = useCallback(async () => {
    if (!user) {
      setOngoingGames([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();
      const games: OngoingGame[] = [];

      // Fetch round_players to find rounds user participates in
      const { data: roundPlayers } = await supabase
        .from('round_players')
        .select('round_id')
        .eq('user_id', user.id);

      const participatingRoundIds = (roundPlayers || []).map(rp => rp.round_id);

      // Fetch all game types in parallel
      const [
        { data: rounds },
        { data: copenhagen },
        { data: skins },
        { data: bestBall },
        { data: scramble },
        { data: wolf },
        { data: umbriago },
        { data: matchPlay }
      ] = await Promise.all([
        // Only show ongoing stroke-play rounds created via Play (exclude tracker/add-stats rounds)
        supabase
          .from('rounds')
          .select('id, user_id, course_name, round_name, created_at, event_id')
          .gte('created_at', twelveHoursAgo)
          .eq('origin', 'play'),
        supabase.from('copenhagen_games').select('id, user_id, course_name, round_name, created_at, is_finished, player_1, player_2, player_3').gte('created_at', twelveHoursAgo).eq('is_finished', false),
        supabase.from('skins_games').select('id, user_id, course_name, round_name, created_at, is_finished, players').gte('created_at', twelveHoursAgo).eq('is_finished', false),
        supabase.from('best_ball_games').select('id, user_id, course_name, round_name, created_at, is_finished, team_a_players, team_b_players').gte('created_at', twelveHoursAgo).eq('is_finished', false),
        supabase.from('scramble_games').select('id, user_id, course_name, round_name, created_at, is_finished, teams').gte('created_at', twelveHoursAgo).eq('is_finished', false),
        supabase.from('wolf_games').select('id, user_id, course_name, round_name, created_at, is_finished, player_1, player_2, player_3, player_4, player_5, player_6').gte('created_at', twelveHoursAgo).eq('is_finished', false),
        supabase.from('umbriago_games').select('id, user_id, course_name, round_name, created_at, is_finished, team_a_player_1, team_a_player_2, team_b_player_1, team_b_player_2').gte('created_at', twelveHoursAgo).eq('is_finished', false),
        supabase.from('match_play_games').select('id, user_id, course_name, round_name, created_at, is_finished, player_1, player_2').gte('created_at', twelveHoursAgo).eq('is_finished', false),
      ]);

      // Batch fetch round_players counts for all rounds at once
      const roundIdsForCount = (rounds || []).map(r => r.id);
      const roundPlayerCounts = new Map<string, number>();
      if (roundIdsForCount.length > 0) {
        const { data: allRoundPlayers } = await supabase
          .from('round_players')
          .select('round_id')
          .in('round_id', roundIdsForCount);
        
        (allRoundPlayers || []).forEach(rp => {
          roundPlayerCounts.set(rp.round_id, (roundPlayerCounts.get(rp.round_id) || 0) + 1);
        });
      }

      // Process rounds - user owns or participates
      const processedRounds: Array<{ id: string; event_id: string | null; round_name: string | null; created_at: string; user_id: string; course_name: string }> = [];
      for (const round of rounds || []) {
        const isOwner = round.user_id === user.id;
        const isParticipant = participatingRoundIds.includes(round.id);
        if (isOwner || isParticipant) {
          processedRounds.push({
            id: round.id,
            event_id: round.event_id || null,
            round_name: round.round_name,
            created_at: round.created_at || '',
            user_id: round.user_id,
            course_name: round.course_name,
          });
          games.push({
            id: round.id,
            gameType: 'round',
            roundName: round.round_name,
            courseName: round.course_name,
            playerCount: roundPlayerCounts.get(round.id) || 1,
            createdAt: round.created_at || '',
            isOwner,
          });
        }
      }

      // Process other game types
      for (const game of copenhagen || []) {
        const isOwner = game.user_id === user.id;
        const isPlayer = [game.player_1, game.player_2, game.player_3].some(p => p && p.includes(user.id));
        if (isOwner || isPlayer) {
          games.push({
            id: game.id,
            gameType: 'copenhagen',
            roundName: game.round_name,
            courseName: game.course_name,
            playerCount: 3,
            createdAt: game.created_at || '',
            isOwner,
          });
        }
      }

      for (const game of skins || []) {
        const isOwner = game.user_id === user.id;
        const players = (game.players as any[]) || [];
        const isPlayer = players.some(p => p?.userId === user.id || p?.id === user.id);
        if (isOwner || isPlayer) {
          games.push({
            id: game.id,
            gameType: 'skins',
            roundName: game.round_name,
            courseName: game.course_name,
            playerCount: players.length,
            createdAt: game.created_at || '',
            isOwner,
          });
        }
      }

      for (const game of bestBall || []) {
        const isOwner = game.user_id === user.id;
        const teamA = (game.team_a_players as any[]) || [];
        const teamB = (game.team_b_players as any[]) || [];
        const allPlayers = [...teamA, ...teamB];
        const isPlayer = allPlayers.some(p => p?.userId === user.id || p?.id === user.id);
        if (isOwner || isPlayer) {
          games.push({
            id: game.id,
            gameType: 'best_ball',
            roundName: game.round_name,
            courseName: game.course_name,
            playerCount: allPlayers.length,
            createdAt: game.created_at || '',
            isOwner,
          });
        }
      }

      for (const game of scramble || []) {
        const isOwner = game.user_id === user.id;
        const teams = (game.teams as any[]) || [];
        const allPlayers = teams.flatMap(t => t?.players || []);
        const isPlayer = allPlayers.some(p => p?.userId === user.id || p?.id === user.id);
        if (isOwner || isPlayer) {
          games.push({
            id: game.id,
            gameType: 'scramble',
            roundName: game.round_name,
            courseName: game.course_name,
            playerCount: allPlayers.length,
            createdAt: game.created_at || '',
            isOwner,
          });
        }
      }

      for (const game of wolf || []) {
        const isOwner = game.user_id === user.id;
        const wolfPlayers = [game.player_1, game.player_2, game.player_3, game.player_4, game.player_5, game.player_6].filter(Boolean);
        const isPlayer = wolfPlayers.some(p => p && p.includes(user.id));
        if (isOwner || isPlayer) {
          games.push({
            id: game.id,
            gameType: 'wolf',
            roundName: game.round_name,
            courseName: game.course_name,
            playerCount: wolfPlayers.length,
            createdAt: game.created_at || '',
            isOwner,
          });
        }
      }

      for (const game of umbriago || []) {
        const isOwner = game.user_id === user.id;
        const umbriagoPlayers = [game.team_a_player_1, game.team_a_player_2, game.team_b_player_1, game.team_b_player_2].filter(Boolean);
        const isPlayer = umbriagoPlayers.some(p => p && p.includes(user.id));
        if (isOwner || isPlayer) {
          games.push({
            id: game.id,
            gameType: 'umbriago',
            roundName: game.round_name,
            courseName: game.course_name,
            playerCount: 4,
            createdAt: game.created_at || '',
            isOwner,
          });
        }
      }

      for (const game of matchPlay || []) {
        const isOwner = game.user_id === user.id;
        const matchPlayers = [game.player_1, game.player_2].filter(Boolean);
        const isPlayer = matchPlayers.some(p => p && p.includes(user.id));
        if (isOwner || isPlayer) {
          games.push({
            id: game.id,
            gameType: 'match_play',
            roundName: game.round_name,
            courseName: game.course_name,
            playerCount: 2,
            createdAt: game.created_at || '',
            isOwner,
          });
        }
      }

      // Filter multi-round stroke play games to show only latest round
      const filteredGames = filterMultiRoundOngoingGames(processedRounds, games);
      
      // Sort by most recent
      filteredGames.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      setOngoingGames(filteredGames);
    } catch (error) {
      console.error('Error loading ongoing games:', error);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadOngoingGames();
  }, [loadOngoingGames]);

  return { ongoingGames, loading, refresh: loadOngoingGames };
}
