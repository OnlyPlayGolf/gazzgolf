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
import { ArrowLeft, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { StatsFilter } from "@/utils/statisticsCalculations";
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

interface DrivingSGStats {
  sgOffTheTee: number;
  avgDistance: number | null;
  fairwayPercentage: number | null;
  fairwaysHit: number;
  totalFairways: number;
  roundsCount: number;
  leftMissPercentage: number | null;
  rightMissPercentage: number | null;
  leftMissCount: number;
  rightMissCount: number;
  totalMisses: number;
}

const getSGColor = (value: number) => {
  if (value > 0.01) return "text-green-500";
  if (value < -0.01) return "text-red-500";
  return "text-muted-foreground";
};

const formatSG = (value: number) => {
  if (Math.abs(value) < 0.005) return "0.00";
  return value >= 0 ? `+${value.toFixed(2)}` : value.toFixed(2);
};

const formatPercentage = (value: number | null): string => {
  if (value === null) return '-';
  return `${value.toFixed(1)}%`;
};

const formatDistance = (value: number | null): string => {
  if (value === null) return '-';
  return `${Math.round(value)} m`;
};

const SGRow = ({ label, value, isBold = false, indent = false }: { label: string; value: number; isBold?: boolean; indent?: boolean }) => (
  <div className={`flex justify-between py-1 ${indent ? 'pl-3' : ''}`}>
    <span className={`text-sm ${isBold ? 'font-semibold' : 'text-muted-foreground'}`}>{label}</span>
    <span className={`text-sm font-medium ${getSGColor(value)}`}>
      {formatSG(value)}
    </span>
  </div>
);

const StatRow = ({ label, value, isBold = false }: { label: string; value: string; isBold?: boolean }) => (
  <div className="flex justify-between py-1">
    <span className={`text-sm ${isBold ? 'font-semibold' : 'text-muted-foreground'}`}>{label}</span>
    <span className={`text-sm ${isBold ? 'font-semibold' : 'font-medium'} text-foreground`}>{value}</span>
  </div>
);

export default function DrivingStats() {
  const navigate = useNavigate();
  const [sgStats, setSgStats] = useState<DrivingSGStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('all');
  const [proRoundsCount, setProRoundsCount] = useState(0);

  useEffect(() => {
    const loadStats = async () => {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/auth');
        return;
      }

      try {
        // Fetch pro stats for SG driving data
        const getDateFilter = () => {
          const now = new Date();
          switch (timeFilter) {
            case 'year':
              return startOfDay(subYears(now, 1)).toISOString();
            case 'last50':
            case 'last20':
            case 'last10':
            case 'last5':
              return null; // Will limit by count instead
            default:
              return null;
          }
        };

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
          setSgStats(null);
          setProRoundsCount(0);
          setLoading(false);
          return;
        }

        setProRoundsCount(proRounds.length);
        const roundIds = proRounds.map(r => r.id);

        const { data: holesData, error: holesError } = await supabase
          .from('pro_stats_holes')
          .select('pro_round_id, hole_number, par, score, pro_shot_data')
          .in('pro_round_id', roundIds);

        if (holesError) throw holesError;

        // Initialize stats
        let sgOffTheTee = 0;
        let totalDistances = 0;
        let distanceCount = 0;
        let fairwaysHit = 0;
        let totalFairways = 0;

        // Process each hole's shot data
        for (const hole of holesData || []) {
          const shotData = hole.pro_shot_data as unknown as Shot[] | null;
          if (!shotData) continue;

          for (const shot of shotData) {
            if (shot.type === 'tee') {
              sgOffTheTee += shot.strokesGained || 0;
              totalFairways++;

              // Calculate driving distance from tee shots
              if (shot.startDistance && shot.endDistance !== undefined) {
                totalDistances += shot.startDistance - shot.endDistance;
                distanceCount++;
              }

              // Determine fairway hit based on endLie
              if (shot.endLie) {
                if (shot.endLie === 'fairway' || shot.endLie === 'green') {
                  fairwaysHit++;
                }
              }
            }
          }
        }

        // Fetch tee_result data from regular rounds for miss direction
        const { data: regularRounds } = await supabase
          .from('rounds')
          .select('id')
          .eq('user_id', user.id);

        let leftMissCount = 0;
        let rightMissCount = 0;
        let totalMisses = 0;

        if (regularRounds && regularRounds.length > 0) {
          const regularRoundIds = regularRounds.map(r => r.id);
          
          const { data: teeResultData } = await supabase
            .from('holes')
            .select('tee_result')
            .in('round_id', regularRoundIds)
            .not('tee_result', 'is', null);

          if (teeResultData) {
            for (const hole of teeResultData) {
              if (hole.tee_result === 'MissL') {
                leftMissCount++;
                totalMisses++;
              } else if (hole.tee_result === 'MissR') {
                rightMissCount++;
                totalMisses++;
              }
            }
          }
        }

        // Normalize by rounds count
        const rounds = proRounds.length;

        setSgStats({
          sgOffTheTee: sgOffTheTee / rounds,
          avgDistance: distanceCount > 0 ? totalDistances / distanceCount : null,
          fairwayPercentage: totalFairways > 0 ? (fairwaysHit / totalFairways) * 100 : null,
          fairwaysHit,
          totalFairways,
          roundsCount: rounds,
          leftMissPercentage: totalMisses > 0 ? (leftMissCount / totalMisses) * 100 : null,
          rightMissPercentage: totalMisses > 0 ? (rightMissCount / totalMisses) * 100 : null,
          leftMissCount,
          rightMissCount,
          totalMisses
        });

      } catch (error) {
        console.error('Error loading stats:', error);
      } finally {
        setLoading(false);
      }
    };

    loadStats();
  }, [timeFilter, navigate]);

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
            <h1 className="text-2xl font-bold text-foreground">Tee Shot Statistics</h1>
            <p className="text-sm text-muted-foreground">
              {proRoundsCount} pro stat {proRoundsCount === 1 ? 'round' : 'rounds'} analyzed • {getFilterLabel()}
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

        {/* Driving Section */}
        {sgStats && proRoundsCount > 0 ? (
          <Card className="mb-4">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <TrendingUp className="h-5 w-5 text-primary" />
                Driving
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Based on {proRoundsCount} pro stat {proRoundsCount === 1 ? 'round' : 'rounds'}
              </p>
            </CardHeader>
            <CardContent>
              <div className="bg-muted/30 rounded-lg p-3 space-y-1">
                <SGRow label="Off the tee" value={sgStats.sgOffTheTee} isBold />
                <div className="border-t border-border/30 my-2" />
                <StatRow 
                  label="Fairways Hit" 
                  value={formatPercentage(sgStats.fairwayPercentage)} 
                />
                <StatRow 
                  label="Left Miss" 
                  value={sgStats.totalMisses > 0 ? formatPercentage(sgStats.leftMissPercentage) : "N/A"} 
                />
                <StatRow 
                  label="Right Miss" 
                  value={sgStats.totalMisses > 0 ? formatPercentage(sgStats.rightMissPercentage) : "N/A"} 
                />
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-6 text-center">
              <TrendingUp className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
              <h3 className="font-semibold text-foreground mb-2">No Data Available</h3>
              <p className="text-sm text-muted-foreground">
                Play some Pro Stats rounds to see detailed driving statistics
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
