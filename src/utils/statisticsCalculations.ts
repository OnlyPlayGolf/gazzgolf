import { supabase } from "@/integrations/supabase/client";

// Stat performance levels
export type StatLevel = 'strength' | 'average' | 'needs-improvement';

export interface StatValue {
  value: number | null;
  label: string;
  level: StatLevel;
  context?: string;
}

export interface ScoringStats {
  scoringAverage: number | null;
  bestRound: number | null;
  worstRound: number | null;
  par3Average: number | null;
  par4Average: number | null;
  par5Average: number | null;
  totalRounds: number;
  totalHoles: number;
}

export interface StrokesGainedStats {
  total: number | null;
  offTheTee: number | null;
  approach: number | null;
  shortGame: number | null;
  putting: number | null;
  other: number | null;
  scoring: number | null;
}

export interface AccuracyStats {
  fairwaysHit: number | null;
  greensInRegulation: number | null;
  girPar3: number | null;
  girPar4: number | null;
  girPar5: number | null;
  scrambling: number | null;
  sandSaves: number | null;
  avgDriverDistance: number | null;
  leftMissPercentage: number | null;
  rightMissPercentage: number | null;
}

export interface PuttingStats {
  puttsPerRound: number | null;
  onePuttPercentage: number | null;
  twoPuttPercentage: number | null;
  threePuttPercentage: number | null;
  fourPlusPuttPercentage: number | null;
  threePuttAvoidance: number | null;
  puttsPerGIR: number | null;
}

export interface AllStats {
  scoring: ScoringStats;
  strokesGained: StrokesGainedStats;
  accuracy: AccuracyStats;
  putting: PuttingStats;
  roundsPlayed: number;
}

// Thresholds for determining stat level (based on amateur benchmarks)
const THRESHOLDS = {
  // Scoring (relative to par)
  scoringAverage: { strength: 2, average: 8 }, // +2 or better is strength, +8 or worse needs work
  
  // Strokes Gained (per round)
  sgTotal: { strength: 0.5, average: -0.5 },
  sgOffTheTee: { strength: 0.2, average: -0.2 },
  sgApproach: { strength: 0.2, average: -0.2 },
  sgShortGame: { strength: 0.1, average: -0.1 },
  sgPutting: { strength: 0.1, average: -0.1 },
  
  // Accuracy percentages
  fairwaysHit: { strength: 60, average: 45 },
  gir: { strength: 55, average: 35 },
  scrambling: { strength: 50, average: 30 },
  sandSaves: { strength: 40, average: 20 },
  
  // Putting
  puttsPerRound: { strength: 30, average: 34 }, // Lower is better
  onePutt: { strength: 35, average: 25 },
  threePuttAvoid: { strength: 95, average: 85 },
};

export const getStatLevel = (value: number | null, statType: keyof typeof THRESHOLDS, lowerIsBetter = false): StatLevel => {
  if (value === null) return 'average';
  
  const threshold = THRESHOLDS[statType];
  if (!threshold) return 'average';
  
  if (lowerIsBetter) {
    if (value <= threshold.strength) return 'strength';
    if (value >= threshold.average) return 'needs-improvement';
    return 'average';
  } else {
    if (value >= threshold.strength) return 'strength';
    if (value <= threshold.average) return 'needs-improvement';
    return 'average';
  }
};

export const getSGLevel = (value: number | null): StatLevel => {
  if (value === null) return 'average';
  if (value >= 0.1) return 'strength';
  if (value <= -0.1) return 'needs-improvement';
  return 'average';
};

export const formatScore = (score: number | null, showPlus = true): string => {
  if (score === null) return '-';
  if (score === 0) return 'E';
  if (score > 0 && showPlus) return `+${score.toFixed(1)}`;
  return score.toFixed(1);
};

export const formatSG = (value: number | null): string => {
  if (value === null) return '-';
  if (value >= 0) return `+${value.toFixed(2)}`;
  return value.toFixed(2);
};

export const formatPercentage = (value: number | null): string => {
  if (value === null) return '-';
  return `${value.toFixed(0)}%`;
};

