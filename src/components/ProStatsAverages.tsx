import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, TrendingUp, Target } from "lucide-react";
import { subDays, subMonths, subYears, startOfDay } from "date-fns";

interface Shot {
  type: 'tee' | 'approach' | 'putt';
  startDistance: number;
  startLie?: string;
  holed: boolean;
  endDistance?: number;
  strokesGained: number;
}

interface ScoringStats {
  roundsCount: number;
  holesCount: number;
  avgScore: number;
  avgScoreVsPar: number;
  scoreHoles1to6: number;
  scoreHoles7to12: number;
  scoreHoles13to18: number;
  scorePar3: number;
  scorePar4: number;
  scorePar5: number;
  eagles: number;
  birdies: number;
  pars: number;
  bogeys: number;
  doubleBogeys: number;
  tripleOrWorse: number;
}

interface SGStats {
  roundsCount: number;
  holesCount: number;
  avgScoreVsPar: number;
  sgTeeTotal: number;
  sgApproachTotal: number;
  sgApproach200Plus: number;
  sgApproach120to200: number;
  sgApproach40to120: number;
  sgShortGameTotal: number;
  sgShortGameFwRough: number;
  sgShortGameBunker: number;
  sgPuttingTotal: number;
  sgPutting0to2: number;
  sgPutting2to7: number;
  sgPutting7Plus: number;
  sgTotal: number;
}

type TimeFilter = 'week' | 'month' | 'year' | 'all';
type StatsView = 'scoring' | 'strokes-gained';

