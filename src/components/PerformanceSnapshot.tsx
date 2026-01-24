import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TrendingUp, TrendingDown, Target, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { StrokesGainedStats, formatSG } from "@/utils/statisticsCalculations";

interface PerformanceSnapshotProps {
  performanceStats: { strokesGained: StrokesGainedStats; insights: any[] } | null;
}

// Map insight categories to drills
const drillsByCategory: Record<string, { id: string; title: string; description: string }[]> = {
  'putting': [
    { id: 'pga-tour-18', title: 'PGA Tour 18-hole Test', description: 'Overall putting practice against tour standards' },
    { id: 'aggressive-putting', title: 'Aggressive Putting 4-6m', description: 'Commit with confidence inside 6 meters' },
    { id: 'short-putting-test', title: 'Short Putt Test', description: 'Build consistency on short putts' },
  ],
  'short-game': [
    { id: '8-ball-drill', title: '8-Ball Circuit', description: 'Complete 8 chip/pitch/lob/bunker stations' },
    { id: 'easy-chip', title: 'Easy Chip Drill', description: 'Build consistency on simple chip shots' },
    { id: 'up-downs-test', title: '18 Up & Downs', description: '18 randomized short game stations' },
  ],
  'approach': [
    { id: 'wedges-2-laps', title: 'Wedge Game 40-80m', description: 'Dial in wedges from 40-80 meters' },
    { id: 'approach-control', title: 'Approach Control 130-180m', description: '14 approach shots from 130-180m' },
    { id: 'wedges-progression', title: "Wedge Ladder 60-120m", description: 'Distance control across 13 distances' },
  ],
  'driving': [
    { id: 'driver-control', title: 'Driver Control Drill', description: '14 tee shots testing fairway accuracy' },
    { id: 'shot-shape-master', title: 'Shot Shape Master', description: 'Master draws, fades, and fairway finding' },
  ],
};

interface SGStatDisplay {
  label: string;
  value: number;
  category: 'putting' | 'short-game' | 'approach' | 'driving';
  isStrength: boolean;
}

