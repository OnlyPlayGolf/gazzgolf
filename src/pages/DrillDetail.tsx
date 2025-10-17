import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Target, Zap, Star, Hammer } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { cn } from "@/lib/utils";
import { isFavorite, addToFavorites, removeFromFavorites } from "@/utils/favoritesManager";
import PGATour18Component from "@/components/drills/PGATour18Component";
import AggressivePuttingComponent from "@/components/drills/AggressivePuttingComponent";
import EightBallComponent from "@/components/drills/EightBallComponent";
import WedgesDistanceControlComponent from "@/components/drills/WedgesDistanceControlComponent";
import Wedges2LapsComponent from "@/components/drills/Wedges2LapsComponent";
import DrillLeaderboard from "@/components/DrillLeaderboard";
import PersonalBestBar from "@/components/PersonalBestBar";

interface Drill {
  id: string;
  title: string;
  shortDescription: string;
  longDescription: string;
  category: string;
  icon: any;
}

const drills: Record<string, Drill> = {
  'pga-tour-18': {
    id: 'pga-tour-18',
    title: 'PGA Tour 18 Holes',
    shortDescription: 'Practice putting from tournament-style distances across 18 holes for consistency under pressure.',
    longDescription: 'This drill simulates the putting challenges you\'ll face on a PGA Tour course. Practice putting from varying distances across 18 holes, with each hole representing the average putting distance from that hole on tour. Focus on developing consistency under pressure and building confidence in your putting stroke.',
    category: 'Putting',
    icon: Target,
  },
  'aggressive-putting': {
    id: 'aggressive-putting',
    title: 'Aggressive Putting',
    shortDescription: 'Putt from a fixed cycle of 4m, 5m, then 6m, repeating in that order to reach 15 points quickly.',
    longDescription: 'This drill focuses on developing an aggressive putting mindset by cycling through increasing distances. Start with 4m putts, then 5m, then 6m, and repeat the cycle. Score points for holed putts and putts finishing within 1m. The goal is to reach 15 points as quickly as possible while maintaining accuracy.',
    category: 'Putting', 
    icon: Target,
  },
  '8-ball-drill': {
    id: '8-ball-drill',
    title: '8-Ball Drill',
    shortDescription: 'Complete 8 stations (chip/pitch/lob/bunker) and score each rep. Do the circuit 5 times.',
    longDescription: 'A comprehensive short game drill that tests your skills across 8 different stations covering chipping, pitching, lob shots, and bunker play. Complete all 8 stations in each of 5 rounds for a total of 40 shots. Score points based on proximity to the hole, with holed shots receiving maximum points.',
    category: 'Short Game',
    icon: Zap,
  },
  'wedges-distance-control': {
    id: 'wedges-distance-control',
    title: 'Wedges 40–80 m — Distance Control',
    shortDescription: 'Hit specified distances in carry with precise distance control. Score points for accuracy.',
    longDescription: 'This drill focuses on developing precise distance control with your wedges from 40-80 meters. Hit 18 shots at specified distances from the fairway, with some shots having constraints (not short/not long). Score points based on how close you finish to the target distance. Perfect for improving your scoring game from prime scoring distances.',
    category: 'Wedges',
    icon: Hammer,
  },
  'wedges-2-laps': {
    id: 'wedges-2-laps',
    title: 'Wedges 40–80 m — 2 Laps',
    shortDescription: 'Hit the specified distances. One shot per length, 2 laps.',
    longDescription: 'A simpler wedge distance drill with 2 laps of 9 different distances from 40-80 meters. Focus on hitting precise distances from the fairway. Score points based on accuracy: 3 points for within 2m, 2 points for within 3m, 1 point for within 4m, 0 points for more than 4m off, and -1 point for missed greens.',
    category: 'Wedges',
    icon: Hammer,
  },
};

const DrillDetail = () => {
  const navigate = useNavigate();
  const { drillId } = useParams<{ drillId: string }>();
  const [drill, setDrill] = useState<Drill | null>(null);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [drillIsFavorite, setDrillIsFavorite] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    if (drillId && drills[drillId]) {
      setDrill(drills[drillId]);
      setDrillIsFavorite(isFavorite(drillId));
    } else {
      navigate('/categories');
    }
  }, [drillId, navigate]);

  const handleBackClick = () => {
    // Determine which category this drill belongs to
    if (drill) {
      const categoryMap: { [key: string]: string } = {
        'pga-tour-18': 'putting',
        'aggressive-putting': 'putting',
        '8-ball-drill': 'shortgame',
        'wedges-distance-control': 'wedges',
        'wedges-2-laps': 'wedges',
      };
      
      const categoryId = categoryMap[drill.id] || 'putting';
      navigate(`/drills/${categoryId}`);
    } else {
      navigate('/categories');
    }
  };

  const toggleFavorite = () => {
    if (!drill) return;
    
    if (drillIsFavorite) {
      removeFromFavorites(drill.id);
      setDrillIsFavorite(false);
    } else {
      addToFavorites({
        id: drill.id,
        title: drill.title,
        category: drill.category,
      });
      setDrillIsFavorite(true);
    }
  };

  if (!drill) {
    return null;
  }

  const handleScoreSaved = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  const renderDrillComponent = () => {
    switch (drillId) {
      case 'pga-tour-18':
        return <PGATour18Component onScoreSaved={handleScoreSaved} />;
      case 'aggressive-putting':
        return <AggressivePuttingComponent onScoreSaved={handleScoreSaved} />;
      case '8-ball-drill':
        return <EightBallComponent onScoreSaved={handleScoreSaved} />;
      case 'wedges-distance-control':
        return <WedgesDistanceControlComponent onScoreSaved={handleScoreSaved} />;
      case 'wedges-2-laps':
        return <Wedges2LapsComponent onScoreSaved={handleScoreSaved} />;
      default:
        return null;
    }
  };

  return (
    <div className="pb-20 min-h-screen bg-background">
      <div className="p-4">
        <div className="flex items-center gap-3 mb-6">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={handleBackClick}
            className="p-2"
          >
            <ArrowLeft size={20} />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-foreground">{drill.title}</h1>
            <p className="text-muted-foreground">{drill.category}</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleFavorite}
            className="p-2"
          >
            <Star 
              size={20} 
              className={cn(
                "transition-colors",
                drillIsFavorite 
                  ? "text-yellow-500 fill-yellow-500" 
                  : "text-muted-foreground hover:text-yellow-500"
              )}
            />
          </Button>
        </div>

        <div className="space-y-6">
          {/* Overview Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <drill.icon className="text-primary" size={20} />
                About this drill
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground leading-relaxed">
                {drill.longDescription}
              </p>
            </CardContent>
          </Card>

          {/* Personal Best Bar */}
          <PersonalBestBar drillTitle={drill.title} refreshTrigger={refreshTrigger} />

          {/* Drill Component */}
          <Card>
            <CardHeader>
              <CardTitle>Start Drill</CardTitle>
            </CardHeader>
            <CardContent>
              {renderDrillComponent()}
            </CardContent>
          </Card>

          {/* Full Leaderboard Toggle */}
          <Button
            variant="outline"
            className="w-full"
            onClick={() => setShowLeaderboard(!showLeaderboard)}
          >
            {showLeaderboard ? 'Hide' : 'Show'} Full Leaderboard
          </Button>

          {showLeaderboard && (
            <Card>
              <CardContent className="pt-6">
                <DrillLeaderboard
                  drillId={drill.id}
                  drillName={drill.title}
                  refreshTrigger={refreshTrigger}
                />
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default DrillDetail;