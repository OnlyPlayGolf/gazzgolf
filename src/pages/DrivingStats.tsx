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
  endLie?: string;
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
  const [roundsAnalyzed, setRoundsAnalyzed] = useState(0);

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

        // Fetch pro stats rounds (this is where our data comes from)
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

        if (!proRounds || proRounds.length === 0) {
          setStats(null);
          setSGStats(null);
          setRoundsAnalyzed(0);
          setLoading(false);
          return;
        }

        setRoundsAnalyzed(proRounds.length);
        const proRoundIds = proRounds.map(r => r.id);

        const { data: proHoles } = await supabase
          .from('pro_stats_holes')
          .select('pro_shot_data')
          .in('pro_round_id', proRoundIds);

        if (proHoles && proHoles.length > 0) {
          let sgOffTheTee = 0;
          let teeShots = 0;
          let fairwaysHit = 0;
          let leftMissCount = 0;
          let rightMissCount = 0;
          let totalDistances = 0;
          let distanceCount = 0;

          proHoles.forEach(hole => {
            if (hole.pro_shot_data && Array.isArray(hole.pro_shot_data)) {
              const shots = hole.pro_shot_data as unknown as Shot[];
              shots.forEach(shot => {
                if (shot.type === 'tee') {
                  sgOffTheTee += shot.strokesGained;
                  teeShots++;
                  
                  // Calculate driving distance from tee shots
                  if (shot.startDistance && shot.endDistance !== undefined) {
                    totalDistances += shot.startDistance - shot.endDistance;
                    distanceCount++;
                  }
                  
                  // Determine fairway hit or miss based on endLie
                  if (shot.endLie) {
                    if (shot.endLie === 'fairway' || shot.endLie === 'green') {
                      fairwaysHit++;
                    } else if (shot.endLie === 'rough') {
                      // We can't determine left vs right from the data, but we can count rough hits
                      // For now, we'll just track total misses
                      // The miss direction isn't available in current data
                    }
                  }
                }
              });
            }
          });

          const totalFairways = teeShots;
          const totalMisses = totalFairways - fairwaysHit;
          const accuracy = totalFairways > 0 ? (fairwaysHit / totalFairways) * 100 : null;
          const avgDistance = distanceCount > 0 ? totalDistances / distanceCount : null;

          setStats({
            accuracy,
            totalFairways,
            fairwaysHit,
            avgDistance,
            leftMiss: null, // Miss direction not available in current pro_shot_data
            rightMiss: null,
            leftMissCount: 0,
            rightMissCount: 0,
            totalMisses
          });

          // Calculate per-round average SG
          const roundsCount = proRounds.length;
          setSGStats({
            sgOffTheTee: roundsCount > 0 ? sgOffTheTee / roundsCount : 0,
            roundsCount
          });
        } else {
          setStats(null);
          setSGStats(null);
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
              {roundsAnalyzed} {roundsAnalyzed === 1 ? 'round' : 'rounds'} analyzed • {getFilterLabel()}
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
            {sgStats && sgStats.roundsCount > 0 && (
              <Card className="mb-4">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <TrendingUp className="h-5 w-5 text-primary" />
                    Strokes Gained - Off the Tee
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    Based on {sgStats.roundsCount} pro stat {sgStats.roundsCount !== 1 ? 'rounds' : 'round'}
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
