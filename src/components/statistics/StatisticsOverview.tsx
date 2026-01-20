import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Target, TrendingUp, BarChart3, ChevronRight, ArrowUp, ArrowDown, Minus } from "lucide-react";
import { fetchUserStats, formatScore, formatSG, formatPercentage, getSGLevel, getStatLevel, AllStats, StatLevel } from "@/utils/statisticsCalculations";
import { cn } from "@/lib/utils";

interface StatisticsOverviewProps {
  userId: string;
  isOwnProfile?: boolean;
}

const StatLevelIndicator = ({ level }: { level: StatLevel }) => {
  if (level === 'strength') {
    return (
      <div className="flex items-center gap-1 text-success">
        <ArrowUp className="h-3 w-3" />
        <span className="text-[10px] font-medium">Strong</span>
      </div>
    );
  }
  if (level === 'needs-improvement') {
    return (
      <div className="flex items-center gap-1 text-destructive">
        <ArrowDown className="h-3 w-3" />
        <span className="text-[10px] font-medium">Work on</span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1 text-muted-foreground">
      <Minus className="h-3 w-3" />
      <span className="text-[10px] font-medium">Average</span>
    </div>
  );
};

export function StatisticsOverview({ userId, isOwnProfile = true }: StatisticsOverviewProps) {
  const navigate = useNavigate();
  const [stats, setStats] = useState<AllStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadStats = async () => {
      try {
        const data = await fetchUserStats(userId);
        setStats(data);
      } catch (error) {
        console.error('Error loading stats:', error);
      } finally {
        setLoading(false);
      }
    };

    loadStats();
  }, [userId]);

  const getScoringLevel = (score: number | null): StatLevel => {
    if (score === null) return 'average';
    if (score <= 2) return 'strength';
    if (score >= 8) return 'needs-improvement';
    return 'average';
  };

  const getGIRLevel = (gir: number | null): StatLevel => {
    if (gir === null) return 'average';
    if (gir >= 55) return 'strength';
    if (gir <= 35) return 'needs-improvement';
    return 'average';
  };

  if (loading) {
    return (
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xl font-bold text-foreground">Statistics</h2>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="bg-card animate-pulse">
              <CardContent className="p-4 h-24" />
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const scoringLevel = stats ? getScoringLevel(stats.scoring.scoringAverage) : 'average';
  const girLevel = stats ? getGIRLevel(stats.accuracy.greensInRegulation) : 'average';
  const sgLevel = stats ? getSGLevel(stats.strokesGained.total) : 'average';
  const fairwaysLevel = stats ? getStatLevel(stats.accuracy.fairwaysHit, 'fairwaysHit') : 'average';

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xl font-bold text-foreground">Statistics</h2>
        <Button 
          variant="link" 
          className="text-primary p-0 h-auto"
          onClick={() => navigate('/statistics')}
        >
          View all
          <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </div>

      <div 
        className="grid grid-cols-3 gap-3 cursor-pointer"
        onClick={() => navigate('/statistics')}
      >
        {/* Scoring Average */}
        <Card className={cn(
          "bg-card hover:bg-accent/50 transition-all border-2",
          scoringLevel === 'strength' && "border-success/30",
          scoringLevel === 'needs-improvement' && "border-destructive/30",
          scoringLevel === 'average' && "border-transparent"
        )}>
          <CardContent className="p-3 text-center">
            <Target className="h-5 w-5 mx-auto mb-1.5 text-primary" />
            <p className="text-[10px] text-muted-foreground mb-1">Scoring Avg</p>
            <p className="text-xl font-bold text-foreground">
              {stats?.scoring.scoringAverage !== null 
                ? formatScore(stats.scoring.scoringAverage) 
                : '-'}
            </p>
            {stats?.scoring.totalRounds && stats.scoring.totalRounds > 0 && (
              <p className="text-[9px] text-muted-foreground mt-0.5">
                {stats.scoring.totalRounds} rounds
              </p>
            )}
            <div className="mt-1.5">
              <StatLevelIndicator level={scoringLevel} />
            </div>
          </CardContent>
        </Card>

        {/* GIR (Key Performance Stat) */}
        <Card className={cn(
          "bg-card hover:bg-accent/50 transition-all border-2",
          girLevel === 'strength' && "border-success/30",
          girLevel === 'needs-improvement' && "border-destructive/30",
          girLevel === 'average' && "border-transparent"
        )}>
          <CardContent className="p-3 text-center">
            <BarChart3 className="h-5 w-5 mx-auto mb-1.5 text-primary" />
            <p className="text-[10px] text-muted-foreground mb-1">GIR</p>
            <p className="text-xl font-bold text-foreground">
              {stats?.accuracy.greensInRegulation !== null 
                ? formatPercentage(stats.accuracy.greensInRegulation)
                : '-'}
            </p>
            <p className="text-[9px] text-muted-foreground mt-0.5">
              Greens in Reg
            </p>
            <div className="mt-1.5">
              <StatLevelIndicator level={girLevel} />
            </div>
          </CardContent>
        </Card>

        {/* Fairways Hit */}
        <Card className={cn(
          "bg-card hover:bg-accent/50 transition-all border-2",
          fairwaysLevel === 'strength' && "border-success/30",
          fairwaysLevel === 'needs-improvement' && "border-destructive/30",
          fairwaysLevel === 'average' && "border-transparent"
        )}>
          <CardContent className="p-3 text-center">
            <TrendingUp className="h-5 w-5 mx-auto mb-1.5 text-primary" />
            <p className="text-[10px] text-muted-foreground mb-1">Fairways Hit</p>
            <p className="text-xl font-bold text-foreground">
              {stats?.accuracy.fairwaysHit !== null
                ? formatPercentage(stats.accuracy.fairwaysHit)
                : '-'}
            </p>
            <p className="text-[9px] text-muted-foreground mt-0.5">
              per round
            </p>
            <div className="mt-1.5">
              <StatLevelIndicator level={fairwaysLevel} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick insight banner */}
      {stats && (stats.strokesGained.total !== null || stats.accuracy.greensInRegulation !== null) && (
        <Card 
          className="mt-3 bg-muted/50 cursor-pointer hover:bg-muted/70 transition-colors"
          onClick={() => navigate('/statistics')}
        >
          <CardContent className="p-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              {sgLevel === 'needs-improvement' || girLevel === 'needs-improvement' || scoringLevel === 'needs-improvement' ? (
                <>
                  <div className="h-2 w-2 rounded-full bg-destructive" />
                  <span className="text-sm text-foreground">See what needs improvement</span>
                </>
              ) : sgLevel === 'strength' || girLevel === 'strength' || scoringLevel === 'strength' ? (
                <>
                  <div className="h-2 w-2 rounded-full bg-success" />
                  <span className="text-sm text-foreground">View your strengths</span>
                </>
              ) : (
                <>
                  <div className="h-2 w-2 rounded-full bg-primary" />
                  <span className="text-sm text-foreground">View detailed stats</span>
                </>
              )}
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
