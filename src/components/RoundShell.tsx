/**
 * RoundShell - Shared UI shell for all game modes
 * 
 * This component provides:
 * - Standard header with back navigation
 * - Hole navigation bar
 * - Tab routing (Leaderboard, Score Entry, Settings, Feed, Info)
 * - Loading/empty/error states
 * - Spectator mode awareness for leaderboard sorting
 * 
 * Usage:
 * ```tsx
 * <RoundShell
 *   gameId={gameId}
 *   mode="best_ball"
 *   gameName={game.round_name || game.course_name}
 *   isSpectator={isSpectator}
 *   leaderboardContent={<MyLeaderboard />}
 *   scoreEntryContent={<MyScoreEntry />}
 *   BottomTabBar={BestBallBottomTabBar}
 * />
 * ```
 */

import React, { useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useRoundNavigation } from "@/hooks/useRoundNavigation";
import { 
  RoundShellProps, 
  LeaderboardRow, 
  defaultOverrides,
  modeDisplayNames,
} from "@/types/roundShell";

export function RoundShell({
  gameId,
  mode,
  gameName,
  courseName,
  isLoading = false,
  isSpectator = false,
  currentHole,
  totalHoles = 18,
  currentPar,
  leaderboardRows = [],
  navigationContext,
  onBack,
  children,
  onNavigateHole,
  overrides = {},
  BottomTabBar,
  headerExtra,
  scoreEntryContent,
  leaderboardContent,
}: RoundShellProps) {
  // Merge overrides with defaults
  const config = useMemo(() => ({
    ...defaultOverrides,
    ...overrides,
  }), [overrides]);

  // Navigation hook
  const { handleBack, viewType } = useRoundNavigation({
    gameId,
    mode,
    onBack,
  });

  // Sort leaderboard rows based on view type
  const sortedLeaderboardRows = useMemo(() => {
    if (!leaderboardRows || leaderboardRows.length === 0) return [];
    
    // In spectator mode, sort by position (ascending: 1, 2, 3...)
    // In participant mode, keep original order (as provided by parent)
    if (viewType === 'spectator' || isSpectator) {
      return [...leaderboardRows].sort((a, b) => a.position - b.position);
    }
    
    return leaderboardRows;
  }, [leaderboardRows, viewType, isSpectator]);

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen pb-24 flex items-center justify-center">
        <div className="text-muted-foreground">{config.loadingMessage}</div>
        {BottomTabBar && <BottomTabBar gameId={gameId} />}
      </div>
    );
  }

  return (
    <div className={`min-h-screen pb-24 bg-background ${config.contentClassName || ''}`}>
      {/* Header */}
      <div className={`bg-card border-b border-border ${config.headerClassName || ''}`}>
        <div className="p-4 max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-2">
            {/* Back Button */}
            <Button
              variant="ghost"
              size="icon"
              onClick={handleBack}
              className="rounded-full"
            >
              <ChevronLeft size={24} />
            </Button>
            
            {/* Title & Mode Label */}
            <div className="flex-1 text-center">
              <div className="flex items-center justify-center gap-2">
                <h1 className="text-xl font-bold">{gameName}</h1>
                {config.showModeLabel && (
                  <Badge variant="secondary" className="text-xs">
                    {modeDisplayNames[mode]}
                  </Badge>
                )}
              </div>
              {courseName && courseName !== gameName && (
                <p className="text-sm text-muted-foreground truncate">{courseName}</p>
              )}
            </div>
            
            {/* Header Actions */}
            <div className="w-10">
              {config.headerActions}
            </div>
          </div>
        </div>

        {/* Hole Navigation Bar - only show if showHoleNavigation and hole data provided */}
        {config.showHoleNavigation && currentHole !== undefined && (
          <div className="bg-primary py-4 px-4">
            <div className="max-w-2xl mx-auto flex items-center justify-between">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onNavigateHole?.('prev')}
                disabled={currentHole <= 1}
                className="text-primary-foreground hover:bg-primary/80 disabled:text-primary-foreground/50"
              >
                <ChevronLeft size={24} />
              </Button>

              <div className="text-center">
                {config.showParDisplay && currentPar !== undefined && (
                  <div className="text-sm text-white/90">PAR {currentPar}</div>
                )}
                <div className="text-2xl font-bold text-white">Hole {currentHole}</div>
              </div>

              <Button
                variant="ghost"
                size="icon"
                onClick={() => onNavigateHole?.('next')}
                disabled={currentHole >= totalHoles}
                className="text-primary-foreground hover:bg-primary/80 disabled:text-primary-foreground/50"
              >
                <ChevronRight size={24} />
              </Button>
            </div>
          </div>
        )}

        {/* Extra header content (mode-specific) */}
        {headerExtra}
      </div>

      {/* Main Content */}
      <div className="max-w-2xl mx-auto">
        {/* Mode-specific content is passed as children or specific content props */}
        {leaderboardContent || scoreEntryContent || children}
      </div>

      {/* Bottom Tab Bar */}
      {BottomTabBar && <BottomTabBar gameId={gameId} />}
    </div>
  );
}

/**
 * Helper hook to sort leaderboard data based on spectator status
 * Can be used independently of RoundShell for existing components
 */
export function useSortedLeaderboard<T extends { position?: number }>(
  rows: T[],
  isSpectator: boolean,
  sortKey: keyof T = 'position' as keyof T
): T[] {
  return useMemo(() => {
    if (!rows || rows.length === 0) return [];
    
    if (isSpectator) {
      return [...rows].sort((a, b) => {
        const aVal = a[sortKey];
        const bVal = b[sortKey];
        if (typeof aVal === 'number' && typeof bVal === 'number') {
          return aVal - bVal;
        }
        return 0;
      });
    }
    
    return rows;
  }, [rows, isSpectator, sortKey]);
}

/**
 * Empty state component for leaderboards/score entry
 */
export function RoundShellEmptyState({ 
  message = 'No data yet',
  icon,
}: { 
  message?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="p-8 text-center">
      {icon && <div className="mb-4 flex justify-center">{icon}</div>}
      <p className="text-muted-foreground">{message}</p>
    </div>
  );
}

/**
 * Loading state component
 */
export function RoundShellLoading({ message = 'Loading...' }: { message?: string }) {
  return (
    <div className="min-h-[200px] flex items-center justify-center">
      <div className="text-muted-foreground">{message}</div>
    </div>
  );
}

export default RoundShell;
