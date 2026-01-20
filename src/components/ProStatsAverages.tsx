import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, TrendingUp, Target } from "lucide-react";
import { subDays, subMonths, subYears, startOfDay } from "date-fns";

interface Shot {
  type: 'tee' | 'approach' | 'putt';
  startDistance: number;
  startLie?: string;
  holed: boolean;
  endDistance?: number;
  strokesGained: number;
}

interface ScoringStats {
  roundsCount: number;
  holesCount: number;
  avgScore: number;
  avgScoreVsPar: number;
  scorePar3: number;
  scorePar4: number;
  scorePar5: number;
  eagles: number;
  birdies: number;
  pars: number;
  bogeys: number;
  doubleBogeys: number;
  tripleOrWorse: number;
}

interface DetailedSGStats {
  roundsCount: number;
  holesCount: number;
  avgScoreVsPar: number;
  
  // Long Game - Tee Shots
  sgTeePar45Total: number;
  sgDrivePar45: number;
  sgOtherPar45: number;
  
  // Long Game - Shots 40m+
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
  
  // Short Game 0-20m
  sgShortGame0to20Total: number;
  sgShortGame0to20Fairway: number;
  sgShortGame0to20Rough: number;
  sgShortGame0to20Bunker: number;
  
  // Short Game 20-40m
  sgShortGame20to40Total: number;
  sgShortGame20to40Fairway: number;
  sgShortGame20to40Bunker: number;
  sgShortGameTotal: number;
  
  // Putting
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
  
  // Other
  sgBunker40to120: number;
  sgBunker120to200: number;
  sgRecovery40to120: number;
  sgRecovery120to240: number;
  sgLayup40Plus: number;
  
  sgTotal: number;
}

type TimeFilter = 'week' | 'month' | 'year' | 'all';
type StatsView = 'scoring' | 'strokes-gained';

