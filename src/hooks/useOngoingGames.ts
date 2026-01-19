import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { User as SupabaseUser } from '@supabase/supabase-js';

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
  const [ongoingGames, setOngoingGames] = useState<OngoingGame[]>([]);
  const [loading, setLoading] = useState(true);

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
          .select('id, user_id, course_name, round_name, created_at')
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
      for (const round of rounds || []) {
        const isOwner = round.user_id === user.id;
        const isParticipant = participatingRoundIds.includes(round.id);
        if (isOwner || isParticipant) {
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

      // Sort by most recent
      games.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      setOngoingGames(games);
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
