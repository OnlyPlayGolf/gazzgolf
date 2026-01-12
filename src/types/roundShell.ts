/**
 * RoundShell Types - Shared configuration for all game mode UI shells
 */

// The game mode types supported by RoundShell
export type GameMode = 
  | 'round' 
  | 'match_play' 
  | 'best_ball' 
  | 'copenhagen' 
  | 'scramble' 
  | 'skins' 
  | 'umbriago' 
  | 'wolf';

// Entry point for navigation - determines back button behavior
export type EntryPoint = 
  | 'home'              // Navigate to home on back
  | 'friends_on_course' // Navigate to home on back  
  | 'deep_link'         // Navigate to home on back
  | 'profile'           // Navigate to profile on back
  | 'default';          // Normal back navigation (history.back)

// View type for sorting behavior
export type ViewType = 'spectator' | 'participant';

// Tab types available in RoundShell
export type RoundShellTab = 'score' | 'leaderboard' | 'settings' | 'feed' | 'info';

// Player/Team data shape for leaderboard rendering
export interface LeaderboardRow {
  id: string;
  name: string;
  position: number;        // 1-indexed position for display
  isTied?: boolean;        // True if tied with another entry
  primaryValue: string | number;  // Main display value (score, points, etc.)
  secondaryValue?: string; // Secondary info (e.g., "Thru 15", "+2")
  avatarUrl?: string;      // Profile photo for individual players
  isCurrentUser?: boolean; // Highlight current user's row
}

// Score entry row configuration
export interface ScoreEntryRow {
  id: string;
  name: string;
  currentScore: number | null;
  onScoreChange: (score: number | null) => void;
  isActive?: boolean;      // Currently selected for input
  handicapStrokes?: number;
  avatarUrl?: string;
}

// Navigation context passed from parent
export interface RoundNavigationContext {
  entryPoint?: EntryPoint;
  returnPath?: string;     // Specific path to return to
}

// UI Override options for mode-specific customizations
export interface RoundShellOverrides {
  // Header customizations
  showModeLabel?: boolean;          // Show game mode badge (default: true)
  headerActions?: React.ReactNode;  // Extra buttons in header
  
  // Tab customizations
  hiddenTabs?: RoundShellTab[];     // Tabs to hide for this mode
  defaultTab?: RoundShellTab;       // Default active tab
  
  // Leaderboard customizations
  leaderboardSortKey?: string;      // Key to sort by (overrides default)
  sortAscending?: boolean;          // Sort direction (default: true for positions)
  
  // Score entry customizations
  showHoleNavigation?: boolean;     // Show hole prev/next (default: true)
  showParDisplay?: boolean;         // Show par for current hole (default: true)
  
  // Empty/Loading states
  emptyStateMessage?: string;
  loadingMessage?: string;
  
  // Styling overrides
  headerClassName?: string;
  contentClassName?: string;
}

// Main props for RoundShell component
export interface RoundShellProps {
  // Required identifiers
  gameId: string;
  mode: GameMode;
  
  // Data
  gameName: string;          // Round name or course name
  courseName?: string;       // Course name (if different from gameName)
  
  // Current state
  isLoading?: boolean;
  isSpectator?: boolean;
  
  // Hole-specific data (for score entry)
  currentHole?: number;
  totalHoles?: number;
  currentPar?: number;
  
  // Leaderboard data
  leaderboardRows?: LeaderboardRow[];
  
  // Score entry data
  scoreEntryRows?: ScoreEntryRow[];
  
  // Navigation
  navigationContext?: RoundNavigationContext;
  onBack?: () => void;       // Override default back behavior
  
  // Tab content - children for specific tabs
  children?: React.ReactNode;
  
  // Score entry controls
  onNavigateHole?: (direction: 'prev' | 'next') => void;
  onSaveScore?: () => void;
  
  // Mode-specific overrides
  overrides?: RoundShellOverrides;
  
  // Bottom tab bar component (mode-specific)
  BottomTabBar?: React.ComponentType<{ gameId: string }>;
  
  // Mode-specific additional header content
  headerExtra?: React.ReactNode;
  
  // Mode-specific score entry content (replaces default)
  scoreEntryContent?: React.ReactNode;
  
  // Mode-specific leaderboard content (replaces default)  
  leaderboardContent?: React.ReactNode;
}

// Default overrides - can be extended per mode
export const defaultOverrides: RoundShellOverrides = {
  showModeLabel: true,
  showHoleNavigation: true,
  showParDisplay: true,
  emptyStateMessage: 'No data yet',
  loadingMessage: 'Loading...',
};

// Mode display names
export const modeDisplayNames: Record<GameMode, string> = {
  round: 'Stroke Play',
  match_play: 'Match Play',
  best_ball: 'Best Ball',
  copenhagen: 'Copenhagen',
  scramble: 'Scramble',
  skins: 'Skins',
  umbriago: 'Umbriago',
  wolf: 'Wolf',
};
