import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TopNavBar } from "@/components/TopNavBar";
import { 
  ArrowLeft, TrendingUp, Target, Play, 
  ArrowUp, ArrowDown, Lightbulb, Info
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { 
  fetchUserStats, formatSG, formatPercentage,
  getSGLevel, getDrillRecommendations,
  AllStats, DrillRecommendation, StatsFilter 
} from "@/utils/statisticsCalculations";
import { cn } from "@/lib/utils";

type TimeFilter = StatsFilter;

interface CategoryConfig {
  title: string;
  icon: any;
  description: string;
  whatItMeasures: string;
  whyItMatters: string;
  tips: string[];
  getStats: (stats: AllStats) => { label: string; value: string; isPositive?: boolean }[];
  getRelevantDrills: (recs: DrillRecommendation[]) => DrillRecommendation[];
}

const CATEGORIES: Record<string, CategoryConfig> = {
  'putting': {
    title: 'Putting',
    icon: Target,
    description: 'Your performance on the greens',
    whatItMeasures: 'Strokes Gained Putting measures how well you putt compared to the average golfer from the same distances. Positive values mean you\'re gaining strokes on the greens.',
    whyItMatters: 'Putting accounts for about 40% of all strokes. A good putter can save 2-3 strokes per round compared to a poor putter.',
    tips: [
      'Focus on distance control for lag putts',
      'Develop a consistent pre-putt routine',
      'Practice short putts (3-6 feet) regularly'
    ],
    getStats: (stats) => [
      { label: 'Putts per Round', value: stats.putting.puttsPerRound?.toFixed(1) ?? '-' },
      { label: '1-Putt per Hole', value: formatPercentage(stats.putting.onePuttPercentage) },
      { label: '2-Putts per Hole', value: formatPercentage(stats.putting.twoPuttPercentage) },
      { label: '3-Putts per Hole', value: formatPercentage(stats.putting.threePuttPercentage) },
      { label: '4-Putts or Worse per Hole', value: formatPercentage(stats.putting.fourPlusPuttPercentage) },
      { label: '3-Putt Avoidance', value: formatPercentage(stats.putting.threePuttAvoidance) },
    ],
    getRelevantDrills: (recs) => recs.filter(d => d.category === 'Putting')
  },
  'short-game': {
    title: 'Short Game',
    icon: Target,
    description: 'Chips, pitches, and bunker play',
    whatItMeasures: 'Strokes Gained Short Game measures your performance from within 40 meters of the green (excluding putting). This includes chips, pitches, and bunker shots.',
    whyItMatters: 'Great short game saves par and prevents big numbers. Tour pros average 60%+ scrambling, while amateurs average around 30%.',
    tips: [
      'Master one go-to chip shot first',
      'Practice different lies and stances',
      'Learn to control trajectory and spin'
    ],
    getStats: (stats) => [
      { label: 'Scrambling', value: formatPercentage(stats.accuracy.scrambling) },
    ],
    getRelevantDrills: (recs) => recs.filter(d => d.category === 'Short Game')
  },
  'approach': {
    title: 'Approach Play',
    icon: Target,
    description: 'Iron shots into the green',
    whatItMeasures: 'Strokes Gained Approach measures your iron play from 40+ meters. It considers both accuracy (how close you hit it) and avoiding trouble.',
    whyItMatters: 'Approach shots are often the biggest differentiator between scoring levels. Hitting more greens means more birdie putts and easier pars.',
    tips: [
      'Know your exact yardages for each club',
      'Aim at the fat part of the green',
      'Practice from various lies'
    ],
    getStats: (stats) => [
      { label: 'Greens in Regulation', value: formatPercentage(stats.accuracy.greensInRegulation) },
      { label: 'Greens in Regulation Par 3s', value: formatPercentage(stats.accuracy.girPar3) },
      { label: 'Greens in Regulation Par 4s', value: formatPercentage(stats.accuracy.girPar4) },
      { label: 'Greens in Regulation Par 5s', value: formatPercentage(stats.accuracy.girPar5) },
    ],
    getRelevantDrills: (recs) => recs.filter(d => ['Approach', 'Wedges'].includes(d.category))
  },
  'driving': {
    title: 'Off the Tee',
    icon: Target,
    description: 'Tee shots on par 4s and 5s',
    whatItMeasures: 'Strokes Gained Off the Tee measures how well you drive the ball on par 4s and 5s. It accounts for both distance and accuracy.',
    whyItMatters: 'A good tee shot sets up the hole. Finding fairways consistently leads to easier approaches and lower scores.',
    tips: [
      'Prioritize fairways over distance',
      'Develop a reliable shot shape',
      'Have a go-to tee shot for pressure situations'
    ],
    getStats: (stats) => [
      { label: 'SG Off the Tee', value: formatSG(stats.strokesGained.offTheTee), isPositive: (stats.strokesGained.offTheTee ?? 0) >= 0 },
      { label: 'Fairways Hit', value: formatPercentage(stats.accuracy.fairwaysHit) },
      { label: 'Left Miss', value: stats.accuracy.leftMissPercentage !== null ? formatPercentage(stats.accuracy.leftMissPercentage) : '-' },
      { label: 'Right Miss', value: stats.accuracy.rightMissPercentage !== null ? formatPercentage(stats.accuracy.rightMissPercentage) : '-' },
      { label: 'Average Driver Distance', value: stats.accuracy.avgDriverDistance !== null ? `${Math.round(stats.accuracy.avgDriverDistance)} m` : '-' },
    ],
    getRelevantDrills: (recs) => recs.filter(d => ['Driving', 'Full Swing'].includes(d.category))
  },
  'fairways': {
    title: 'Fairways Hit',
    icon: Target,
    description: 'Accuracy off the tee',
    whatItMeasures: 'Fairways Hit measures the percentage of times your tee shot lands in the fairway on par 4s and 5s. It\'s a key indicator of driving accuracy.',
    whyItMatters: 'Hitting fairways gives you better angles and lies for approach shots. From the fairway, you have more control and can attack pins more aggressively.',
    tips: [
      'Prioritize fairways over distance',
      'Develop a reliable shot shape',
      'Have a go-to tee shot for pressure situations'
    ],
    getStats: (stats) => [
      { label: 'Fairways Hit', value: formatPercentage(stats.accuracy.fairwaysHit) },
      { label: 'Left Miss', value: stats.accuracy.leftMissPercentage !== null ? formatPercentage(stats.accuracy.leftMissPercentage) : '-' },
      { label: 'Right Miss', value: stats.accuracy.rightMissPercentage !== null ? formatPercentage(stats.accuracy.rightMissPercentage) : '-' },
    ],
    getRelevantDrills: (recs) => recs.filter(d => ['Driving', 'Full Swing'].includes(d.category))
  },
  'scoring': {
    title: 'Scoring',
    icon: TrendingUp,
    description: 'Overall scoring performance',
    whatItMeasures: 'Your scoring average relative to par shows how you typically score. Breaking it down by par 3/4/5 helps identify specific areas to improve.',
    whyItMatters: 'Understanding where you make and lose strokes helps prioritize practice time effectively.',
    tips: [
      'Avoid big numbers - play smart when in trouble',
      'Capitalize on par 5s for easy birdies',
      'Par is always a good score'
    ],
    getStats: (stats) => [
      { label: 'Scoring Average', value: stats.scoring.scoringAverage !== null 
        ? (stats.scoring.scoringAverage > 0 ? '+' : '') + stats.scoring.scoringAverage.toFixed(1) 
        : '-' },
      { label: 'Best Round', value: stats.scoring.bestRound?.toString() ?? '-' },
      { label: 'Rounds Played', value: stats.scoring.totalRounds.toString() },
    ],
    getRelevantDrills: () => []
  },
  'strokes-gained': {
    title: 'Strokes Gained',
    icon: TrendingUp,
    description: 'Understanding your game',
    whatItMeasures: 'Strokes Gained compares your performance to a baseline (typically scratch golfer) from every shot. Positive = better than baseline, Negative = worse.',
    whyItMatters: 'It\'s the most accurate way to identify strengths and weaknesses. Traditional stats like GIR don\'t account for difficulty.',
    tips: [
      'Focus on your biggest negative category first',
      'Small improvements in weak areas have outsized impact',
      'Track trends over time, not single rounds'
    ],
    getStats: (stats) => [
      { label: 'Total', value: formatSG(stats.strokesGained.total), isPositive: (stats.strokesGained.total ?? 0) >= 0 },
      { label: 'Off the Tee', value: formatSG(stats.strokesGained.offTheTee), isPositive: (stats.strokesGained.offTheTee ?? 0) >= 0 },
      { label: 'Approach', value: formatSG(stats.strokesGained.approach), isPositive: (stats.strokesGained.approach ?? 0) >= 0 },
      { label: 'Short Game', value: formatSG(stats.strokesGained.shortGame), isPositive: (stats.strokesGained.shortGame ?? 0) >= 0 },
      { label: 'Putting', value: formatSG(stats.strokesGained.putting), isPositive: (stats.strokesGained.putting ?? 0) >= 0 },
    ],
    getRelevantDrills: (recs) => recs
  }
};

export default function StatDetail() {
  const navigate = useNavigate();
  const { category } = useParams<{ category: string }>();
  const [stats, setStats] = useState<AllStats | null>(null);
  const [drillRecs, setDrillRecs] = useState<DrillRecommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('all');

  const config = category ? CATEGORIES[category] : null;

  useEffect(() => {
    const loadStats = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/auth');
        return;
      }

      try {
        const data = await fetchUserStats(user.id, timeFilter);
        setStats(data);
        setDrillRecs(getDrillRecommendations(data));
      } catch (error) {
        console.error('Error loading stats:', error);
      } finally {
        setLoading(false);
      }
    };

    loadStats();
  }, [navigate, category, timeFilter]);

  if (!config) {
    return (
      <div className="min-h-screen bg-background">
        <TopNavBar />
        <div className="flex items-center justify-center pt-32">
          <p className="text-muted-foreground">Category not found</p>
        </div>
      </div>
    );
  }

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

  const Icon = config.icon;
  const categoryStats = stats ? config.getStats(stats) : [];
  const relevantDrills = config.getRelevantDrills(drillRecs);

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 pb-20">
      <TopNavBar />
      <div className="pt-16 px-4">
        {/* Header */}
        <div className="flex items-center gap-3 py-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/statistics')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Icon className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">{config.title}</h1>
              <p className="text-sm text-muted-foreground">{config.description}</p>
            </div>
          </div>
        </div>

        {/* Time Filter */}
        <div className="mb-4">
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

        {/* Current Stats */}
        <Card className="mb-4">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Your Performance</CardTitle>
          </CardHeader>
          <CardContent>
            {categoryStats.map((stat, index) => (
              <div 
                key={index}
                className="flex items-center justify-between py-3 border-b border-border/50 last:border-0"
              >
                <span className="text-sm text-foreground">{stat.label}</span>
                <span className={cn(
                  "text-lg font-bold",
                  stat.isPositive === true && "text-success",
                  stat.isPositive === false && "text-destructive"
                )}>
                  {stat.value}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* What it measures */}
        <Card className="mb-4">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Info className="h-4 w-4 text-primary" />
              What This Measures
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {config.whatItMeasures}
            </p>
          </CardContent>
        </Card>

        {/* Why it matters */}
        <Card className="mb-4">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-4 w-4 text-primary" />
              Why It Matters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {config.whyItMatters}
            </p>
          </CardContent>
        </Card>

        {/* Tips */}
        <Card className="mb-4">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Lightbulb className="h-4 w-4 text-primary" />
              Tips to Improve
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {config.tips.map((tip, index) => (
                <li key={index} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <div className="h-1.5 w-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                  {tip}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {/* Recommended Drills */}
        {relevantDrills.length > 0 && (
          <section className="mb-6">
            <h2 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              Drills to Improve
            </h2>
            <div className="space-y-3">
              {relevantDrills.map((drill, index) => (
                <Card 
                  key={index}
                  className="cursor-pointer hover:shadow-md transition-all"
                  onClick={() => navigate(drill.path)}
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
              ))}
            </div>
          </section>
        )}

        {/* CTA */}
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="p-4 text-center">
            <p className="text-sm text-foreground mb-3">
              Ready to improve your {config.title.toLowerCase()}?
            </p>
            <Button onClick={() => navigate('/drills')}>
              Browse All Drills
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
