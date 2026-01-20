import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Target, TrendingUp, TrendingDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface UpDownPuttingComponentProps {
  onTabChange?: (tab: string) => void;
  onScoreSaved?: () => void;
}

type PuttOutcome = 'holed' | 'inside' | 'outside';

interface Attempt {
  puttIndex: number;
  distance: string;
  direction: 'uphill' | 'downhill';
  outcome: PuttOutcome | null;
  score: number;
}

const putts = [
  { distance: '6m', direction: 'uphill' as const },
  { distance: '6m', direction: 'downhill' as const },
  { distance: '8m', direction: 'uphill' as const },
  { distance: '8m', direction: 'downhill' as const },
  { distance: '10m', direction: 'uphill' as const },
  { distance: '10m', direction: 'downhill' as const },
];

const outcomeScores: Record<PuttOutcome, number> = {
  'holed': -1,
  'inside': 0,
  'outside': 1,
};

const outcomeLabels: Record<PuttOutcome, string> = {
  'holed': 'Holed',
  'inside': 'Inside 3ft',
  'outside': 'Outside',
};

const UpDownPuttingComponent = ({ onTabChange, onScoreSaved }: UpDownPuttingComponentProps) => {
  const STORAGE_KEY = 'up-down-putting-drill-state';
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [drillStarted, setDrillStarted] = useState(false);
  const [currentRound, setCurrentRound] = useState(0);
  const { toast } = useToast();

  // Load state from localStorage on mount or auto-start
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const state = JSON.parse(saved);
        setAttempts(state.attempts || []);
        setDrillStarted(state.drillStarted || false);
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
    if (drillStarted) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        attempts,
        drillStarted
      }));
    }
  }, [attempts, drillStarted]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUserId(user?.id || null);
    });
  }, []);

  const initializeAttempts = () => {
    localStorage.removeItem(STORAGE_KEY);
    const newAttempts: Attempt[] = [];
    // 3 rounds, each round goes through all 6 stations once
    for (let round = 0; round < 3; round++) {
      putts.forEach((putt, stationIndex) => {
        newAttempts.push({
          puttIndex: round * 6 + stationIndex,
          distance: putt.distance,
          direction: putt.direction,
          outcome: null,
          score: 0,
        });
      });
    }
    setAttempts(newAttempts);
    setDrillStarted(true);
    onTabChange?.('score');
  };

  const updateAttempt = (puttIndex: number, outcome: PuttOutcome) => {
    setAttempts(prev => prev.map(attempt => {
      if (attempt.puttIndex === puttIndex) {
        // If clicking the same outcome, deselect it
        if (attempt.outcome === outcome) {
          return {
            ...attempt,
            outcome: null,
            score: 0,
          };
        }
        // Otherwise select the new outcome
        return {
          ...attempt,
          outcome,
          score: outcomeScores[outcome],
        };
      }
      return attempt;
    }));
  };

  const totalScore = attempts.reduce((sum, attempt) => sum + attempt.score, 0);
  const completedAttempts = attempts.filter(a => a.outcome !== null).length;
  const totalAttempts = 18;
  const tourAverage = 0.64;

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
        description: "Please record at least one putt before saving.",
        variant: "destructive",
      });
      return;
    }

    try {
      const drillTitle = 'Up & Down Putting Drill';
      
      const { data: drillData, error: drillError } = await supabase
        .rpc('get_or_create_drill_by_title', { p_title: drillTitle });

      if (drillError) throw drillError;

      const { error: insertError } = await supabase
        .from('drill_results')
        .insert([{
          drill_id: drillData,
          user_id: userId,
          total_points: totalScore,
          attempts_json: attempts as any,
        }]);

      if (insertError) throw insertError;

      const comparison = totalScore < tourAverage 
        ? `Great! You're ${(tourAverage - totalScore).toFixed(2)} strokes better than tour average!`
        : totalScore > tourAverage
        ? `You're ${(totalScore - tourAverage).toFixed(2)} strokes above tour average. Keep practicing!`
        : "Perfect! You matched the tour average!";

      toast({
        title: "Score saved!",
        description: `Your score: ${totalScore > 0 ? '+' : ''}${totalScore}. ${comparison}`,
      });

      localStorage.removeItem(STORAGE_KEY);
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

  const handleReset = () => {
    initializeAttempts();
  };

  return (
    <div className="space-y-6">
      {drillStarted && (
        <>
          {/* Record Your Putts */}
          <Card>
            <CardHeader>
              <CardTitle>Record Your Putts</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-2 border-b">
                  <div className="flex items-center gap-2">
                    <Target className="text-primary" size={18} />
                    <span className="font-semibold">
                      Round {currentRound + 1} of 3
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    Putts {currentRound * 6 + 1}-{currentRound * 6 + 6} of 18
                  </span>
                </div>

                <div className="space-y-3">
                  {putts.map((putt, stationIndex) => {
                    const puttIndex = currentRound * 6 + stationIndex;
                    const attempt = attempts[puttIndex];
                    
                    return (
                      <div key={puttIndex} className="space-y-2">
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-2">
                            {putt.direction === 'uphill' ? (
                              <TrendingUp className="text-primary" size={14} />
                            ) : (
                              <TrendingDown className="text-primary" size={14} />
                            )}
                            <span className="text-sm text-muted-foreground">
                              {putt.distance} {putt.direction}
                            </span>
                          </div>
                          {attempt?.outcome && (
                            <span className={`text-sm font-medium ${
                              attempt.score < 0 ? 'text-green-500' : 
                              attempt.score === 0 ? 'text-blue-500' : 'text-red-500'
                            }`}>
                              {attempt.score > 0 ? '+' : ''}{attempt.score}
                            </span>
                          )}
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          {(Object.keys(outcomeScores) as PuttOutcome[]).map((outcome) => (
                            <Button
                              key={outcome}
                              variant={attempt?.outcome === outcome ? "default" : "outline"}
                              size="sm"
                              onClick={() => updateAttempt(puttIndex, outcome)}
                              className="text-xs px-2"
                            >
                              {outcomeLabels[outcome]}
                            </Button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="flex gap-2 pt-2">
                  <Button
                    variant="outline"
                    onClick={() => setCurrentRound(prev => Math.max(0, prev - 1))}
                    disabled={currentRound === 0}
                    className="flex-1"
                  >
                    Previous Round
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setCurrentRound(prev => Math.min(2, prev + 1))}
                    disabled={currentRound === 2}
                    className="flex-1"
                  >
                    Next Round
                  </Button>
                </div>
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
                    <p className="text-3xl font-bold">
                      {totalScore > 0 ? '+' : ''}{totalScore}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Tour avg: +{tourAverage.toFixed(2)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">Completed</p>
                    <p className="text-xl font-semibold">{completedAttempts}/{totalAttempts}</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <Button
                    onClick={saveScore}
                    disabled={completedAttempts === 0}
                    className="w-full bg-primary hover:bg-primary/90"
                  >
                    Save Score
                  </Button>
                  <Button
                    onClick={handleReset}
                    variant="outline"
                    className="w-full"
                  >
                    Reset
                  </Button>
                </div>
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

export default UpDownPuttingComponent;
