import { useState, useEffect, useCallback } from "react";

const STORAGE_KEY_PREFIX = "stroke_play_enabled_";

/**
 * Hook to manage stroke play enabled state for a game.
 * Stroke Play is enabled by default for all games.
 */
export function useStrokePlayEnabled(gameId: string | undefined, gameType: string) {
  const [strokePlayEnabled, setStrokePlayEnabledState] = useState(true);

  const storageKey = gameId ? `${STORAGE_KEY_PREFIX}${gameType}_${gameId}` : null;

  useEffect(() => {
    if (!storageKey) return;
    
    // Check localStorage for saved preference (default is true)
    const saved = localStorage.getItem(storageKey);
    if (saved !== null) {
      setStrokePlayEnabledState(saved === "true");
    } else {
      // Default to true for new games
      setStrokePlayEnabledState(true);
    }
  }, [storageKey]);

  const setStrokePlayEnabled = useCallback((enabled: boolean) => {
    if (!storageKey) return;
    setStrokePlayEnabledState(enabled);
    localStorage.setItem(storageKey, String(enabled));
  }, [storageKey]);

  return { strokePlayEnabled, setStrokePlayEnabled };
}
