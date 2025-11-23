import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Zap } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface EightBallComponentProps {
  onTabChange?: (tab: string) => void;
  onScoreSaved?: () => void;
}

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

const EightBallComponent = ({ onTabChange, onScoreSaved }: EightBallComponentProps) => {
  const STORAGE_KEY = '8-ball-drill-state';
  const [attempts, setAttempts] = useState<StationAttempt[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [currentRound, setCurrentRound] = useState(0);
  const { toast } = useToast();

  // Load state from localStorage on mount or auto-start
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const state = JSON.parse(saved);
        setAttempts(state.attempts || []);
        setCurrentRound(state.currentRound || 0);
      } catch (e) {
        console.error('Failed to restore drill state:', e);
        initializeAttempts();
      }
    } else {
      initializeAttempts();
    }
  }, []);

  // Save state to localStorage whenever it changes
  useEffect(() => {
    if (attempts.length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        attempts,
        currentRound
      }));
    }
  }, [attempts, currentRound]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUserId(user?.id || null);
    });
  }, []);

  // Initialize attempts array for 8 stations × 5 rounds = 40 attempts
  const initializeAttempts = () => {
    localStorage.removeItem(STORAGE_KEY);
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
    setCurrentRound(0);
    onTabChange?.('score');
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

  // Auto-advance to next round when current round is completed
  useEffect(() => {
    if (attempts.length === 0) return;
    
    const currentRoundAttempts = attempts.filter(a => a.roundIndex === currentRound);
    const isCurrentRoundComplete = currentRoundAttempts.every(a => a.outcome !== null);
    
    if (isCurrentRoundComplete && currentRound < 4) {
      // Small delay before auto-advancing
      const timer = setTimeout(() => {
        setCurrentRound(currentRound + 1);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [attempts, currentRound]);

  const totalPoints = attempts.reduce((sum, attempt) => sum + attempt.points, 0);
  const completedAttempts = attempts.filter(a => a.outcome !== null).length;
  const totalAttempts = 40; // 8 stations × 5 rounds

  const saveScore = async () => {
    if (!userId) {
      toast({
        title: "Sign in required",
        description: "Please sign in to save your score.",
        variant: "destructive",
      });
      return;
    }

    try {
      // Ensure drill exists and get its UUID by title
      const { data: drillId, error: drillError } = await (supabase as any)
        .rpc('get_or_create_drill_by_title', { p_title: '8-Ball Drill' });

      if (drillError || !drillId) {
        console.error('Drill not found or could not create:', drillError);
        toast({
          title: "Error",
          description: "Could not save score.",
          variant: "destructive",
        });
        return;
      }

      // Save drill result to Supabase
      const { error: saveError } = await (supabase as any)
        .from('drill_results')
        .insert({
          drill_id: drillId,
          user_id: userId,
          total_points: totalPoints,
          attempts_json: attempts.map(a => ({
            station: stations[a.stationIndex],
            round: a.roundIndex + 1,
            outcome: a.outcome,
            points: a.points,
          }))
        });

      if (saveError) {
        console.error('Error saving score:', saveError);
        toast({
          title: "Error saving score",
          description: "Please try again.",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Score Saved!",
        description: `Your score of ${totalPoints} points has been recorded`,
      });

      localStorage.removeItem(STORAGE_KEY);
      onScoreSaved?.();
    } catch (error) {
      console.error('Error:', error);
      toast({
        title: "Error",
        description: "An unexpected error occurred.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Scoring Grid */}
      {attempts.length > 0 && (
        <>
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
            {/* Round Navigation */}
            <div className="flex gap-2 justify-center items-center mb-4">
              {[0, 1, 2, 3, 4].map((roundIndex) => (
                <Button
                  key={roundIndex}
                  variant={currentRound === roundIndex ? "default" : "outline"}
                  size="sm"
                  onClick={() => setCurrentRound(roundIndex)}
                  className="w-12"
                >
                  {roundIndex + 1}
                </Button>
              ))}
            </div>

            {/* Current Round */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Round {currentRound + 1}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {stations.map((station, stationIndex) => {
                    const attempt = attempts.find(a => 
                      a.stationIndex === stationIndex && a.roundIndex === currentRound
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
                              onClick={() => {
                                if (attempt?.outcome === outcome) {
                                  // Deselect if clicking the same button
                                  setAttempts(prev => prev.map(a => {
                                    if (a.stationIndex === stationIndex && a.roundIndex === currentRound) {
                                      return { ...a, outcome: null, points: 0 };
                                    }
                                    return a;
                                  }));
                                } else {
                                  updateAttempt(stationIndex, currentRound, outcome);
                                }
                              }}
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
          </div>

          <Button 
            onClick={initializeAttempts}
            variant="outline"
            className="w-full"
          >
            Reset Drill
          </Button>
        </>
      )}
    </div>
  );
};

export default EightBallComponent;