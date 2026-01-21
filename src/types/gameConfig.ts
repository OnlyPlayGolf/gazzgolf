// AI-generated game configuration types

export interface HoleConfig {
  holeNumber: number;
  par?: number;
  strokeIndex?: number;
}

export interface PlayerTeeAssignment {
  playerIndex: number;
  playerName: string;
  defaultTee: string;
  holeOverrides?: {
    holeNumber: number;
    tee: string;
  }[];
}

export interface HandicapAdjustment {
  playerIndex: number;
  playerName: string;
  baseHandicap?: number;
  adjustedStrokes: number;
  reason: string;
}

export interface TeamConfig {
  teamId: string;
  teamName: string;
  playerIndices: number[];
  rotationSchedule?: {
    startHole: number;
    endHole: number;
    playerIndices: number[];
  }[];
}

export interface BonusRule {
  type: 'multiplier' | 'skins' | 'birdie_points' | 'par3_bonus' | 'custom';
  description: string;
  holes?: number[];
  value?: number;
  conditions?: string;
}

export interface MiniMatch {
  matchNumber: number;
  holes: number[];
  format?: string;
}

export interface GameConfiguration {
  // Base format
  baseFormat: 'stroke_play' | 'umbriago' | 'wolf' | 'stableford' | 'scramble' | 'best_ball' | 'copenhagen' | 'match_play' | 'skins' | 'custom';
  formatModifications?: string[];
  
  // Holes configuration
  holes: HoleConfig[];
  totalHoles: number;
  
  // Players and tees
  playerCount: number;
  playerNames?: string[];
  teeAssignments: PlayerTeeAssignment[];
  
  // Teams (if applicable)
  teams?: TeamConfig[];
  teamRotation?: boolean;
  
  // Game settings
  mulligansPerPlayer?: number;
  gimmesEnabled?: boolean;
  
  // Bonus rules and side games
  bonusRules?: BonusRule[];
  
  // Mini-matches (for segmented games)
  miniMatches?: MiniMatch[];
  
  // Handicap adjustments
  handicapAdjustments?: HandicapAdjustment[];
  
  // AI assumptions and notes
  assumptions: string[];
  notes?: string;
}

export interface AIMessage {
  role: 'user' | 'assistant';
  content: string;
  gameConfig?: GameConfiguration;
  configApplied?: boolean;
}

export interface AISetupState {
  messages: AIMessage[];
  currentConfig: GameConfiguration | null;
  isProcessing: boolean;
  error: string | null;
}
