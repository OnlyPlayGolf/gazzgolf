// Copenhagen (6-Point) scoring utility functions

import { PlayerScore, HoleResult } from "@/types/copenhagen";

/**
 * Calculate Copenhagen points for a hole
 * 
 * Rules:
 * - 6 points per hole total
 * - Normal: 4 (lowest), 2 (second), 0 (highest)
 * - Tie for lowest (2 players): 3-3-0
 * - Three-way tie: 2-2-2
 * - Tie for second: 4-1-1
 * - Sweep (6-0-0): Only when birdie+ AND win by ≥2 strokes over both opponents
 */
export function calculateCopenhagenPoints(
  scores: PlayerScore[],
  par: number
): HoleResult {
  // Sort by gross score (ascending - lower is better)
  const sorted = [...scores].sort((a, b) => a.grossScore - b.grossScore);
  
  const lowest = sorted[0].grossScore;
  const middle = sorted[1].grossScore;
  const highest = sorted[2].grossScore;
  
  // Check for sweep conditions
  // Sweep requires: birdie or better AND win by 2+ strokes over BOTH opponents
  const lowestPlayer = sorted[0];
  const isBirdieOrBetter = lowestPlayer.grossScore <= par - 1;
  const winsBy2OrMore = (middle - lowest) >= 2 && (highest - lowest) >= 2;
  const isSweep = isBirdieOrBetter && winsBy2OrMore;
  
  let points: Record<number, number> = { 1: 0, 2: 0, 3: 0 };
  
  if (isSweep) {
    // Sweep: 6-0-0
    points[lowestPlayer.playerIndex] = 6;
    return {
      player1Points: points[1],
      player2Points: points[2],
      player3Points: points[3],
      isSweep: true,
      sweepWinner: lowestPlayer.playerIndex,
    };
  }
  
  // Check for three-way tie
  if (lowest === middle && middle === highest) {
    // Three-way tie: 2-2-2
    points = { 1: 2, 2: 2, 3: 2 };
    return {
      player1Points: points[1],
      player2Points: points[2],
      player3Points: points[3],
      isSweep: false,
      sweepWinner: null,
    };
  }
  
  // Check for tie for lowest (two players tie for best)
  if (lowest === middle && middle !== highest) {
    // Tie for lowest: 3-3-0
    points[sorted[0].playerIndex] = 3;
    points[sorted[1].playerIndex] = 3;
    points[sorted[2].playerIndex] = 0;
    return {
      player1Points: points[1],
      player2Points: points[2],
      player3Points: points[3],
      isSweep: false,
      sweepWinner: null,
    };
  }
  
  // Check for tie for second (two players tie for worst)
  if (lowest !== middle && middle === highest) {
    // Tie for second: 4-1-1
    points[sorted[0].playerIndex] = 4;
    points[sorted[1].playerIndex] = 1;
    points[sorted[2].playerIndex] = 1;
    return {
      player1Points: points[1],
      player2Points: points[2],
      player3Points: points[3],
      isSweep: false,
      sweepWinner: null,
    };
  }
  
  // Normal scoring: 4-2-0
  points[sorted[0].playerIndex] = 4;
  points[sorted[1].playerIndex] = 2;
  points[sorted[2].playerIndex] = 0;
  
  return {
    player1Points: points[1],
    player2Points: points[2],
    player3Points: points[3],
    isSweep: false,
    sweepWinner: null,
  };
}

/**
 * Calculate net score based on handicap and stroke index
 */
export function calculateNetScore(
  grossScore: number,
  handicap: number | null,
  strokeIndex: number | null,
  holesPlayed: number = 18
): number {
  if (handicap === null || strokeIndex === null) {
    return grossScore;
  }
  
  // Calculate strokes received on this hole
  // Full stroke if handicap >= strokeIndex
  // Extra stroke if handicap >= strokeIndex + 18
  let strokesReceived = 0;
  
  if (handicap >= strokeIndex) {
    strokesReceived = 1;
  }
  if (handicap >= strokeIndex + holesPlayed) {
    strokesReceived = 2;
  }
  if (handicap >= strokeIndex + (holesPlayed * 2)) {
    strokesReceived = 3;
  }
  
  // For plus handicaps (negative values), they give strokes
  if (handicap < 0) {
    const absHandicap = Math.abs(handicap);
    if (strokeIndex <= absHandicap) {
      strokesReceived = -1;
    }
  }
  
  return grossScore - strokesReceived;
}

/**
 * Calculate point differentials for each player
 */
export function calculatePointDifferentials(
  player1Points: number,
  player2Points: number,
  player3Points: number
): { player1: number; player2: number; player3: number } {
  const totalPoints = player1Points + player2Points + player3Points;
  const averagePoints = totalPoints / 3;
  
  return {
    player1: player1Points - averagePoints,
    player2: player2Points - averagePoints,
    player3: player3Points - averagePoints,
  };
}

/**
 * Normalize points by subtracting the lowest score from all players
 * Example: 10-5-5 becomes 5-0-0
 */
export function normalizePoints(
  player1Points: number,
  player2Points: number,
  player3Points: number
): { player1: number; player2: number; player3: number } {
  const minPoints = Math.min(player1Points, player2Points, player3Points);
  
  return {
    player1: player1Points - minPoints,
    player2: player2Points - minPoints,
    player3: player3Points - minPoints,
  };
}