export type StatsFilter = 'all' | 'year' | 'last5' | 'last10' | 'last20' | 'last50';

export async function fetchUserStats(userId: string, filter: StatsFilter = 'all'): Promise<AllStats> {
  // Fetch rounds from round_summaries view
  let query = supabase
    .from('round_summaries')
    .select('*')
    .eq('user_id', userId)
    .order('date_played', { ascending: false });

  // Apply year filter
  if (filter === 'year') {
    const startOfYear = new Date(new Date().getFullYear(), 0, 1).toISOString();
    query = query.gte('date_played', startOfYear);
  }

  const { data: summaries, error: summariesError } = await query;

  if (summariesError) {
    console.error('Error fetching round summaries:', summariesError);
  }

  let validSummaries = summaries?.filter(s => s.total_score && s.total_score > 0) || [];
  
  // Apply round count filters
  if (filter === 'last5') {
    validSummaries = validSummaries.slice(0, 5);
  } else if (filter === 'last10') {
    validSummaries = validSummaries.slice(0, 10);
  } else if (filter === 'last20') {
    validSummaries = validSummaries.slice(0, 20);
  } else if (filter === 'last50') {
    validSummaries = validSummaries.slice(0, 50);
  }
  const roundsPlayed = validSummaries.length;

  // Calculate scoring stats
  const scores = validSummaries.map(s => s.total_score!);
  const scoresToPar = validSummaries.map(s => s.score_vs_par!).filter(s => s !== null);
  
  const scoring: ScoringStats = {
    scoringAverage: scoresToPar.length > 0 
      ? scoresToPar.reduce((a, b) => a + b, 0) / scoresToPar.length 
      : null,
    bestRound: scores.length > 0 ? Math.min(...scores) : null,
    worstRound: scores.length > 0 ? Math.max(...scores) : null,
    par3Average: null, // Would need hole-by-hole data
    par4Average: null,
    par5Average: null,
    totalRounds: roundsPlayed,
    totalHoles: validSummaries.reduce((sum, s) => sum + (s.holes_played || 0), 0),
  };

  // Calculate accuracy stats - start with basic values from summaries
  let accuracy: AccuracyStats = {
    fairwaysHit: validSummaries.length > 0 
      ? validSummaries.reduce((sum, s) => sum + (s.fir_percentage || 0), 0) / validSummaries.length 
      : null,
    greensInRegulation: validSummaries.length > 0 
      ? validSummaries.reduce((sum, s) => sum + (s.gir_percentage || 0), 0) / validSummaries.length 
      : null,
    girPar3: null,
    girPar4: null,
    girPar5: null,
    scrambling: (() => {
      // Only calculate if we have summaries with actual updown_percentage values
      const summariesWithUpDown = validSummaries.filter(s => s.updown_percentage !== null && s.updown_percentage !== undefined);
      if (summariesWithUpDown.length === 0) {
        return null;
      }
      return summariesWithUpDown.reduce((sum, s) => sum + (s.updown_percentage || 0), 0) / summariesWithUpDown.length;
    })(),
    sandSaves: null,
    avgDriverDistance: null,
    leftMissPercentage: null,
    rightMissPercentage: null,
  };

  // Calculate left/right miss percentages from hole data
  if (validSummaries.length > 0) {
    const roundIds = validSummaries.map(s => s.round_id);
    const { data: teeResultData } = await supabase
      .from('holes')
      .select('tee_result')
      .in('round_id', roundIds)
      .not('tee_result', 'is', null);

    if (teeResultData && teeResultData.length > 0) {
      let leftMissCount = 0;
      let rightMissCount = 0;
      let totalMisses = 0;

      teeResultData.forEach(hole => {
        if (hole.tee_result === 'MissL') {
          leftMissCount++;
          totalMisses++;
        } else if (hole.tee_result === 'MissR') {
          rightMissCount++;
          totalMisses++;
        }
      });

      if (totalMisses > 0) {
        accuracy = {
          ...accuracy,
          leftMissPercentage: (leftMissCount / totalMisses) * 100,
          rightMissPercentage: (rightMissCount / totalMisses) * 100,
        };
      }
    }
  }

  // Fetch hole-level data for GIR by par type
  if (validSummaries.length > 0) {
    const roundIds = validSummaries.map(s => s.round_id);
    const { data: holesData } = await supabase
      .from('holes')
      .select('par, score, putts')
      .in('round_id', roundIds);

    if (holesData && holesData.length > 0) {
      const girByPar = {
        par3: { gir: 0, total: 0 },
        par4: { gir: 0, total: 0 },
        par5: { gir: 0, total: 0 },
      };

      holesData.forEach(hole => {
        if (hole.score && hole.par && hole.putts !== null) {
          const strokesBeforePutt = hole.score - hole.putts;
          const isGIR = strokesBeforePutt <= hole.par - 2;

          if (hole.par === 3) {
            girByPar.par3.total++;
            if (isGIR) girByPar.par3.gir++;
          } else if (hole.par === 4) {
            girByPar.par4.total++;
            if (isGIR) girByPar.par4.gir++;
          } else if (hole.par === 5) {
            girByPar.par5.total++;
            if (isGIR) girByPar.par5.gir++;
          }
        }
      });

      accuracy = {
        ...accuracy,
        girPar3: girByPar.par3.total > 0 ? (girByPar.par3.gir / girByPar.par3.total) * 100 : null,
        girPar4: girByPar.par4.total > 0 ? (girByPar.par4.gir / girByPar.par4.total) * 100 : null,
        girPar5: girByPar.par5.total > 0 ? (girByPar.par5.gir / girByPar.par5.total) * 100 : null,
      };
    }
  }

  // Calculate putting stats - including putt distribution from hole data
  let putting: PuttingStats = {
    puttsPerRound: validSummaries.length > 0 
      ? validSummaries.reduce((sum, s) => sum + (s.total_putts || 0), 0) / validSummaries.length 
      : null,
    onePuttPercentage: null,
    twoPuttPercentage: null,
    threePuttPercentage: null,
    fourPlusPuttPercentage: null,
    threePuttAvoidance: validSummaries.length > 0 
      ? 100 - (validSummaries.reduce((sum, s) => sum + (s.three_putts || 0), 0) / validSummaries.reduce((sum, s) => sum + (s.holes_played || 0), 0)) * 100
      : null,
    puttsPerGIR: null,
  };

  // Calculate putt distribution from hole-level data
  if (validSummaries.length > 0) {
    const roundIds = validSummaries.map(s => s.round_id);
    const { data: puttHolesData } = await supabase
      .from('holes')
      .select('putts')
      .in('round_id', roundIds)
      .not('putts', 'is', null);

    if (puttHolesData && puttHolesData.length > 0) {
      let onePutts = 0, twoPutts = 0, threePutts = 0, fourPlusPutts = 0;
      
      puttHolesData.forEach(hole => {
        if (hole.putts === 1) onePutts++;
        else if (hole.putts === 2) twoPutts++;
        else if (hole.putts === 3) threePutts++;
        else if (hole.putts !== null && hole.putts >= 4) fourPlusPutts++;
      });

      const totalHolesWithPutts = puttHolesData.length;
      putting = {
        ...putting,
        onePuttPercentage: totalHolesWithPutts > 0 ? (onePutts / totalHolesWithPutts) * 100 : null,
        twoPuttPercentage: totalHolesWithPutts > 0 ? (twoPutts / totalHolesWithPutts) * 100 : null,
        threePuttPercentage: totalHolesWithPutts > 0 ? (threePutts / totalHolesWithPutts) * 100 : null,
        fourPlusPuttPercentage: totalHolesWithPutts > 0 ? (fourPlusPutts / totalHolesWithPutts) * 100 : null,
      };
    }
  }

  // Fetch strokes gained from pro_stats if available
  const { data: proRounds } = await supabase
    .from('pro_stats_rounds')
    .select('id, holes_played')
    .eq('user_id', userId);

  let strokesGained: StrokesGainedStats = {
    total: null,
    offTheTee: null,
    approach: null,
    shortGame: null,
    putting: null,
    other: null,
    scoring: null,
  };

  // Variables to accumulate pro stats data for Basic Stats
  let proFairwaysHit = 0;
  let proFairwayAttempts = 0;
  let proGIRCount = 0;
  let proGIRAttempts = 0;
  let proScramblingSuccess = 0;
  let proScramblingAttempts = 0;
  let proTotalPutts = 0;
  let proHolesWithPutts = 0;
  let proOnePutts = 0;
  let proTwoPutts = 0;
  let proThreePutts = 0;
  let proFourPlusPutts = 0;

  if (proRounds && proRounds.length > 0) {
    const roundIds = proRounds.map(r => r.id);
    const { data: holes } = await supabase
      .from('pro_stats_holes')
      .select('par, score, putts, pro_shot_data')
      .in('pro_round_id', roundIds);

    if (holes && holes.length > 0) {
      let sgTee = 0, sgApproach = 0, sgShort = 0, sgPutt = 0, sgOther = 0, sgScoring = 0;
      let totalDriverDistance = 0;
      let driverDistanceCount = 0;

      holes.forEach(hole => {
        const par = hole.par;
        const putts = hole.putts;
        const shots = hole.pro_shot_data as any[] | null;
        
        if (shots && Array.isArray(shots)) {
          // Calculate strokes gained by category
          shots.forEach((shot, idx) => {
            const sg = shot.strokesGained || 0;
            const type = shot.type;
            const dist = shot.startDistance || 0;
            const startLie = shot.startLie;
            // Note: category field may not exist on all shots, so we categorize based on shot properties
            const category = (shot as any).category;
            
            // Calculate driver distance from tee shots
            if (type === 'tee' && shot.startDistance && shot.endDistance !== undefined) {
              const driverDist = shot.startDistance - shot.endDistance;
              if (driverDist > 0) {
                totalDriverDistance += driverDist;
                driverDistanceCount++;
              }
            }
            
            // Categorize strokes gained
            // First check if explicit category exists (for backwards compatibility)
            if (category === 'other') {
              sgOther += sg;
            } else if (category === 'scoring') {
              sgScoring += sg;
            } else if (type === 'putt' || startLie === 'green') {
              // Putting shots
              sgPutt += sg;
            } else if (idx === 0 && dist >= 200) {
              // First shot from 200m+ = tee shot
              sgTee += sg;
            } else if (dist >= 40) {
              // Shots from 40m+ = approach shots
              sgApproach += sg;
            } else if (dist > 0) {
              // Shots under 40m = short game
              sgShort += sg;
            } else {
              // Fallback to other
              sgOther += sg;
            }
          });

          // Calculate fairways hit (for par 4s and 5s)
          if (par >= 4) {
            const teeShot = shots.find(s => s.type === 'tee');
            if (teeShot && teeShot.endLie) {
              proFairwayAttempts++;
              if (teeShot.endLie === 'fairway') {
                proFairwaysHit++;
              }
            }
          }

          // Calculate GIR
          let strokeCount = 0;
          let hitGreen = false;
          const girTarget = par - 2;
          
          for (const shot of shots) {
            if (shot.isOB || shot.type === 'penalty') continue;
            strokeCount++;
            if (shot.endLie === 'green' || shot.holed) {
              hitGreen = true;
              break;
            }
          }
          
          if (hitGreen || shots.some(s => s.endLie === 'green' || s.holed)) {
            proGIRAttempts++;
            if (strokeCount <= girTarget) {
              proGIRCount++;
            }
          }

          // Calculate scrambling (up and down when missed GIR)
          const missedGIR = strokeCount > girTarget || !hitGreen;
          if (missedGIR) {
            // Find if they got up and down
            const nonGreenShots = shots.filter(s => s.startLie !== 'green' && s.type !== 'putt');
            const lastNonGreenShotIdx = shots.findIndex(s => s.endLie === 'green' || s.holed);
            
            if (lastNonGreenShotIdx > 0) {
              proScramblingAttempts++;
              // Check if they holed out in 2 strokes or less after reaching green area
              const shotsAfterMiss = shots.slice(lastNonGreenShotIdx);
              const puttCount = shotsAfterMiss.filter(s => s.type === 'putt' || s.startLie === 'green').length;
              if (puttCount <= 1 || shotsAfterMiss.some(s => s.holed && puttCount <= 1)) {
                proScramblingSuccess++;
              }
            }
          }
        }

        // Calculate putting stats
        if (putts !== null && putts !== undefined) {
          proTotalPutts += putts;
          proHolesWithPutts++;
          if (putts === 1) proOnePutts++;
          else if (putts === 2) proTwoPutts++;
          else if (putts === 3) proThreePutts++;
          else if (putts >= 4) proFourPlusPutts++;
        }
      });

      const roundCount = proRounds.length;
      if (roundCount > 0) {
        const total = sgTee + sgApproach + sgShort + sgPutt + sgOther + sgScoring;
        strokesGained = {
          total: total / roundCount,
          offTheTee: sgTee / roundCount,
          approach: sgApproach / roundCount,
          shortGame: sgShort / roundCount,
          putting: sgPutt / roundCount,
          other: sgOther !== 0 ? sgOther / roundCount : null,
          scoring: sgScoring !== 0 ? sgScoring / roundCount : null,
        };
        
        // Update accuracy with driver distance
        if (driverDistanceCount > 0) {
          accuracy = {
            ...accuracy,
            avgDriverDistance: totalDriverDistance / driverDistanceCount,
          };
        }
      }
    }
  }

  // Merge pro stats into accuracy and putting if we have pro data
  // Pro stats take precedence if available, otherwise fall back to regular round data
  if (proFairwayAttempts > 0) {
    accuracy = {
      ...accuracy,
      fairwaysHit: (proFairwaysHit / proFairwayAttempts) * 100,
    };
  }
  
  if (proGIRAttempts > 0) {
    accuracy = {
      ...accuracy,
      greensInRegulation: (proGIRCount / proGIRAttempts) * 100,
    };
  }
  
  if (proScramblingAttempts > 0) {
    // Check if all greens were hit (no scramble opportunities)
    if (proGIRAttempts > 0 && proGIRCount === proGIRAttempts) {
      // All greens hit = no scramble opportunities = N/A
      accuracy = {
        ...accuracy,
        scrambling: null,
      };
    } else {
    accuracy = {
      ...accuracy,
      scrambling: (proScramblingSuccess / proScramblingAttempts) * 100,
    };
    }
  } else {
    // No scramble attempts at all = N/A
    // Only set to null if we have pro stats data, otherwise keep existing value
    if (proRounds && proRounds.length > 0) {
      accuracy = {
        ...accuracy,
        scrambling: null,
      };
    }
  }
  
  if (proHolesWithPutts > 0) {
    const proRoundCount = proRounds?.length || 1;
    putting = {
      ...putting,
      puttsPerRound: proTotalPutts / proRoundCount,
      onePuttPercentage: (proOnePutts / proHolesWithPutts) * 100,
      twoPuttPercentage: (proTwoPutts / proHolesWithPutts) * 100,
      threePuttPercentage: (proThreePutts / proHolesWithPutts) * 100,
      fourPlusPuttPercentage: (proFourPlusPutts / proHolesWithPutts) * 100,
      threePuttAvoidance: 100 - ((proThreePutts + proFourPlusPutts) / proHolesWithPutts) * 100,
    };
  }

  // Update roundsPlayed to include pro stats rounds if no regular rounds
  const totalRoundsPlayed = roundsPlayed > 0 ? roundsPlayed : (proRounds?.length || 0);

  return {
    scoring,
    strokesGained,
    accuracy,
    putting,
    roundsPlayed: totalRoundsPlayed,
  };
}

