import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { StatsMode } from '@/components/play/StatsModeSelector';

const LAST_STATS_MODE_KEY = 'lastPlayerStatsMode';

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
    let mounted = true;
    let channel: ReturnType<typeof supabase.channel> | null = null;

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

      if (data && mounted) {
        // Use existing mode for this game
        setStatsModeState(data.stats_mode as StatsMode);
      } else if (mounted) {
        // No mode set in player_game_stats_mode - check round's stats_mode as fallback
        if (gameType === 'round') {
          const { data: roundData } = await supabase
            .from('rounds')
            .select('stats_mode')
            .eq('id', gameId)
            .maybeSingle();
          
          if (roundData?.stats_mode && ['none', 'basic', 'strokes_gained'].includes(roundData.stats_mode)) {
            if (mounted) {
              setStatsModeState(roundData.stats_mode as StatsMode);
            }
            // Also save it to player_game_stats_mode for future consistency
            await supabase
              .from('player_game_stats_mode')
              .upsert({
                user_id: user.id,
                game_id: gameId,
                game_type: gameType,
                stats_mode: roundData.stats_mode,
              }, { onConflict: 'user_id,game_id,game_type' });
          } else if (mounted) {
            // Fall back to last saved preference
            const lastMode = localStorage.getItem(LAST_STATS_MODE_KEY) as StatsMode | null;
            if (lastMode && ['none', 'basic', 'strokes_gained'].includes(lastMode)) {
              setStatsModeState(lastMode);
            }
          }
        } else if (mounted) {
          // For other game types, use last saved preference as default
          const lastMode = localStorage.getItem(LAST_STATS_MODE_KEY) as StatsMode | null;
          if (lastMode && ['none', 'basic', 'strokes_gained'].includes(lastMode)) {
            setStatsModeState(lastMode);
          }
        }
      }
      
      if (mounted) {
        setLoading(false);
      }

      // Set up real-time subscription to listen for stats mode changes
      if (mounted && user && gameId) {
        channel = supabase
          .channel(`player-stats-mode-${gameId}-${user.id}`)
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'player_game_stats_mode',
              filter: `user_id=eq.${user.id} AND game_id=eq.${gameId} AND game_type=eq.${gameType}`,
            },
            (payload) => {
              if (!mounted) return;
              
              if (payload.new && (payload.new as any).stats_mode) {
                setStatsModeState((payload.new as any).stats_mode as StatsMode);
              } else if (payload.eventType === 'DELETE') {
                // If deleted, fall back to round's stats_mode or default
                if (gameType === 'round') {
                  supabase
                    .from('rounds')
                    .select('stats_mode')
                    .eq('id', gameId)
                    .maybeSingle()
                    .then(({ data: roundData }) => {
                      if (!mounted) return;
                      if (roundData?.stats_mode && ['none', 'basic', 'strokes_gained'].includes(roundData.stats_mode)) {
                        setStatsModeState(roundData.stats_mode as StatsMode);
                      } else {
                        const lastMode = localStorage.getItem(LAST_STATS_MODE_KEY) as StatsMode | null;
                        if (lastMode && ['none', 'basic', 'strokes_gained'].includes(lastMode)) {
                          setStatsModeState(lastMode);
                        } else {
                          setStatsModeState('none');
                        }
                      }
                    });
                } else {
                  const lastMode = localStorage.getItem(LAST_STATS_MODE_KEY) as StatsMode | null;
                  if (lastMode && ['none', 'basic', 'strokes_gained'].includes(lastMode)) {
                    setStatsModeState(lastMode);
                  } else {
                    setStatsModeState('none');
                  }
                }
              }
            }
          )
          .subscribe();
      }
    };

    loadUserAndMode();

    return () => {
      mounted = false;
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
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
      
      // Save as last used preference for future games
      localStorage.setItem(LAST_STATS_MODE_KEY, mode);
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
