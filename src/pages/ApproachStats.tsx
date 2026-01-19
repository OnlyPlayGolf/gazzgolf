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
import { ArrowLeft, Crosshair, TrendingUp } from "lucide-react";
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

interface GIRStats {
  all: { gir: number; total: number; percentage: number | null };
  par3: { gir: number; total: number; percentage: number | null };
  par4: { gir: number; total: number; percentage: number | null };
  par5: { gir: number; total: number; percentage: number | null };
}

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

interface ApproachSGStats {
  // Shots 40m+ (all long game)
  sgLongGame40Plus: number;
  sgLongGame200Plus: number;
  sgLongGame160to200: number;
  sgLongGame120to160: number;
  sgLongGame80to120: number;
  sgLongGame40to80: number;
  // Approach from Fairway
  sgApproachFw40Plus: number;
  sgApproachFw200Plus: number;
  sgApproachFw160to200: number;
  sgApproachFw120to160: number;
  sgApproachFw80to120: number;
  sgApproachFw40to80: number;
  // Approach from Rough
  sgApproachRough40Plus: number;
  sgApproachRough200Plus: number;
  sgApproachRough160to200: number;
  sgApproachRough120to160: number;
  sgApproachRough80to120: number;
  sgApproachRough40to80: number;
  roundsCount: number;
}

