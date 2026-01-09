// Centralized Tee Box System
// Uses difficulty-based naming: Longest → Shortest

export type TeeDifficulty = "Longest" | "Long" | "Medium" | "Short" | "Shortest";

export interface TeeBox {
  id: string;           // Internal identifier (e.g., "longest", "long")
  difficulty: TeeDifficulty;
  yardage?: number;
  meters?: number;
  colorName?: string;   // Secondary: course-specific color (e.g., "White", "Blue")
  customName?: string;  // Secondary: course-specific name (e.g., "Championship")
}

// Standard difficulty levels in order (hardest to easiest)
export const TEE_DIFFICULTIES: TeeDifficulty[] = [
  "Longest",
  "Long", 
  "Medium",
  "Short",
  "Shortest"
];

// Map legacy color names to difficulty levels based on common conventions
// This is used when converting old data to the new system
const COLOR_TO_DIFFICULTY_MAP: Record<string, number> = {
  // Common longest tees (black, gold, championship)
  "black": 0,
  "gold": 0,
  "championship": 0,
  "tips": 0,
  
  // Common long tees (blue, back)
  "blue": 1,
  "back": 1,
  
  // Common medium tees (white, member)
  "white": 2,
  "member": 2,
  
  // Common short tees (yellow, senior)
  "yellow": 3,
  "senior": 3,
  
  // Common shortest tees (red, forward, ladies)
  "red": 4,
  "forward": 4,
  "ladies": 4,
  "orange": 4,
};

/**
 * Get difficulty name based on index
 */
export function getDifficultyByIndex(index: number, totalTees: number): TeeDifficulty {
  if (totalTees <= 1) return "Medium";
  if (totalTees === 2) {
    return index === 0 ? "Long" : "Short";
  }
  if (totalTees === 3) {
    if (index === 0) return "Long";
    if (index === 1) return "Medium";
    return "Short";
  }
  if (totalTees === 4) {
    if (index === 0) return "Longest";
    if (index === 1) return "Long";
    if (index === 2) return "Short";
    return "Shortest";
  }
  // 5 or more tees
  if (index === 0) return "Longest";
  if (index === 1) return "Long";
  if (index === totalTees - 1) return "Shortest";
  if (index === totalTees - 2) return "Short";
  return "Medium";
}

/**
 * Convert a legacy color name to a difficulty level
 */
export function colorToDifficulty(color: string, availableColors: string[]): TeeDifficulty {
  const normalized = color.toLowerCase().trim();
  const totalTees = availableColors.length;
  
  // Try direct mapping first
  if (COLOR_TO_DIFFICULTY_MAP[normalized] !== undefined) {
    const diffIndex = COLOR_TO_DIFFICULTY_MAP[normalized];
    return getDifficultyByIndex(Math.min(diffIndex, totalTees - 1), totalTees);
  }
  
  // Fall back to position in available colors array
  const index = availableColors.findIndex(c => c.toLowerCase() === normalized);
  if (index !== -1) {
    return getDifficultyByIndex(index, totalTees);
  }
  
  return "Medium";
}

/**
 * Convert available tee colors to TeeBox array with difficulty names
 */
export function createTeeBoxes(availableColors: string[], yardages?: Record<string, number>): TeeBox[] {
  if (!availableColors || availableColors.length === 0) {
    return [{
      id: "medium",
      difficulty: "Medium",
    }];
  }

  // Sort colors by typical difficulty (longest first) if yardages provided
  let sortedColors = [...availableColors];
  if (yardages) {
    sortedColors.sort((a, b) => {
      const yardA = yardages[a] || 0;
      const yardB = yardages[b] || 0;
      return yardB - yardA; // Descending (longest first)
    });
  }

  return sortedColors.map((color, index) => ({
    id: color.toLowerCase(),
    difficulty: getDifficultyByIndex(index, sortedColors.length),
    colorName: color,
    yardage: yardages?.[color],
  }));
}

/**
 * Get display label for a tee box
 * Format: "Medium" or "Medium (White)" if color is different
 */
export function getTeeDisplayLabel(teeBox: TeeBox, showColor: boolean = true): string {
  if (!showColor || !teeBox.colorName) {
    return teeBox.difficulty;
  }
  
  // Don't show color if it's the same as difficulty
  if (teeBox.colorName.toLowerCase() === teeBox.difficulty.toLowerCase()) {
    return teeBox.difficulty;
  }
  
  return `${teeBox.difficulty} (${teeBox.colorName})`;
}

