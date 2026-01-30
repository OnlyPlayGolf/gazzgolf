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
import { StatsFilter } from "@/utils/statisticsCalculations";
import { startOfYear } from "date-fns";
import { loadUnifiedRounds } from "@/utils/unifiedRoundsLoader";

type TimeFilter = StatsFilter;

interface ScoringData {
  roundsCount: number;
  holesPerRound: number;
  scorePerHole: number | null;
  scoreToParPerHole: number | null;
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

      const now = new Date();
      // "This year" = current calendar year (Jan 1 to now)
      const startOfYearIso = startOfYear(now).toISOString();
      const toSortTime = (d: string) => {
        if (!d) return 0;
        if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return new Date(`${d}T12:00:00Z`).getTime();
        return new Date(d).getTime();
      };

      // 1) Profile rounds except scramble (same universe as profile), with time filter
      const allUnified = await loadUnifiedRounds(user.id);
      const noScramble = allUnified.filter((r) => r.gameType !== "scramble");
      const sorted = [...noScramble].sort((a, b) => toSortTime(b.date || "") - toSortTime(a.date || ""));
      let filtered = sorted;
      if (timeFilter === "year") {
        filtered = sorted.filter((r) => (r.date && toSortTime(r.date) >= toSortTime(startOfYearIso)));
      } else if (timeFilter === "last5") filtered = sorted.slice(0, 5);
      else if (timeFilter === "last10") filtered = sorted.slice(0, 10);
      else if (timeFilter === "last20") filtered = sorted.slice(0, 20);
      else if (timeFilter === "last50") filtered = sorted.slice(0, 50);

      const roundsCount = filtered.filter((r) => r.gameType === "round").length;
      const totalHolesProfile = filtered.reduce((s, r) => s + (r.holesPlayed ?? 0), 0);
      const holesPerRound = roundsCount > 0 ? totalHolesProfile / roundsCount : 0;

      // 2) Score/Hole, Score to par/Hole, and Eagles/Birdies/etc. % from the same filtered set (stroke play, user's holes only)
      const strokePlayRoundIds = filtered.filter((r) => r.gameType === "round").map((r) => r.id);
      let totalScoreSum = 0;
      let totalParSum = 0;
      let totalHolesSum = 0;
      let scorePar3 = 0;
      let scorePar4 = 0;
      let scorePar5 = 0;
      let eagles = 0;
      let birdies = 0;
      let pars = 0;
      let bogeys = 0;
      let doubles = 0;
      let tripleOrWorse = 0;