const formatPercentage = (value: number | null): string => {
  if (value === null) return '-';
  return `${value.toFixed(1)}%`;
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

const SGRow = ({ label, value, isBold = false, indent = false }: { label: string; value: number; isBold?: boolean; indent?: boolean }) => (
  <div className={`flex justify-between py-1 ${indent ? 'pl-3' : ''}`}>
    <span className={`text-sm ${isBold ? 'font-semibold' : 'text-muted-foreground'}`}>{label}</span>
    <span className={`text-sm font-medium ${getSGColor(value)}`}>
      {formatSG(value)}
    </span>
  </div>
);

export default function ApproachStats() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<ApproachDistanceStats | null>(null);
  const [girStats, setGirStats] = useState<GIRStats | null>(null);
  const [sgStats, setSgStats] = useState<ApproachSGStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('all');
  const [roundsPlayed, setRoundsPlayed] = useState(0);
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
        // Fetch approach stats from holes data
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

        const { count, data: roundsData } = await roundsQuery;
        setRoundsPlayed(count || 0);

        // Calculate GIR stats from holes data
        const girStats: GIRStats = {
          all: { gir: 0, total: 0, percentage: null },
          par3: { gir: 0, total: 0, percentage: null },
          par4: { gir: 0, total: 0, percentage: null },
          par5: { gir: 0, total: 0, percentage: null },
        };

        if (roundsData && roundsData.length > 0) {
          const roundIds = roundsData.map(r => r.id);
          
          const { data: holesForGIR } = await supabase
            .from('holes')
            .select('hole_number, par, score, putts')
            .in('round_id', roundIds);

          if (holesForGIR) {
            holesForGIR.forEach(hole => {
              if (hole.score && hole.par && hole.putts !== null) {
                const strokesBeforePutt = hole.score - hole.putts;
                const isGIR = strokesBeforePutt <= hole.par - 2;
                
                girStats.all.total++;
                if (isGIR) girStats.all.gir++;
                
                if (hole.par === 3) {
                  girStats.par3.total++;
                  if (isGIR) girStats.par3.gir++;
                } else if (hole.par === 4) {
                  girStats.par4.total++;
                  if (isGIR) girStats.par4.gir++;
                } else if (hole.par === 5) {
                  girStats.par5.total++;
                  if (isGIR) girStats.par5.gir++;
                }
              }
            });
            
            if (girStats.all.total > 0) {
              girStats.all.percentage = (girStats.all.gir / girStats.all.total) * 100;
            }
            if (girStats.par3.total > 0) {
              girStats.par3.percentage = (girStats.par3.gir / girStats.par3.total) * 100;
            }
            if (girStats.par4.total > 0) {
              girStats.par4.percentage = (girStats.par4.gir / girStats.par4.total) * 100;
            }
            if (girStats.par5.total > 0) {
              girStats.par5.percentage = (girStats.par5.gir / girStats.par5.total) * 100;
            }
          }
        }
        
        setGirStats(girStats);

        // Fetch pro stats for SG approach data
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

        const { data: allProRounds } = await proQuery;

        if (allProRounds && allProRounds.length > 0) {
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

          const roundIds = validProRounds.map(r => r.id);

          const { data: holesData } = await supabase
            .from('pro_stats_holes')
            .select('pro_round_id, hole_number, par, score, pro_shot_data')
            .in('pro_round_id', roundIds);

          // Initialize SG stats
          let sgLongGame40Plus = 0;
          let sgLongGame200Plus = 0;
          let sgLongGame160to200 = 0;
          let sgLongGame120to160 = 0;
          let sgLongGame80to120 = 0;
          let sgLongGame40to80 = 0;
          let sgApproachFw40Plus = 0;
          let sgApproachFw200Plus = 0;
          let sgApproachFw160to200 = 0;
          let sgApproachFw120to160 = 0;
          let sgApproachFw80to120 = 0;
          let sgApproachFw40to80 = 0;
          let sgApproachRough40Plus = 0;
          let sgApproachRough200Plus = 0;
          let sgApproachRough160to200 = 0;
          let sgApproachRough120to160 = 0;
          let sgApproachRough80to120 = 0;
          let sgApproachRough40to80 = 0;

          holesData?.forEach(hole => {
            if (hole.pro_shot_data) {
              const shots = hole.pro_shot_data as unknown as Shot[];
              
              shots.forEach((shot, idx) => {
                const sg = shot.strokesGained || 0;
                const dist = shot.startDistance || 0;
                const lie = (shot.startLie || '').toLowerCase();
                const isTeeShot = idx === 0;
                const isFairway = lie === 'fairway' || lie === 'tee';
                const isRough = lie === 'rough' || lie === 'first_cut';

                if (!isTeeShot && dist >= 40 && shot.type !== 'putt') {
                  // Track all long game shots 40m+
                  sgLongGame40Plus += sg;
                  if (dist >= 200) sgLongGame200Plus += sg;
                  else if (dist >= 160) sgLongGame160to200 += sg;
                  else if (dist >= 120) sgLongGame120to160 += sg;
                  else if (dist >= 80) sgLongGame80to120 += sg;
                  else sgLongGame40to80 += sg;

                  // Approach from fairway
                  if (isFairway) {
                    sgApproachFw40Plus += sg;
                    if (dist >= 200) sgApproachFw200Plus += sg;
                    else if (dist >= 160) sgApproachFw160to200 += sg;
                    else if (dist >= 120) sgApproachFw120to160 += sg;
                    else if (dist >= 80) sgApproachFw80to120 += sg;
                    else sgApproachFw40to80 += sg;
                  }
                  // Approach from rough
                  else if (isRough) {
                    sgApproachRough40Plus += sg;
                    if (dist >= 200) sgApproachRough200Plus += sg;
                    else if (dist >= 160) sgApproachRough160to200 += sg;
                    else if (dist >= 120) sgApproachRough120to160 += sg;
                    else if (dist >= 80) sgApproachRough80to120 += sg;
                    else sgApproachRough40to80 += sg;
                  }
                }
              });
            }
          });

          const validRounds = proRounds.length;
          setProRoundsCount(validRounds);

          if (validRounds > 0) {
            setSgStats({
              sgLongGame40Plus: sgLongGame40Plus / validRounds,
              sgLongGame200Plus: sgLongGame200Plus / validRounds,
              sgLongGame160to200: sgLongGame160to200 / validRounds,
              sgLongGame120to160: sgLongGame120to160 / validRounds,
              sgLongGame80to120: sgLongGame80to120 / validRounds,
              sgLongGame40to80: sgLongGame40to80 / validRounds,
              sgApproachFw40Plus: sgApproachFw40Plus / validRounds,
              sgApproachFw200Plus: sgApproachFw200Plus / validRounds,
              sgApproachFw160to200: sgApproachFw160to200 / validRounds,
              sgApproachFw120to160: sgApproachFw120to160 / validRounds,
              sgApproachFw80to120: sgApproachFw80to120 / validRounds,
              sgApproachFw40to80: sgApproachFw40to80 / validRounds,
              sgApproachRough40Plus: sgApproachRough40Plus / validRounds,
              sgApproachRough200Plus: sgApproachRough200Plus / validRounds,
              sgApproachRough160to200: sgApproachRough160to200 / validRounds,
              sgApproachRough120to160: sgApproachRough120to160 / validRounds,
              sgApproachRough80to120: sgApproachRough80to120 / validRounds,
              sgApproachRough40to80: sgApproachRough40to80 / validRounds,
              roundsCount: validRounds,
            });
          }
        }
        
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

        {/* Greens in Regulation Section */}
        {girStats && girStats.all.total > 0 && (
          <Card className="mb-4">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Crosshair className="h-5 w-5 text-primary" />
                Greens in Regulation
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-0">
              <StatRow 
                label="Greens in Regulation" 
                value={formatPercentage(girStats.all.percentage)} 
                subValue={`${girStats.all.gir}/${girStats.all.total}`}
                isHighlighted 
              />
              <StatRow 
                label="Greens in Regulation Par 3s" 
                value={formatPercentage(girStats.par3.percentage)} 
                subValue={`${girStats.par3.gir}/${girStats.par3.total}`}
              />
              <StatRow 
                label="Greens in Regulation Par 4s" 
                value={formatPercentage(girStats.par4.percentage)} 
                subValue={`${girStats.par4.gir}/${girStats.par4.total}`}
              />
              <StatRow 
                label="Greens in Regulation Par 5s" 
                value={formatPercentage(girStats.par5.percentage)} 
                subValue={`${girStats.par5.gir}/${girStats.par5.total}`}
              />
            </CardContent>
          </Card>
        )}

        {/* Shots 40m+ - Overall Long Game Section */}
        {sgStats && proRoundsCount > 0 && (
          <Card className="mb-4">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <TrendingUp className="h-5 w-5 text-primary" />
                Shots 40m+
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Based on {proRoundsCount} pro stat {proRoundsCount === 1 ? 'round' : 'rounds'}
              </p>
            </CardHeader>
            <CardContent className="space-y-1">
              <SGRow label="All (40m+)" value={sgStats.sgLongGame40Plus} isBold />
              <SGRow label="200+ m" value={sgStats.sgLongGame200Plus} indent />
              <SGRow label="160-200 m" value={sgStats.sgLongGame160to200} indent />
              <SGRow label="120-160 m" value={sgStats.sgLongGame120to160} indent />
              <SGRow label="80-120 m" value={sgStats.sgLongGame80to120} indent />
              <SGRow label="40-80 m" value={sgStats.sgLongGame40to80} indent />
            </CardContent>
          </Card>
        )}

        {/* Approach from Fairway - SG Section */}
        {sgStats && proRoundsCount > 0 && (
          <Card className="mb-4">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <TrendingUp className="h-5 w-5 text-primary" />
                Approach from Fairway
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Based on {proRoundsCount} pro stat {proRoundsCount === 1 ? 'round' : 'rounds'}
              </p>
            </CardHeader>
            <CardContent className="space-y-1">
              <SGRow label="All (40m+)" value={sgStats.sgApproachFw40Plus} isBold />
              <SGRow label="200+ m" value={sgStats.sgApproachFw200Plus} indent />
              <SGRow label="160-200 m" value={sgStats.sgApproachFw160to200} indent />
              <SGRow label="120-160 m" value={sgStats.sgApproachFw120to160} indent />
              <SGRow label="80-120 m" value={sgStats.sgApproachFw80to120} indent />
              <SGRow label="40-80 m" value={sgStats.sgApproachFw40to80} indent />
            </CardContent>
          </Card>
        )}


        {/* Approach from Rough - SG Section */}
        {sgStats && proRoundsCount > 0 && (
          <Card className="mb-4">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <TrendingUp className="h-5 w-5 text-primary" />
                Approach from Rough
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Based on {proRoundsCount} pro stat {proRoundsCount === 1 ? 'round' : 'rounds'}
              </p>
            </CardHeader>
            <CardContent className="space-y-1">
              <SGRow label="All (40m+)" value={sgStats.sgApproachRough40Plus} isBold />
              <SGRow label="200+ m" value={sgStats.sgApproachRough200Plus} indent />
              <SGRow label="160-200 m" value={sgStats.sgApproachRough160to200} indent />
              <SGRow label="120-160 m" value={sgStats.sgApproachRough120to160} indent />
              <SGRow label="80-120 m" value={sgStats.sgApproachRough80to120} indent />
              <SGRow label="40-80 m" value={sgStats.sgApproachRough40to80} indent />
            </CardContent>
          </Card>
        )}

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