/**
 * Get display label for a tee with yardage
 * Format: "Medium    6,250 yd    (White)"
 */
export function getTeeFullDisplay(teeBox: TeeBox): string {
  let display = teeBox.difficulty;
  
  if (teeBox.yardage) {
    display += ` • ${teeBox.yardage.toLocaleString()} yd`;
  } else if (teeBox.meters) {
    display += ` • ${teeBox.meters.toLocaleString()} m`;
  }
  
  if (teeBox.colorName && teeBox.colorName.toLowerCase() !== teeBox.difficulty.toLowerCase()) {
    display += ` (${teeBox.colorName})`;
  }
  
  return display;
}

/**
 * Convert a legacy tee color value to the new difficulty-based value
 * For backwards compatibility - stores as "longest", "long", etc.
 */
export function colorToTeeId(color: string, availableColors: string[]): string {
  const difficulty = colorToDifficulty(color, availableColors);
  return difficulty.toLowerCase();
}

/**
 * Convert a tee ID to display name
 */
export function teeIdToDisplay(teeId: string): TeeDifficulty {
  const map: Record<string, TeeDifficulty> = {
    "longest": "Longest",
    "long": "Long",
    "medium": "Medium", 
    "short": "Short",
    "shortest": "Shortest",
  };
  return map[teeId.toLowerCase()] || "Medium";
}

/**
 * Get standard tee options for selection
 * Returns options based on course tee count
 */
export function getStandardTeeOptions(teeCount: number = 5): { value: string; label: string }[] {
  if (teeCount <= 1) {
    return [{ value: "medium", label: "Medium" }];
  }
  if (teeCount === 2) {
    return [
      { value: "long", label: "Long" },
      { value: "short", label: "Short" },
    ];
  }
  if (teeCount === 3) {
    return [
      { value: "long", label: "Long" },
      { value: "medium", label: "Medium" },
      { value: "short", label: "Short" },
    ];
  }
  if (teeCount === 4) {
    return [
      { value: "longest", label: "Longest" },
      { value: "long", label: "Long" },
      { value: "short", label: "Short" },
      { value: "shortest", label: "Shortest" },
    ];
  }
  // 5 or more
  return [
    { value: "longest", label: "Longest" },
    { value: "long", label: "Long" },
    { value: "medium", label: "Medium" },
    { value: "short", label: "Short" },
    { value: "shortest", label: "Shortest" },
  ];
}

/**
 * Get difficulty index for handicap calculations
 * Higher index = easier tee = fewer strokes
 */
export function getDifficultyIndex(teeId: string): number {
  const map: Record<string, number> = {
    "longest": 0,
    "long": 1,
    "medium": 2,
    "short": 3,
    "shortest": 4,
  };
  return map[teeId.toLowerCase()] ?? 2;
}

/**
 * Calculate handicap adjustment between two tees
 * Returns positive number if player on harder tee should get more strokes
 */
export function calculateTeeHandicapAdjustment(
  playerTeeId: string, 
  referenceTeeId: string
): number {
  const playerIndex = getDifficultyIndex(playerTeeId);
  const referenceIndex = getDifficultyIndex(referenceTeeId);
  
  // Each level difference = approximately 2 strokes (this can be refined with course rating)
  const strokesPerLevel = 2;
  return (referenceIndex - playerIndex) * strokesPerLevel;
}

/**
 * Default tee options when no course data is available
 */
export const DEFAULT_TEE_OPTIONS = getStandardTeeOptions(5);

/**
 * Default tee for men (second farthest)
 */
export const DEFAULT_MEN_TEE = "long";

/**
 * Get user's preferred default tee from app preferences
 */
export function getDefaultTeeFromPreferences(): string {
  try {
    const savedPrefs = localStorage.getItem('appPreferences');
    if (savedPrefs) {
      const prefs = JSON.parse(savedPrefs);
      if (prefs.defaultTee) {
        return prefs.defaultTee;
      }
    }
  } catch (e) {
    console.error("Error reading app preferences for tee:", e);
  }
  return DEFAULT_MEN_TEE;
}

/**
 * Legacy color options for backwards compatibility with database
 */
export const LEGACY_TEE_COLORS = ["White", "Yellow", "Blue", "Red", "Orange"];
