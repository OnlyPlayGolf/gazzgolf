import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Target, Zap } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import DrillLeaderboard from "@/components/DrillLeaderboard";

// Import drill-specific components
import PGATour18Component from "@/components/drills/PGATour18Component";
import AggressivePuttingComponent from "@/components/drills/AggressivePuttingComponent";
import EightBallComponent from "@/components/drills/EightBallComponent";

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
};

const DrillDetail = () => {
  const navigate = useNavigate();
  const { drillId } = useParams<{ drillId: string }>();
  const [drill, setDrill] = useState<Drill | null>(null);
  const [currentTab, setCurrentTab] = useState('overview');

  useEffect(() => {
    if (!drillId || !drills[drillId]) {
      navigate('/drills');
      return;
    }
    setDrill(drills[drillId]);
  }, [drillId, navigate]);

  const handleBackClick = () => {
    // Always navigate to /drills, regardless of history
    navigate('/drills', { replace: true });
  };

  if (!drill) {
    return null;
  }

  const Icon = drill.icon;

  // Mock leaderboard data
  const mockLeaderboard = [
    { id: '1', name: 'John D.', score: 85, timestamp: Date.now() - 86400000 },
    { id: '2', name: 'Sarah M.', score: 92, timestamp: Date.now() - 172800000 },
    { id: '3', name: 'Mike R.', score: 78, timestamp: Date.now() - 259200000 },
  ];

  const renderDrillComponent = () => {
    switch (drillId) {
      case 'pga-tour-18':
        return <PGATour18Component onTabChange={setCurrentTab} />;
      case 'aggressive-putting':
        return <AggressivePuttingComponent onTabChange={setCurrentTab} />;
      case '8-ball-drill':
        return <EightBallComponent onTabChange={setCurrentTab} />;
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
          <div>
            <h1 className="text-2xl font-bold text-foreground">{drill.title}</h1>
            <p className="text-muted-foreground">{drill.category}</p>
          </div>
        </div>

        <Tabs value={currentTab} onValueChange={setCurrentTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="score">Score</TabsTrigger>
            <TabsTrigger value="leaderboard">Leaderboard</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Icon className="text-primary" size={20} />
                  About This Drill
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground leading-relaxed">
                  {drill.longDescription}
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="score" className="mt-4">
            {renderDrillComponent()}
          </TabsContent>

          <TabsContent value="leaderboard" className="mt-4">
            <DrillLeaderboard
              drillId={drillId!}
              drillName={drill.title}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default DrillDetail;