export const PerformanceSnapshot = ({ performanceStats }: PerformanceSnapshotProps) => {
  const navigate = useNavigate();

  // Safe defaults when no stats data
  const sgStats = performanceStats?.strokesGained || {
    putting: null,
    shortGame: null,
    approach: null,
    offTheTee: null,
  };
  const insights = performanceStats?.insights || [];
  
  // Check if we have any SG data
  const hasSGData = sgStats.putting !== null || sgStats.shortGame !== null || 
                    sgStats.approach !== null || sgStats.offTheTee !== null;

  // Build SG stats array for comparison
  const sgStatsList: SGStatDisplay[] = [];
  
  if (sgStats.putting !== null) {
    sgStatsList.push({
      label: 'Putting',
      value: sgStats.putting,
      category: 'putting',
      isStrength: sgStats.putting >= 0.1,
    });
  }
  if (sgStats.shortGame !== null) {
    sgStatsList.push({
      label: 'Short Game',
      value: sgStats.shortGame,
      category: 'short-game',
      isStrength: sgStats.shortGame >= 0.1,
    });
  }
  if (sgStats.approach !== null) {
    sgStatsList.push({
      label: 'Approach',
      value: sgStats.approach,
      category: 'approach',
      isStrength: sgStats.approach >= 0.2,
    });
  }
  if (sgStats.offTheTee !== null) {
    sgStatsList.push({
      label: 'Off the Tee',
      value: sgStats.offTheTee,
      category: 'driving',
      isStrength: sgStats.offTheTee >= 0.2,
    });
  }

  // Sort by value: highest (best) to lowest (worst)
  sgStatsList.sort((a, b) => b.value - a.value);

  const bestStat = sgStatsList.length >= 1 ? sgStatsList[0] : null;
  
  // Get two worst stats (end of sorted array)
  const worstStats: SGStatDisplay[] = [];
  if (sgStatsList.length >= 3) {
    worstStats.push(sgStatsList[sgStatsList.length - 2], sgStatsList[sgStatsList.length - 1]);
  } else if (sgStatsList.length === 2) {
    worstStats.push(sgStatsList[1]);
  }

  // Get recommended drills from the worst categories (matching Key Insights logic)
  const weakCategories = new Set<string>();
  
  // Use insights from the statistics page to ensure consistency
  const weaknesses = insights.filter((i: any) => i.status === 'weakness');
  weaknesses.forEach((w: any) => weakCategories.add(w.category));
  
  // If no weaknesses from insights, use the worst SG stats
  if (weakCategories.size === 0 && sgStatsList.length >= 2) {
    weakCategories.add(sgStatsList[sgStatsList.length - 1].category);
    if (sgStatsList.length >= 3) {
      weakCategories.add(sgStatsList[sgStatsList.length - 2].category);
    }
  }

  // Collect drills from weak categories
  const recommendedDrills: { id: string; title: string; description: string }[] = [];
  weakCategories.forEach(category => {
    const categoryDrills = drillsByCategory[category] || [];
    recommendedDrills.push(...categoryDrills.slice(0, 2));
  });

  // Limit to 3 drills max
  const finalRecommendedDrills = recommendedDrills.slice(0, 3);

  return (
    <Card className="rounded-none border-x-0">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center justify-between">
          <span>Key Insights</span>
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-muted-foreground"
            onClick={() => navigate('/statistics')}
          >
            View All
            <ChevronRight size={14} className="ml-1" />
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* SG Stats Grid */}
        <div className="grid grid-cols-3 gap-3">
          {/* Best stat (left) */}
          {bestStat ? (
            <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3 text-center">
              <div className="flex items-center justify-center gap-1 mb-1">
                <TrendingUp size={14} className="text-green-500" />
                <span className="text-[10px] uppercase tracking-wide text-green-600 font-medium">Best</span>
              </div>
              <p className="text-lg font-bold text-green-600">{formatSG(bestStat.value)}</p>
              <p className="text-xs text-muted-foreground">{bestStat.label}</p>
            </div>
          ) : (
            <div className="bg-muted/50 border border-border rounded-lg p-3 text-center">
              <div className="flex items-center justify-center gap-1 mb-1">
                <TrendingUp size={14} className="text-muted-foreground" />
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Best</span>
              </div>
              <p className="text-lg font-bold text-muted-foreground">—</p>
              <p className="text-xs text-muted-foreground">No data yet</p>
            </div>
          )}
          
          {/* Worst stats (middle and right) */}
          {worstStats.length > 0 ? (
            worstStats.map((stat) => (
              <div key={stat.category} className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <TrendingDown size={14} className="text-red-500" />
                  <span className="text-[10px] uppercase tracking-wide text-red-600 font-medium">Focus</span>
                </div>
                <p className="text-lg font-bold text-red-600">{formatSG(stat.value)}</p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </div>
            ))
          ) : (
            <>
              {/* Fill empty slots with placeholders */}
              <div className="bg-muted/50 border border-border rounded-lg p-3 text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <TrendingDown size={14} className="text-muted-foreground" />
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Focus</span>
                </div>
                <p className="text-lg font-bold text-muted-foreground">—</p>
                <p className="text-xs text-muted-foreground">No data yet</p>
              </div>
              <div className="bg-muted/50 border border-border rounded-lg p-3 text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <TrendingDown size={14} className="text-muted-foreground" />
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Focus</span>
                </div>
                <p className="text-lg font-bold text-muted-foreground">—</p>
                <p className="text-xs text-muted-foreground">No data yet</p>
              </div>
            </>
          )}
        </div>

        {/* Recommended Drills */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Recommended Drills</p>
          {finalRecommendedDrills.length > 0 ? (
            <div className="space-y-2">
              {finalRecommendedDrills.map((drill) => (
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
          ) : (
            <div className="p-3 rounded-lg bg-muted/50">
              <p className="text-sm text-muted-foreground text-center">No data yet</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
