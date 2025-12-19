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
}

export interface AccuracyStats {
  fairwaysHit: number | null;
  greensInRegulation: number | null;
  scrambling: number | null;
  sandSaves: number | null;
}

export interface PuttingStats {
  puttsPerRound: number | null;
  onePuttPercentage: number | null;
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

export async function fetchUserStats(userId: string): Promise<AllStats> {
  // Fetch rounds from round_summaries view
  const { data: summaries, error: summariesError } = await supabase
    .from('round_summaries')
    .select('*')
    .eq('user_id', userId);

  if (summariesError) {
    console.error('Error fetching round summaries:', summariesError);
  }

  const validSummaries = summaries?.filter(s => s.total_score && s.total_score > 0) || [];
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

  // Calculate accuracy stats
  const accuracy: AccuracyStats = {
    fairwaysHit: validSummaries.length > 0 
      ? validSummaries.reduce((sum, s) => sum + (s.fir_percentage || 0), 0) / validSummaries.length 
      : null,
    greensInRegulation: validSummaries.length > 0 
      ? validSummaries.reduce((sum, s) => sum + (s.gir_percentage || 0), 0) / validSummaries.length 
      : null,
    scrambling: validSummaries.length > 0 
      ? validSummaries.reduce((sum, s) => sum + (s.updown_percentage || 0), 0) / validSummaries.length 
      : null,
    sandSaves: null, // Would need more detailed data
  };

  // Calculate putting stats
  const putting: PuttingStats = {
    puttsPerRound: validSummaries.length > 0 
      ? validSummaries.reduce((sum, s) => sum + (s.total_putts || 0), 0) / validSummaries.length 
      : null,
    onePuttPercentage: null, // Would need hole-by-hole data
    threePuttAvoidance: validSummaries.length > 0 
      ? 100 - (validSummaries.reduce((sum, s) => sum + (s.three_putts || 0), 0) / validSummaries.reduce((sum, s) => sum + (s.holes_played || 0), 0)) * 100
      : null,
    puttsPerGIR: null,
  };

  // Fetch strokes gained from pro_stats if available
  const { data: proRounds } = await supabase
    .from('pro_stats_rounds')
    .select('id')
    .eq('user_id', userId);

  let strokesGained: StrokesGainedStats = {
    total: null,
    offTheTee: null,
    approach: null,
    shortGame: null,
    putting: null,
  };

  if (proRounds && proRounds.length > 0) {
    const roundIds = proRounds.map(r => r.id);
    const { data: holes } = await supabase
      .from('pro_stats_holes')
      .select('pro_shot_data')
      .in('pro_round_id', roundIds);

    if (holes && holes.length > 0) {
      let sgTee = 0, sgApproach = 0, sgShort = 0, sgPutt = 0;
      let shotCount = 0;

      holes.forEach(hole => {
        if (hole.pro_shot_data && Array.isArray(hole.pro_shot_data)) {
          (hole.pro_shot_data as any[]).forEach((shot, idx) => {
            const sg = shot.strokesGained || 0;
            const type = shot.type;
            const dist = shot.startDistance || 0;
            
            if (type === 'putt') {
              sgPutt += sg;
            } else if (idx === 0 && dist >= 200) {
              sgTee += sg;
            } else if (dist >= 40) {
              sgApproach += sg;
            } else if (dist > 0) {
              sgShort += sg;
            }
            shotCount++;
          });
        }
      });

      const roundCount = proRounds.length;
      if (roundCount > 0) {
        strokesGained = {
          total: (sgTee + sgApproach + sgShort + sgPutt) / roundCount,
          offTheTee: sgTee / roundCount,
          approach: sgApproach / roundCount,
          shortGame: sgShort / roundCount,
          putting: sgPutt / roundCount,
        };
      }
    }
  }

  return {
    scoring,
    strokesGained,
    accuracy,
    putting,
    roundsPlayed,
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

  // Sort: weaknesses first, then strengths
  return insights.sort((a, b) => {
    if (a.status === 'weakness' && b.status === 'strength') return -1;
    if (a.status === 'strength' && b.status === 'weakness') return 1;
    return 0;
  });
};
