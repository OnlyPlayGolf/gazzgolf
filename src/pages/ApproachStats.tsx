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
import { ArrowLeft, Crosshair } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { StatsFilter } from "@/utils/statisticsCalculations";
import { cn } from "@/lib/utils";

type TimeFilter = StatsFilter;

interface ApproachDistanceStats {
  allApproaches: { gir: number; total: number; percentage: number | null };
  distance50to75: { gir: number; total: number; percentage: number | null };
  distance75to100: { gir: number; total: number; percentage: number | null };
  distance100to125: { gir: number; total: number; percentage: number | null };
  distance125to150: { gir: number; total: number; percentage: number | null };
  distance150to175: { gir: number; total: number; percentage: number | null };
  distance175to200: { gir: number; total: number; percentage: number | null };
  distance200plus: { gir: number; total: number; percentage: number | null };
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

export default function ApproachStats() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<ApproachDistanceStats | null>(null);
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
        // Fetch approach stats from holes data
        // For now, we'll create placeholder structure - actual implementation depends on data tracking
        const approachStats: ApproachDistanceStats = {
          allApproaches: { gir: 0, total: 0, percentage: null },
          distance50to75: { gir: 0, total: 0, percentage: null },
          distance75to100: { gir: 0, total: 0, percentage: null },
          distance100to125: { gir: 0, total: 0, percentage: null },
          distance125to150: { gir: 0, total: 0, percentage: null },
          distance150to175: { gir: 0, total: 0, percentage: null },
          distance175to200: { gir: 0, total: 0, percentage: null },
          distance200plus: { gir: 0, total: 0, percentage: null },
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

        // TODO: Implement actual approach distance tracking from holes data
        // This would require additional fields in the holes table to track approach distances
        
        setStats(approachStats);
      } catch (error) {
        console.error('Error loading approach stats:', error);
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
            <h1 className="text-2xl font-bold text-foreground">Approach Statistics</h1>
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

        {/* Approach by Distance Section */}
        <Card className="mb-4">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Crosshair className="h-5 w-5 text-primary" />
              GIR by Distance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <StatRow 
              label="All Approaches"
              value={formatPercentage(stats?.allApproaches.percentage ?? null)}
              subValue={stats?.allApproaches.total ? `${stats.allApproaches.gir}/${stats.allApproaches.total}` : undefined}
              isHighlighted
            />
            <StatRow 
              label="50-75 m"
              value={formatPercentage(stats?.distance50to75.percentage ?? null)}
              subValue={stats?.distance50to75.total ? `${stats.distance50to75.gir}/${stats.distance50to75.total}` : undefined}
            />
            <StatRow 
              label="75-100 m"
              value={formatPercentage(stats?.distance75to100.percentage ?? null)}
              subValue={stats?.distance75to100.total ? `${stats.distance75to100.gir}/${stats.distance75to100.total}` : undefined}
            />
            <StatRow 
              label="100-125 m"
              value={formatPercentage(stats?.distance100to125.percentage ?? null)}
              subValue={stats?.distance100to125.total ? `${stats.distance100to125.gir}/${stats.distance100to125.total}` : undefined}
            />
            <StatRow 
              label="125-150 m"
              value={formatPercentage(stats?.distance125to150.percentage ?? null)}
              subValue={stats?.distance125to150.total ? `${stats.distance125to150.gir}/${stats.distance125to150.total}` : undefined}
            />
            <StatRow 
              label="150-175 m"
              value={formatPercentage(stats?.distance150to175.percentage ?? null)}
              subValue={stats?.distance150to175.total ? `${stats.distance150to175.gir}/${stats.distance150to175.total}` : undefined}
            />
            <StatRow 
              label="175-200 m"
              value={formatPercentage(stats?.distance175to200.percentage ?? null)}
              subValue={stats?.distance175to200.total ? `${stats.distance175to200.gir}/${stats.distance175to200.total}` : undefined}
            />
            <StatRow 
              label="200+ m"
              value={formatPercentage(stats?.distance200plus.percentage ?? null)}
              subValue={stats?.distance200plus.total ? `${stats.distance200plus.gir}/${stats.distance200plus.total}` : undefined}
            />
          </CardContent>
        </Card>

        {/* No data message */}
        {roundsPlayed === 0 && (
          <Card className="bg-muted/50">
            <CardContent className="p-6 text-center">
              <Crosshair className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
              <h3 className="font-semibold text-foreground mb-2">No Approach Data Yet</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Play some rounds with detailed approach tracking to see your statistics
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
