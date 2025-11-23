import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Target } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface AggressivePuttingComponentProps {
  onTabChange?: (tab: string) => void;
  onScoreSaved?: () => void;
}

interface Attempt {
  attemptNumber: number;
  distance: number;
  outcome: string;
  points: number;
}

const distances = [4, 5, 6]; // meters

const outcomes = [
  { label: 'Holed', points: 3 },
  { label: 'Good Pace', points: 1 },
  { label: 'Short', points: -3 },
  { label: 'Long Miss', points: -3 },
];

const AggressivePuttingComponent = ({ onTabChange, onScoreSaved }: AggressivePuttingComponentProps) => {
  const STORAGE_KEY = 'aggressive-putting-drill-state';
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [currentAttempt, setCurrentAttempt] = useState(1);
  const [isActive, setIsActive] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const { toast } = useToast();

  // Load state from localStorage on mount or auto-start
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const state = JSON.parse(saved);
        setAttempts(state.attempts || []);
        setCurrentAttempt(state.currentAttempt || 1);
        setIsActive(state.isActive || false);
      } catch (e) {
        console.error('Failed to restore drill state:', e);
        handleStartDrill();
      }
    } else {
      handleStartDrill();
    }
  }, []);

  // Save state to localStorage whenever it changes
  useEffect(() => {
    if (isActive) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        attempts,
        currentAttempt,
        isActive
      }));
    }
  }, [attempts, currentAttempt, isActive]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUserId(user?.id || null);
    });
  }, []);

  const totalPoints = attempts.reduce((sum, attempt) => sum + attempt.points, 0);
  const currentDistanceIndex = (attempts.length) % distances.length;
  const currentDistance = distances[currentDistanceIndex];

  const handleStartDrill = () => {
    localStorage.removeItem(STORAGE_KEY);
    setIsActive(true);
    setAttempts([]);
    setCurrentAttempt(1);
    onTabChange?.('score');
  };

  const resetDrill = () => {
    localStorage.removeItem(STORAGE_KEY);
    setIsActive(false);
    setAttempts([]);
    setCurrentAttempt(1);
  };

  const handleOutcome = (outcome: string, points: number) => {
    const newAttempt: Attempt = {
      attemptNumber: currentAttempt,
      distance: currentDistance,
      outcome,
      points,
    };

    const newAttempts = [...attempts, newAttempt];
    setAttempts(newAttempts);
    setCurrentAttempt(currentAttempt + 1);

    const newTotalPoints = newAttempts.reduce((sum, att) => sum + att.points, 0);
    
    if (newTotalPoints >= 15) {
      // Drill completed
      handleSaveScore(newTotalPoints, newAttempts.length);
    }
  };

  const handleSaveScore = async (finalPoints: number, totalAttempts: number) => {
    if (!userId) {
      toast({
        title: "Sign in required",
        description: "Please sign in to save your score.",
        variant: "destructive",
      });
      setIsActive(false);
      return;
    }

    try {
      // Ensure drill exists and get its UUID by title
      const { data: drillId, error: drillError } = await (supabase as any)
        .rpc('get_or_create_drill_by_title', { p_title: 'Aggressive Putting' });

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
          total_points: totalAttempts,
          attempts_json: attempts,
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
        description: `You completed the drill in ${totalAttempts} putts!`,
      });
      
      localStorage.removeItem(STORAGE_KEY);
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

  if (!isActive) {
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="text-primary" />
              Aggressive Putting
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <h3 className="font-semibold">Instructions:</h3>
              <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                <li>Distances cycle: 4m → 5m → 6m → repeat</li>
                <li>Choose any starting putt</li>
                <li>Reach 15 points in as few putts as possible</li>
                <li>Tour Average: 12.28 putts</li>
              </ul>
            </div>
            
            <div className="space-y-2">
              <h3 className="font-semibold">Scoring:</h3>
              <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                <li>Holed putt: +3 points</li>
                <li>Good pace (within 3 ft past): +1 point</li>
                <li>Short putt: -3 points</li>
                <li>Long and missed return: -3 points</li>
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
              Putt {currentAttempt}
            </span>
            <div className="flex flex-col items-end">
              <span className="text-lg">Score: {totalPoints}/15</span>
            </div>
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
            <div className="text-sm text-muted-foreground text-center mb-2">
              Select outcome:
            </div>
            {outcomes.map((outcome) => (
              <Button
                key={outcome.label}
                onClick={() => handleOutcome(outcome.label, outcome.points)}
                className="w-full h-auto py-3 flex flex-col gap-1"
                variant={outcome.points > 0 ? "default" : outcome.points === 0 ? "secondary" : "destructive"}
              >
                <span className="font-semibold">{outcome.label}</span>
                <span className="text-xs opacity-90">
                  {outcome.points > 0 ? '+' : ''}{outcome.points} {outcome.points === 1 || outcome.points === -1 ? 'point' : 'points'}
                </span>
              </Button>
            ))}
          </div>

          <Button 
            onClick={resetDrill}
            variant="outline"
            className="w-full mt-4"
          >
            Reset Drill
          </Button>
        </CardContent>
      </Card>

      {/* Attempts History */}
      {attempts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Attempt History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {attempts.map((attempt, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 bg-muted/50 rounded-md"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-medium">#{attempt.attemptNumber}</span>
                    <span className="text-sm text-muted-foreground">{attempt.distance}m</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{attempt.outcome}</span>
                    <span className={`font-medium ${attempt.points > 0 ? 'text-green-600' : attempt.points < 0 ? 'text-red-600' : 'text-muted-foreground'}`}>
                      {attempt.points > 0 ? '+' : ''}{attempt.points}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default AggressivePuttingComponent;
