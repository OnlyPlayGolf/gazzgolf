import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, TrendingUp } from "lucide-react";
import { subDays, subMonths, subYears, startOfDay } from "date-fns";

interface Shot {
  type: 'tee' | 'approach' | 'putt';
  startDistance: number;
  holed: boolean;
  endDistance?: number;
  strokesGained: number;
}

interface SGAverages {
  roundsCount: number;
  avgScore: number;
  avgScoreVsPar: number;
  avgOffTheTee: number;
  avgApproach: number;
  avgShortGame: number;
  avgPutting: number;
  avgTotal: number;
  avgFairwayPct: number;
  avgGirPct: number;
  avgPuttsPerHole: number;
}

type TimeFilter = 'week' | 'month' | 'year' | 'all';

export const ProStatsAverages = () => {
  const [filter, setFilter] = useState<TimeFilter>('all');
  const [averages, setAverages] = useState<SGAverages | null>(null);
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

      // Get pro stats rounds
      let query = supabase
        .from('pro_stats_rounds')
        .select('id, created_at')
        .eq('user_id', user.id)
        .not('external_round_id', 'is', null);

      const dateFilter = getDateFilter();
      if (dateFilter) {
        query = query.gte('created_at', dateFilter);
      }

      const { data: proRounds, error: roundsError } = await query;
      
      if (roundsError) throw roundsError;
      
      if (!proRounds || proRounds.length === 0) {
        setAverages(null);
        setLoading(false);
        return;
      }

      const roundIds = proRounds.map(r => r.id);

      // Get all holes for these rounds
      const { data: holesData, error: holesError } = await supabase
        .from('pro_stats_holes')
        .select('pro_round_id, par, score, pro_shot_data')
        .in('pro_round_id', roundIds);

      if (holesError) throw holesError;

      // Group holes by round
      const roundsData: Map<string, any[]> = new Map();
      holesData?.forEach(hole => {
        const existing = roundsData.get(hole.pro_round_id) || [];
        existing.push(hole);
        roundsData.set(hole.pro_round_id, existing);
      });

      // Calculate averages across all rounds
      let totalScore = 0;
      let totalPar = 0;
      let totalOffTheTee = 0;
      let totalApproach = 0;
      let totalShortGame = 0;
      let totalPutting = 0;
      let totalFairwaysHit = 0;
      let totalFairways = 0;
      let totalGir = 0;
      let totalGreens = 0;
      let totalPutts = 0;
      let totalHoles = 0;
      let validRounds = 0;

      roundsData.forEach((holes) => {
        if (holes.length === 0) return;
        validRounds++;

        holes.forEach(hole => {
          totalScore += hole.score || 0;
          totalPar += hole.par || 0;
          totalHoles++;
          totalGreens++;

          if (!hole.pro_shot_data) return;
          
          const shots = hole.pro_shot_data as Shot[];
          const puttCount = shots.filter(s => s.type === 'putt').length;
          totalPutts += puttCount;

          // Count fairways (par 4 and 5 only)
          if (hole.par >= 4) {
            totalFairways++;
            const teeShot = shots.find(s => s.type === 'tee');
            if (teeShot && !teeShot.holed) {
              totalFairwaysHit++;
            }
          }

          // GIR
          let strokesBeforeGreen = 0;
          const regulationStrokes = hole.par - 2;
          for (const shot of shots) {
            strokesBeforeGreen++;
            if (shot.type === 'putt' || shot.holed) {
              if (strokesBeforeGreen <= regulationStrokes) {
                totalGir++;
              }
              break;
            }
          }

          // Strokes gained by category
          shots.forEach(shot => {
            const sg = shot.strokesGained;
            if (shot.type === 'tee' && hole.par >= 4) {
              totalOffTheTee += sg;
            } else if (shot.type === 'approach') {
              const dist = shot.startDistance;
              if (dist >= 40) {
                totalApproach += sg;
              } else {
                totalShortGame += sg;
              }
            } else if (shot.type === 'putt') {
              totalPutting += sg;
            }
          });
        });
      });

      if (validRounds === 0) {
        setAverages(null);
        setLoading(false);
        return;
      }

      setAverages({
        roundsCount: validRounds,
        avgScore: totalScore / validRounds,
        avgScoreVsPar: (totalScore - totalPar) / validRounds,
        avgOffTheTee: totalOffTheTee / validRounds,
        avgApproach: totalApproach / validRounds,
        avgShortGame: totalShortGame / validRounds,
        avgPutting: totalPutting / validRounds,
        avgTotal: (totalOffTheTee + totalApproach + totalShortGame + totalPutting) / validRounds,
        avgFairwayPct: totalFairways > 0 ? (totalFairwaysHit / totalFairways) * 100 : 0,
        avgGirPct: totalGreens > 0 ? (totalGir / totalGreens) * 100 : 0,
        avgPuttsPerHole: totalHoles > 0 ? totalPutts / totalHoles : 0,
      });
    } catch (error) {
      console.error('Error fetching averages:', error);
      setAverages(null);
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

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Performance Averages
          </CardTitle>
        </div>
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
        ) : !averages ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No Pro Stats rounds found for this period
          </p>
        ) : (
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground text-center pb-2 border-b">
              Based on {averages.roundsCount} round{averages.roundsCount !== 1 ? 's' : ''}
            </div>

            {/* Score averages */}
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-3 bg-muted/50 rounded-lg">
                <div className="text-2xl font-bold">{averages.avgScore.toFixed(1)}</div>
                <div className="text-xs text-muted-foreground">Avg Score</div>
              </div>
              <div className="text-center p-3 bg-muted/50 rounded-lg">
                <div className={`text-2xl font-bold ${getScoreColor(averages.avgScoreVsPar)}`}>
                  {averages.avgScoreVsPar >= 0 ? '+' : ''}{averages.avgScoreVsPar.toFixed(1)}
                </div>
                <div className="text-xs text-muted-foreground">Avg vs Par</div>
              </div>
            </div>

            {/* Traditional stats */}
            <div className="space-y-2">
              <div className="flex justify-between py-1.5 border-b">
                <span className="text-sm">Fairways</span>
                <span className="text-sm font-medium">{averages.avgFairwayPct.toFixed(1)}%</span>
              </div>
              <div className="flex justify-between py-1.5 border-b">
                <span className="text-sm">Greens in Reg</span>
                <span className="text-sm font-medium">{averages.avgGirPct.toFixed(1)}%</span>
              </div>
              <div className="flex justify-between py-1.5 border-b">
                <span className="text-sm">Putts/Hole</span>
                <span className="text-sm font-medium">{averages.avgPuttsPerHole.toFixed(2)}</span>
              </div>
            </div>

            {/* Strokes Gained averages */}
            <div className="pt-2">
              <div className="text-sm font-semibold mb-2">Strokes Gained Averages</div>
              <div className="space-y-2">
                <div className="flex justify-between py-1.5 border-b">
                  <span className="text-sm">Off the Tee</span>
                  <span className={`text-sm font-medium ${getSGColor(averages.avgOffTheTee)}`}>
                    {formatSG(averages.avgOffTheTee)}
                  </span>
                </div>
                <div className="flex justify-between py-1.5 border-b">
                  <span className="text-sm">Approach</span>
                  <span className={`text-sm font-medium ${getSGColor(averages.avgApproach)}`}>
                    {formatSG(averages.avgApproach)}
                  </span>
                </div>
                <div className="flex justify-between py-1.5 border-b">
                  <span className="text-sm">Short Game</span>
                  <span className={`text-sm font-medium ${getSGColor(averages.avgShortGame)}`}>
                    {formatSG(averages.avgShortGame)}
                  </span>
                </div>
                <div className="flex justify-between py-1.5 border-b">
                  <span className="text-sm">Putting</span>
                  <span className={`text-sm font-medium ${getSGColor(averages.avgPutting)}`}>
                    {formatSG(averages.avgPutting)}
                  </span>
                </div>
                <div className="flex justify-between py-2 border-t-2 border-primary">
                  <span className="text-sm font-bold">Total SG/Round</span>
                  <span className={`text-sm font-bold ${getSGColor(averages.avgTotal)}`}>
                    {formatSG(averages.avgTotal)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
