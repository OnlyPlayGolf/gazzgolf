import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface UseGameAdminStatusResult {
  isAdmin: boolean;
  isLoading: boolean;
  currentUserId: string | null;
  gameOwnerId: string | null;
}

type GameType = 'skins' | 'wolf' | 'best_ball' | 'match_play' | 'copenhagen' | 'umbriago' | 'scramble' | 'round';

/**
 * Hook to determine if the current user is the admin (creator) of a game.
 * @param gameType - The type of game table (e.g., 'skins', 'wolf', 'best_ball', etc.)
 * @param gameId - The ID of the game
 */
export function useGameAdminStatus(
  gameType: GameType,
  gameId: string | undefined
): UseGameAdminStatusResult {
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [gameOwnerId, setGameOwnerId] = useState<string | null>(null);

  useEffect(() => {
    const checkAdminStatus = async () => {
      if (!gameId) {
        setIsLoading(false);
        return;
      }

      try {
        // Get current user
        const { data: { user } } = await supabase.auth.getUser();
        setCurrentUserId(user?.id || null);

        if (!user) {
          setIsAdmin(false);
          setIsLoading(false);
          return;
        }

        // Fetch the game owner based on game type
        let ownerId: string | null = null;

        if (gameType === 'skins') {
          const { data } = await supabase.from('skins_games').select('user_id').eq('id', gameId).maybeSingle();
          ownerId = data?.user_id || null;
        } else if (gameType === 'wolf') {
          const { data } = await supabase.from('wolf_games').select('user_id').eq('id', gameId).maybeSingle();
          ownerId = data?.user_id || null;
        } else if (gameType === 'best_ball') {
          const { data } = await supabase.from('best_ball_games').select('user_id').eq('id', gameId).maybeSingle();
          ownerId = data?.user_id || null;
        } else if (gameType === 'match_play') {
          const { data } = await supabase.from('match_play_games').select('user_id').eq('id', gameId).maybeSingle();
          ownerId = data?.user_id || null;
        } else if (gameType === 'copenhagen') {
          const { data } = await supabase.from('copenhagen_games').select('user_id').eq('id', gameId).maybeSingle();
          ownerId = data?.user_id || null;
        } else if (gameType === 'umbriago') {
          const { data } = await supabase.from('umbriago_games').select('user_id').eq('id', gameId).maybeSingle();
          ownerId = data?.user_id || null;
        } else if (gameType === 'scramble') {
          const { data } = await supabase.from('scramble_games').select('user_id').eq('id', gameId).maybeSingle();
          ownerId = data?.user_id || null;
        } else if (gameType === 'round') {
          const { data } = await supabase.from('rounds').select('user_id').eq('id', gameId).maybeSingle();
          ownerId = data?.user_id || null;
        }

        setGameOwnerId(ownerId);
        setIsAdmin(user.id === ownerId);
      } catch (error) {
        console.error("Error checking admin status:", error);
      } finally {
        setIsLoading(false);
      }
    };

    checkAdminStatus();
  }, [gameType, gameId]);

  return { isAdmin, isLoading, currentUserId, gameOwnerId };
}
