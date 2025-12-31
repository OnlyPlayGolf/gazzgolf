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
import { cn } from "@/lib/utils";
import { StatsFilter } from "@/utils/statisticsCalculations";
import { subYears, startOfDay } from "date-fns";

type TimeFilter = StatsFilter;

interface OtherSGStats {
  roundsCount: number;
  sgTeePar45Total: number;
  sgDrivePar45: number;
  sgOtherPar45: number;
  sgBunker40to120: number;
  sgBunker120to200: number;
  sgRecovery40to120: number;
  sgRecovery120to240: number;
  sgLayup40Plus: number;
  sgOtherTotal: number;
}

interface Shot {
  type: 'tee' | 'approach' | 'putt';
  startDistance: number;
  startLie?: string;
  holed: boolean;
  endDistance?: number;
  strokesGained: number;
}

export default function OtherStats() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<OtherSGStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('all');

  useEffect(() => {
    fetchStats();
  }, [timeFilter]);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const getDateFilter = () => {
        const now = new Date();
        switch (timeFilter) {
          case 'year':
            return startOfDay(subYears(now, 1)).toISOString();
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

      if (!proRounds || proRounds.length === 0) {
        setStats(null);
        setLoading(false);
        return;
      }

      const roundIds = proRounds.map(r => r.id);

      const { data: holesData } = await supabase
        .from('pro_stats_holes')
        .select('pro_shot_data, par')
        .in('pro_round_id', roundIds);

      let sgTeePar45Total = 0;
      let sgDrivePar45 = 0;
      let sgOtherPar45 = 0;
      let sgBunker40to120 = 0;
      let sgBunker120to200 = 0;
      let sgRecovery40to120 = 0;
      let sgRecovery120to240 = 0;
      let sgLayup40Plus = 0;

      holesData?.forEach(hole => {
        const par = hole.par || 0;
        
        if (hole.pro_shot_data) {
          const shots = hole.pro_shot_data as unknown as Shot[];
          
          shots.forEach((shot, idx) => {
            const sg = shot.strokesGained || 0;
            const dist = shot.startDistance || 0;
            const lie = (shot.startLie || '').toLowerCase();
            const shotType = shot.type;
            const isTeeShot = idx === 0;
            const isBunker = lie === 'bunker' || lie === 'sand';
            const isRecovery = lie === 'recovery' || lie === 'trees' || lie === 'penalty';

            if (shotType === 'putt') {
              // Exclude putting
            } else if (isTeeShot && par >= 4) {
              sgTeePar45Total += sg;
              if (shotType === 'tee') sgDrivePar45 += sg;
              else sgOtherPar45 += sg;
            } else if (dist >= 40) {
              if (isBunker) {
                if (dist >= 120) sgBunker120to200 += sg;
                else sgBunker40to120 += sg;
              } else if (isRecovery) {
                if (dist >= 120) sgRecovery120to240 += sg;
                else sgRecovery40to120 += sg;
              } else if (lie === 'layup') {
                sgLayup40Plus += sg;
              }
            }
          });
        }
      });

      const validRounds = proRounds.length;

      setStats({
        roundsCount: validRounds,
        sgTeePar45Total: sgTeePar45Total / validRounds,
        sgDrivePar45: sgDrivePar45 / validRounds,
        sgOtherPar45: sgOtherPar45 / validRounds,
        sgBunker40to120: sgBunker40to120 / validRounds,
        sgBunker120to200: sgBunker120to200 / validRounds,
        sgRecovery40to120: sgRecovery40to120 / validRounds,
        sgRecovery120to240: sgRecovery120to240 / validRounds,
        sgLayup40Plus: sgLayup40Plus / validRounds,
        sgOtherTotal: (sgBunker40to120 + sgBunker120to200 + sgRecovery40to120 + sgRecovery120to240 + sgLayup40Plus) / validRounds,
      });
    } catch (error) {
      console.error('Error fetching other stats:', error);
    } finally {
      setLoading(false);
    }
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

  const SGRow = ({ label, value, isBold = false, indent = false }: { label: string; value: number; isBold?: boolean; indent?: boolean }) => (
    <div className={cn("flex justify-between py-2 border-b border-border/50", indent && "pl-4")}>
      <span className={cn("text-sm", isBold ? "font-semibold" : "text-muted-foreground")}>{label}</span>
      <span className={cn("text-sm font-medium", getSGColor(value))}>
        {formatSG(value)}
      </span>
    </div>
  );

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
            <h1 className="text-2xl font-bold text-foreground">Other Stats</h1>
            <p className="text-sm text-muted-foreground">
              {stats?.roundsCount || 0} rounds analyzed
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

        {!stats ? (
          <Card className="bg-muted/50">
            <CardContent className="p-6 text-center">
              <TrendingUp className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
              <h3 className="font-semibold text-foreground mb-2">No Data Yet</h3>
              <p className="text-sm text-muted-foreground">
                Play some Pro Stats rounds to see your other strokes gained stats
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {/* Tee Shots */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  Tee Shots Par 4/5
                </CardTitle>
              </CardHeader>
              <CardContent>
                <SGRow label="Tee shots par 4/5" value={stats.sgTeePar45Total} isBold />
                <SGRow label="Drive par 4/5" value={stats.sgDrivePar45} indent />
                <SGRow label="Other par 4/5" value={stats.sgOtherPar45} indent />
              </CardContent>
            </Card>

            {/* Other Shot Types */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  Other Shot Types (40m+)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <SGRow label="Bunker 40-120m" value={stats.sgBunker40to120} />
                <SGRow label="Bunker 120-200m" value={stats.sgBunker120to200} />
                <SGRow label="Recovery 40-120m" value={stats.sgRecovery40to120} />
                <SGRow label="Recovery 120-240m" value={stats.sgRecovery120to240} />
                <SGRow label="Layup 40m+" value={stats.sgLayup40Plus} />
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
