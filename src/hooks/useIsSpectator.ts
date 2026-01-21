import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface SpectatorCheckResult {
  isSpectator: boolean;
  isLoading: boolean;
  currentUserId: string | null;
  isEditWindowExpired: boolean;
}

const EDIT_WINDOW_HOURS = 24;

/**
 * Check if the 24-hour editing window has expired after a round finishes
 */
function isEditingWindowExpired(isFinished: boolean, createdAt: string | null): boolean {
  if (!isFinished || !createdAt) return false;
  
  const createdDate = new Date(createdAt);
  const now = new Date();
  const hoursSinceCreation = (now.getTime() - createdDate.getTime()) / (1000 * 60 * 60);
  
  // For finished games, check if 24 hours have passed since creation
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
        let lockReferenceTime: string | null = null; // For multi-round tournaments

        if (gameType === 'round') {
          // Check if user is round owner
          const { data: roundData } = await supabase
            .from('rounds')
            .select('user_id, created_at, event_id')
            .eq('id', gameId)
            .maybeSingle();

          // Rounds don't have is_finished flag, so we check if holes have been recorded
          const { data: holesData } = await supabase
            .from('holes')
            .select('id')
            .eq('round_id', gameId);
          
          // A round is "finished" if it has any holes recorded (round has been started)
          // Once finished, editing is locked 24 hours after the round was created
          isFinished = (holesData?.length || 0) > 0;
          createdAt = roundData?.created_at || null;

          // For multi-round tournaments, use the last round's created_at for lock calculation
          lockReferenceTime = createdAt;
          if (roundData?.event_id) {
            const { data: eventRounds } = await supabase
              .from('rounds')
              .select('created_at')
              .eq('event_id', roundData.event_id)
              .order('created_at', { ascending: false })
              .limit(1);
            
            if (eventRounds && eventRounds.length > 0) {
              lockReferenceTime = eventRounds[0].created_at;
            }
          }

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
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/04be59d6-47f1-4996-9a2e-5e7d80a7add1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useIsSpectator.ts:100',message:'Before match_play_games.maybeSingle()',data:{gameId,gameType},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
          // #endregion
          const { data, error } = await supabase.from('match_play_games').select('user_id, is_finished, created_at').eq('id', gameId).maybeSingle();
          // #region agent log
          if(error) fetch('http://127.0.0.1:7242/ingest/04be59d6-47f1-4996-9a2e-5e7d80a7add1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useIsSpectator.ts:100',message:'match_play_games.maybeSingle() ERROR',data:{errorCode:error.code,errorMessage:error.message,errorDetails:error.details,gameId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
          // #endregion
          isParticipant = data?.user_id === user.id;
          isFinished = data?.is_finished || false;
          createdAt = data?.created_at || null;
        } else if (gameType === 'best_ball') {
          const { data } = await supabase.from('best_ball_games').select('user_id, is_finished, created_at').eq('id', gameId).maybeSingle();
          isParticipant = data?.user_id === user.id;
          isFinished = data?.is_finished || false;
          createdAt = data?.created_at || null;
        } else if (gameType === 'copenhagen') {
          const { data } = await supabase.from('copenhagen_games').select('user_id, is_finished, created_at').eq('id', gameId).maybeSingle();
          isParticipant = data?.user_id === user.id;
          isFinished = data?.is_finished || false;
          createdAt = data?.created_at || null;
        } else if (gameType === 'scramble') {
          const { data } = await supabase.from('scramble_games').select('user_id, is_finished, created_at').eq('id', gameId).maybeSingle();
          isParticipant = data?.user_id === user.id;
          isFinished = data?.is_finished || false;
          createdAt = data?.created_at || null;
        } else if (gameType === 'skins') {
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/04be59d6-47f1-4996-9a2e-5e7d80a7add1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useIsSpectator.ts:120',message:'Before skins_games.maybeSingle()',data:{gameId,gameType},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
          // #endregion
          const { data, error } = await supabase.from('skins_games').select('user_id, is_finished, created_at, players').eq('id', gameId).maybeSingle();
          // #region agent log
          if(error) fetch('http://127.0.0.1:7242/ingest/04be59d6-47f1-4996-9a2e-5e7d80a7add1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useIsSpectator.ts:120',message:'skins_games.maybeSingle() ERROR',data:{errorCode:error.code,errorMessage:error.message,errorDetails:error.details,gameId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
          // #endregion
          // Check if user is owner OR in the players array
          const players = Array.isArray(data?.players) ? data.players as { odId: string }[] : [];
          isParticipant = data?.user_id === user.id || players.some(p => p.odId === user.id);
          isFinished = data?.is_finished || false;
          createdAt = data?.created_at || null;
        } else if (gameType === 'umbriago') {
          const { data } = await supabase.from('umbriago_games').select('user_id, is_finished, created_at').eq('id', gameId).maybeSingle();
          isParticipant = data?.user_id === user.id;
          isFinished = data?.is_finished || false;
          createdAt = data?.created_at || null;
        } else if (gameType === 'wolf') {
          const { data } = await supabase.from('wolf_games' as any).select('user_id, is_finished, created_at').eq('id', gameId).maybeSingle();
          isParticipant = (data as any)?.user_id === user.id;
          isFinished = (data as any)?.is_finished || false;
          createdAt = (data as any)?.created_at || null;
        }

        // Check if the 24-hour editing window has expired
        // For rounds: lock if finished (has holes) OR if round is older than 24 hours (regardless of holes)
        // For multi-round tournaments, use the last round's created_at for the lock calculation
        let editWindowExpired = false;
        if (gameType === 'round') {
          if (isFinished) {
            // Round has holes - use lock reference time (last round in event, or this round)
            editWindowExpired = isEditingWindowExpired(isFinished, lockReferenceTime);
          } else if (lockReferenceTime) {
            // Round has no holes yet, but check if lock reference time is older than 24 hours
            const referenceDate = new Date(lockReferenceTime);
            const now = new Date();
            const hoursSinceReference = (now.getTime() - referenceDate.getTime()) / (1000 * 60 * 60);
            editWindowExpired = hoursSinceReference > EDIT_WINDOW_HOURS;
          }
        } else {
          // For other game types, use standard logic
          editWindowExpired = isEditingWindowExpired(isFinished, createdAt);
        }
        setIsEditWindowExpired(editWindowExpired);

        // User is spectator ONLY if not a participant
        // The edit window expiry is tracked separately and should NOT make owners into spectators
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

  return { isSpectator, isLoading, currentUserId, isEditWindowExpired };
}
