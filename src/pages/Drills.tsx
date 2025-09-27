import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Target, Zap } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { getStorageItem } from "@/utils/storageManager";
import { STORAGE_KEYS } from "@/constants/app";
// Import the DrillLeaderboard component
import DrillLeaderboard from "@/components/DrillLeaderboard";

const drills = [
  {
    id: 'pga-tour-18',
    title: 'PGA Tour 18 Holes',
    shortDescription: 'Practice putting from tournament-style distances across 18 holes for consistency under pressure.',
    category: 'Putting',
    icon: Target,
    lastScore: null, // Will be populated from storage
    storageKey: STORAGE_KEYS.PGA18_SCORES,
  },
  {
    id: 'aggressive-putting',
    title: 'Aggressive Putting',
    shortDescription: 'Putt from a fixed cycle of 4m, 5m, then 6m, repeating in that order to reach 15 points quickly.',
    category: 'Putting', 
    icon: Target,
    lastScore: null,
    storageKey: STORAGE_KEYS.AGGRESSIVE_PUTTING_SCORES,
  },
  {
    id: '8-ball-drill',
    title: '8-Ball Drill',
    shortDescription: 'Complete 8 stations (chip/pitch/lob/bunker) and score each rep. Do the circuit 5 times.',
    category: 'Short Game',
    icon: Zap,
    lastScore: null,
    storageKey: 'eightBallDrillScores', // Will need to add this to constants
  },
];

const Drills = () => {
  const navigate = useNavigate();

  // Get last scores for each drill
  const drillsWithScores = drills.map(drill => {
    const scores = getStorageItem(drill.storageKey, []);
    const lastScore = scores.length > 0 ? scores[scores.length - 1] : null;
    return { ...drill, lastScore };
  });

  // Mock leaderboard data - will be replaced with Supabase data
  const mockLeaderboard = [
    { id: '1', name: 'John D.', score: 85, timestamp: Date.now() - 86400000 },
    { id: '2', name: 'Sarah M.', score: 92, timestamp: Date.now() - 172800000 },
    { id: '3', name: 'Mike R.', score: 78, timestamp: Date.now() - 259200000 },
  ];

  return (
    <div className="pb-20 min-h-screen bg-background">
      <div className="p-4">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground mb-2">Drills</h1>
          <p className="text-muted-foreground">Choose a drill to start practicing</p>
        </div>

        <div className="space-y-6">
          {drillsWithScores.map((drill) => {
            const Icon = drill.icon;
            
            return (
              <Card key={drill.id} className="border-golf-light hover:border-primary transition-all duration-200">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-3 text-foreground">
                    <Icon size={24} className="text-primary" />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span>{drill.title}</span>
                        <span className="text-xs text-muted-foreground">{drill.category}</span>
                      </div>
                      {drill.lastScore && (
                        <div className="text-sm font-normal text-muted-foreground mt-1">
                          Last Score: {drill.lastScore.score}
                        </div>
                      )}
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    {drill.shortDescription}
                  </p>
                  
                  <Button 
                    onClick={() => navigate(`/drills/${drill.id}`)}
                    className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
                  >
                    Start
                  </Button>

                  <DrillLeaderboard
                    drillName={drill.title}
                    friendsLeaderboard={mockLeaderboard.slice(0, 3)}
                    groupLeaderboard={mockLeaderboard.slice(0, 3)}
                    groupName="Golf Buddies"
                  />
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default Drills;