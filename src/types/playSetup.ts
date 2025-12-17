// Types for Play Page setup

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
  gameFormat: "stroke_play" | "umbriago" | "wolf" | "copenhagen" | "match_play" | "scramble" | "best_ball" | "best_ball_stroke" | "best_ball_match";
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

export const getInitialPlaySetupState = (): PlaySetupState => {
  // Read default tee from app preferences
  let defaultTee = "medium";
  try {
    const savedPrefs = localStorage.getItem('appPreferences');
    if (savedPrefs) {
      const prefs = JSON.parse(savedPrefs);
      if (prefs.defaultTee) {
        defaultTee = prefs.defaultTee;
      }
    }
  } catch (e) {
    console.error("Error reading app preferences:", e);
  }

  return {
    roundName: "",
    datePlayed: new Date().toISOString().split('T')[0],
    selectedCourse: null,
    selectedHoles: "18",
    teeColor: defaultTee,
    gameFormat: "stroke_play",
    groups: [createDefaultGroup(0)],
    strokePlaySettings: {
      mulligansPerPlayer: 0,
      handicapEnabled: false,
      gimmesEnabled: false,
    },
    aiConfigApplied: false,
  };
};
