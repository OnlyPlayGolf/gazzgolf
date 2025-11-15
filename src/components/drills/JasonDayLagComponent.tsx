import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Target } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface JasonDayLagComponentProps {
  onTabChange?: (tab: string) => void;
  onScoreSaved?: () => void;
}

interface PuttAttempt {
  puttNumber: number;
  distance: number;
  outcome: string;
  points: number;
}

const generateRandomDistances = (): number[] => {
  const distances: number[] = [];
  const minDistance = 8;
  const maxDistance = 20;
  
  // Generate 18 unique random distances between 8 and 20 meters
  const step = (maxDistance - minDistance) / 17;
  for (let i = 0; i < 18; i++) {
    distances.push(minDistance + (i * step));
  }
  
  // Fisher-Yates shuffle
  for (let i = distances.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [distances[i], distances[j]] = [distances[j], distances[i]];
  }
  
  return distances.map(d => Math.round(d));
};

const outcomes = [
  { label: 'Holed', points: 3 },
  { label: 'Within 0.6m (2 feet)', points: 2 },
  { label: '0.6m-1m (2-3 feet)', points: 1 },
  { label: '1-2 meters', points: 0 },
  { label: '2-3 meters', points: -1 },
  { label: 'Outside 3 meters', points: -2 },
];

const JasonDayLagComponent = ({ onTabChange, onScoreSaved }: JasonDayLagComponentProps) => {
  const [attempts, setAttempts] = useState<PuttAttempt[]>([]);
  const [currentPutt, setCurrentPutt] = useState(1);
  const [isActive, setIsActive] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [distanceSequence, setDistanceSequence] = useState<number[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUserId(user?.id || null);
    });
  }, []);

  const totalPoints = attempts.reduce((sum, att) => sum + att.points, 0);
  const currentDistance = distanceSequence[currentPutt - 1];

  const handleStartDrill = () => {
    setIsActive(true);
    setAttempts([]);
    setCurrentPutt(1);
    setDistanceSequence(generateRandomDistances());
    onTabChange?.('score');
  };

  const handleOutcome = (outcome: string, points: number) => {
    const newAttempt: PuttAttempt = {
      puttNumber: currentPutt,
      distance: currentDistance,
      outcome,
      points,
    };

    const newAttempts = [...attempts, newAttempt];
    setAttempts(newAttempts);

    if (currentPutt === 18) {
      handleSaveScore(newAttempts);
    } else {
      setCurrentPutt(currentPutt + 1);
    }
  };

  const handleSaveScore = async (finalAttempts: PuttAttempt[]) => {
    if (!userId) {
      toast({
        title: "Sign in required",
        description: "Please sign in to save your score.",
        variant: "destructive",
      });
      setIsActive(false);
      return;
    }

    const finalPoints = finalAttempts.reduce((sum, att) => sum + att.points, 0);

    try {
      const { data: drillId, error: drillError } = await (supabase as any)
        .rpc('get_or_create_drill_by_title', { p_title: "Jason Day's Lag Drill" });

      if (drillError || !drillId) {
        console.error('Drill not found or could not create:', drillError);
        toast({
          title: "Error",
          description: "Could not save score.",
          variant: "destructive",
        });
        setIsActive(false);
        return;
      }

      const { error: saveError } = await (supabase as any)
        .from('drill_results')
        .insert({
          drill_id: drillId,
          user_id: userId,
          total_points: finalPoints,
          attempts_json: finalAttempts
        });

      if (saveError) {
        console.error('Error saving score:', saveError);
        toast({
          title: "Error saving score",
          description: "Please try again.",
          variant: "destructive",
        });
        setIsActive(false);
        return;
      }

      toast({
        title: "Score saved!",
        description: `You scored ${finalPoints} points!`,
      });
      
      setIsActive(false);
      onScoreSaved?.();
      onTabChange?.('leaderboard');
    } catch (error) {
      console.error('Unexpected error:', error);
      toast({
        title: "Error",
        description: "An unexpected error occurred.",
        variant: "destructive",
      });
      setIsActive(false);
    }
  };

  const resetDrill = () => {
    setIsActive(false);
    setAttempts([]);
    setCurrentPutt(1);
  };

  if (!isActive) {
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="text-primary" />
              Jason Day's Lag Drill
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <h3 className="font-semibold">Instructions:</h3>
              <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                <li>18 putts from 8-20 meters (randomized, never same distance twice)</li>
                <li>Can be done on the course (one putt per hole)</li>
                <li>Goal: Score as many points as possible</li>
              </ul>
            </div>
            
            <div className="space-y-2">
              <h3 className="font-semibold">Scoring:</h3>
              <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                <li>Holed: +3 points</li>
                <li>Within 0.6m (2 feet): +2 points</li>
                <li>0.6m-1m (2-3 feet): +1 point</li>
                <li>1-2 meters: 0 points</li>
                <li>2-3 meters: -1 point</li>
                <li>Outside 3 meters: -2 points</li>
              </ul>
            </div>

            <Button onClick={handleStartDrill} className="w-full">
              Start Drill
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Target className="text-primary" />
              Putt {currentPutt} of 18
            </span>
            <span className="text-lg">Score: {totalPoints}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-center p-6 bg-muted rounded-lg">
            <div className="text-sm text-muted-foreground mb-2">Distance</div>
            <div className="text-4xl font-bold text-foreground">
              {currentDistance}m
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-sm font-medium text-center mb-2">Select outcome:</p>
            {outcomes.map((outcome) => (
              <Button
                key={outcome.label}
                onClick={() => handleOutcome(outcome.label, outcome.points)}
                className="w-full"
                variant={outcome.points >= 0 ? "default" : "outline"}
                size="lg"
              >
                <span className="flex-1 text-left">{outcome.label}</span>
                <span className="font-bold">{outcome.points > 0 ? '+' : ''}{outcome.points}</span>
              </Button>
            ))}
          </div>

          <Button onClick={resetDrill} variant="ghost" className="w-full">
            Reset Drill
          </Button>
        </CardContent>
      </Card>

      {attempts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Attempt History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {[...attempts].reverse().map((attempt) => (
                <div 
                  key={attempt.puttNumber}
                  className="flex justify-between items-center p-2 bg-muted rounded"
                >
                  <span className="text-sm">
                    Putt {attempt.puttNumber}: {attempt.distance}m
                  </span>
                  <span className="text-sm font-semibold">
                    {attempt.outcome} ({attempt.points > 0 ? '+' : ''}{attempt.points})
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default JasonDayLagComponent;
