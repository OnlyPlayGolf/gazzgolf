import { BestBallPlayerScore } from "@/types/bestBall";

/**
 * Calculate best ball score for a team on a hole
 */
export function calculateBestBall(
  scores: BestBallPlayerScore[],
  useHandicaps: boolean
): { bestScore: number | null; countingPlayer: string | null } {
  const validScores = scores.filter(s => 
    useHandicaps ? s.netScore !== null : s.grossScore !== null
  );

  if (validScores.length === 0) {
    return { bestScore: null, countingPlayer: null };
  }

  let best: BestBallPlayerScore | null = null;
  for (const score of validScores) {
    const currentScore = useHandicaps ? score.netScore! : score.grossScore!;
    const bestScore = best ? (useHandicaps ? best.netScore! : best.grossScore!) : Infinity;
    
    if (currentScore < bestScore) {
      best = score;
    }
  }

  return {
    bestScore: best ? (useHandicaps ? best.netScore! : best.grossScore!) : null,
    countingPlayer: best?.playerName || null,
  };
}

/**
 * Calculate match play hole result
 * Returns: 1 if Team A wins, -1 if Team B wins, 0 if halved
 */
export function calculateHoleResult(
  teamABest: number | null,
  teamBBest: number | null
): number {
  if (teamABest === null || teamBBest === null) return 0;
  if (teamABest < teamBBest) return 1;
  if (teamBBest < teamABest) return -1;
  return 0;
}

/**
 * Format match status as readable string
 */
export function formatMatchStatus(
  matchStatus: number,
  holesRemaining: number,
  teamAName: string = "Team A",
  teamBName: string = "Team B"
): string {
  if (matchStatus === 0) {
    return "All Square";
  }
  
  const leadingTeam = matchStatus > 0 ? teamAName : teamBName;
  const lead = Math.abs(matchStatus);
  
  return `${leadingTeam} ${lead} Up`;
}

/**
 * Format match status with holes remaining
 */
export function formatMatchStatusWithHoles(
  matchStatus: number,
  holesRemaining: number,
  teamAName: string = "Team A",
  teamBName: string = "Team B"
): string {
  const status = formatMatchStatus(matchStatus, holesRemaining, teamAName, teamBName);
  
  if (holesRemaining > 0) {
    return `${status}, ${holesRemaining} to play`;
  }
  
  return status;
}

/**
 * Check if match is finished
 */
export function isMatchFinished(matchStatus: number, holesRemaining: number): boolean {
  return Math.abs(matchStatus) > holesRemaining || holesRemaining === 0;
}

/**
 * Get final result string
 */
export function getFinalResult(
  matchStatus: number,
  holesRemaining: number,
  teamAName: string = "Team A",
  teamBName: string = "Team B"
): { winner: string | null; result: string } {
  if (matchStatus === 0) {
    return { winner: null, result: "All Square" };
  }
  
  const winner = matchStatus > 0 ? teamAName : teamBName;
  const lead = Math.abs(matchStatus);
  
  if (holesRemaining === 0) {
    return { winner, result: `${lead} Up` };
  }
  
  return { winner, result: `${lead} & ${holesRemaining}` };
}

/**
 * Calculate handicap strokes for a player on a hole
 */
export function calculateHandicapStrokes(
  playerHandicap: number | undefined,
  holeStrokeIndex: number | null
): number {
  if (!playerHandicap || holeStrokeIndex === null) return 0;
  
  const handicap = Math.round(playerHandicap);
  if (handicap <= 0) return 0;
  
  // First pass: strokes for holes 1-18
  let strokes = handicap >= holeStrokeIndex ? 1 : 0;
  
  // Second pass for handicaps > 18
  if (handicap > 18) {
    strokes += (handicap - 18) >= holeStrokeIndex ? 1 : 0;
  }
  
  // Third pass for handicaps > 36
  if (handicap > 36) {
    strokes += (handicap - 36) >= holeStrokeIndex ? 1 : 0;
  }
  
  return strokes;
}

/**
 * Format score relative to par
 */
export function formatScoreToPar(score: number, par: number): string {
  const diff = score - par;
  if (diff === 0) return "E";
  if (diff > 0) return `+${diff}`;
  return `${diff}`;
}

/**
 * Get score color class
 */
export function getScoreColorClass(score: number, par: number): string {
  const diff = score - par;
  if (diff <= -2) return "text-yellow-500 font-bold"; // Eagle or better
  if (diff === -1) return "text-green-600"; // Birdie
  if (diff === 0) return ""; // Par
  if (diff === 1) return "text-orange-500"; // Bogey
  return "text-red-500"; // Double or worse
}
