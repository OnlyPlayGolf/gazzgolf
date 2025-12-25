import { WolfHole, WolfSettings } from '@/types/wolf';

export interface WolfScoreInput {
  scores: (number | null)[];  // Scores for each player (index 0-4)
  wolfPlayer: number;         // 1-5 which player is wolf
  wolfChoice: 'lone' | 'partner';
  partnerPlayer: number | null; // 1-5 if partner chosen
  playerCount: number;        // 3-5 players
  settings: WolfSettings;
}

export interface WolfScoreResult {
  winningSide: 'wolf' | 'opponents' | 'tie';
  playerPoints: number[];     // Points for each player (index 0-4)
}

export function calculateWolfHoleScore(input: WolfScoreInput): WolfScoreResult {
  const { scores, wolfPlayer, wolfChoice, partnerPlayer, playerCount, settings } = input;
  
  // Get valid scores (non-null)
  const wolfIndex = wolfPlayer - 1;
  const wolfScore = scores[wolfIndex];
  
  if (wolfScore === null) {
    return { winningSide: 'tie', playerPoints: [0, 0, 0, 0, 0] };
  }
  
  let wolfTeamBestScore: number;
  let opponentsBestScore: number;
  
  if (wolfChoice === 'lone') {
    // Lone wolf vs everyone
    wolfTeamBestScore = wolfScore;
    
    // Find best opponent score
    const opponentScores: number[] = [];
    for (let i = 0; i < playerCount; i++) {
      if (i !== wolfIndex && scores[i] !== null) {
        opponentScores.push(scores[i]!);
      }
    }
    opponentsBestScore = Math.min(...opponentScores);
  } else {
    // Wolf + partner vs others
    const partnerIndex = (partnerPlayer || 1) - 1;
    const partnerScore = scores[partnerIndex];
    
    // Best score of wolf team
    wolfTeamBestScore = partnerScore !== null 
      ? Math.min(wolfScore, partnerScore) 
      : wolfScore;
    
    // Find best opponent score
    const opponentScores: number[] = [];
    for (let i = 0; i < playerCount; i++) {
      if (i !== wolfIndex && i !== partnerIndex && scores[i] !== null) {
        opponentScores.push(scores[i]!);
      }
    }
    opponentsBestScore = opponentScores.length > 0 ? Math.min(...opponentScores) : 999;
  }
  
  // Determine winner
  let winningSide: 'wolf' | 'opponents' | 'tie';
  if (wolfTeamBestScore < opponentsBestScore) {
    winningSide = 'wolf';
  } else if (opponentsBestScore < wolfTeamBestScore) {
    winningSide = 'opponents';
  } else {
    winningSide = 'tie';
  }
  
  // Calculate points
  const playerPoints = [0, 0, 0, 0, 0];
  
  if (winningSide === 'tie') {
    // No points on tie
    return { winningSide, playerPoints };
  }
  
  if (wolfChoice === 'lone') {
    if (winningSide === 'wolf') {
      // Lone wolf wins: gets lone_wolf_win_points
      playerPoints[wolfIndex] = settings.lone_wolf_win_points;
    } else {
      // Lone wolf loses: each opponent gets lone_wolf_loss_points
      for (let i = 0; i < playerCount; i++) {
        if (i !== wolfIndex) {
          playerPoints[i] = settings.lone_wolf_loss_points;
        }
      }
    }
  } else {
    // Team play
    const partnerIndex = (partnerPlayer || 1) - 1;
    
    if (winningSide === 'wolf') {
      // Wolf team wins
      playerPoints[wolfIndex] = settings.team_win_points;
      playerPoints[partnerIndex] = settings.team_win_points;
    } else {
      // Opponents win
      for (let i = 0; i < playerCount; i++) {
        if (i !== wolfIndex && i !== partnerIndex) {
          playerPoints[i] = settings.team_win_points;
        }
      }
    }
  }
  
  return { winningSide, playerPoints };
}

export function getWolfPlayerForHole(holeNumber: number, playerCount: number, wolfPosition: 'first' | 'last' = 'last'): number {
  // Wolf rotates each hole
  if (wolfPosition === 'last') {
    // Hole 1: last player (playerCount), Hole 2: player 1, Hole 3: player 2, etc.
    return ((holeNumber - 2 + playerCount) % playerCount) + 1;
  } else {
    // Hole 1: player 1, Hole 2: player 2, etc.
    return ((holeNumber - 1) % playerCount) + 1;
  }
}

export function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}