// Drill recommendations based on stats
export interface DrillRecommendation {
  drillId: string;
  drillTitle: string;
  category: string;
  reason: string;
  path: string;
}

export const getDrillRecommendations = (stats: AllStats): DrillRecommendation[] => {
  const recommendations: DrillRecommendation[] = [];

  // Putting recommendations
  if (stats.putting.puttsPerRound && stats.putting.puttsPerRound > 32) {
    recommendations.push({
      drillId: 'pga-tour-18',
      drillTitle: 'PGA Tour 18 Holes',
      category: 'Putting',
      reason: 'Improve distance control and consistency',
      path: '/drill/pga-tour-18'
    });
    recommendations.push({
      drillId: 'aggressive-putting',
      drillTitle: 'Aggressive Putting',
      category: 'Putting',
      reason: 'Build confidence on mid-range putts',
      path: '/drill/aggressive-putting'
    });
  }

  if (stats.strokesGained.putting !== null && stats.strokesGained.putting < -0.1) {
    recommendations.push({
      drillId: 'short-putting-test',
      drillTitle: 'Short Putting Test',
      category: 'Putting',
      reason: 'Losing strokes on the green - focus on short putts',
      path: '/drill/short-putting-test'
    });
    recommendations.push({
      drillId: 'jason-day-lag',
      drillTitle: 'Jason Day Lag Putting',
      category: 'Putting',
      reason: 'Improve lag putting to reduce 3-putts',
      path: '/drill/jason-day-lag'
    });
  }

  // Short game recommendations
  if (stats.accuracy.scrambling !== null && stats.accuracy.scrambling < 40) {
    recommendations.push({
      drillId: '8-ball-drill',
      drillTitle: '8-Ball Drill',
      category: 'Short Game',
      reason: 'Improve up-and-down percentage',
      path: '/drill/8-ball-drill'
    });
    recommendations.push({
      drillId: 'easy-chip',
      drillTitle: 'Easy Chip',
      category: 'Short Game',
      reason: 'Master basic chip shots',
      path: '/drill/easy-chip'
    });
  }

  if (stats.strokesGained.shortGame !== null && stats.strokesGained.shortGame < -0.1) {
    recommendations.push({
      drillId: 'up-downs-test',
      drillTitle: 'Up & Downs Test',
      category: 'Short Game',
      reason: 'Losing strokes around the green',
      path: '/drill/up-downs-test'
    });
  }

  // Approach recommendations
  if (stats.accuracy.greensInRegulation !== null && stats.accuracy.greensInRegulation < 40) {
    recommendations.push({
      drillId: 'approach-control',
      drillTitle: 'Approach Control',
      category: 'Approach',
      reason: 'Hit more greens in regulation',
      path: '/drill/approach-control'
    });
    recommendations.push({
      drillId: 'wedges-progression',
      drillTitle: 'Wedges Progression',
      category: 'Wedges',
      reason: 'Improve wedge distance control',
      path: '/drill/wedges-progression'
    });
  }

  // Tee shot recommendations
  if (stats.accuracy.fairwaysHit !== null && stats.accuracy.fairwaysHit < 50) {
    recommendations.push({
      drillId: 'driver-control',
      drillTitle: 'Driver Control',
      category: 'Driving',
      reason: 'Find more fairways off the tee',
      path: '/drill/driver-control'
    });
    recommendations.push({
      drillId: 'shot-shape-master',
      drillTitle: 'Shot Shape Master',
      category: 'Full Swing',
      reason: 'Control your ball flight',
      path: '/drill/shot-shape-master'
    });
  }

  // Limit to top 4 recommendations
  return recommendations.slice(0, 4);
};

