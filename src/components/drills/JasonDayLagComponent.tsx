import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Target, ChevronLeft, ChevronRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { DrillCompletionDialog } from "@/components/DrillCompletionDialog";

interface JasonDayLagComponentProps {
  onTabChange?: (tab: string) => void;
  onScoreSaved?: () => void;
}

interface PuttAttempt {
  puttNumber: number;
  distance: number;
  outcome: string | null;
  points: number;
  bonusPoints?: number;
}

const generateRandomDistances = (): number[] => {
  const distances: number[] = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 9, 11, 13, 15, 17];
  for (let i = distances.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [distances[i], distances[j]] = [distances[j], distances[i]];
  }
  return distances;
};

const outcomes = [
  { label: 'Holed', points: 5 },
  { label: 'Within 0.6m (2 feet)', points: 3 },
  { label: '0.6m-1m (2-3 feet)', points: 2 },
  { label: '1-2 meters', points: 1 },
  { label: '2-3 meters', points: 0 },
  { label: 'Outside 3 meters', points: -1 },
];

const JasonDayLagComponent = ({ onTabChange, onScoreSaved }: JasonDayLagComponentProps) => {
  const STORAGE_KEY = 'jason-day-lag-drill-state';
  const [attempts, setAttempts] = useState<PuttAttempt[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [distanceSequence, setDistanceSequence] = useState<number[]>([]);
  const [showCompletionDialog, setShowCompletionDialog] = useState(false);
  const [savedResultId, setSavedResultId] = useState<string | null>(null);
  const [finalScore, setFinalScore] = useState(0);
  const { toast } = useToast();

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const state = JSON.parse(saved);
        setAttempts(state.attempts || []);
        setCurrentIndex(state.currentIndex || 0);
        setIsActive(state.isActive || false);
        setDistanceSequence(state.distanceSequence || []);
      } catch (e) {
        console.error('Failed to restore drill state:', e);
        handleStartDrill();
      }
    } else {
      handleStartDrill();
    }
  }, []);

  useEffect(() => {
    if (isActive) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        attempts,
        currentIndex,
        isActive,
        distanceSequence
      }));
    }
  }, [attempts, currentIndex, isActive, distanceSequence]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUserId(user?.id || null);
    });
  }, []);

  // Calculate bonus streak based on completed attempts up to current position
  const calculateBonusStreak = (attemptsUpTo: PuttAttempt[]): number => {
    let streak = 0;
    for (let i = attemptsUpTo.length - 1; i >= 0; i--) {
      if (attemptsUpTo[i].outcome && attemptsUpTo[i].points >= 3) {
        streak++;
      } else {
        break;
      }
    }
    return streak;
  };

  const totalPoints = attempts.reduce((sum, att) => sum + (att.outcome ? att.points + (att.bonusPoints || 0) : 0), 0);
  const currentDistance = distanceSequence[currentIndex];
  const currentAttempt = attempts[currentIndex];
  const completedCount = attempts.filter(a => a.outcome !== null).length;

  // Calculate current bonus streak from completed attempts before current
  const previousAttempts = attempts.slice(0, currentIndex).filter(a => a.outcome !== null);
  const bonusStreak = calculateBonusStreak(previousAttempts);

  const handleStartDrill = () => {
    localStorage.removeItem(STORAGE_KEY);
    const distances = generateRandomDistances();
    setDistanceSequence(distances);
    setIsActive(true);
    setAttempts(distances.map((d, i) => ({
      puttNumber: i + 1,
      distance: d,
      outcome: null,
      points: 0,
      bonusPoints: 0
    })));
    setCurrentIndex(0);
    setShowCompletionDialog(false);
    setSavedResultId(null);
    setFinalScore(0);
    onTabChange?.('score');
  };

  const resetDrill = () => {
    handleStartDrill();
  };

  const handleOutcome = (outcome: string, points: number) => {
    // Calculate bonus points
    let bonusPoints = 0;
    if (points >= 3 && bonusStreak >= 3) {
      bonusPoints = 1;
    }

    const updatedAttempts = [...attempts];
    updatedAttempts[currentIndex] = {
      ...updatedAttempts[currentIndex],
      outcome,
      points,
      bonusPoints,
    };
    setAttempts(updatedAttempts);

    // Check if all 18 are complete
    const allComplete = updatedAttempts.every(a => a.outcome !== null);
    if (allComplete) {
      handleSaveScore(updatedAttempts);
    } else if (currentIndex < 17) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const canGoBack = currentIndex > 0;
  const canGoForward = currentIndex < 17 && currentAttempt?.outcome !== null;

  const handleBack = () => {
    if (canGoBack) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const handleForward = () => {
    if (canGoForward) {
      setCurrentIndex(currentIndex + 1);
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

    const finalPoints = finalAttempts.reduce((sum, att) => sum + att.points + (att.bonusPoints || 0), 0);

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

      const { data: insertedResult, error: saveError } = await (supabase as any)
        .from('drill_results')
        .insert({
          drill_id: drillId,
          user_id: userId,
          total_points: finalPoints,
          attempts_json: finalAttempts
        })
        .select('id')
        .single();

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
      
      setSavedResultId(insertedResult?.id || null);
      setFinalScore(finalPoints);
      localStorage.removeItem(STORAGE_KEY);
      setIsActive(false);
      setShowCompletionDialog(true);
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

  if ((!isActive || !currentDistance) && !showCompletionDialog) {
    return null;
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Target className="text-primary" />
              Putt {currentIndex + 1} of 18
            </span>
            <div className="flex flex-col items-end">
              <span className="text-lg">Score: {totalPoints}</span>
              {bonusStreak >= 3 && (
                <span className="text-xs text-primary">🔥 Bonus Active!</span>
              )}
              {bonusStreak === 2 && (
                <span className="text-xs text-amber-500">⚡ 1 more for bonus!</span>
              )}
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Navigation Arrows */}
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              size="icon"
              onClick={handleBack}
              disabled={!canGoBack}
              className="h-10 w-10"
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <span className="text-sm text-muted-foreground">
              {currentIndex + 1} / 18
            </span>
            <Button
              variant="outline"
              size="icon"
              onClick={handleForward}
              disabled={!canGoForward}
              className="h-10 w-10"
            >
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>

          <div className="text-center p-6 bg-muted rounded-lg">
            <div className="text-sm text-muted-foreground mb-2">Distance</div>
            <div className="text-4xl font-bold text-foreground">
              {currentDistance} meters
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-sm font-medium text-center mb-2">Select outcome:</p>
            {outcomes.map((outcome) => {
              const willGetBonus = outcome.points >= 3 && bonusStreak >= 3;
              return (
                <Button
                  key={outcome.label}
                  onClick={() => handleOutcome(outcome.label, outcome.points)}
                  className={`w-full ${
                    currentAttempt?.outcome === outcome.label 
                      ? 'ring-2 ring-primary ring-offset-2' 
                      : ''
                  }`}
                  variant="outline"
                  size="lg"
                >
                  <span className="flex-1 text-left">{outcome.label}</span>
                  <span className="font-bold">
                    {outcome.points > 0 ? '+' : ''}{outcome.points}
                    {willGetBonus && <span className="text-primary ml-1">(+1 bonus)</span>}
                  </span>
                </Button>
              );
            })}
          </div>

          <Button onClick={resetDrill} variant="ghost" className="w-full">
            Reset Drill
          </Button>
        </CardContent>
      </Card>

      {attempts.filter(a => a.outcome !== null).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Attempt History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {[...attempts].filter(a => a.outcome !== null).reverse().map((attempt) => (
                <div 
                  key={attempt.puttNumber}
                  className={`flex justify-between items-center p-2 bg-muted rounded cursor-pointer hover:bg-muted/80 ${
                    currentIndex === attempt.puttNumber - 1 ? 'ring-2 ring-primary' : ''
                  }`}
                  onClick={() => setCurrentIndex(attempt.puttNumber - 1)}
                >
                  <span className="text-sm">
                    Putt {attempt.puttNumber}: {attempt.distance} m
                  </span>
                  <span className="text-sm font-semibold">
                    {attempt.outcome} ({attempt.points > 0 ? '+' : ''}{attempt.points}
                    {attempt.bonusPoints ? ` +${attempt.bonusPoints} bonus` : ''})
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <DrillCompletionDialog
        open={showCompletionDialog}
        onOpenChange={setShowCompletionDialog}
        drillTitle="Jason Day's Lag Drill"
        score={finalScore}
        unit="points"
        resultId={savedResultId || undefined}
        onContinue={() => {
          onScoreSaved?.();
          onTabChange?.('leaderboard');
        }}
      />
    </div>
  );
};

export default JasonDayLagComponent;
