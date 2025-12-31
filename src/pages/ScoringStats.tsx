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
import { ArrowLeft, Target } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { StatsFilter } from "@/utils/statisticsCalculations";
import { subYears, startOfDay } from "date-fns";

type TimeFilter = StatsFilter;

interface ScoringData {
  roundsCount: number;
  holesCount: number;
  totalScore: number;
  scoreToPar: number;
  scorePar3: number;
  scorePar4: number;
  scorePar5: number;
  eagles: number;
  birdies: number;
  pars: number;
  bogeys: number;
  doubles: number;
  tripleOrWorse: number;
}

export default function ScoringStats() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<ScoringData | null>(null);
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
        .select('score, par')
        .in('pro_round_id', roundIds);

      if (!holesData || holesData.length === 0) {
        setStats(null);
        setLoading(false);
        return;
      }

      let totalScore = 0;
      let totalPar = 0;
      let scorePar3 = 0;
      let scorePar4 = 0;
      let scorePar5 = 0;
      let par3Count = 0;
      let par4Count = 0;
      let par5Count = 0;
      let eagles = 0;
      let birdies = 0;
      let pars = 0;
      let bogeys = 0;
      let doubles = 0;
      let tripleOrWorse = 0;

      holesData.forEach(hole => {
        const score = hole.score || 0;
        const par = hole.par || 4;
        const diff = score - par;

        totalScore += score;
        totalPar += par;

        if (par === 3) {
          scorePar3 += score;
          par3Count++;
        } else if (par === 4) {
          scorePar4 += score;
          par4Count++;
        } else if (par >= 5) {
          scorePar5 += score;
          par5Count++;
        }

        if (diff <= -2) eagles++;
        else if (diff === -1) birdies++;
        else if (diff === 0) pars++;
        else if (diff === 1) bogeys++;
        else if (diff === 2) doubles++;
        else if (diff >= 3) tripleOrWorse++;
      });

      const roundsCount = proRounds.length;

      setStats({
        roundsCount,
        holesCount: holesData.length,
        totalScore: totalScore / roundsCount,
        scoreToPar: (totalScore - totalPar) / roundsCount,
        scorePar3: par3Count > 0 ? scorePar3 / roundsCount : 0,
        scorePar4: par4Count > 0 ? scorePar4 / roundsCount : 0,
        scorePar5: par5Count > 0 ? scorePar5 / roundsCount : 0,
        eagles: eagles / roundsCount,
        birdies: birdies / roundsCount,
        pars: pars / roundsCount,
        bogeys: bogeys / roundsCount,
        doubles: doubles / roundsCount,
        tripleOrWorse: tripleOrWorse / roundsCount,
      });
    } catch (error) {
      console.error('Error fetching scoring stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const StatRow = ({ label, value }: { label: string; value: string }) => (
    <div className="flex justify-between py-2 border-b border-border/50">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-foreground">{value}</span>
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
            <h1 className="text-2xl font-bold text-foreground">Scoring Stats</h1>
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
              <Target className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
              <h3 className="font-semibold text-foreground mb-2">No Data Yet</h3>
              <p className="text-sm text-muted-foreground">
                Play some Pro Stats rounds to see your scoring stats
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Target className="h-5 w-5 text-primary" />
                Scoring Overview
              </CardTitle>
            </CardHeader>
            <CardContent>
              <StatRow label="Rounds" value={stats.roundsCount.toString()} />
              <StatRow label="Holes" value={stats.holesCount.toString()} />
              <StatRow label="Score" value={stats.totalScore.toFixed(1)} />
              <StatRow label="Score/par" value={stats.scoreToPar >= 0 ? `+${stats.scoreToPar.toFixed(1)}` : stats.scoreToPar.toFixed(1)} />
              <StatRow label="Score par 3" value={stats.scorePar3.toFixed(1)} />
              <StatRow label="Score par 4" value={stats.scorePar4.toFixed(1)} />
              <StatRow label="Score par 5" value={stats.scorePar5.toFixed(1)} />
              <StatRow label="Eagles" value={stats.eagles.toFixed(1)} />
              <StatRow label="Birdies" value={stats.birdies.toFixed(1)} />
              <StatRow label="Par" value={stats.pars.toFixed(1)} />
              <StatRow label="Bogey" value={stats.bogeys.toFixed(1)} />
              <StatRow label="Double" value={stats.doubles.toFixed(1)} />
              <StatRow label="Triple or worse" value={stats.tripleOrWorse.toFixed(1)} />
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
