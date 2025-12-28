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
import { ArrowLeft, Circle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { StatsFilter } from "@/utils/statisticsCalculations";
import { cn } from "@/lib/utils";

type TimeFilter = StatsFilter;

interface PuttingDistanceStats {
  allPutts: { made: number; total: number; percentage: number | null };
  distance0to1m: { made: number; total: number; percentage: number | null };
  distance1to2m: { made: number; total: number; percentage: number | null };
  distance2to4m: { made: number; total: number; percentage: number | null };
  distance4to6m: { made: number; total: number; percentage: number | null };
  distance6to8m: { made: number; total: number; percentage: number | null };
  distance8to10m: { made: number; total: number; percentage: number | null };
  distance10to14m: { made: number; total: number; percentage: number | null };
  distance14to18m: { made: number; total: number; percentage: number | null };
  distance18plus: { made: number; total: number; percentage: number | null };
  threePuttAvoidance: number | null;
}

const formatPercentage = (value: number | null): string => {
  if (value === null) return '-';
  return `${value.toFixed(1)}%`;
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

export default function PuttingStats() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<PuttingDistanceStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('all');
  const [roundsPlayed, setRoundsPlayed] = useState(0);

  useEffect(() => {
    const loadStats = async () => {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/auth');
        return;
      }

      try {
        // Fetch putting stats from holes data
        // For now, we'll create placeholder structure - actual implementation depends on data tracking
        const puttingStats: PuttingDistanceStats = {
          allPutts: { made: 0, total: 0, percentage: null },
          distance0to1m: { made: 0, total: 0, percentage: null },
          distance1to2m: { made: 0, total: 0, percentage: null },
          distance2to4m: { made: 0, total: 0, percentage: null },
          distance4to6m: { made: 0, total: 0, percentage: null },
          distance6to8m: { made: 0, total: 0, percentage: null },
          distance8to10m: { made: 0, total: 0, percentage: null },
          distance10to14m: { made: 0, total: 0, percentage: null },
          distance14to18m: { made: 0, total: 0, percentage: null },
          distance18plus: { made: 0, total: 0, percentage: null },
          threePuttAvoidance: null,
        };

        // Fetch rounds count
        let roundsQuery = supabase
          .from('rounds')
          .select('id', { count: 'exact' })
          .eq('user_id', user.id);

        if (timeFilter === 'year') {
          const startOfYear = new Date(new Date().getFullYear(), 0, 1).toISOString();
          roundsQuery = roundsQuery.gte('date_played', startOfYear);
        }

        const { count } = await roundsQuery;
        setRoundsPlayed(count || 0);

        // TODO: Implement actual putting distance tracking from holes data
        // This would require additional fields in the holes table to track putt distances
        
        setStats(puttingStats);
      } catch (error) {
        console.error('Error loading putting stats:', error);
      } finally {
        setLoading(false);
      }
    };

    loadStats();
  }, [navigate, timeFilter]);

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
            <h1 className="text-2xl font-bold text-foreground">Putting Statistics</h1>
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

        {/* Putting by Distance Section */}
        <Card className="mb-4">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Circle className="h-5 w-5 text-primary" />
              Putting by Distance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <StatRow 
              label="All Putts"
              value={formatPercentage(stats?.allPutts.percentage ?? null)}
              subValue={stats?.allPutts.total ? `${stats.allPutts.made}/${stats.allPutts.total}` : undefined}
              isHighlighted
            />
            <StatRow 
              label="0-1 m"
              value={formatPercentage(stats?.distance0to1m.percentage ?? null)}
              subValue={stats?.distance0to1m.total ? `${stats.distance0to1m.made}/${stats.distance0to1m.total}` : undefined}
            />
            <StatRow 
              label="1-2 m"
              value={formatPercentage(stats?.distance1to2m.percentage ?? null)}
              subValue={stats?.distance1to2m.total ? `${stats.distance1to2m.made}/${stats.distance1to2m.total}` : undefined}
            />
            <StatRow 
              label="2-4 m"
              value={formatPercentage(stats?.distance2to4m.percentage ?? null)}
              subValue={stats?.distance2to4m.total ? `${stats.distance2to4m.made}/${stats.distance2to4m.total}` : undefined}
            />
            <StatRow 
              label="4-6 m"
              value={formatPercentage(stats?.distance4to6m.percentage ?? null)}
              subValue={stats?.distance4to6m.total ? `${stats.distance4to6m.made}/${stats.distance4to6m.total}` : undefined}
            />
            <StatRow 
              label="6-8 m"
              value={formatPercentage(stats?.distance6to8m.percentage ?? null)}
              subValue={stats?.distance6to8m.total ? `${stats.distance6to8m.made}/${stats.distance6to8m.total}` : undefined}
            />
            <StatRow 
              label="8-10 m"
              value={formatPercentage(stats?.distance8to10m.percentage ?? null)}
              subValue={stats?.distance8to10m.total ? `${stats.distance8to10m.made}/${stats.distance8to10m.total}` : undefined}
            />
            <StatRow 
              label="10-14 m"
              value={formatPercentage(stats?.distance10to14m.percentage ?? null)}
              subValue={stats?.distance10to14m.total ? `${stats.distance10to14m.made}/${stats.distance10to14m.total}` : undefined}
            />
            <StatRow 
              label="14-18 m"
              value={formatPercentage(stats?.distance14to18m.percentage ?? null)}
              subValue={stats?.distance14to18m.total ? `${stats.distance14to18m.made}/${stats.distance14to18m.total}` : undefined}
            />
            <StatRow 
              label="18+ m"
              value={formatPercentage(stats?.distance18plus.percentage ?? null)}
              subValue={stats?.distance18plus.total ? `${stats.distance18plus.made}/${stats.distance18plus.total}` : undefined}
            />
          </CardContent>
        </Card>

        {/* 3-Putt Avoidance Section */}
        <Card className="mb-4">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Circle className="h-5 w-5 text-primary" />
              3-Putt Avoidance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <StatRow 
              label="3-Putt Avoidance"
              value={formatPercentage(stats?.threePuttAvoidance ?? null)}
              isHighlighted
            />
            <p className="text-xs text-muted-foreground mt-2">
              Percentage of holes where you avoided 3-putting or worse
            </p>
          </CardContent>
        </Card>

        {/* No data message */}
        {roundsPlayed === 0 && (
          <Card className="bg-muted/50">
            <CardContent className="p-6 text-center">
              <Circle className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
              <h3 className="font-semibold text-foreground mb-2">No Putting Data Yet</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Play some rounds with detailed putting tracking to see your statistics
              </p>
              <Button onClick={() => navigate('/rounds')}>
                Start a Round
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