export const ProStatsAverages = () => {
  const [filter, setFilter] = useState<TimeFilter>('all');
  const [view, setView] = useState<StatsView>('scoring');
  const [scoringStats, setScoringStats] = useState<ScoringStats | null>(null);
  const [sgStats, setSgStats] = useState<DetailedSGStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAverages();
  }, [filter]);

  const getDateFilter = () => {
    const now = new Date();
    switch (filter) {
      case 'week':
        return startOfDay(subDays(now, 7)).toISOString();
      case 'month':
        return startOfDay(subMonths(now, 1)).toISOString();
      case 'year':
        return startOfDay(subYears(now, 1)).toISOString();
      case 'all':
      default:
        return null;
    }
  };

  const fetchAverages = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

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
        setScoringStats(null);
        setSgStats(null);
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
        setScoringStats(null);
        setSgStats(null);
        setLoading(false);
        return;
      }

      const roundIds = validProRounds.map(r => r.id);

      const { data: holesData, error: holesError } = await supabase
        .from('pro_stats_holes')
        .select('pro_round_id, hole_number, par, score, pro_shot_data')
        .in('pro_round_id', roundIds);

      if (holesError) throw holesError;

      // Initialize scoring stats
      let totalScore = 0;
      let totalPar = 0;
      let totalHoles = 0;
      let scorePar3 = 0;
      let scorePar4 = 0;
      let scorePar5 = 0;
      let eagles = 0;
      let birdies = 0;
      let pars = 0;
      let bogeys = 0;
      let doubleBogeys = 0;
      let tripleOrWorse = 0;

      // Initialize detailed SG stats
      let sgTeePar45Total = 0;
      let sgDrivePar45 = 0;
      let sgOtherPar45 = 0;
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
      let sgShortGame0to20Total = 0;
      let sgShortGame0to20Fairway = 0;
      let sgShortGame0to20Rough = 0;
      let sgShortGame0to20Bunker = 0;
      let sgShortGame20to40Total = 0;
      let sgShortGame20to40Fairway = 0;
      let sgShortGame20to40Bunker = 0;
      let sgShortGameTotal = 0;
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
      let sgBunker40to120 = 0;
      let sgBunker120to200 = 0;
      let sgRecovery40to120 = 0;
      let sgRecovery120to240 = 0;
      let sgLayup40Plus = 0;

      holesData?.forEach(hole => {
        const score = hole.score || 0;
        const par = hole.par || 0;
        const diff = score - par;

        totalScore += score;
        totalPar += par;
        totalHoles++;

        // Score by par
        if (par === 3) scorePar3 += score;
        else if (par === 4) scorePar4 += score;
        else if (par === 5) scorePar5 += score;

        // Score distribution
        if (diff <= -2) eagles++;
        else if (diff === -1) birdies++;
        else if (diff === 0) pars++;
        else if (diff === 1) bogeys++;
        else if (diff === 2) doubleBogeys++;
        else if (diff >= 3) tripleOrWorse++;

        // Strokes gained by category
        if (hole.pro_shot_data) {
          const shots = hole.pro_shot_data as unknown as Shot[];
          
          shots.forEach((shot, idx) => {
            const sg = shot.strokesGained || 0;
            const dist = shot.startDistance || 0;
            const lie = (shot.startLie || '').toLowerCase();
            const shotType = shot.type;
            const isTeeShot = idx === 0;
            const isFairway = lie === 'fairway' || lie === 'tee';
            const isRough = lie === 'rough' || lie === 'first_cut';
            const isBunker = lie === 'bunker' || lie === 'sand';
            const isRecovery = lie === 'recovery' || lie === 'trees' || lie === 'penalty';

            if (shotType === 'putt') {
              // Putting with detailed distance breakdown
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
            } else if (isTeeShot && par >= 4) {
              // Tee shots on par 4/5
              sgTeePar45Total += sg;
              if (shotType === 'tee') sgDrivePar45 += sg;
              else sgOtherPar45 += sg;
            } else if (dist >= 40) {
              // Long game shots 40m+
              sgLongGame40Plus += sg;
              
              // Categorize by distance
              if (dist >= 200) sgLongGame200Plus += sg;
              else if (dist >= 160) sgLongGame160to200 += sg;
              else if (dist >= 120) sgLongGame120to160 += sg;
              else if (dist >= 80) sgLongGame80to120 += sg;
              else sgLongGame40to80 += sg;
              
              // Bunker shots from distance
              if (isBunker) {
                if (dist >= 120) sgBunker120to200 += sg;
                else sgBunker40to120 += sg;
              }
              // Recovery shots
              else if (isRecovery) {
                if (dist >= 120) sgRecovery120to240 += sg;
                else sgRecovery40to120 += sg;
              }
              // Layup shots (approach shots that don't target the green)
              else if (lie === 'layup') {
                sgLayup40Plus += sg;
              }
              // Approach from fairway
              else if (isFairway) {
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
            } else if (dist > 0 && dist < 40) {
              // Short game (under 40m, not putting)
              sgShortGameTotal += sg;
              
              if (dist <= 20) {
                // Short game 0-20m
                sgShortGame0to20Total += sg;
                if (isBunker) sgShortGame0to20Bunker += sg;
                else if (isRough) sgShortGame0to20Rough += sg;
                else sgShortGame0to20Fairway += sg;
              } else {
                // Short game 20-40m
                sgShortGame20to40Total += sg;
                if (isBunker) sgShortGame20to40Bunker += sg;
                else sgShortGame20to40Fairway += sg;
              }
            }
          });
        }
      });

      const validRounds = proRounds.length;

      if (validRounds === 0 || totalHoles === 0) {
        setScoringStats(null);
        setSgStats(null);
        setLoading(false);
        return;
      }

      setScoringStats({
        roundsCount: validRounds,
        holesCount: totalHoles,
        avgScore: totalScore / validRounds,
        avgScoreVsPar: (totalScore - totalPar) / validRounds,
        scorePar3: scorePar3 / validRounds,
        scorePar4: scorePar4 / validRounds,
        scorePar5: scorePar5 / validRounds,
        eagles: eagles / validRounds,
        birdies: birdies / validRounds,
        pars: pars / validRounds,
        bogeys: bogeys / validRounds,
        doubleBogeys: doubleBogeys / validRounds,
        tripleOrWorse: tripleOrWorse / validRounds,
      });

      setSgStats({
        roundsCount: validRounds,
        holesCount: totalHoles,
        avgScoreVsPar: (totalScore - totalPar) / validRounds,
        sgTeePar45Total: sgTeePar45Total / validRounds,
        sgDrivePar45: sgDrivePar45 / validRounds,
        sgOtherPar45: sgOtherPar45 / validRounds,
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
        sgShortGame0to20Total: sgShortGame0to20Total / validRounds,
        sgShortGame0to20Fairway: sgShortGame0to20Fairway / validRounds,
        sgShortGame0to20Rough: sgShortGame0to20Rough / validRounds,
        sgShortGame0to20Bunker: sgShortGame0to20Bunker / validRounds,
        sgShortGame20to40Total: sgShortGame20to40Total / validRounds,
        sgShortGame20to40Fairway: sgShortGame20to40Fairway / validRounds,
        sgShortGame20to40Bunker: sgShortGame20to40Bunker / validRounds,
        sgShortGameTotal: sgShortGameTotal / validRounds,
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
        sgBunker40to120: sgBunker40to120 / validRounds,
        sgBunker120to200: sgBunker120to200 / validRounds,
        sgRecovery40to120: sgRecovery40to120 / validRounds,
        sgRecovery120to240: sgRecovery120to240 / validRounds,
        sgLayup40Plus: sgLayup40Plus / validRounds,
        sgTotal: (sgTeePar45Total + sgLongGame40Plus + sgShortGameTotal + sgPuttingTotal) / validRounds,
      });

    } catch (error) {
      console.error('Error fetching averages:', error);
      setScoringStats(null);
      setSgStats(null);
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

  const StatRow = ({ label, value, isBold = false }: { label: string; value: string | number; isBold?: boolean }) => (
    <div className={`flex justify-between py-1.5 border-b border-border/50`}>
      <span className={`text-sm ${isBold ? 'font-semibold' : ''}`}>{label}</span>
      <span className={`text-sm ${isBold ? 'font-semibold' : 'font-medium'}`}>{value}</span>
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

  const SGSection = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div className="bg-muted/30 rounded-lg p-3 space-y-1">
      <h4 className="text-sm font-semibold text-foreground mb-2">{title}</h4>
      {children}
    </div>
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Performance Averages
          </CardTitle>
        </div>
        
        {/* Stats View Toggle */}
        <Tabs value={view} onValueChange={(v) => setView(v as StatsView)} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="scoring" className="flex items-center gap-1">
              <Target className="h-4 w-4" />
              Scoring
            </TabsTrigger>
            <TabsTrigger value="strokes-gained" className="flex items-center gap-1">
              <TrendingUp className="h-4 w-4" />
              Strokes Gained
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Time Filter */}
        <Tabs value={filter} onValueChange={(v) => setFilter(v as TimeFilter)} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="week">Week</TabsTrigger>
            <TabsTrigger value="month">Month</TabsTrigger>
            <TabsTrigger value="year">Year</TabsTrigger>
            <TabsTrigger value="all">All Time</TabsTrigger>
          </TabsList>
        </Tabs>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (!scoringStats || !sgStats) ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No Pro Stats rounds found for this period
          </p>
        ) : view === 'scoring' ? (
          <div className="space-y-1">
            <StatRow label="Rounds" value={scoringStats.roundsCount} />
            <StatRow label="Holes" value={scoringStats.holesCount} />
            <StatRow label="Score" value={scoringStats.avgScore.toFixed(1)} />
            <StatRow label="Score/par" value={`${scoringStats.avgScoreVsPar >= 0 ? '+' : ''}${scoringStats.avgScoreVsPar.toFixed(1)}`} />
            <StatRow label="Score par 3" value={scoringStats.scorePar3.toFixed(1)} />
            <StatRow label="Score par 4" value={scoringStats.scorePar4.toFixed(1)} />
            <StatRow label="Score par 5" value={scoringStats.scorePar5.toFixed(1)} />
            <StatRow label="Eagles" value={scoringStats.eagles.toFixed(1)} />
            <StatRow label="Birdies" value={scoringStats.birdies.toFixed(1)} />
            <StatRow label="Par" value={scoringStats.pars.toFixed(1)} />
            <StatRow label="Bogey" value={scoringStats.bogeys.toFixed(1)} />
            <StatRow label="Double" value={scoringStats.doubleBogeys.toFixed(1)} />
            <StatRow label="Triple or worse" value={scoringStats.tripleOrWorse.toFixed(1)} />
            
            {/* Strokes Gained Summary */}
            <div className="pt-3 mt-2 border-t border-border">
              <h4 className="text-sm font-semibold text-foreground mb-2">Strokes Gained</h4>
              <SGRow label="Tee shots par 4/5" value={sgStats.sgTeePar45Total} isBold />
              <SGRow label="Drive par 4/5" value={sgStats.sgDrivePar45} indent />
              <SGRow label="Other par 4/5" value={sgStats.sgOtherPar45} indent />
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Summary */}
            <div className="flex justify-between items-center py-2 px-3 bg-primary text-primary-foreground rounded-lg">
              <span className="font-semibold">Total Strokes Gained</span>
              <span className={`font-bold text-lg ${getSGColor(sgStats.sgTotal)}`}>
                {formatSG(sgStats.sgTotal)}
              </span>
            </div>
            
            {/* Long Game */}
            <SGSection title="Long Game">
              <SGRow label="Tee shots par 4/5" value={sgStats.sgTeePar45Total} isBold />
              <SGRow label="Drive par 4/5" value={sgStats.sgDrivePar45} indent />
              <SGRow label="Other par 4/5" value={sgStats.sgOtherPar45} indent />
              <div className="border-t border-border/30 my-1" />
              <SGRow label="Shots 40m+" value={sgStats.sgLongGame40Plus} isBold />
              <SGRow label="200+ m" value={sgStats.sgLongGame200Plus} indent />
              <SGRow label="160-200 m" value={sgStats.sgLongGame160to200} indent />
              <SGRow label="120-160 m" value={sgStats.sgLongGame120to160} indent />
              <SGRow label="80-120 m" value={sgStats.sgLongGame80to120} indent />
              <SGRow label="40-80 m" value={sgStats.sgLongGame40to80} indent />
            </SGSection>

            {/* Approach from Fairway */}
            <SGSection title="Approach from Fairway">
              <SGRow label="Shots 40m+" value={sgStats.sgApproachFw40Plus} isBold />
              <SGRow label="200+ m" value={sgStats.sgApproachFw200Plus} indent />
              <SGRow label="160-200 m" value={sgStats.sgApproachFw160to200} indent />
              <SGRow label="120-160 m" value={sgStats.sgApproachFw120to160} indent />
              <SGRow label="80-120 m" value={sgStats.sgApproachFw80to120} indent />
              <SGRow label="40-80 m" value={sgStats.sgApproachFw40to80} indent />
            </SGSection>

            {/* Approach from Rough */}
            <SGSection title="Approach from Rough">
              <SGRow label="Shots 40m+" value={sgStats.sgApproachRough40Plus} isBold />
              <SGRow label="200+ m" value={sgStats.sgApproachRough200Plus} indent />
              <SGRow label="160-200 m" value={sgStats.sgApproachRough160to200} indent />
              <SGRow label="120-160 m" value={sgStats.sgApproachRough120to160} indent />
              <SGRow label="80-120 m" value={sgStats.sgApproachRough80to120} indent />
              <SGRow label="40-80 m" value={sgStats.sgApproachRough40to80} indent />
            </SGSection>

            {/* Short Game */}
            <SGSection title="Short Game">
              <SGRow label="Short game 0-20m" value={sgStats.sgShortGame0to20Total} isBold />
              <SGRow label="Fairway" value={sgStats.sgShortGame0to20Fairway} indent />
              <SGRow label="Rough" value={sgStats.sgShortGame0to20Rough} indent />
              <SGRow label="Bunker" value={sgStats.sgShortGame0to20Bunker} indent />
              <div className="border-t border-border/30 my-1" />
              <SGRow label="Short game 20-40m" value={sgStats.sgShortGame20to40Total} isBold />
              <SGRow label="Fairway" value={sgStats.sgShortGame20to40Fairway} indent />
              <SGRow label="Bunker" value={sgStats.sgShortGame20to40Bunker} indent />
              <div className="border-t border-border/30 my-1" />
              <SGRow label="Total" value={sgStats.sgShortGameTotal} isBold />
            </SGSection>

            {/* Putting */}
            <SGSection title="Putting">
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
            </SGSection>

            {/* Other */}
            <SGSection title="Other">
              <SGRow label="Tee shots par 4/5" value={sgStats.sgTeePar45Total} isBold />
              <SGRow label="Drive par 4/5" value={sgStats.sgDrivePar45} indent />
              <SGRow label="Other par 4/5" value={sgStats.sgOtherPar45} indent />
              <div className="border-t border-border/30 my-1" />
              <SGRow label="Bunker 40-120m" value={sgStats.sgBunker40to120} />
              <SGRow label="Bunker 120-200m" value={sgStats.sgBunker120to200} />
              <SGRow label="Recovery 40-120m" value={sgStats.sgRecovery40to120} />
              <SGRow label="Recovery 120-240m" value={sgStats.sgRecovery120to240} />
              <SGRow label="Layup 40+" value={sgStats.sgLayup40Plus} />
            </SGSection>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
