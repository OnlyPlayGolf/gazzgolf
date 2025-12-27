import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface SpectatorCheckResult {
  isSpectator: boolean;
  isLoading: boolean;
  currentUserId: string | null;
}

/**
 * Hook to determine if the current user is a spectator for a round/game.
 * A user is a spectator if they are not the owner and not a participant.
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

        if (gameType === 'round') {
          // Check if user is round owner
          const { data: roundData } = await supabase
            .from('rounds')
            .select('user_id')
            .eq('id', gameId)
            .single();

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
          const { data } = await supabase.from('match_play_games').select('user_id').eq('id', gameId).single();
          isParticipant = data?.user_id === user.id;
        } else if (gameType === 'best_ball') {
          const { data } = await supabase.from('best_ball_games').select('user_id').eq('id', gameId).single();
          isParticipant = data?.user_id === user.id;
        } else if (gameType === 'copenhagen') {
          const { data } = await supabase.from('copenhagen_games').select('user_id').eq('id', gameId).single();
          isParticipant = data?.user_id === user.id;
        } else if (gameType === 'scramble') {
          const { data } = await supabase.from('scramble_games').select('user_id').eq('id', gameId).single();
          isParticipant = data?.user_id === user.id;
        } else if (gameType === 'skins') {
          const { data } = await supabase.from('skins_games').select('user_id').eq('id', gameId).single();
          isParticipant = data?.user_id === user.id;
        } else if (gameType === 'umbriago') {
          const { data } = await supabase.from('umbriago_games').select('user_id').eq('id', gameId).single();
          isParticipant = data?.user_id === user.id;
        } else if (gameType === 'wolf') {
          const { data } = await supabase.from('wolf_games' as any).select('user_id').eq('id', gameId).single();
          isParticipant = (data as any)?.user_id === user.id;
        }

        setIsSpectator(!isParticipant);
      } catch (error) {
        console.error('Error checking spectator status:', error);
        setIsSpectator(true);
      } finally {
        setIsLoading(false);
      }
    };

    checkSpectatorStatus();
  }, [gameType, gameId]);

  return { isSpectator, isLoading, currentUserId };
}
