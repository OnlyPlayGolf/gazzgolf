import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Hammer } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface WedgesDistanceControlComponentProps {
  onTabChange?: (tab: string) => void;
  onScoreSaved?: () => void;
}

type ShotOutcome = '2m' | '3m' | '4m' | 'long' | 'missed';

interface Shot {
  shotIndex: number;
  distance: string;
  lap: number;
  outcome: ShotOutcome | null;
  points: number;
}

const distances = ['40m', '45m', '50m', '55m', '60m', '65m', '70m', '75m', '80m'];

const shots = [
  // Lap 1
  ...distances.map((distance, index) => ({ distance, lap: 1 })),
  // Lap 2
  ...distances.map((distance, index) => ({ distance, lap: 2 })),
];

const outcomePoints: Record<ShotOutcome, number> = {
  '2m': 3,
  '3m': 2,
  '4m': 1,
  'long': 0,
  'missed': -1,
};

const outcomeLabels: Record<ShotOutcome, string> = {
  '2m': '<2m',
  '3m': '<3m',
  '4m': '<4m',
  'long': '>4m',
  'missed': 'Missed',
};

const WedgesDistanceControlComponent = ({ onTabChange, onScoreSaved }: WedgesDistanceControlComponentProps) => {
  const [attempts, setAttempts] = useState<Shot[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [drillStarted, setDrillStarted] = useState(false);
  const [completedShots, setCompletedShots] = useState<number[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUserId(user?.id || null);
    });
  }, []);

  const initializeAttempts = () => {
    const newAttempts: Shot[] = shots.map((shot, index) => ({
      shotIndex: index,
      distance: shot.distance,
      lap: shot.lap,
      outcome: null,
      points: 0,
    }));
    setAttempts(newAttempts);
    setDrillStarted(true);
    setCompletedShots([]);
    onTabChange?.('score');
  };

  const updateAttempt = (shotIndex: number, outcome: ShotOutcome) => {
    setAttempts(prev => prev.map(attempt => {
      if (attempt.shotIndex === shotIndex) {
        return {
          ...attempt,
          outcome,
          points: outcomePoints[outcome],
        };
      }
      return attempt;
    }));
  };

  const toggleShotCompletion = (shotIndex: number) => {
    setCompletedShots(prev => 
      prev.includes(shotIndex)
        ? prev.filter(s => s !== shotIndex)
        : [...prev, shotIndex]
    );
  };

  const totalPoints = attempts.reduce((sum, attempt) => sum + attempt.points, 0);
  const completedAttempts = attempts.filter(a => a.outcome !== null).length;
  const totalAttempts = shots.length;

  const saveScore = async () => {
    if (!userId) {
      toast({
        title: "Sign in required",
        description: "Please sign in to save your score.",
        variant: "destructive",
      });
      return;
    }

    if (completedAttempts === 0) {
      toast({
        title: "No attempts recorded",
        description: "Please record at least one shot before saving.",
        variant: "destructive",
      });
      return;
    }

    try {
      const drillTitle = 'Wedges 40–80 m — Distance Control';
      
      const { data: drillData, error: drillError } = await supabase
        .rpc('get_or_create_drill_by_title', { p_title: drillTitle });

      if (drillError) throw drillError;

      const { error: insertError } = await supabase
        .from('drill_results')
        .insert([{
          drill_id: drillData,
          user_id: userId,
          total_points: totalPoints,
          attempts_json: attempts as any,
        }]);

      if (insertError) throw insertError;

      toast({
        title: "Score saved!",
        description: `Your score of ${totalPoints} points has been saved.`,
      });

      if (onScoreSaved) {
        onScoreSaved();
      }

      onTabChange?.('leaderboard');
    } catch (error: any) {
      toast({
        title: "Error saving score",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleStartDrill = () => {
    initializeAttempts();
  };

  return (
    <div className="space-y-6">
      {!drillStarted ? (
        <>
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold text-lg mb-2">Description</h3>
              <p className="text-muted-foreground">
                Hit the specified distances. One shot per length, 2 laps.
              </p>
              <p className="text-muted-foreground mt-2 font-medium">
                Distances: 40, 45, 50, 55, 60, 65, 70, 75, 80 meters
              </p>
            </div>

            <div>
              <h3 className="font-semibold text-lg mb-2">Scoring</h3>
              <ul className="space-y-1 text-muted-foreground">
                <li>• Within 2m of target → 3 points</li>
                <li>• Within 3m → 2 points</li>
                <li>• Within 4m → 1 point</li>
                <li>• More than 4m off → 0 points</li>
                <li>• Missed green → −1 point</li>
              </ul>
            </div>
          </div>

          <Button 
            onClick={handleStartDrill}
            className="w-full bg-primary hover:bg-primary/90"
          >
            Start Drill
          </Button>
        </>
      ) : (
        <>
          {/* Shot Distances */}
          <Card>
            <CardHeader>
              <CardTitle>Shot Distances</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Lap 1 */}
                <div>
                  <h4 className="text-sm font-semibold mb-2 text-muted-foreground">Lap 1</h4>
                  <div className="space-y-2">
                    {shots.slice(0, 9).map((shot, index) => (
                      <div 
                        key={index}
                        onClick={() => toggleShotCompletion(index)}
                        className={`flex justify-between items-center p-2 rounded-md cursor-pointer transition-colors ${
                          completedShots.includes(index)
                            ? 'bg-green-500/20 border-2 border-green-500'
                            : 'bg-muted/50 hover:bg-muted'
                        }`}
                      >
                        <span className="font-medium">Shot {index + 1}</span>
                        <span className="text-muted-foreground">{shot.distance}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Lap 2 */}
                <div>
                  <h4 className="text-sm font-semibold mb-2 text-muted-foreground">Lap 2</h4>
                  <div className="space-y-2">
                    {shots.slice(9, 18).map((shot, index) => {
                      const actualIndex = index + 9;
                      return (
                        <div 
                          key={actualIndex}
                          onClick={() => toggleShotCompletion(actualIndex)}
                          className={`flex justify-between items-center p-2 rounded-md cursor-pointer transition-colors ${
                            completedShots.includes(actualIndex)
                              ? 'bg-green-500/20 border-2 border-green-500'
                              : 'bg-muted/50 hover:bg-muted'
                          }`}
                        >
                          <span className="font-medium">Shot {actualIndex + 1}</span>
                          <span className="text-muted-foreground">{shot.distance}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Record Your Score */}
          <Card>
            <CardHeader>
              <CardTitle>Record Your Score</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {attempts.map((attempt) => (
                  <div key={attempt.shotIndex} className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="font-medium">
                        Shot {attempt.shotIndex + 1} - {attempt.distance}
                        <span className="text-xs ml-2 text-muted-foreground">
                          (Lap {attempt.lap})
                        </span>
                      </span>
                      {attempt.outcome && (
                        <span className={`text-sm ${
                          attempt.points >= 2 ? 'text-green-500' : 
                          attempt.points === 1 ? 'text-yellow-500' :
                          attempt.points === 0 ? 'text-orange-500' : 'text-red-500'
                        }`}>
                          {attempt.points > 0 ? '+' : ''}{attempt.points} pts
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-5 gap-2">
                      {(Object.keys(outcomePoints) as ShotOutcome[]).map((outcome) => (
                        <Button
                          key={outcome}
                          variant={attempt.outcome === outcome ? "default" : "outline"}
                          size="sm"
                          onClick={() => updateAttempt(attempt.shotIndex, outcome)}
                          className="text-xs px-2"
                        >
                          {outcomeLabels[outcome]}
                        </Button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Summary Card */}
          {userId ? (
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Score</p>
                    <p className="text-3xl font-bold">{totalPoints} pts</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">Completed</p>
                    <p className="text-xl font-semibold">{completedAttempts}/{totalAttempts}</p>
                  </div>
                </div>
                <Button
                  onClick={saveScore}
                  disabled={completedAttempts === 0}
                  className="w-full bg-primary hover:bg-primary/90"
                >
                  Save Score
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="pt-6 text-center">
                <p className="text-muted-foreground mb-2">
                  Sign in to save your score and compete on the leaderboard
                </p>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
};

export default WedgesDistanceControlComponent;
