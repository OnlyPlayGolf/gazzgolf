import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface SpectatorCheckResult {
  isSpectator: boolean;
  isLoading: boolean;
  currentUserId: string | null;
  isEditWindowExpired: boolean;
}

const EDIT_WINDOW_HOURS = 12;

/**
 * Check if the 12-hour editing window has expired after a round finishes
 */
function isEditingWindowExpired(isFinished: boolean, createdAt: string | null): boolean {
  if (!isFinished || !createdAt) return false;
  
  const createdDate = new Date(createdAt);
  const now = new Date();
  const hoursSinceCreation = (now.getTime() - createdDate.getTime()) / (1000 * 60 * 60);
  
  // For finished games, check if 12 hours have passed since creation
  // (We use created_at as a proxy since we don't have a finished_at timestamp)
  return hoursSinceCreation > EDIT_WINDOW_HOURS;
}

/**
 * Hook to determine if the current user is a spectator for a round/game.
 * A user is a spectator if:
 * 1. They are not the owner and not a participant, OR
 * 2. The game is finished and 12 hours have passed (editing window expired)
 * 
 * @param gameType - The type of game ('round' | 'match_play' | 'best_ball' | 'copenhagen' | 'scramble' | 'skins' | 'umbriago' | 'wolf')
 * @param gameId - The ID of the game/round
 */
export function useIsSpectator(
  gameType: 'round' | 'match_play' | 'best_ball' | 'copenhagen' | 'scramble' | 'skins' | 'umbriago' | 'wolf',
  gameId: string | undefined
): SpectatorCheckResult {
  const [isSpectator, setIsSpectator] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isEditWindowExpired, setIsEditWindowExpired] = useState(false);

  useEffect(() => {
    if (!gameId) {
      setIsLoading(false);
      return;
    }

    const checkSpectatorStatus = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setIsSpectator(true);
          setIsLoading(false);
          return;
        }
        
        setCurrentUserId(user.id);
        
        let isParticipant = false;
        let isFinished = false;
        let createdAt: string | null = null;

        if (gameType === 'round') {
          // Check if user is round owner
          const { data: roundData } = await supabase
            .from('rounds')
            .select('user_id, created_at')
            .eq('id', gameId)
            .single();

          // Rounds don't have is_finished flag, so we check holes_played
          const { data: holesData } = await supabase
            .from('holes')
            .select('id')
            .eq('round_id', gameId);
          
          // A round is "finished" if it has any holes recorded (simple heuristic)
          // For more accuracy, we'd need an is_finished flag on rounds table
          isFinished = false; // Rounds don't auto-finish like other game types
          createdAt = roundData?.created_at || null;

          if (roundData?.user_id === user.id) {
            isParticipant = true;
          } else {
            // Check if user is a round player
            const { data: playerData } = await supabase
              .from('round_players')
              .select('id')
              .eq('round_id', gameId)
              .eq('user_id', user.id)
              .maybeSingle();

            isParticipant = !!playerData;
          }
        } else if (gameType === 'match_play') {
          const { data } = await supabase.from('match_play_games').select('user_id, is_finished, created_at').eq('id', gameId).single();
          isParticipant = data?.user_id === user.id;
          isFinished = data?.is_finished || false;
          createdAt = data?.created_at || null;
        } else if (gameType === 'best_ball') {
          const { data } = await supabase.from('best_ball_games').select('user_id, is_finished, created_at').eq('id', gameId).single();
          isParticipant = data?.user_id === user.id;
          isFinished = data?.is_finished || false;
          createdAt = data?.created_at || null;
        } else if (gameType === 'copenhagen') {
          const { data } = await supabase.from('copenhagen_games').select('user_id, is_finished, created_at').eq('id', gameId).single();
          isParticipant = data?.user_id === user.id;
          isFinished = data?.is_finished || false;
          createdAt = data?.created_at || null;
        } else if (gameType === 'scramble') {
          const { data } = await supabase.from('scramble_games').select('user_id, is_finished, created_at').eq('id', gameId).single();
          isParticipant = data?.user_id === user.id;
          isFinished = data?.is_finished || false;
          createdAt = data?.created_at || null;
        } else if (gameType === 'skins') {
          const { data } = await supabase.from('skins_games').select('user_id, is_finished, created_at').eq('id', gameId).single();
          isParticipant = data?.user_id === user.id;
          isFinished = data?.is_finished || false;
          createdAt = data?.created_at || null;
        } else if (gameType === 'umbriago') {
          const { data } = await supabase.from('umbriago_games').select('user_id, is_finished, created_at').eq('id', gameId).single();
          isParticipant = data?.user_id === user.id;
          isFinished = data?.is_finished || false;
          createdAt = data?.created_at || null;
        } else if (gameType === 'wolf') {
          const { data } = await supabase.from('wolf_games' as any).select('user_id, is_finished, created_at').eq('id', gameId).single();
          isParticipant = (data as any)?.user_id === user.id;
          isFinished = (data as any)?.is_finished || false;
          createdAt = (data as any)?.created_at || null;
        }

        // Check if the 12-hour editing window has expired
        const editWindowExpired = isEditingWindowExpired(isFinished, createdAt);
        setIsEditWindowExpired(editWindowExpired);

        // User is spectator if not a participant OR if edit window has expired
        setIsSpectator(!isParticipant || editWindowExpired);
      } catch (error) {
        console.error('Error checking spectator status:', error);
        setIsSpectator(true);
      } finally {
        setIsLoading(false);
      }
    };

    checkSpectatorStatus();
  }, [gameType, gameId]);

  return { isSpectator, isLoading, currentUserId, isEditWindowExpired };
}
