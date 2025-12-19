import { SkinsPlayer, SkinsPlayerScore } from "@/types/skins";

interface SkinsHoleResult {
  winnerPlayer: string | null;
  isCarryover: boolean;
  skinsWon: number;
}

/**
 * Calculate the number of strokes a player receives on a given hole
 */
export function getStrokesOnHole(
  handicap: number | null,
  strokeIndex: number,
  totalHoles: number = 18
): number {
  if (handicap === null || handicap === 0) return 0;
  
  const absHandicap = Math.abs(handicap);
  const isPlus = handicap < 0;
  
  // For plus handicaps, player gives strokes
  if (isPlus) {
    // Plus handicap gives strokes on lowest SI holes
    if (strokeIndex <= absHandicap) {
      return -1;
    }
    return 0;
  }
  
  // Normal handicap receives strokes
  const fullStrokes = Math.floor(absHandicap / totalHoles);
  const extraStrokes = absHandicap % totalHoles;
  
  let strokes = fullStrokes;
  if (strokeIndex <= extraStrokes) {
    strokes += 1;
  }
  
  return strokes;
}

/**
 * Calculate net score for a player on a hole
 */
export function calculateNetScore(
  grossScore: number,
  handicap: number | null,
  strokeIndex: number,
  totalHoles: number = 18
): number {
  const strokes = getStrokesOnHole(handicap, strokeIndex, totalHoles);
  return grossScore - strokes;
}

/**
 * Calculate the skins result for a hole
 * Returns the winner (if any) and whether this resulted in a carryover
 */
export function calculateSkinsHoleResult(
  playerScores: Record<string, SkinsPlayerScore>,
  useNetScores: boolean,
  carryoverEnabled: boolean,
  currentSkinsAvailable: number
): SkinsHoleResult {
  const scores = Object.entries(playerScores);
  
  if (scores.length === 0) {
    return { winnerPlayer: null, isCarryover: true, skinsWon: 0 };
  }
  
  // Get the score to use (net or gross)
  const scoreValues = scores.map(([name, score]) => ({
    name,
    score: useNetScores ? score.net : score.gross,
  }));
  
  // Find the lowest score
  const lowestScore = Math.min(...scoreValues.map(s => s.score));
  
  // Find all players with the lowest score
  const playersWithLowestScore = scoreValues.filter(s => s.score === lowestScore);
  
  // If exactly one player has the lowest score, they win
  if (playersWithLowestScore.length === 1) {
    return {
      winnerPlayer: playersWithLowestScore[0].name,
      isCarryover: false,
      skinsWon: currentSkinsAvailable,
    };
  }
  
  // Tie - if carryover is enabled, skin carries over
  if (carryoverEnabled) {
    return {
      winnerPlayer: null,
      isCarryover: true,
      skinsWon: 0,
    };
  }
  
  // Carryover disabled - no skin awarded
  return {
    winnerPlayer: null,
    isCarryover: false,
    skinsWon: 0,
  };
}

/**
 * Format handicap for display
 * "+X.X" for plus handicaps, "X.X" for normal
 */
export function formatHandicap(handicap: number | null): string {
  if (handicap === null) return "-";
  if (handicap < 0) return `+${Math.abs(handicap).toFixed(1)}`;
  return handicap.toFixed(1);
}

/**
 * Calculate the skins leaderboard from completed holes
 */
export function calculateSkinsLeaderboard(
  players: SkinsPlayer[],
  holes: Array<{
    hole_number: number;
    winner_player: string | null;
    skins_available: number;
  }>,
  skinValue: number
): Array<{
  playerName: string;
  groupName: string;
  skinsWon: number;
  totalValue: number;
  holesWon: number[];
}> {
  const leaderboard = new Map<string, {
    groupName: string;
    skinsWon: number;
    holesWon: number[];
  }>();
  
  // Initialize all players
  players.forEach(player => {
    leaderboard.set(player.name, {
      groupName: player.group_name,
      skinsWon: 0,
      holesWon: [],
    });
  });
  
  // Count skins won
  holes.forEach(hole => {
    if (hole.winner_player) {
      const entry = leaderboard.get(hole.winner_player);
      if (entry) {
        entry.skinsWon += hole.skins_available;
        entry.holesWon.push(hole.hole_number);
      }
    }
  });
  
  // Convert to array and sort
  return Array.from(leaderboard.entries())
    .map(([playerName, data]) => ({
      playerName,
      groupName: data.groupName,
      skinsWon: data.skinsWon,
      totalValue: data.skinsWon * skinValue,
      holesWon: data.holesWon,
    }))
    .sort((a, b) => b.skinsWon - a.skinsWon);
}
