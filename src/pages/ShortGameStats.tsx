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
import { StatsFilter, formatPercentage } from "@/utils/statisticsCalculations";
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

interface ShortGameSGStats {
  sgShortGameTotal: number;
  sgShortGame0to20Total: number;
  sgShortGame0to20Fairway: number;
  sgShortGame0to20Rough: number;
  sgShortGame0to20Bunker: number;
  sgShortGame20to40Total: number;
  sgShortGame20to40Fairway: number;
  sgShortGame20to40Bunker: number;
  scramblePercentage: number | null;
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

export default function ShortGameStats() {
  const navigate = useNavigate();
  const [sgStats, setSgStats] = useState<ShortGameSGStats | null>(null);
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
        // Fetch pro stats for SG short game data
        const getDateFilter = () => {
          const now = new Date();
          switch (timeFilter) {
            case 'year':
              return startOfDay(subYears(now, 1)).toISOString();
            case 'last50':
            case 'last20':
            case 'last5':
            case 'all':
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

        const { data: allProRounds, error: roundsError } = await query;

        if (roundsError) throw roundsError;

        if (!allProRounds || allProRounds.length === 0) {
          setSgStats(null);
          setProRoundsCount(0);
          setLoading(false);
          return;
        }

        // Filter out orphaned pro_stats_rounds (where external_round_id points to a deleted round)
        const roundsWithExternalId = allProRounds.filter(pr => pr.external_round_id);
        let validProRounds = allProRounds;
        if (roundsWithExternalId.length > 0) {
          const externalRoundIds = roundsWithExternalId.map(pr => pr.external_round_id!);
          const { data: existingRounds } = await supabase
            .from('rounds')
            .select('id')
            .in('id', externalRoundIds);
          const existingRoundIds = new Set((existingRounds || []).map(r => r.id));
          validProRounds = allProRounds.filter(pr => !pr.external_round_id || existingRoundIds.has(pr.external_round_id));
        }

        if (validProRounds.length === 0) {
          setSgStats(null);
          setProRoundsCount(0);
          setLoading(false);
          return;
        }

        setProRoundsCount(validProRounds.length);
        const roundIds = validProRounds.map(r => r.id);

        const { data: holesData, error: holesError } = await supabase
          .from('pro_stats_holes')
          .select('pro_round_id, hole_number, par, score, pro_shot_data')
          .in('pro_round_id', roundIds);

        if (holesError) throw holesError;

        // Initialize SG stats
        let sgShortGame0to20Total = 0;
        let sgShortGame0to20Fairway = 0;
        let sgShortGame0to20Rough = 0;
        let sgShortGame0to20Bunker = 0;
        let sgShortGame20to40Total = 0;
        let sgShortGame20to40Fairway = 0;
        let sgShortGame20to40Bunker = 0;
        let sgShortGameTotal = 0;

        // For scramble percentage calculation
        let scrambleOpportunities = 0;
        let scrambleSuccesses = 0;

        // Process each hole's shot data
        for (const hole of holesData || []) {
          const shotData = hole.pro_shot_data as unknown as Shot[] | null;
          if (!shotData) continue;

          // Check for scramble opportunity (missed GIR)
          let hitGreen = false;
          let madeParOrBetter = hole.score <= hole.par;
          
          for (let i = 0; i < shotData.length; i++) {
            const shot = shotData[i];

            // Check if hit green in regulation
            const shotsToGreen = hole.par - 2;
            if (i < shotsToGreen && shot.type === 'approach' && shot.holed === false) {
              const nextShot = shotData[i + 1];
              if (nextShot && nextShot.type === 'putt') {
                hitGreen = true;
              }
            }

            // Short game shots (0-40m from off the green)
            if (shot.type === 'approach' && shot.startDistance <= 40) {
              const lie = shot.startLie?.toLowerCase() || 'fairway';
              const sg = shot.strokesGained || 0;

              if (shot.startDistance <= 20) {
                sgShortGame0to20Total += sg;
                if (lie.includes('bunker') || lie.includes('sand')) {
                  sgShortGame0to20Bunker += sg;
                } else if (lie.includes('rough')) {
                  sgShortGame0to20Rough += sg;
                } else {
                  sgShortGame0to20Fairway += sg;
                }
              } else {
                sgShortGame20to40Total += sg;
                if (lie.includes('bunker') || lie.includes('sand')) {
                  sgShortGame20to40Bunker += sg;
                } else {
                  sgShortGame20to40Fairway += sg;
                }
              }
              sgShortGameTotal += sg;
            }
          }

          // Track scramble opportunities
          if (!hitGreen) {
            scrambleOpportunities++;
            if (madeParOrBetter) {
              scrambleSuccesses++;
            }
          }
        }

        // Normalize by rounds count
        const rounds = proRounds.length;

        setSgStats({
          sgShortGameTotal: sgShortGameTotal / rounds,
          sgShortGame0to20Total: sgShortGame0to20Total / rounds,
          sgShortGame0to20Fairway: sgShortGame0to20Fairway / rounds,
          sgShortGame0to20Rough: sgShortGame0to20Rough / rounds,
          sgShortGame0to20Bunker: sgShortGame0to20Bunker / rounds,
          sgShortGame20to40Total: sgShortGame20to40Total / rounds,
          sgShortGame20to40Fairway: sgShortGame20to40Fairway / rounds,
          sgShortGame20to40Bunker: sgShortGame20to40Bunker / rounds,
          scramblePercentage: scrambleOpportunities > 0 
            ? (scrambleSuccesses / scrambleOpportunities) * 100 
            : null,
          roundsCount: rounds
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
            <h1 className="text-2xl font-bold text-foreground">Short Game Statistics</h1>
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
              <SelectItem value="last5">Last 5 Rounds</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Short Game Section */}
        {sgStats && proRoundsCount > 0 ? (
          <Card className="mb-4">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <TrendingUp className="h-5 w-5 text-primary" />
                Short Game
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Based on {proRoundsCount} pro stat {proRoundsCount === 1 ? 'round' : 'rounds'}
              </p>
            </CardHeader>
            <CardContent>
              <div className="bg-muted/30 rounded-lg p-3 space-y-1">
                <SGRow label="Total" value={sgStats.sgShortGameTotal} isBold />
                <StatRow label="Scramble %" value={formatPercentage(sgStats.scramblePercentage)} />
                <div className="border-t border-border/30 my-2" />
                <SGRow label="Short game 0-20m" value={sgStats.sgShortGame0to20Total} isBold />
                <SGRow label="Fairway" value={sgStats.sgShortGame0to20Fairway} indent />
                <SGRow label="Rough" value={sgStats.sgShortGame0to20Rough} indent />
                <SGRow label="Bunker" value={sgStats.sgShortGame0to20Bunker} indent />
                <div className="border-t border-border/30 my-1" />
                <SGRow label="Short game 20-40m" value={sgStats.sgShortGame20to40Total} isBold />
                <SGRow label="Fairway" value={sgStats.sgShortGame20to40Fairway} indent />
                <SGRow label="Bunker" value={sgStats.sgShortGame20to40Bunker} indent />
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-6 text-center">
              <TrendingUp className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
              <h3 className="font-semibold text-foreground mb-2">No Data Available</h3>
              <p className="text-sm text-muted-foreground">
                Play some Pro Stats rounds to see detailed short game statistics
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