// Identify key insights
export interface StatInsight {
  area: string;
  status: 'strength' | 'weakness';
  message: string;
  value: string;
  category: 'putting' | 'short-game' | 'approach' | 'driving' | 'scoring';
}

export const getStatInsights = (stats: AllStats): StatInsight[] => {
  const insights: StatInsight[] = [];

  // Strokes Gained insights
  if (stats.strokesGained.putting !== null) {
    if (stats.strokesGained.putting >= 0.1) {
      insights.push({
        area: 'Putting',
        status: 'strength',
        message: 'You\'re gaining strokes on the greens',
        value: formatSG(stats.strokesGained.putting),
        category: 'putting'
      });
    } else if (stats.strokesGained.putting <= -0.1) {
      insights.push({
        area: 'Putting',
        status: 'weakness',
        message: 'You\'re losing strokes on the greens',
        value: formatSG(stats.strokesGained.putting),
        category: 'putting'
      });
    }
  }

  if (stats.strokesGained.shortGame !== null) {
    if (stats.strokesGained.shortGame >= 0.1) {
      insights.push({
        area: 'Short Game',
        status: 'strength',
        message: 'Strong around the green',
        value: formatSG(stats.strokesGained.shortGame),
        category: 'short-game'
      });
    } else if (stats.strokesGained.shortGame <= -0.1) {
      insights.push({
        area: 'Short Game',
        status: 'weakness',
        message: 'Losing strokes around the green',
        value: formatSG(stats.strokesGained.shortGame),
        category: 'short-game'
      });
    }
  }

  if (stats.strokesGained.approach !== null) {
    if (stats.strokesGained.approach >= 0.2) {
      insights.push({
        area: 'Approach Play',
        status: 'strength',
        message: 'Excellent iron play',
        value: formatSG(stats.strokesGained.approach),
        category: 'approach'
      });
    } else if (stats.strokesGained.approach <= -0.2) {
      insights.push({
        area: 'Approach Play',
        status: 'weakness',
        message: 'Iron play needs work',
        value: formatSG(stats.strokesGained.approach),
        category: 'approach'
      });
    }
  }

  if (stats.strokesGained.offTheTee !== null) {
    if (stats.strokesGained.offTheTee >= 0.2) {
      insights.push({
        area: 'Off the Tee',
        status: 'strength',
        message: 'Strong driving',
        value: formatSG(stats.strokesGained.offTheTee),
        category: 'driving'
      });
    } else if (stats.strokesGained.offTheTee <= -0.2) {
      insights.push({
        area: 'Off the Tee',
        status: 'weakness',
        message: 'Losing strokes off the tee',
        value: formatSG(stats.strokesGained.offTheTee),
        category: 'driving'
      });
    }
  }

  // Accuracy insights
  if (stats.accuracy.greensInRegulation !== null) {
    if (stats.accuracy.greensInRegulation >= 55) {
      insights.push({
        area: 'Greens in Regulation',
        status: 'strength',
        message: 'Hitting greens consistently',
        value: formatPercentage(stats.accuracy.greensInRegulation),
        category: 'approach'
      });
    } else if (stats.accuracy.greensInRegulation <= 35) {
      insights.push({
        area: 'Greens in Regulation',
        status: 'weakness',
        message: 'Missing too many greens',
        value: formatPercentage(stats.accuracy.greensInRegulation),
        category: 'approach'
      });
    }
  }

  if (stats.accuracy.scrambling !== null) {
    if (stats.accuracy.scrambling >= 50) {
      insights.push({
        area: 'Scrambling',
        status: 'strength',
        message: 'Great at saving par',
        value: formatPercentage(stats.accuracy.scrambling),
        category: 'short-game'
      });
    } else if (stats.accuracy.scrambling <= 30) {
      insights.push({
        area: 'Scrambling',
        status: 'weakness',
        message: 'Struggling to save par',
        value: formatPercentage(stats.accuracy.scrambling),
        category: 'short-game'
      });
    }
  }

  // Separate strengths and weaknesses
  const strengths = insights.filter(i => i.status === 'strength');
  const weaknesses = insights.filter(i => i.status === 'weakness');
  
  // Sort strengths by value (highest first) and keep only the best one
  strengths.sort((a, b) => {
    const aVal = parseFloat(a.value.replace('+', '').replace('%', ''));
    const bVal = parseFloat(b.value.replace('+', '').replace('%', ''));
    return bVal - aVal;
  });
  
  const bestStrength = strengths.length > 0 ? [strengths[0]] : [];
  
  // Return best strength first, then weaknesses
  return [...bestStrength, ...weaknesses];
};
