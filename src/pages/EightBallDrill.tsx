import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Target } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import DrillLeaderboard from "@/components/DrillLeaderboard";

type ShotOutcome = 'holed' | '1m' | '2m' | '3m' | 'miss';

interface StationAttempt {
  stationIndex: number;
  roundIndex: number;
  outcome: ShotOutcome | null;
  points: number;
}

const stations = [
  'Chip 10m',
  'Chip 30m', 
  'Pitch 20m',
  'Pitch 40m',
  'Lob 15m',
  'Lob 25m',
  'Bunker 10m',
  'Bunker 20m',
];

const outcomePoints = {
  holed: 4,
  '1m': 3,
  '2m': 2, 
  '3m': 1,
  miss: 0,
};

const outcomeLabels = {
  holed: 'Holed',
  '1m': '≤1m',
  '2m': '≤2m',
  '3m': '≤3m',
  miss: 'Miss',
};

const EightBallDrill = () => {
  const navigate = useNavigate();
  const [attempts, setAttempts] = useState<StationAttempt[]>([]);
  const [currentTab, setCurrentTab] = useState('overview');

  // Initialize attempts array for 8 stations × 5 rounds = 40 attempts
  const initializeAttempts = () => {
    const newAttempts: StationAttempt[] = [];
    for (let round = 0; round < 5; round++) {
      for (let station = 0; station < 8; station++) {
        newAttempts.push({
          stationIndex: station,
          roundIndex: round,
          outcome: null,
          points: 0,
        });
      }
    }
    setAttempts(newAttempts);
    setCurrentTab('score');
  };

  const updateAttempt = (stationIndex: number, roundIndex: number, outcome: ShotOutcome) => {
    setAttempts(prev => prev.map(attempt => {
      if (attempt.stationIndex === stationIndex && attempt.roundIndex === roundIndex) {
        return {
          ...attempt,
          outcome,
          points: outcomePoints[outcome],
        };
      }
      return attempt;
    }));
  };

  const totalPoints = attempts.reduce((sum, attempt) => sum + attempt.points, 0);
  const completedAttempts = attempts.filter(a => a.outcome !== null).length;
  const totalAttempts = 40; // 8 stations × 5 rounds

  const saveScore = () => {
    // Save to localStorage or Supabase
    const scoreData = {
      drillId: '8-ball-drill',
      totalPoints,
      attempts: attempts.map(a => ({
        station: stations[a.stationIndex],
        round: a.roundIndex + 1,
        outcome: a.outcome,
        points: a.points,
      })),
      timestamp: Date.now(),
    };
    
    console.log('Saving score:', scoreData);
    // TODO: Save to Supabase
    
    navigate('/drills');
  };

  // Mock leaderboard data
  const mockLeaderboard = [
    { id: '1', name: 'John D.', score: 85, timestamp: Date.now() - 86400000 },
    { id: '2', name: 'Sarah M.', score: 92, timestamp: Date.now() - 172800000 },
    { id: '3', name: 'Mike R.', score: 78, timestamp: Date.now() - 259200000 },
  ];

  return (
    <div className="pb-20 min-h-screen bg-background">
      <div className="p-4">
        <div className="flex items-center gap-3 mb-6">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => navigate('/drills')}
            className="p-2"
          >
            <ArrowLeft size={20} />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">8-Ball Drill</h1>
            <p className="text-muted-foreground">Short Game • Points-based scoring</p>
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
                  <Target className="text-primary" size={20} />
                  Instructions
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-muted-foreground">
                  Perform the circuit 5 times. Complete all 8 stations in each round for a total of 40 shots.
                </p>
                
                <div>
                  <h4 className="font-medium mb-2">Stations (8):</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    {stations.map((station, index) => (
                      <li key={index}>• {station}</li>
                    ))}
                  </ul>
                </div>

                <div>
                  <h4 className="font-medium mb-2">Scoring:</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Holed: <span className="font-medium text-foreground">4 pts</span></li>
                    <li>• Within 1m: <span className="font-medium text-foreground">3 pts</span></li>
                    <li>• Within 2m: <span className="font-medium text-foreground">2 pts</span></li>
                    <li>• Within 3m: <span className="font-medium text-foreground">1 pt</span></li>
                    <li>• Miss: <span className="font-medium text-foreground">0 pts</span></li>
                  </ul>
                </div>

                <Button 
                  onClick={initializeAttempts}
                  className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
                >
                  Start Drill
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="score" className="space-y-4 mt-4">
            <div className="flex justify-between items-center">
              <div>
                <div className="text-lg font-bold">Total: {totalPoints} points</div>
                <div className="text-sm text-muted-foreground">
                  {completedAttempts}/{totalAttempts} attempts completed
                </div>
              </div>
              {completedAttempts === totalAttempts && (
                <Button onClick={saveScore} className="bg-primary hover:bg-primary/90">
                  Save Score
                </Button>
              )}
            </div>

            <div className="space-y-4">
              {[0, 1, 2, 3, 4].map(roundIndex => (
                <Card key={roundIndex}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Round {roundIndex + 1}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {stations.map((station, stationIndex) => {
                        const attempt = attempts.find(a => 
                          a.stationIndex === stationIndex && a.roundIndex === roundIndex
                        );
                        
                        return (
                          <div key={stationIndex} className="flex items-center justify-between">
                            <span className="text-sm font-medium">{station}</span>
                            <div className="flex gap-1">
                              {(Object.keys(outcomePoints) as ShotOutcome[]).map(outcome => (
                                <Button
                                  key={outcome}
                                  variant={attempt?.outcome === outcome ? "default" : "outline"}
                                  size="sm"
                                  className="text-xs px-2 py-1 h-7"
                                  onClick={() => updateAttempt(stationIndex, roundIndex, outcome)}
                                >
                                  {outcomeLabels[outcome]}
                                </Button>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="leaderboard" className="mt-4">
            <DrillLeaderboard
              drillName="8-Ball Drill"
              friendsLeaderboard={mockLeaderboard.slice(0, 3)}
              groupLeaderboard={mockLeaderboard.slice(0, 3)}
              groupName="Golf Buddies"
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default EightBallDrill;