import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

type GameType = 
  | 'best_ball' 
  | 'match_play' 
  | 'copenhagen' 
  | 'umbriago' 
  | 'wolf' 
  | 'scramble' 
  | 'skins' 
  | 'round';

const SUMMARY_PATH_MAP: Record<GameType, string> = {
  best_ball: 'best-ball',
  match_play: 'match-play',
  copenhagen: 'copenhagen',
  umbriago: 'umbriago',
  wolf: 'wolf',
  scramble: 'scramble',
  skins: 'skins',
  round: 'round',
};

interface UseGameAdminActionsProps {
  gameType: GameType;
  gameId: string | undefined;
  /** The user_id of the game owner (from game data) */
  gameOwnerId?: string | null;
}

interface UseGameAdminActionsResult {
  isAdmin: boolean;
  currentUserId: string | null;
  handleSaveAndExit: () => void;
  gameName: string;
}

export function useGameAdminActions({
  gameType,
  gameId,
  gameOwnerId,
}: UseGameAdminActionsProps): UseGameAdminActionsResult {
  const navigate = useNavigate();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    const loadUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUserId(user?.id || null);
    };
    loadUser();
  }, []);

  const isAdmin = currentUserId !== null && gameOwnerId !== null && currentUserId === gameOwnerId;

  const handleSaveAndExit = useCallback(() => {
    navigate('/profile');
  }, [navigate]);

  const gameNameMap: Record<GameType, string> = {
    best_ball: 'Best Ball Game',
    match_play: 'Match Play Game',
    copenhagen: 'Copenhagen Game',
    umbriago: 'Umbriago Game',
    wolf: 'Wolf Game',
    scramble: 'Scramble Game',
    skins: 'Skins Game',
    round: 'Round',
  };

  return {
    isAdmin,
    currentUserId,
    handleSaveAndExit,
    gameName: gameNameMap[gameType],
  };
}
