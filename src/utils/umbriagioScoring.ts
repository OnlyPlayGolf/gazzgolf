import { UmbriagioHole } from '@/types/umbriago';

export interface HoleScores {
  teamAPlayer1: number | null;
  teamAPlayer2: number | null;
  teamBPlayer1: number | null;
  teamBPlayer2: number | null;
  par: number;
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
  // Only count actual scores (not null) for birdie/eagle
  const teamAHasBirdie = (scores.teamAPlayer1 !== null && scores.teamAPlayer1 <= scores.par - 1) || 
                         (scores.teamAPlayer2 !== null && scores.teamAPlayer2 <= scores.par - 1);
  const teamBHasBirdie = (scores.teamBPlayer1 !== null && scores.teamBPlayer1 <= scores.par - 1) || 
                         (scores.teamBPlayer2 !== null && scores.teamBPlayer2 <= scores.par - 1);
  
  if (teamAHasBirdie && !teamBHasBirdie) return 'A';
  if (teamBHasBirdie && !teamAHasBirdie) return 'B';
  return null; // Both or neither
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
  
  // Calculate umbriago multiplier based on eagle (-2) scores
  let umbriagioMultiplierA = 1;
  let umbriagioMultiplierB = 1;
  
  if (scores) {
    const teamAPlayer1Eagle = scores.teamAPlayer1 !== null && scores.teamAPlayer1 <= scores.par - 2;
    const teamAPlayer2Eagle = scores.teamAPlayer2 !== null && scores.teamAPlayer2 <= scores.par - 2;
    const teamBPlayer1Eagle = scores.teamBPlayer1 !== null && scores.teamBPlayer1 <= scores.par - 2;
    const teamBPlayer2Eagle = scores.teamBPlayer2 !== null && scores.teamBPlayer2 <= scores.par - 2;
    
    // x4 if both players have eagle or better, x2 if one player has eagle or better
    if (isUmbriagioA) {
      if (teamAPlayer1Eagle && teamAPlayer2Eagle) {
        umbriagioMultiplierA = 4; // 32 points total (4 * 2 * 4)
      } else if (teamAPlayer1Eagle || teamAPlayer2Eagle) {
        umbriagioMultiplierA = 2; // 16 points total (4 * 2 * 2)
      }
    }
    
    if (isUmbriagioB) {
      if (teamBPlayer1Eagle && teamBPlayer2Eagle) {
        umbriagioMultiplierB = 4;
      } else if (teamBPlayer1Eagle || teamBPlayer2Eagle) {
        umbriagioMultiplierB = 2;
      }
    }
  }
  
  // Apply Umbriago doubling first, then super umbriago multiplier, then hole multiplier
  let teamAPoints = teamACategories;
  let teamBPoints = teamBCategories;
  
  if (isUmbriagioA) teamAPoints = teamAPoints * 2 * umbriagioMultiplierA; // 4 → 8 → 16/32
  if (isUmbriagioB) teamBPoints = teamBPoints * 2 * umbriagioMultiplierB;
  
  // Apply hole multiplier (doubles/double-back)
  teamAPoints *= multiplier;
  teamBPoints *= multiplier;
  
  const umbriagioMultiplier = isUmbriagioA ? umbriagioMultiplierA : isUmbriagioB ? umbriagioMultiplierB : undefined;
  
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