export const ProStatsAverages = () => {
  const [filter, setFilter] = useState<TimeFilter>('all');
  const [view, setView] = useState<StatsView>('scoring');
  const [scoringStats, setScoringStats] = useState<ScoringStats | null>(null);
  const [sgStats, setSgStats] = useState<SGStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAverages();
  }, [filter]);

  const getDateFilter = () => {
    const now = new Date();
    switch (filter) {
      case 'week':
        return startOfDay(subDays(now, 7)).toISOString();
      case 'month':
        return startOfDay(subMonths(now, 1)).toISOString();
      case 'year':
        return startOfDay(subYears(now, 1)).toISOString();
      case 'all':
      default:
        return null;
    }
  };

  const fetchAverages = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      let query = supabase
        .from('pro_stats_rounds')
        .select('id, created_at')
        .eq('user_id', user.id)
        .eq('holes_played', 18);

      const dateFilter = getDateFilter();
      if (dateFilter) {
        query = query.gte('created_at', dateFilter);
      }

      const { data: proRounds, error: roundsError } = await query;
      
      if (roundsError) throw roundsError;
      
      if (!proRounds || proRounds.length === 0) {
        setScoringStats(null);
        setSgStats(null);
        setLoading(false);
        return;
      }

      const roundIds = proRounds.map(r => r.id);

      const { data: holesData, error: holesError } = await supabase
        .from('pro_stats_holes')
        .select('pro_round_id, hole_number, par, score, pro_shot_data')
        .in('pro_round_id', roundIds);

      if (holesError) throw holesError;

      // Initialize scoring stats
      let totalScore = 0;
      let totalPar = 0;
      let totalHoles = 0;
      let scoreHoles1to6 = 0;
      let scoreHoles7to12 = 0;
      let scoreHoles13to18 = 0;
      let scorePar3 = 0;
      let scorePar4 = 0;
      let scorePar5 = 0;
      let eagles = 0;
      let birdies = 0;
      let pars = 0;
      let bogeys = 0;
      let doubleBogeys = 0;
      let tripleOrWorse = 0;

      // Initialize SG stats
      let sgTeeTotal = 0;
      let sgApproachTotal = 0;
      let sgApproach200Plus = 0;
      let sgApproach120to200 = 0;
      let sgApproach40to120 = 0;
      let sgShortGameTotal = 0;
      let sgShortGameFwRough = 0;
      let sgShortGameBunker = 0;
      let sgPuttingTotal = 0;
      let sgPutting0to2 = 0;
      let sgPutting2to7 = 0;
      let sgPutting7Plus = 0;

      holesData?.forEach(hole => {
        const score = hole.score || 0;
        const par = hole.par || 0;
        const holeNum = hole.hole_number || 0;
        const diff = score - par;

        totalScore += score;
        totalPar += par;
        totalHoles++;

        // Score by hole range
        if (holeNum >= 1 && holeNum <= 6) {
          scoreHoles1to6 += score;
        } else if (holeNum >= 7 && holeNum <= 12) {
          scoreHoles7to12 += score;
        } else if (holeNum >= 13 && holeNum <= 18) {
          scoreHoles13to18 += score;
        }

        // Score by par
        if (par === 3) {
          scorePar3 += score;
        } else if (par === 4) {
          scorePar4 += score;
        } else if (par === 5) {
          scorePar5 += score;
        }

        // Score distribution
        if (diff <= -2) {
          eagles++;
        } else if (diff === -1) {
          birdies++;
        } else if (diff === 0) {
          pars++;
        } else if (diff === 1) {
          bogeys++;
        } else if (diff === 2) {
          doubleBogeys++;
        } else if (diff >= 3) {
          tripleOrWorse++;
        }

        // Strokes gained by category
        if (hole.pro_shot_data) {
          const shots = hole.pro_shot_data as unknown as Shot[];
          
          shots.forEach(shot => {
            const sg = shot.strokesGained || 0;
            const dist = shot.startDistance || 0;
            const lie = shot.startLie || '';
            const shotType = shot.type;

            if (shotType === 'putt') {
              // Putting
              sgPuttingTotal += sg;
              if (dist <= 2) {
                sgPutting0to2 += sg;
              } else if (dist <= 7) {
                sgPutting2to7 += sg;
              } else {
                sgPutting7Plus += sg;
              }
            } else if (shotType === 'tee' && par >= 4) {
              // Tee shots on par 4/5
              sgTeeTotal += sg;
            } else if (dist >= 40) {
              // Approach shots (40m+)
              sgApproachTotal += sg;
              if (dist >= 200) {
                sgApproach200Plus += sg;
              } else if (dist >= 120) {
                sgApproach120to200 += sg;
              } else {
                sgApproach40to120 += sg;
              }
            } else {
              // Short game (under 40m, not putting)
              sgShortGameTotal += sg;
              if (lie === 'bunker' || lie === 'sand') {
                sgShortGameBunker += sg;
              } else {
                sgShortGameFwRough += sg;
              }
            }
          });
        }
      });

      const validRounds = proRounds.length;

      if (validRounds === 0 || totalHoles === 0) {
        setScoringStats(null);
        setSgStats(null);
        setLoading(false);
        return;
      }

      setScoringStats({
        roundsCount: validRounds,
        holesCount: totalHoles,
        avgScore: totalScore / validRounds,
        avgScoreVsPar: (totalScore - totalPar) / validRounds,
        scoreHoles1to6: scoreHoles1to6 / validRounds,
        scoreHoles7to12: scoreHoles7to12 / validRounds,
        scoreHoles13to18: scoreHoles13to18 / validRounds,
        scorePar3: scorePar3 / validRounds,
        scorePar4: scorePar4 / validRounds,
        scorePar5: scorePar5 / validRounds,
        eagles: eagles / validRounds,
        birdies: birdies / validRounds,
        pars: pars / validRounds,
        bogeys: bogeys / validRounds,
        doubleBogeys: doubleBogeys / validRounds,
        tripleOrWorse: tripleOrWorse / validRounds,
      });

      setSgStats({
        roundsCount: validRounds,
        holesCount: totalHoles,
        avgScoreVsPar: (totalScore - totalPar) / validRounds,
        sgTeeTotal: sgTeeTotal / validRounds,
        sgApproachTotal: sgApproachTotal / validRounds,
        sgApproach200Plus: sgApproach200Plus / validRounds,
        sgApproach120to200: sgApproach120to200 / validRounds,
        sgApproach40to120: sgApproach40to120 / validRounds,
        sgShortGameTotal: sgShortGameTotal / validRounds,
        sgShortGameFwRough: sgShortGameFwRough / validRounds,
        sgShortGameBunker: sgShortGameBunker / validRounds,
        sgPuttingTotal: sgPuttingTotal / validRounds,
        sgPutting0to2: sgPutting0to2 / validRounds,
        sgPutting2to7: sgPutting2to7 / validRounds,
        sgPutting7Plus: sgPutting7Plus / validRounds,
        sgTotal: (sgTeeTotal + sgApproachTotal + sgShortGameTotal + sgPuttingTotal) / validRounds,
      });

    } catch (error) {
      console.error('Error fetching averages:', error);
      setScoringStats(null);
      setSgStats(null);
    } finally {
      setLoading(false);
    }
  };

  const getSGColor = (value: number) => {
    if (value > 0) return "text-green-500";
    if (value < 0) return "text-red-500";
    return "text-muted-foreground";
  };

  const formatSG = (value: number) => {
    return value >= 0 ? `+${value.toFixed(2)}` : value.toFixed(2);
  };

  const getScoreColor = (diff: number) => {
    if (diff <= 0) return "text-green-500";
    if (diff <= 5) return "text-yellow-500";
    return "text-red-500";
  };

  const StatRow = ({ label, value, isSubcategory = false, isBold = false }: { label: string; value: string | number; isSubcategory?: boolean; isBold?: boolean }) => (
    <div className={`flex justify-between py-1.5 border-b ${isSubcategory ? 'pl-4' : ''}`}>
      <span className={`text-sm ${isBold ? 'font-semibold' : ''}`}>{label}</span>
      <span className={`text-sm ${isBold ? 'font-semibold' : 'font-medium'}`}>{value}</span>
    </div>
  );

  const SGRow = ({ label, value, isSubcategory = false, isBold = false }: { label: string; value: number; isSubcategory?: boolean; isBold?: boolean }) => (
    <div className={`flex justify-between py-1.5 border-b ${isSubcategory ? 'pl-4' : ''}`}>
      <span className={`text-sm ${isBold ? 'font-semibold' : ''}`}>{label}</span>
      <span className={`text-sm ${isBold ? 'font-semibold' : 'font-medium'} ${getSGColor(value)}`}>
        {formatSG(value)}
      </span>
    </div>
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Performance Averages
          </CardTitle>
        </div>
        
        {/* Stats View Toggle */}
        <Tabs value={view} onValueChange={(v) => setView(v as StatsView)} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="scoring" className="flex items-center gap-1">
              <Target className="h-4 w-4" />
              Scoring
            </TabsTrigger>
            <TabsTrigger value="strokes-gained" className="flex items-center gap-1">
              <TrendingUp className="h-4 w-4" />
              Strokes Gained
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Time Filter */}
        <Tabs value={filter} onValueChange={(v) => setFilter(v as TimeFilter)} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="week">Week</TabsTrigger>
            <TabsTrigger value="month">Month</TabsTrigger>
            <TabsTrigger value="year">Year</TabsTrigger>
            <TabsTrigger value="all">All Time</TabsTrigger>
          </TabsList>
        </Tabs>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (!scoringStats || !sgStats) ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No Pro Stats rounds found for this period
          </p>
        ) : view === 'scoring' ? (
          <div className="space-y-1">
            <StatRow label="Rounds" value={scoringStats.roundsCount} />
            <StatRow label="Holes" value={scoringStats.holesCount} />
            <StatRow label="Score" value={scoringStats.avgScore.toFixed(1)} />
            <StatRow label="Score/par" value={`${scoringStats.avgScoreVsPar >= 0 ? '+' : ''}${scoringStats.avgScoreVsPar.toFixed(1)}`} />
            <StatRow label="Score par 3" value={scoringStats.scorePar3.toFixed(1)} />
            <StatRow label="Score par 4" value={scoringStats.scorePar4.toFixed(1)} />
            <StatRow label="Score par 5" value={scoringStats.scorePar5.toFixed(1)} />
            <StatRow label="Eagles" value={scoringStats.eagles.toFixed(1)} />
            <StatRow label="Birdies" value={scoringStats.birdies.toFixed(1)} />
            <StatRow label="Par" value={scoringStats.pars.toFixed(1)} />
            <StatRow label="Bogey" value={scoringStats.bogeys.toFixed(1)} />
            <StatRow label="Double" value={scoringStats.doubleBogeys.toFixed(1)} />
            <StatRow label="Triple or worse" value={scoringStats.tripleOrWorse.toFixed(1)} />
          </div>
        ) : (
          <div className="space-y-1">
            <StatRow label="Rounds" value={sgStats.roundsCount} />
            <StatRow label="Holes" value={sgStats.holesCount} />
            <StatRow label="Score/par" value={`${sgStats.avgScoreVsPar >= 0 ? '+' : ''}${sgStats.avgScoreVsPar.toFixed(1)}`} />
            
            <SGRow label="Tee shots par 4/5 tot." value={sgStats.sgTeeTotal} isBold />
            
            <SGRow label="Approach 40-240m tot." value={sgStats.sgApproachTotal} isBold />
            <SGRow label="200+" value={sgStats.sgApproach200Plus} isSubcategory />
            <SGRow label="120-200m" value={sgStats.sgApproach120to200} isSubcategory />
            <SGRow label="40-120m" value={sgStats.sgApproach40to120} isSubcategory />
            
            <SGRow label="Short game tot." value={sgStats.sgShortGameTotal} isBold />
            <SGRow label="Short game fw & rough" value={sgStats.sgShortGameFwRough} isSubcategory />
            <SGRow label="Short game bunker" value={sgStats.sgShortGameBunker} isSubcategory />
            
            <SGRow label="Putting tot." value={sgStats.sgPuttingTotal} isBold />
            <SGRow label="0-2m" value={sgStats.sgPutting0to2} isSubcategory />
            <SGRow label="2-7m" value={sgStats.sgPutting2to7} isSubcategory />
            <SGRow label="7+m" value={sgStats.sgPutting7Plus} isSubcategory />
            
            <div className="flex justify-between py-2 border-t-2 border-primary mt-2">
              <span className="text-sm font-bold">Strokes Gained tot.</span>
              <span className={`text-sm font-bold ${getSGColor(sgStats.sgTotal)}`}>
                {formatSG(sgStats.sgTotal)}
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
