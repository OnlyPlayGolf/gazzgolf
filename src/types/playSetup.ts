// Types for Play Page setup

export type GameFormatId = "stroke_play" | "stableford" | "umbriago" | "wolf" | "copenhagen" | "scramble" | "best_ball";

export interface GameFormatInfo {
  id: GameFormatId;
  label: string;
  description: string;
  minPlayers?: number;
  maxPlayers?: number;
  teamBased?: boolean;
}

export const GAME_FORMATS: GameFormatInfo[] = [
  { id: "stroke_play", label: "Stroke Play", description: "Standard scoring" },
  { id: "stableford", label: "Stableford", description: "Points-based scoring" },
  { id: "umbriago", label: "Umbriago", description: "2v2 team game", minPlayers: 4, maxPlayers: 4, teamBased: true },
  { id: "wolf", label: "🐺 Wolf", description: "3-5 players, dynamic teams", minPlayers: 3, maxPlayers: 5 },
  { id: "copenhagen", label: "Copenhagen", description: "3 players, 6-point game", minPlayers: 3, maxPlayers: 3 },
];

export interface Player {
  odId: string;
  teeColor: string;
  displayName: string;
  username: string;
  avatarUrl?: string;
  isTemporary?: boolean;
  handicap?: number;
}

export interface PlayerGroup {
  id: string;
  name: string;
  players: Player[];
  startingHole?: number;
  teeTime?: string;
}

export interface FormatSettings {
  formatId: GameFormatId;
  isPrimary?: boolean;
  // Stroke Play / Stableford settings
  mulligansPerPlayer?: number;
  handicapEnabled?: boolean;
  gimmesEnabled?: boolean;
  // Umbriago settings
  rollsPerTeam?: number;
  stakePerPoint?: number;
  teamRotation?: 'none' | 'every6' | 'every9';
  // Wolf settings
  loneWolfWinPoints?: number;
  loneWolfLossPoints?: number;
  teamWinPoints?: number;
  wolfPosition?: 'first' | 'last';
  // Copenhagen settings
  useHandicaps?: boolean;
}

export interface PlaySetupState {
  roundName: string;
  datePlayed: string;
  selectedCourse: {
    id: string;
    name: string;
    location: string;
  } | null;
  selectedHoles: "18" | "front9" | "back9" | "custom";
  customHoles?: number[];
  teeColor: string;
  // Multi-format support
  gameFormats: GameFormatId[];
  primaryFormat?: GameFormatId;
  formatSettings: FormatSettings[];
  // Legacy single format (kept for backwards compatibility)
  gameFormat: GameFormatId;
  groups: PlayerGroup[];
  strokePlaySettings: {
    mulligansPerPlayer: number;
    handicapEnabled: boolean;
    gimmesEnabled: boolean;
  };
  aiConfigApplied: boolean;
  aiConfigSummary?: string;
  aiAssumptions?: string[];
}

export const createDefaultGroup = (index: number): PlayerGroup => ({
  id: `group_${Date.now()}_${index}`,
  name: `Group ${String.fromCharCode(65 + index)}`,
  players: [],
});

export const getInitialPlaySetupState = (): PlaySetupState => ({
  roundName: "",
  datePlayed: new Date().toISOString().split('T')[0],
  selectedCourse: null,
  selectedHoles: "18",
  teeColor: "",
  gameFormats: ["stroke_play"],
  primaryFormat: "stroke_play",
  formatSettings: [{ formatId: "stroke_play", isPrimary: true }],
  gameFormat: "stroke_play",
  groups: [createDefaultGroup(0)],
  strokePlaySettings: {
    mulligansPerPlayer: 0,
    handicapEnabled: false,
    gimmesEnabled: false,
  },
  aiConfigApplied: false,
});
