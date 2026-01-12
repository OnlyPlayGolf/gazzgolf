import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { StatsMode } from '@/components/play/StatsModeSelector';

interface UsePlayerStatsModeReturn {
  statsMode: StatsMode;
  loading: boolean;
  saving: boolean;
  setStatsMode: (mode: StatsMode) => Promise<void>;
  deletePlayerStats: () => Promise<void>;
}

export function usePlayerStatsMode(
  gameId: string | undefined,
  gameType: string
): UsePlayerStatsModeReturn {
  const [statsMode, setStatsModeState] = useState<StatsMode>('none');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const loadUserAndMode = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !gameId) {
        setLoading(false);
        return;
      }
      
      setUserId(user.id);

      // Fetch player's stats mode for this game
      const { data } = await supabase
        .from('player_game_stats_mode')
        .select('stats_mode')
        .eq('user_id', user.id)
        .eq('game_id', gameId)
        .eq('game_type', gameType)
        .maybeSingle();

      if (data) {
        setStatsModeState(data.stats_mode as StatsMode);
      }
      
      setLoading(false);
    };

    loadUserAndMode();
  }, [gameId, gameType]);

  const setStatsMode = useCallback(async (mode: StatsMode) => {
    if (!userId || !gameId) return;
    
    setSaving(true);
    try {
      const { error } = await supabase
        .from('player_game_stats_mode')
        .upsert({
          user_id: userId,
          game_id: gameId,
          game_type: gameType,
          stats_mode: mode,
        }, { onConflict: 'user_id,game_id,game_type' });

      if (error) throw error;
      setStatsModeState(mode);
    } catch (error) {
      console.error('Error saving stats mode:', error);
      throw error;
    } finally {
      setSaving(false);
    }
  }, [userId, gameId, gameType]);

  const deletePlayerStats = useCallback(async () => {
    if (!userId || !gameId) return;

    try {
      // Find and delete pro_stats_rounds linked to this game for this user
      const { data: proRound } = await supabase
        .from('pro_stats_rounds')
        .select('id')
        .eq('user_id', userId)
        .eq('external_round_id', gameId)
        .maybeSingle();

      if (proRound) {
        // Delete all holes first
        await supabase
          .from('pro_stats_holes')
          .delete()
          .eq('pro_round_id', proRound.id);

        // Delete the round
        await supabase
          .from('pro_stats_rounds')
          .delete()
          .eq('id', proRound.id);
      }
    } catch (error) {
      console.error('Error deleting player stats:', error);
      throw error;
    }
  }, [userId, gameId]);

  return {
    statsMode,
    loading,
    saving,
    setStatsMode,
    deletePlayerStats,
  };
}
