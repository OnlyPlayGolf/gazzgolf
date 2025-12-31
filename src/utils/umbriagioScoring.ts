import { UmbriagioHole } from '@/types/umbriago';

export interface HoleScores {
  teamAPlayer1: number | null;
  teamAPlayer2: number | null;
  teamBPlayer1: number | null;
  teamBPlayer2: number | null;
  par: number;
}

// Normalize points by subtracting the minimum so the losing team shows 0
export function normalizeUmbriagioPoints(teamAPoints: number, teamBPoints: number): { normalizedA: number; normalizedB: number } {
  const minPoints = Math.min(teamAPoints, teamBPoints);
  return {
    normalizedA: teamAPoints - minPoints,
    normalizedB: teamBPoints - minPoints,
  };
}

export interface CategoryResults {
  teamLowWinner: 'A' | 'B' | null;
  individualLowWinner: 'A' | 'B' | null;
  closestToPinWinner: 'A' | 'B' | null;
  birdieEagleWinner: 'A' | 'B' | null;
}

export function calculateTeamLow(scores: HoleScores): 'A' | 'B' | null {
  // If any player has null (didn't finish), their team can't win team low
  const teamAHasNull = scores.teamAPlayer1 === null || scores.teamAPlayer2 === null;
  const teamBHasNull = scores.teamBPlayer1 === null || scores.teamBPlayer2 === null;
  
  if (teamAHasNull && teamBHasNull) return null; // Both teams have a player who didn't finish
  if (teamAHasNull) return 'B'; // Team A can't win, Team B wins by default
  if (teamBHasNull) return 'A'; // Team B can't win, Team A wins by default
  
  const teamATotal = scores.teamAPlayer1 + scores.teamAPlayer2;
  const teamBTotal = scores.teamBPlayer1 + scores.teamBPlayer2;
  
  if (teamATotal < teamBTotal) return 'A';
  if (teamBTotal < teamATotal) return 'B';
  return null;
}

export function calculateIndividualLow(scores: HoleScores): 'A' | 'B' | null {
  const allScores = [
    { team: 'A' as const, score: scores.teamAPlayer1 },
    { team: 'A' as const, score: scores.teamAPlayer2 },
    { team: 'B' as const, score: scores.teamBPlayer1 },
    { team: 'B' as const, score: scores.teamBPlayer2 },
  ].filter(s => s.score !== null && s.score > 0) as { team: 'A' | 'B'; score: number }[];
  
  if (allScores.length === 0) return null;
  
  const minScore = Math.min(...allScores.map(s => s.score));
  const playersWithMin = allScores.filter(s => s.score === minScore);
  
  // Check if only one team has the lowest score
  const teamsWithMin = [...new Set(playersWithMin.map(p => p.team))];
  
  if (teamsWithMin.length === 1) {
    return teamsWithMin[0];
  }
  
  return null; // Tie if both teams have a player with the lowest score
}

export function calculateBirdieEagle(scores: HoleScores): 'A' | 'B' | null {
  // Get best score for each team
  const teamABest = Math.min(
    scores.teamAPlayer1 !== null ? scores.teamAPlayer1 : Infinity,
    scores.teamAPlayer2 !== null ? scores.teamAPlayer2 : Infinity
  );
  const teamBBest = Math.min(
    scores.teamBPlayer1 !== null ? scores.teamBPlayer1 : Infinity,
    scores.teamBPlayer2 !== null ? scores.teamBPlayer2 : Infinity
  );
  
  const teamAUnderPar = teamABest < scores.par;
  const teamBUnderPar = teamBBest < scores.par;
  
  // If neither is under par, no winner
  if (!teamAUnderPar && !teamBUnderPar) return null;
  
  // If only one team is under par, they win
  if (teamAUnderPar && !teamBUnderPar) return 'A';
  if (teamBUnderPar && !teamAUnderPar) return 'B';
  
  // Both under par - team with best (lowest) score wins
  if (teamABest < teamBBest) return 'A';
  if (teamBBest < teamABest) return 'B';
  
  return null; // Same best score under par = tie
}

