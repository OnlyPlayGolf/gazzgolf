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
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TopNavBar } from "@/components/TopNavBar";
import { 
  ArrowLeft, Target, TrendingUp, Crosshair, Circle, 
  ArrowUp, ArrowDown, Minus, ChevronRight, Play, Info, Lightbulb
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { 
  fetchUserStats, formatScore, formatSG, formatPercentage, 
  getSGLevel, getStatInsights, getDrillRecommendations,
  AllStats, StatLevel, StatInsight, DrillRecommendation, StatsFilter
} from "@/utils/statisticsCalculations";
import { migrateOBStrokesGained } from "@/utils/migrateOBStrokesGained";
import { cn } from "@/lib/utils";

type TimeFilter = StatsFilter;

const StatLevelBadge = ({ level }: { level: StatLevel }) => {
  if (level === 'strength') {
    return (
      <Badge variant="outline" className="bg-success/10 text-success border-success/30 text-xs">
        <ArrowUp className="h-3 w-3 mr-1" />
        Strength
      </Badge>
    );
  }
  if (level === 'needs-improvement') {
    return (
      <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30 text-xs">
        <ArrowDown className="h-3 w-3 mr-1" />
        Work on
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-xs">
      <Minus className="h-3 w-3 mr-1" />
      Average
    </Badge>
  );
};

const StatRow = ({ 
  label, 
  value, 
  level, 
  onClick,
  indent = false 
}: { 
  label: string; 
  value: string; 
  level?: StatLevel;
  onClick?: () => void;
  indent?: boolean;
}) => (
  <div 
    className={cn(
      "flex items-center justify-between py-3 border-b border-border/50 last:border-0",
      onClick && "cursor-pointer hover:bg-muted/30 -mx-3 px-3",
      indent && "ml-4"
    )}
    onClick={onClick}
  >
    <span className={cn("text-sm", indent ? "text-muted-foreground" : "text-foreground")}>{label}</span>
    <div className="flex items-center gap-2">
      <span className={cn(
        "text-sm font-medium",
        level === 'strength' && "text-success",
        level === 'needs-improvement' && "text-destructive"
      )}>{value}</span>
      {level && <StatLevelBadge level={level} />}
      {onClick && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
    </div>
  </div>
);

const SGStatRow = ({ label, value, showBadge = false, onClick }: { label: string; value: number | null; showBadge?: boolean; onClick?: () => void }) => {
  const level = getSGLevel(value);
  return (
    <div 
      className={cn(
        "flex items-center justify-between py-2",
        onClick && "cursor-pointer hover:bg-muted/30 -mx-3 px-3"
      )}
      onClick={onClick}
    >
      <span className="text-sm text-foreground">{label}</span>
      <div className="flex items-center gap-2">
        <span className={cn(
          "text-sm font-bold",
          value !== null && value >= 0 ? "text-success" : "text-destructive"
        )}>
          {formatSG(value)}
        </span>
        {showBadge && level !== 'average' && <StatLevelBadge level={level} />}
        {onClick && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
      </div>
    </div>
  );
};

const InsightCard = ({ insight, onClick }: { insight: StatInsight; onClick: () => void }) => (
  <Card 
    className={cn(
      "cursor-pointer hover:shadow-md transition-all border-l-4",
      insight.status === 'strength' ? "border-l-success" : "border-l-destructive"
    )}
    onClick={onClick}
  >
    <CardContent className="p-4">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className={cn(
              "text-xs font-medium uppercase tracking-wide",
              insight.status === 'strength' ? "text-success" : "text-destructive"
            )}>
              {insight.status === 'strength' ? 'Gaining Strokes' : 'Losing Strokes'}
            </span>
          </div>
          <h3 className="font-semibold text-foreground">{insight.area}</h3>
          <p className="text-sm text-muted-foreground mt-0.5">{insight.message}</p>
        </div>
        <div className={cn(
          "text-lg font-bold",
          insight.status === 'strength' ? "text-success" : "text-destructive"
        )}>
          {insight.value}
        </div>
      </div>
    </CardContent>
  </Card>
);

const DrillCard = ({ drill, onClick }: { drill: DrillRecommendation; onClick: () => void }) => (
  <Card 
    className="cursor-pointer hover:shadow-md transition-all"
    onClick={onClick}
  >
    <CardContent className="p-4">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="secondary" className="text-xs">{drill.category}</Badge>
          </div>
          <h3 className="font-semibold text-foreground">{drill.drillTitle}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">{drill.reason}</p>
        </div>
        <Button size="sm" className="gap-1">
          <Play className="h-3 w-3" />
          Start
        </Button>
      </div>
    </CardContent>
  </Card>
);

export default function Statistics() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<AllStats | null>(null);
  const [insights, setInsights] = useState<StatInsight[]>([]);
  const [drillRecs, setDrillRecs] = useState<DrillRecommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('all');
  const [sgInfoOpen, setSgInfoOpen] = useState(false);
  const [migrating, setMigrating] = useState(false);
  const [migrationResult, setMigrationResult] = useState<string | null>(null);

  useEffect(() => {
    const loadStats = async () => {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/auth');
        return;
      }

      try {
        const data = await fetchUserStats(user.id, timeFilter);
        setStats(data);
        setInsights(getStatInsights(data));
        setDrillRecs(getDrillRecommendations(data));
      } catch (error) {
        console.error('Error loading stats:', error);
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
            <h1 className="text-2xl font-bold text-foreground">Statistics</h1>
            <p className="text-sm text-muted-foreground">
              {stats?.roundsPlayed || 0} {stats?.roundsPlayed === 1 ? 'round' : 'rounds'} analyzed • {getFilterLabel()}
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

        {/* Key Insights - Matches PerformanceSnapshot design */}
        {stats && (stats.strokesGained.putting !== null || stats.strokesGained.shortGame !== null || 
          stats.strokesGained.approach !== null || stats.strokesGained.offTheTee !== null) && (
          <Card className="mb-6">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Key Insights</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* SG Stats Grid */}
              {(() => {
                const sgStatsList: { label: string; value: number; category: string; isStrength: boolean }[] = [];
                
                if (stats.strokesGained.putting !== null) {
                  sgStatsList.push({
                    label: 'Putting',
                    value: stats.strokesGained.putting,
                    category: 'putting',
                    isStrength: stats.strokesGained.putting >= 0.1,
                  });
                }
                if (stats.strokesGained.shortGame !== null) {
                  sgStatsList.push({
                    label: 'Short Game',
                    value: stats.strokesGained.shortGame,
                    category: 'short-game',
                    isStrength: stats.strokesGained.shortGame >= 0.1,
                  });
                }
                if (stats.strokesGained.approach !== null) {
                  sgStatsList.push({
                    label: 'Approach',
                    value: stats.strokesGained.approach,
                    category: 'approach',
                    isStrength: stats.strokesGained.approach >= 0.2,
                  });
                }
                if (stats.strokesGained.offTheTee !== null) {
                  sgStatsList.push({
                    label: 'Off the Tee',
                    value: stats.strokesGained.offTheTee,
                    category: 'driving',
                    isStrength: stats.strokesGained.offTheTee >= 0.2,
                  });
                }

                sgStatsList.sort((a, b) => b.value - a.value);
                
                const bestStat = sgStatsList.length >= 1 ? sgStatsList[0] : null;
                const worstStats = sgStatsList.length >= 3 
                  ? [sgStatsList[sgStatsList.length - 2], sgStatsList[sgStatsList.length - 1]]
                  : sgStatsList.length === 2 ? [sgStatsList[1]] : [];

                // Drill recommendations based on weakest categories (same logic as PerformanceSnapshot)
                const drillsByCategory: Record<string, { id: string; title: string; description: string }[]> = {
                  'putting': [
                    { id: 'pga-tour-18', title: 'PGA Tour 18-hole Test', description: 'Overall putting practice against tour standards' },
                    { id: 'aggressive-putting', title: 'Aggressive Putting 4-6m', description: 'Commit with confidence inside 6 meters' },
                  ],
                  'short-game': [
                    { id: '8-ball-drill', title: '8-Ball Circuit', description: 'Complete 8 chip/pitch/lob/bunker stations' },
                    { id: 'easy-chip', title: 'Easy Chip Drill', description: 'Build consistency on simple chip shots' },
                  ],
                  'approach': [
                    { id: 'wedges-2-laps', title: 'Wedge Game 40-80m', description: 'Dial in wedges from 40-80 meters' },
                    { id: 'approach-control', title: 'Approach Control 130-180m', description: '14 approach shots from 130-180m' },
                  ],
                  'driving': [
                    { id: 'driver-control', title: 'Driver Control Drill', description: '14 tee shots testing fairway accuracy' },
                    { id: 'shot-shape-master', title: 'Shot Shape Master', description: 'Master draws, fades, and fairway finding' },
                  ],
                };

                // Get weak categories from insights or worst stats
                const weakCategories = new Set<string>();
                const weaknesses = insights.filter(i => i.status === 'weakness');
                weaknesses.forEach(w => weakCategories.add(w.category));
                
                if (weakCategories.size === 0 && sgStatsList.length >= 2) {
                  weakCategories.add(sgStatsList[sgStatsList.length - 1].category);
                  if (sgStatsList.length >= 3) {
                    weakCategories.add(sgStatsList[sgStatsList.length - 2].category);
                  }
                }

                const recommendedDrills: { id: string; title: string; description: string }[] = [];
                weakCategories.forEach(category => {
                  const categoryDrills = drillsByCategory[category] || [];
                  recommendedDrills.push(...categoryDrills.slice(0, 2));
                });
                const displayDrills = recommendedDrills.slice(0, 3);

                return (
                  <>
                    <div className="grid grid-cols-3 gap-3">
                      {/* Best stat (left) */}
                      {bestStat && (
                        <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3 text-center">
                          <div className="flex items-center justify-center gap-1 mb-1">
                            <TrendingUp size={14} className="text-green-500" />
                            <span className="text-[10px] uppercase tracking-wide text-green-600 font-medium">Best</span>
                          </div>
                          <p className="text-lg font-bold text-green-600">{formatSG(bestStat.value)}</p>
                          <p className="text-xs text-muted-foreground">{bestStat.label}</p>
                        </div>
                      )}
                      
                      {/* Worst stats (middle and right) */}
                      {worstStats.map((stat) => (
                        <div key={stat.category} className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-center">
                          <div className="flex items-center justify-center gap-1 mb-1">
                            <ArrowDown size={14} className="text-red-500" />
                            <span className="text-[10px] uppercase tracking-wide text-red-600 font-medium">Focus</span>
                          </div>
                          <p className="text-lg font-bold text-red-600">{formatSG(stat.value)}</p>
                          <p className="text-xs text-muted-foreground">{stat.label}</p>
                        </div>
                      ))}
                      
                      {/* Fill empty slots if not enough data */}
                      {bestStat && worstStats.length < 2 && (
                        <div className="bg-muted/50 border border-border rounded-lg p-3 text-center flex items-center justify-center">
                          <p className="text-xs text-muted-foreground">Play more to see</p>
                        </div>
                      )}
                    </div>

                    {/* Recommended Drills */}
                    {displayDrills.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Recommended Drills</p>
                        <div className="space-y-2">
                          {displayDrills.map((drill) => (
                            <div
                              key={drill.id}
                              className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted cursor-pointer transition-colors"
                              onClick={() => navigate(`/drill/${drill.id}/score`)}
                            >
                              <div className="p-2 bg-primary/10 rounded-full">
                                <Target size={16} className="text-primary" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-foreground truncate">{drill.title}</p>
                                <p className="text-xs text-muted-foreground truncate">{drill.description}</p>
                              </div>
                              <ChevronRight size={16} className="text-muted-foreground flex-shrink-0" />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                );
              })()}
            </CardContent>
          </Card>
        )}

        {/* Scoring Section */}
        <Card className="mb-4">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Target className="h-5 w-5 text-primary" />
              Overall
            </CardTitle>
          </CardHeader>
          <CardContent>
            <StatRow 
              label="Scoring Average" 
              value={formatScore(stats?.scoring.scoringAverage ?? null)}
              level={stats?.scoring.scoringAverage !== null 
                ? stats.scoring.scoringAverage <= 2 ? 'strength' 
                : stats.scoring.scoringAverage >= 8 ? 'needs-improvement' 
                : 'average' : undefined}
              onClick={() => navigate('/statistics/scoring')}
            />
            <StatRow 
              label="Best Round" 
              value={stats?.scoring.bestRound?.toString() ?? '-'}
            />
            <StatRow 
              label="Total Rounds" 
              value={stats?.scoring.totalRounds?.toString() ?? '0'}
            />
            <StatRow 
              label="Scoring" 
              value={stats?.strokesGained.scoring !== null ? formatSG(stats?.strokesGained.scoring) : ''}
              onClick={() => navigate('/statistics/scoring-sg')}
            />
          </CardContent>
        </Card>

        {/* Strokes Gained Section */}
        <Card className="mb-4">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-base">
                <TrendingUp className="h-5 w-5 text-primary" />
                Strokes Gained
              </span>
              <Button 
                variant="ghost" 
                size="icon"
                onClick={() => setSgInfoOpen(true)}
              >
                <Info className="h-4 w-4 text-muted-foreground" />
              </Button>
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Positive = gaining strokes vs field • Negative = losing strokes
            </p>
          </CardHeader>
          <CardContent>
            <SGStatRow label="Total" value={stats?.strokesGained.total ?? null} showBadge />
            <div className="h-px bg-border my-2" />
            <SGStatRow label="Off the Tee" value={stats?.strokesGained.offTheTee ?? null} showBadge onClick={() => navigate('/statistics/driving')} />
            <SGStatRow label="Approach" value={stats?.strokesGained.approach ?? null} showBadge onClick={() => navigate('/statistics/approach-detail')} />
            <SGStatRow label="Short Game" value={stats?.strokesGained.shortGame ?? null} showBadge onClick={() => navigate('/statistics/short-game-detail')} />
            <SGStatRow label="Putting" value={stats?.strokesGained.putting ?? null} showBadge onClick={() => navigate('/statistics/putting-detail')} />
            <StatRow 
              label="Other" 
              value={stats?.strokesGained.other !== null ? formatSG(stats?.strokesGained.other) : ''}
              onClick={() => navigate('/statistics/other')}
            />
          </CardContent>
        </Card>

        {/* Basic Statistics Section */}
        <Card className="mb-4">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Crosshair className="h-5 w-5 text-primary" />
              Basic Statistics
            </CardTitle>
          </CardHeader>
          <CardContent>
            <StatRow 
              label="Fairways Hit" 
              value={formatPercentage(stats?.accuracy.fairwaysHit ?? null)}
              level={stats?.accuracy.fairwaysHit !== null 
                ? stats.accuracy.fairwaysHit >= 60 ? 'strength' 
                : stats.accuracy.fairwaysHit <= 45 ? 'needs-improvement' 
                : 'average' : undefined}
              onClick={() => navigate('/statistics/fairways')}
            />
            <StatRow 
              label="Greens in Regulation" 
              value={formatPercentage(stats?.accuracy.greensInRegulation ?? null)}
              level={stats?.accuracy.greensInRegulation !== null 
                ? stats.accuracy.greensInRegulation >= 55 ? 'strength' 
                : stats.accuracy.greensInRegulation <= 35 ? 'needs-improvement' 
                : 'average' : undefined}
              onClick={() => navigate('/statistics/approach')}
            />
            <StatRow 
              label="Scrambling" 
              value={stats?.accuracy.scrambling !== null && stats?.accuracy.scrambling !== undefined
                ? formatPercentage(stats.accuracy.scrambling)
                : "N/A"}
              level={stats?.accuracy.scrambling !== null 
                ? stats.accuracy.scrambling >= 50 ? 'strength' 
                : stats.accuracy.scrambling <= 30 ? 'needs-improvement' 
                : 'average' : undefined}
              onClick={() => navigate('/statistics/short-game')}
            />
            <StatRow 
              label="Putts per Round" 
              value={stats?.putting.puttsPerRound?.toFixed(1) ?? '-'}
              level={stats?.putting.puttsPerRound !== null 
                ? stats.putting.puttsPerRound <= 30 ? 'strength' 
                : stats.putting.puttsPerRound >= 34 ? 'needs-improvement' 
                : 'average' : undefined}
              onClick={() => navigate('/statistics/putting')}
            />
          </CardContent>
        </Card>

        {/* No data message */}
        {stats?.roundsPlayed === 0 && (
          <Card className="bg-muted/50">
            <CardContent className="p-6 text-center">
              <TrendingUp className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
              <h3 className="font-semibold text-foreground mb-2">No Statistics Yet</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Play some rounds to start tracking your performance
              </p>
              <Button onClick={() => navigate('/rounds')}>
                Start a Round
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Migration Tool (Developer/Admin) */}
        {process.env.NODE_ENV === 'development' && (
          <Card className="mt-4 border-dashed">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Developer Tools</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-xs text-muted-foreground">
                Fix OB shot strokes gained in historical data
              </p>
              <Button
                onClick={async () => {
                  setMigrating(true);
                  setMigrationResult(null);
                  try {
                    const result = await migrateOBStrokesGained();
                    if (result.success) {
                      setMigrationResult(
                        `Success! Updated ${result.updated} holes. ` +
                        (result.errors ? `${result.errors} errors. ` : '') +
                        'Refresh to see updated stats.'
                      );
                      // Reload stats after migration
                      const { data: { user } } = await supabase.auth.getUser();
                      if (user) {
                        const data = await fetchUserStats(user.id, timeFilter);
                        setStats(data);
                        setInsights(getStatInsights(data));
                      }
                    } else {
                      setMigrationResult(`Error: ${result.error || 'Unknown error'}`);
                    }
                  } catch (error) {
                    setMigrationResult(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
                  } finally {
                    setMigrating(false);
                  }
                }}
                disabled={migrating}
                variant="outline"
                size="sm"
                className="w-full"
              >
                {migrating ? 'Migrating...' : 'Fix Historical OB Shots'}
              </Button>
              {migrationResult && (
                <p className="text-xs text-muted-foreground">{migrationResult}</p>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Strokes Gained Info Dialog */}
      <Dialog open={sgInfoOpen} onOpenChange={setSgInfoOpen}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Strokes Gained
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* What it measures */}
            <div>
              <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground mb-2">
                <Info className="h-4 w-4 text-primary" />
                What This Measures
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Strokes Gained compares your performance to a baseline (typically scratch golfer) from every shot. Positive = better than baseline, Negative = worse.
              </p>
            </div>

            {/* Why it matters */}
            <div>
              <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground mb-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                Why It Matters
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                It's the most accurate way to identify strengths and weaknesses. Traditional stats like GIR don't account for difficulty.
              </p>
            </div>

            {/* Tips */}
            <div>
              <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground mb-2">
                <Lightbulb className="h-4 w-4 text-primary" />
                Tips to Improve
              </h3>
              <ul className="space-y-2">
                <li className="flex items-start gap-2 text-sm text-muted-foreground">
                  <div className="h-1.5 w-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                  Focus on your biggest negative category first
                </li>
                <li className="flex items-start gap-2 text-sm text-muted-foreground">
                  <div className="h-1.5 w-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                  Small improvements in weak areas have outsized impact
                </li>
                <li className="flex items-start gap-2 text-sm text-muted-foreground">
                  <div className="h-1.5 w-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                  Track trends over time, not single rounds
                </li>
              </ul>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
