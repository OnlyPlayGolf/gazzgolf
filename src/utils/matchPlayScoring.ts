/**
 * Calculate the result of a single hole in Match Play
 * Returns: 1 if player 1 wins, -1 if player 2 wins, 0 if halved
 */
export function calculateHoleResult(
  player1Score: number,
  player2Score: number
): number {
  if (player1Score < player2Score) return 1;
  if (player2Score < player1Score) return -1;
  return 0;
}

/**
 * Format match status as a readable string
 * e.g. "Player A 2 Up", "All Square", "Player B 3 Up"
 */
export function formatMatchStatus(
  matchStatus: number,
  holesRemaining: number,
  player1Name: string,
  player2Name: string
): string {
  if (matchStatus === 0) {
    return "All Square";
  }
  
  const leadingPlayer = matchStatus > 0 ? player1Name : player2Name;
  const lead = Math.abs(matchStatus);
  
  return `${leadingPlayer} ${lead} Up`;
}

/**
 * Format match status with holes to play
 * e.g. "2 Up, 5 to play"
 */
export function formatMatchStatusWithHoles(
  matchStatus: number,
  holesRemaining: number,
  player1Name: string,
  player2Name: string
): string {
  const status = formatMatchStatus(matchStatus, holesRemaining, player1Name, player2Name);
  
  if (holesRemaining > 0) {
    return `${status}, ${holesRemaining} to play`;
  }
  
  return status;
}

/**
 * Check if the match is finished (dormie or won)
 * Match ends when one side is up more holes than remain
 */
export function isMatchFinished(matchStatus: number, holesRemaining: number): boolean {
  return Math.abs(matchStatus) > holesRemaining || holesRemaining === 0;
}

/**
 * Get the final result string for a finished match
 * e.g. "3 & 2", "1 Up", "All Square"
 */
export function getFinalResult(
  matchStatus: number,
  holesRemaining: number,
  player1Name: string,
  player2Name: string
): { winner: string | null; result: string } {
  if (matchStatus === 0) {
    return { winner: null, result: "All Square" };
  }
  
  const winner = matchStatus > 0 ? player1Name : player2Name;
  const lead = Math.abs(matchStatus);
  
  if (holesRemaining === 0) {
    return { winner, result: `${lead} Up` };
  }
  
  return { winner, result: `${lead} & ${holesRemaining}` };
}

/**
 * Calculate strokes received per hole based on handicap difference
 * Returns array of stroke allocations per hole (1-18)
 */
export function calculateStrokeAllocation(
  player1Handicap: number,
  player2Handicap: number,
  courseHoles: { hole_number: number; stroke_index: number }[]
): Map<number, { player1Strokes: number; player2Strokes: number }> {
  const handicapDiff = Math.abs(player1Handicap - player2Handicap);
  const player1GetsStrokes = player1Handicap > player2Handicap;
  
  const allocation = new Map<number, { player1Strokes: number; player2Strokes: number }>();
  
  // Sort holes by stroke index
  const sortedHoles = [...courseHoles].sort((a, b) => a.stroke_index - b.stroke_index);
  
  for (const hole of courseHoles) {
    allocation.set(hole.hole_number, { player1Strokes: 0, player2Strokes: 0 });
  }
  
  // Allocate strokes based on stroke index
  let strokesRemaining = handicapDiff;
  let round = 0;
  
  while (strokesRemaining > 0) {
    for (const hole of sortedHoles) {
      if (strokesRemaining <= 0) break;
      
      const current = allocation.get(hole.hole_number)!;
      if (player1GetsStrokes) {
        current.player1Strokes = round + 1;
      } else {
        current.player2Strokes = round + 1;
      }
      allocation.set(hole.hole_number, current);
      strokesRemaining--;
    }
    round++;
  }
  
  return allocation;
}
