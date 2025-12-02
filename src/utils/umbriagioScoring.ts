import { UmbriagioHole } from '@/types/umbriago';

export interface HoleScores {
  teamAPlayer1: number;
  teamAPlayer2: number;
  teamBPlayer1: number;
  teamBPlayer2: number;
  par: number;
}

export interface CategoryResults {
  teamLowWinner: 'A' | 'B' | null;
  individualLowWinner: 'A' | 'B' | null;
  closestToPinWinner: 'A' | 'B' | null;
  birdieEagleWinner: 'A' | 'B' | null;
}

export function calculateTeamLow(scores: HoleScores): 'A' | 'B' | null {
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
  ];
  
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
  const teamAHasBirdie = scores.teamAPlayer1 <= scores.par - 1 || scores.teamAPlayer2 <= scores.par - 1;
  const teamBHasBirdie = scores.teamBPlayer1 <= scores.par - 1 || scores.teamBPlayer2 <= scores.par - 1;
  
  if (teamAHasBirdie && !teamBHasBirdie) return 'A';
  if (teamBHasBirdie && !teamAHasBirdie) return 'B';
  return null; // Both or neither
}

export function calculateHolePoints(
  categories: CategoryResults,
  multiplier: 1 | 2 | 4
): { teamAPoints: number; teamBPoints: number; isUmbriago: boolean } {
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
  
  // Apply Umbriago doubling first, then multiplier
  let teamAPoints = teamACategories;
  let teamBPoints = teamBCategories;
  
  if (isUmbriagioA) teamAPoints *= 2; // 4 → 8
  if (isUmbriagioB) teamBPoints *= 2; // 4 → 8
  
  // Apply hole multiplier
  teamAPoints *= multiplier;
  teamBPoints *= multiplier;
  
  return {
    teamAPoints,
    teamBPoints,
    isUmbriago: isUmbriagioA || isUmbriagioB
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