export function calculateHolePoints(
  categories: CategoryResults,
  multiplier: 1 | 2 | 4,
  scores?: HoleScores
): { teamAPoints: number; teamBPoints: number; isUmbriago: boolean; umbriagioMultiplier?: number } {
  let teamACategories = 0;
  let teamBCategories = 0;
  
  if (categories.teamLowWinner === 'A') teamACategories++;
  else if (categories.teamLowWinner === 'B') teamBCategories++;
  
  if (categories.individualLowWinner === 'A') teamACategories++;
  else if (categories.individualLowWinner === 'B') teamBCategories++;
  
  if (categories.closestToPinWinner === 'A') teamACategories++;
  else if (categories.closestToPinWinner === 'B') teamBCategories++;
  
  if (categories.birdieEagleWinner === 'A') teamACategories++;
  else if (categories.birdieEagleWinner === 'B') teamBCategories++;
  
  // Check for Umbriago sweep (all 4 categories)
  const isUmbriagioA = teamACategories === 4;
  const isUmbriagioB = teamBCategories === 4;
  
  let teamAPoints = teamACategories;
  let teamBPoints = teamBCategories;
  let umbriagioMultiplier: number | undefined;
  
  if ((isUmbriagioA || isUmbriagioB) && scores) {
    // Calculate strokes under par for each team
    // Each stroke under par = 8 points for winning team
    // Each stroke under par from losing team cancels 8 points
    const teamAPlayer1UnderPar = scores.teamAPlayer1 !== null ? Math.max(0, scores.par - scores.teamAPlayer1) : 0;
    const teamAPlayer2UnderPar = scores.teamAPlayer2 !== null ? Math.max(0, scores.par - scores.teamAPlayer2) : 0;
    const teamBPlayer1UnderPar = scores.teamBPlayer1 !== null ? Math.max(0, scores.par - scores.teamBPlayer1) : 0;
    const teamBPlayer2UnderPar = scores.teamBPlayer2 !== null ? Math.max(0, scores.par - scores.teamBPlayer2) : 0;
    
    const teamAUnderPar = teamAPlayer1UnderPar + teamAPlayer2UnderPar;
    const teamBUnderPar = teamBPlayer1UnderPar + teamBPlayer2UnderPar;
    
    if (isUmbriagioA) {
      // Net strokes under par × 8
      const netUnderPar = teamAUnderPar - teamBUnderPar;
      teamAPoints = netUnderPar * 8;
      teamBPoints = 0;
      umbriagioMultiplier = netUnderPar;
    } else if (isUmbriagioB) {
      const netUnderPar = teamBUnderPar - teamAUnderPar;
      teamBPoints = netUnderPar * 8;
      teamAPoints = 0;
      umbriagioMultiplier = netUnderPar;
    }
  }
  
  // Apply hole multiplier (doubles/double-back)
  teamAPoints *= multiplier;
  teamBPoints *= multiplier;
  
  return {
    teamAPoints,
    teamBPoints,
    isUmbriago: isUmbriagioA || isUmbriagioB,
    umbriagioMultiplier
  };
}

export function calculateRoll(
  currentDifference: number,
  currentStake: number
): { newDifference: number; newStake: number } {
  // Roll halves the point difference (round up) and doubles stake
  const newDifference = Math.ceil(Math.abs(currentDifference) / 2);
  const newStake = currentStake * 2;
  
  return { newDifference, newStake };
}

export function calculatePayout(
  teamAPoints: number,
  teamBPoints: number,
  stakePerPoint: number,
  payoutMode: 'difference' | 'total'
): { winner: 'A' | 'B' | 'TIE'; payout: number } {
  if (teamAPoints === teamBPoints) {
    return { winner: 'TIE', payout: 0 };
  }
  
  const winner = teamAPoints > teamBPoints ? 'A' : 'B';
  
  let payout: number;
  if (payoutMode === 'difference') {
    payout = Math.abs(teamAPoints - teamBPoints) * stakePerPoint;
  } else {
    // Total points mode - winning team's total points
    payout = Math.max(teamAPoints, teamBPoints) * stakePerPoint;
  }
  
  return { winner, payout };
}
