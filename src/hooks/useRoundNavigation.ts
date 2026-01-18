import { useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { useCallback, useMemo } from "react";
import { EntryPoint, GameMode } from "@/types/roundShell";

interface UseRoundNavigationOptions {
  gameId: string;
  mode: GameMode;
  onBack?: () => void;         // Custom back handler
  fallbackPath?: string;       // Fallback if no history
}

interface RoundNavigationResult {
  entryPoint: EntryPoint;
  viewType: 'spectator' | 'participant';
  handleBack: () => void;
  navigateToTab: (tab: string) => void;
  getTabPath: (tab: string) => string;
}

/**
 * Hook for standardized navigation across all game modes.
 * 
 * Reads `entryPoint` and `viewType` from URL search params to determine:
 * - Back button behavior
 * - Leaderboard sorting behavior
 * 
 * Usage:
 * ```tsx
 * const { entryPoint, viewType, handleBack } = useRoundNavigation({
 *   gameId,
 *   mode: 'best_ball',
 * });
 * ```
 */
export function useRoundNavigation({
  gameId,
  mode,
  onBack,
  fallbackPath = '/',
}: UseRoundNavigationOptions): RoundNavigationResult {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  // Extract navigation params from URL
  const entryPoint = useMemo(() => {
    const param = searchParams.get('entryPoint');
    if (param === 'home' || param === 'friends_on_course' || param === 'deep_link' || param === 'profile') {
      return param as EntryPoint;
    }
    return 'default' as EntryPoint;
  }, [searchParams]);

  const viewType = useMemo(() => {
    const param = searchParams.get('viewType');
    if (param === 'spectator') return 'spectator';
    return 'participant';
  }, [searchParams]);

  // Get the base path for this game mode
  const getModePath = useCallback((gameMode: GameMode): string => {
    switch (gameMode) {
      case 'match_play': return 'match-play';
      case 'best_ball': return 'best-ball';
      default: return gameMode;
    }
  }, []);

  // Get full path for a tab
  const getTabPath = useCallback((tab: string): string => {
    const basePath = `/${getModePath(mode)}/${gameId}`;
    // Preserve query params when navigating between tabs
    const queryString = searchParams.toString();
    const path = `${basePath}/${tab}`;
    return queryString ? `${path}?${queryString}` : path;
  }, [mode, gameId, searchParams, getModePath]);

  // Navigate to a specific tab
  const navigateToTab = useCallback((tab: string) => {
    navigate(getTabPath(tab));
  }, [navigate, getTabPath]);

  // Handle back navigation based on entry point
  const handleBack = useCallback(() => {
    // If custom handler provided, use it
    if (onBack) {
      onBack();
      return;
    }

    // Determine where to go based on entry point
    switch (entryPoint) {
      case 'home':
      case 'friends_on_course':
      case 'deep_link':
        navigate('/');
        break;
      case 'profile':
        navigate('/profile');
        break;
      case 'default':
      default:
        // Try to go back in history, fallback to home if no history
        if (window.history.length > 1) {
          navigate(-1);
        } else {
          navigate(fallbackPath);
        }
        break;
    }
  }, [entryPoint, navigate, onBack, fallbackPath]);

  return {
    entryPoint,
    viewType,
    handleBack,
    navigateToTab,
    getTabPath,
  };
}

/**
 * Helper to build navigation URL with entryPoint param
 */
export function buildGameUrl(
  mode: GameMode,
  gameId: string,
  tab: string = 'leaderboard',
  options?: { entryPoint?: EntryPoint; viewType?: 'spectator' | 'participant' }
): string {
  const modePath = mode === 'match_play' ? 'match-play' : mode === 'best_ball' ? 'best-ball' : mode === 'round' ? 'rounds' : mode;
  let url = `/${modePath}/${gameId}/${tab}`;
  
  const params = new URLSearchParams();
  if (options?.entryPoint && options.entryPoint !== 'default') {
    params.set('entryPoint', options.entryPoint);
  }
  if (options?.viewType === 'spectator') {
    params.set('viewType', 'spectator');
  }
  
  const queryString = params.toString();
  return queryString ? `${url}?${queryString}` : url;
}