      if (strokePlayRoundIds.length > 0) {
        // User's holes only: round_players for this user + owned rounds (player_id null)
        const [
          { data: rpData },
          { data: ownedRounds },
          { data: allHoles },
        ] = await Promise.all([
          supabase.from("round_players").select("id, round_id").eq("user_id", user.id).in("round_id", strokePlayRoundIds),
          supabase.from("rounds").select("id").eq("user_id", user.id).in("id", strokePlayRoundIds),
          supabase.from("holes").select("round_id, player_id, score, par").in("round_id", strokePlayRoundIds).gt("score", 0),
        ]);
        const userPlayerIds = new Set((rpData ?? []).map((rp) => rp.id));
        const ownedRoundIds = new Set((ownedRounds ?? []).map((r) => r.id));
        const userHoles = (allHoles ?? []).filter(
          (h) => (h.player_id && userPlayerIds.has(h.player_id)) || (!h.player_id && ownedRoundIds.has(h.round_id))
        );
        const totalHoles = userHoles.length;

        if (totalHoles > 0) {
          totalScoreSum = userHoles.reduce((s, h) => s + (h.score ?? 0), 0);
          totalParSum = userHoles.reduce((s, h) => s + (h.par ?? 0), 0);
          totalHolesSum = totalHoles;

          let sumPar3 = 0, sumPar4 = 0, sumPar5 = 0;
          let par3Count = 0, par4Count = 0, par5Count = 0;
          userHoles.forEach((hole) => {
            const score = hole.score ?? 0;
            const par = hole.par ?? 4;
            const diff = score - par;
            if (par === 3) { sumPar3 += score; par3Count++; }
            else if (par === 4) { sumPar4 += score; par4Count++; }
            else if (par >= 5) { sumPar5 += score; par5Count++; }
            if (diff <= -2) eagles++;
            else if (diff === -1) birdies++;
            else if (diff === 0) pars++;
            else if (diff === 1) bogeys++;
            else if (diff === 2) doubles++;
            else if (diff >= 3) tripleOrWorse++;
          });
          scorePar3 = par3Count > 0 ? sumPar3 / par3Count : 0;
          scorePar4 = par4Count > 0 ? sumPar4 / par4Count : 0;
          scorePar5 = par5Count > 0 ? sumPar5 / par5Count : 0;
          // Percent of holes played = (count / total user holes in these stroke play rounds) * 100
          eagles = (eagles / totalHoles) * 100;
          birdies = (birdies / totalHoles) * 100;
          pars = (pars / totalHoles) * 100;
          bogeys = (bogeys / totalHoles) * 100;
          doubles = (doubles / totalHoles) * 100;
          tripleOrWorse = (tripleOrWorse / totalHoles) * 100;
        } else {
          const { data: summaries } = await supabase
            .from("round_summaries")
            .select("round_id, total_score, total_par, holes_played")
            .in("round_id", strokePlayRoundIds);
          const rows = summaries ?? [];
          totalScoreSum = rows.reduce((s, r) => s + (r.total_score ?? 0), 0);
          totalParSum = rows.reduce((s, r) => s + (r.total_par ?? 0), 0);
          totalHolesSum = rows.reduce((s, r) => s + (r.holes_played ?? 0), 0);
        }
      }

      const scorePerHole: number | null = totalHolesSum > 0 ? totalScoreSum / totalHolesSum : null;
      const scoreToParPerHole: number | null = totalHolesSum > 0 ? (totalScoreSum - totalParSum) / totalHolesSum : null;

      setStats({
        roundsCount,
        holesPerRound,
        scorePerHole,
        scoreToParPerHole,
        scorePar3,
        scorePar4,
        scorePar5,
        eagles,
        birdies,
        pars,
        bogeys,
        doubles,
        tripleOrWorse,
      });
    } catch (error) {
      console.error("Error fetching scoring stats:", error);
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
                Play some rounds to see your scoring stats
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
              <StatRow label="Holes/Round" value={stats.holesPerRound.toFixed(1)} />
              <StatRow label="Score/Hole" value={stats.scorePerHole != null ? stats.scorePerHole.toFixed(2) : "–"} />
              <StatRow
                label="Score to par/Hole"
                value={
                  stats.scoreToParPerHole != null
                    ? stats.scoreToParPerHole >= 0
                      ? `+${stats.scoreToParPerHole.toFixed(2)}`
                      : stats.scoreToParPerHole.toFixed(2)
                    : "–"
                }
              />
              <StatRow label="Score par 3" value={stats.scorePar3.toFixed(1)} />
              <StatRow label="Score par 4" value={stats.scorePar4.toFixed(1)} />
              <StatRow label="Score par 5" value={stats.scorePar5.toFixed(1)} />
              <StatRow label="Eagles" value={`${stats.eagles.toFixed(1)}%`} />
              <StatRow label="Birdies" value={`${stats.birdies.toFixed(1)}%`} />
              <StatRow label="Par" value={`${stats.pars.toFixed(1)}%`} />
              <StatRow label="Bogey" value={`${stats.bogeys.toFixed(1)}%`} />
              <StatRow label="Double" value={`${stats.doubles.toFixed(1)}%`} />
              <StatRow label="Triple or worse" value={`${stats.tripleOrWorse.toFixed(1)}%`} />
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
