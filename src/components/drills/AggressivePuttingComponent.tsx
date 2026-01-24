import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Target, ChevronLeft, ChevronRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { DrillCompletionDialog } from "@/components/DrillCompletionDialog";

interface AggressivePuttingComponentProps {
  onTabChange?: (tab: string) => void;
  onScoreSaved?: () => void;
}

interface Attempt {
  attemptNumber: number;
  distance: number;
  outcome: string | null;
  points: number;
}

const distances = [4, 5, 6]; // meters

const outcomes = [
  { label: 'Holed', points: 3 },
  { label: 'Good Pace', points: 1 },
  { label: 'Long + Made', points: 0 },
  { label: 'Short', points: -3 },
  { label: 'Long + Miss', points: -3 },
  { label: '4-Putt or worse', points: -5 },
];

const AggressivePuttingComponent = ({ onTabChange, onScoreSaved }: AggressivePuttingComponentProps) => {
  const STORAGE_KEY = 'aggressive-putting-drill-state';
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [showCompletionDialog, setShowCompletionDialog] = useState(false);
  const [savedResultId, setSavedResultId] = useState<string | null>(null);
  const [totalAttempts, setTotalAttempts] = useState(0);
  const { toast } = useToast();

  // Load state from localStorage on mount or auto-start
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const state = JSON.parse(saved);
        setAttempts(state.attempts || []);
        setCurrentIndex(state.currentIndex || 0);
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
        currentIndex,
        isActive
      }));
    }
  }, [attempts, currentIndex, isActive]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUserId(user?.id || null);
    });
  }, []);

  const totalPoints = attempts.reduce((sum, attempt) => sum + (attempt.outcome ? attempt.points : 0), 0);
  const currentDistanceIndex = currentIndex % distances.length;
  const currentDistance = distances[currentDistanceIndex];
  const currentAttempt = attempts[currentIndex];
  const completedCount = attempts.filter(a => a.outcome !== null).length;

  const handleStartDrill = () => {
    localStorage.removeItem(STORAGE_KEY);
    setIsActive(true);
    setAttempts([{ attemptNumber: 1, distance: distances[0], outcome: null, points: 0 }]);
    setCurrentIndex(0);
    setShowCompletionDialog(false);
    onTabChange?.('score');
  };

  const resetDrill = () => {
    handleStartDrill();
  };

  const handleOutcome = (outcome: string, points: number) => {
    const updatedAttempts = [...attempts];
    updatedAttempts[currentIndex] = {
      ...updatedAttempts[currentIndex],
      outcome,
      points,
    };
    setAttempts(updatedAttempts);

    const newTotalPoints = updatedAttempts.reduce((sum, att) => sum + (att.outcome ? att.points : 0), 0);
    
    if (newTotalPoints >= 15) {
      // Drill completed
      handleSaveScore(newTotalPoints, updatedAttempts.filter(a => a.outcome !== null).length);
    } else {
      // Move to next attempt
      const nextIndex = currentIndex + 1;
      if (nextIndex >= updatedAttempts.length) {
        // Add new attempt slot
        const newAttempt: Attempt = {
          attemptNumber: nextIndex + 1,
          distance: distances[nextIndex % distances.length],
          outcome: null,
          points: 0,
        };
        setAttempts([...updatedAttempts, newAttempt]);
      }
      setCurrentIndex(nextIndex);
    }
  };

  const canGoBack = currentIndex > 0;
  const canGoForward = currentIndex < attempts.length - 1 && currentAttempt?.outcome !== null;

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
      const { data: drillId, error: drillError } = await (supabase as any)
        .rpc('get_or_create_drill_by_title', { p_title: 'Aggressive Putting 4-6m' });

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
          total_points: totalAttempts,
          attempts_json: attempts.filter(a => a.outcome !== null),
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
        description: `You completed the drill in ${totalAttempts} putts!`,
      });
      
      setSavedResultId(insertedResult?.id || null);
      setTotalAttempts(totalAttempts);
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

  if (!isActive && !showCompletionDialog) {
    return null;
  }

  return (
    <div className="space-y-4">
      {isActive && (
        <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Target className="text-primary" />
              Putt {currentIndex + 1}
            </span>
            <div className="flex flex-col items-end">
              <span className="text-lg">Score: {totalPoints}/15</span>
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
              {currentIndex + 1} / {attempts.length}
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
                className={`w-full h-auto py-3 flex flex-col gap-1 ${
                  currentAttempt?.outcome === outcome.label 
                    ? 'ring-2 ring-primary ring-offset-2' 
                    : ''
                }`}
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
      {attempts.filter(a => a.outcome !== null).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Attempt History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {attempts.filter(a => a.outcome !== null).map((attempt, index) => (
                <div
                  key={index}
                  className={`flex items-center justify-between p-3 bg-muted/50 rounded-md cursor-pointer hover:bg-muted ${
                    currentIndex === index ? 'ring-2 ring-primary' : ''
                  }`}
                  onClick={() => setCurrentIndex(index)}
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
        </>
      )}

      <DrillCompletionDialog
        open={showCompletionDialog}
        onOpenChange={setShowCompletionDialog}
        drillTitle="Aggressive Putting"
        score={totalAttempts}
        unit="putts"
        resultId={savedResultId || undefined}
        onContinue={() => {
          onScoreSaved?.();
          onTabChange?.('leaderboard');
        }}
      />
    </div>
  );
};

export default AggressivePuttingComponent;
