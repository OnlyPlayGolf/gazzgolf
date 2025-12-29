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
import { ArrowLeft, TrendingUp, Circle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { StatsFilter } from "@/utils/statisticsCalculations";
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

interface PuttingSGStats {
  sgPuttingTotal: number;
  sgPutting0to1: number;
  sgPutting1to2: number;
  sgPutting2to4: number;
  sgPutting4to6: number;
  sgPutting6to8: number;
  sgPutting8to10: number;
  sgPutting10to14: number;
  sgPutting14to18: number;
  sgPutting18Plus: number;
  threePuttAvoidance: number | null;
  roundsCount: number;
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

export default function PuttingStats() {
  const navigate = useNavigate();
  const [sgStats, setSgStats] = useState<PuttingSGStats | null>(null);
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
        // Fetch pro stats for SG putting data
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

        let proQuery = supabase
          .from('pro_stats_rounds')
          .select('id, created_at')
          .eq('user_id', user.id)
          .eq('holes_played', 18);

        const dateFilter = getDateFilter();
        if (dateFilter) {
          proQuery = proQuery.gte('created_at', dateFilter);
        }

        const { data: proRounds } = await proQuery;

        if (proRounds && proRounds.length > 0) {
          const roundIds = proRounds.map(r => r.id);

          const { data: holesData } = await supabase
            .from('pro_stats_holes')
            .select('pro_round_id, hole_number, par, score, putts, pro_shot_data')
            .in('pro_round_id', roundIds);

          // Initialize SG stats
          let sgPuttingTotal = 0;
          let sgPutting0to1 = 0;
          let sgPutting1to2 = 0;
          let sgPutting2to4 = 0;
          let sgPutting4to6 = 0;
          let sgPutting6to8 = 0;
          let sgPutting8to10 = 0;
          let sgPutting10to14 = 0;
          let sgPutting14to18 = 0;
          let sgPutting18Plus = 0;
          let threePuttCount = 0;
          let totalHolesWithPutts = 0;

          holesData?.forEach(hole => {
            // Count 3-putts
            if (hole.putts && hole.putts >= 3) {
              threePuttCount++;
            }
            if (hole.putts && hole.putts > 0) {
              totalHolesWithPutts++;
            }

            if (hole.pro_shot_data) {
              const shots = hole.pro_shot_data as unknown as Shot[];
              
              shots.forEach((shot) => {
                const sg = shot.strokesGained || 0;
                const dist = shot.startDistance || 0;

                if (shot.type === 'putt') {
                  sgPuttingTotal += sg;
                  if (dist <= 1) sgPutting0to1 += sg;
                  else if (dist <= 2) sgPutting1to2 += sg;
                  else if (dist <= 4) sgPutting2to4 += sg;
                  else if (dist <= 6) sgPutting4to6 += sg;
                  else if (dist <= 8) sgPutting6to8 += sg;
                  else if (dist <= 10) sgPutting8to10 += sg;
                  else if (dist <= 14) sgPutting10to14 += sg;
                  else if (dist <= 18) sgPutting14to18 += sg;
                  else sgPutting18Plus += sg;
                }
              });
            }
          });

          const validRounds = proRounds.length;
          setProRoundsCount(validRounds);

          // Calculate 3-putt avoidance percentage
          const threePuttAvoidance = totalHolesWithPutts > 0 
            ? ((totalHolesWithPutts - threePuttCount) / totalHolesWithPutts) * 100 
            : null;

          if (validRounds > 0) {
            setSgStats({
              sgPuttingTotal: sgPuttingTotal / validRounds,
              sgPutting0to1: sgPutting0to1 / validRounds,
              sgPutting1to2: sgPutting1to2 / validRounds,
              sgPutting2to4: sgPutting2to4 / validRounds,
              sgPutting4to6: sgPutting4to6 / validRounds,
              sgPutting6to8: sgPutting6to8 / validRounds,
              sgPutting8to10: sgPutting8to10 / validRounds,
              sgPutting10to14: sgPutting10to14 / validRounds,
              sgPutting14to18: sgPutting14to18 / validRounds,
              sgPutting18Plus: sgPutting18Plus / validRounds,
              threePuttAvoidance,
              roundsCount: validRounds,
            });
          }
        } else {
          setProRoundsCount(0);
          setSgStats(null);
        }
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

        {/* Putting Section */}
        {sgStats && proRoundsCount > 0 && (
          <Card className="mb-4">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <TrendingUp className="h-5 w-5 text-primary" />
                Putting
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Based on {proRoundsCount} pro stat {proRoundsCount === 1 ? 'round' : 'rounds'}
              </p>
            </CardHeader>
            <CardContent className="space-y-1">
              <SGRow label="All putts" value={sgStats.sgPuttingTotal} isBold />
              <SGRow label="0-1 m" value={sgStats.sgPutting0to1} indent />
              <SGRow label="1-2 m" value={sgStats.sgPutting1to2} indent />
              <SGRow label="2-4 m" value={sgStats.sgPutting2to4} indent />
              <SGRow label="4-6 m" value={sgStats.sgPutting4to6} indent />
              <SGRow label="6-8 m" value={sgStats.sgPutting6to8} indent />
              <SGRow label="8-10 m" value={sgStats.sgPutting8to10} indent />
              <SGRow label="10-14 m" value={sgStats.sgPutting10to14} indent />
              <SGRow label="14-18 m" value={sgStats.sgPutting14to18} indent />
              <SGRow label="18+ m" value={sgStats.sgPutting18Plus} indent />
              <div className="border-t border-border/30 my-2" />
              <StatRow 
                label="3-Putt Avoidance" 
                value={formatPercentage(sgStats.threePuttAvoidance)} 
                isBold 
              />
            </CardContent>
          </Card>
        )}

        {/* No data message */}
        {proRoundsCount === 0 && (
          <Card className="bg-muted/50">
            <CardContent className="p-6 text-center">
              <Circle className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
              <h3 className="font-semibold text-foreground mb-2">No Putting Data Yet</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Play some Pro Stats rounds with detailed putting tracking to see your statistics
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
