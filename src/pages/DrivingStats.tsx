import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TopNavBar } from "@/components/TopNavBar";
import { ArrowLeft, Target, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { StatsFilter } from "@/utils/statisticsCalculations";
import { cn } from "@/lib/utils";
import { subYears, startOfDay } from "date-fns";

type TimeFilter = StatsFilter;

interface Shot {
  type: 'tee' | 'approach' | 'putt';
  startDistance: number;
  startLie?: string;
  holed: boolean;
  endDistance?: number;
  strokesGained: number;
}

interface DrivingStats {
  accuracy: number | null;
  totalFairways: number;
  fairwaysHit: number;
  avgDistance: number | null;
  leftMiss: number | null;
  rightMiss: number | null;
  leftMissCount: number;
  rightMissCount: number;
  totalMisses: number;
}

interface TeeSGStats {
  sgOffTheTee: number;
  roundsCount: number;
}

const formatPercentage = (value: number | null): string => {
  if (value === null) return '-';
  return `${value.toFixed(1)}%`;
};

const formatDistance = (value: number | null): string => {
  if (value === null) return '-';
  return `${Math.round(value)} m`;
};

const getSGColor = (value: number) => {
  if (value > 0.01) return "text-green-500";
  if (value < -0.01) return "text-red-500";
  return "text-muted-foreground";
};

const formatSG = (value: number) => {
  if (Math.abs(value) < 0.005) return "0.00";
  return value >= 0 ? `+${value.toFixed(2)}` : value.toFixed(2);
};

const StatRow = ({ 
  label, 
  value, 
  subValue,
  isHighlighted = false
}: { 
  label: string; 
  value: string;
  subValue?: string;
  isHighlighted?: boolean;
}) => (
  <div className={cn(
    "flex items-center justify-between py-3 border-b border-border/50 last:border-0",
    isHighlighted && "bg-muted/30 -mx-3 px-3"
  )}>
    <span className={cn(
      "text-sm",
      isHighlighted ? "font-semibold text-foreground" : "text-foreground"
    )}>{label}</span>
    <div className="flex items-center gap-3">
      {subValue && (
        <span className="text-xs text-muted-foreground">{subValue}</span>
      )}
      <span className="text-sm font-medium text-foreground">{value}</span>
    </div>
  </div>
);

const SGRow = ({ 
  label, 
  value,
  isHighlighted = false
}: { 
  label: string; 
  value: number;
  isHighlighted?: boolean;
}) => (
  <div className={cn(
    "flex items-center justify-between py-3 border-b border-border/50 last:border-0",
    isHighlighted && "bg-muted/30 -mx-3 px-3"
  )}>
    <span className={cn(
      "text-sm",
      isHighlighted ? "font-semibold text-foreground" : "text-foreground"
    )}>{label}</span>
    <span className={cn("text-sm font-bold", getSGColor(value))}>
      {formatSG(value)}
    </span>
  </div>
);

export default function DrivingStats() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<DrivingStats | null>(null);
  const [sgStats, setSGStats] = useState<TeeSGStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('all');
  const [proRoundsCount, setProRoundsCount] = useState(0);
  const [roundsPlayed, setRoundsPlayed] = useState(0);

  const getFilterLabel = () => {
    switch (timeFilter) {
      case 'last5': return 'Last 5 Rounds';
      case 'last10': return 'Last 10 Rounds';
      case 'last20': return 'Last 20 Rounds';
      case 'last50': return 'Last 50 Rounds';
      case 'year': return 'This Year';
      default: return 'All Time';
    }
  };

  useEffect(() => {
    const loadStats = async () => {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/auth');
        return;
      }

      try {
        // Calculate date filter
        let dateFilter: string | null = null;
        const now = new Date();
        if (timeFilter === 'year') {
          dateFilter = startOfDay(subYears(now, 1)).toISOString();
        }

        // Fetch rounds
        let roundsQuery = supabase
          .from('rounds')
          .select('id, date_played')
          .eq('user_id', user.id)
          .order('date_played', { ascending: false });

        if (dateFilter) {
          roundsQuery = roundsQuery.gte('date_played', dateFilter);
        }

        if (timeFilter === 'last5') {
          roundsQuery = roundsQuery.limit(5);
        } else if (timeFilter === 'last10') {
          roundsQuery = roundsQuery.limit(10);
        } else if (timeFilter === 'last20') {
          roundsQuery = roundsQuery.limit(20);
        } else if (timeFilter === 'last50') {
          roundsQuery = roundsQuery.limit(50);
        }

        const { data: rounds } = await roundsQuery;

        if (!rounds || rounds.length === 0) {
          setStats(null);
          setSGStats(null);
          setRoundsPlayed(0);
          setLoading(false);
          return;
        }

        setRoundsPlayed(rounds.length);
        const roundIds = rounds.map(r => r.id);

        // Fetch holes data for par 4 and par 5 holes
        const { data: drivingHoles } = await supabase
          .from('holes')
          .select('tee_result, par')
          .in('round_id', roundIds)
          .or('par.eq.4,par.eq.5');

        // Calculate driving stats
        let fairwaysHit = 0;
        let totalFairways = 0;
        let leftMissCount = 0;
        let rightMissCount = 0;

        (drivingHoles || []).forEach(hole => {
          if (hole.tee_result) {
            totalFairways++;
            if (hole.tee_result === 'FIR') {
              fairwaysHit++;
            } else if (hole.tee_result === 'MissL') {
              leftMissCount++;
            } else if (hole.tee_result === 'MissR') {
              rightMissCount++;
            }
          }
        });

        const totalMisses = leftMissCount + rightMissCount;
        const accuracy = totalFairways > 0 ? (fairwaysHit / totalFairways) * 100 : null;
        const leftMiss = totalMisses > 0 ? (leftMissCount / totalMisses) * 100 : null;
        const rightMiss = totalMisses > 0 ? (rightMissCount / totalMisses) * 100 : null;

        setStats({
          accuracy,
          totalFairways,
          fairwaysHit,
          avgDistance: null, // Would need distance data from shots
          leftMiss,
          rightMiss,
          leftMissCount,
          rightMissCount,
          totalMisses
        });

        // Fetch pro stats rounds for SG data
        let proRoundsQuery = supabase
          .from('pro_stats_rounds')
          .select('id, created_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (dateFilter) {
          proRoundsQuery = proRoundsQuery.gte('created_at', dateFilter);
        }

        if (timeFilter === 'last5') {
          proRoundsQuery = proRoundsQuery.limit(5);
        } else if (timeFilter === 'last10') {
          proRoundsQuery = proRoundsQuery.limit(10);
        } else if (timeFilter === 'last20') {
          proRoundsQuery = proRoundsQuery.limit(20);
        } else if (timeFilter === 'last50') {
          proRoundsQuery = proRoundsQuery.limit(50);
        }

        const { data: proRounds } = await proRoundsQuery;

        if (proRounds && proRounds.length > 0) {
          setProRoundsCount(proRounds.length);
          const proRoundIds = proRounds.map(r => r.id);

          const { data: proHoles } = await supabase
            .from('pro_stats_holes')
            .select('pro_shot_data')
            .in('pro_round_id', proRoundIds);

          if (proHoles) {
            let sgOffTheTee = 0;
            let teeShots = 0;

            proHoles.forEach(hole => {
              if (hole.pro_shot_data && Array.isArray(hole.pro_shot_data)) {
                const shots = hole.pro_shot_data as unknown as Shot[];
                shots.forEach(shot => {
                  if (shot.type === 'tee') {
                    sgOffTheTee += shot.strokesGained;
                    teeShots++;
                  }
                });
              }
            });

            // Calculate per-round average
            const roundsCount = proRounds.length;
            setSGStats({
              sgOffTheTee: roundsCount > 0 ? sgOffTheTee / roundsCount : 0,
              roundsCount
            });
          }
        } else {
          setSGStats(null);
          setProRoundsCount(0);
        }

      } catch (error) {
        console.error('Error loading driving stats:', error);
      } finally {
        setLoading(false);
      }
    };

    loadStats();
  }, [navigate, timeFilter]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <TopNavBar />
        <div className="flex items-center justify-center pt-32">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 pb-20">
      <TopNavBar />
      <div className="pt-16 px-4">
        {/* Header */}
        <div className="flex items-center gap-3 py-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Driving Statistics</h1>
            <p className="text-sm text-muted-foreground">
              {roundsPlayed} {roundsPlayed === 1 ? 'round' : 'rounds'} analyzed • {getFilterLabel()}
            </p>
          </div>
        </div>

        {/* Time Filter */}
        <div className="mb-6">
          <Select value={timeFilter} onValueChange={(v) => setTimeFilter(v as TimeFilter)}>
            <SelectTrigger className="w-full bg-card">
              <SelectValue placeholder="Select time period" />
            </SelectTrigger>
            <SelectContent className="bg-card">
              <SelectItem value="all">All Time</SelectItem>
              <SelectItem value="year">This Year</SelectItem>
              <SelectItem value="last50">Last 50 Rounds</SelectItem>
              <SelectItem value="last20">Last 20 Rounds</SelectItem>
              <SelectItem value="last10">Last 10 Rounds</SelectItem>
              <SelectItem value="last5">Last 5 Rounds</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {!stats || stats.totalFairways === 0 ? (
          <Card className="bg-muted/50">
            <CardContent className="p-6 text-center">
              <TrendingUp className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
              <h3 className="font-semibold text-foreground mb-2">No Driving Data Yet</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Play some rounds tracking tee shots to see your driving statistics
              </p>
              <Button onClick={() => navigate('/rounds')}>
                Start a Round
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Off the Tee SG Section */}
            {sgStats && proRoundsCount > 0 && (
              <Card className="mb-4">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <TrendingUp className="h-5 w-5 text-primary" />
                    Strokes Gained - Off the Tee
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    Based on {proRoundsCount} pro stat {proRoundsCount !== 1 ? 'rounds' : 'round'}
                  </p>
                </CardHeader>
                <CardContent>
                  <SGRow 
                    label="Off the Tee (per round)"
                    value={sgStats.sgOffTheTee}
                    isHighlighted
                  />
                </CardContent>
              </Card>
            )}

            {/* Driving Accuracy Section */}
            <Card className="mb-4">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Target className="h-5 w-5 text-primary" />
                  Driving Accuracy
                </CardTitle>
              </CardHeader>
              <CardContent>
                <StatRow 
                  label="Fairways Hit"
                  value={formatPercentage(stats.accuracy)}
                  subValue={`${stats.fairwaysHit}/${stats.totalFairways}`}
                  isHighlighted
                />
              </CardContent>
            </Card>

            {/* Miss Tendencies Section */}
            {stats.totalMisses > 0 && (
              <Card className="mb-4">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Target className="h-5 w-5 text-primary" />
                    Miss Tendencies
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    Distribution of missed fairways
                  </p>
                </CardHeader>
                <CardContent>
                  <StatRow 
                    label="Left Miss"
                    value={formatPercentage(stats.leftMiss)}
                    subValue={`${stats.leftMissCount} shots`}
                  />
                  <StatRow 
                    label="Right Miss"
                    value={formatPercentage(stats.rightMiss)}
                    subValue={`${stats.rightMissCount} shots`}
                  />
                </CardContent>
              </Card>
            )}

            {/* Driving Distance Section - placeholder for future */}
            <Card className="mb-4">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Target className="h-5 w-5 text-primary" />
                  Driving Distance
                </CardTitle>
              </CardHeader>
              <CardContent>
                <StatRow 
                  label="Average Distance"
                  value={formatDistance(stats.avgDistance)}
                  isHighlighted
                />
                <p className="text-xs text-muted-foreground mt-2">
                  Distance tracking requires pro stats round data
                </p>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
