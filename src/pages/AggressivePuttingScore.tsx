import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Target, ChevronLeft, ChevronRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { STORAGE_KEYS } from "@/constants/app";
import { getStorageItem, setStorageItem } from "@/utils/storageManager";
import { supabase } from "@/integrations/supabase/client";
import { DrillCompletionDialog } from "@/components/DrillCompletionDialog";

interface Score {
  name: string;
  score: number;
  timestamp: number;
}
interface Attempt {
  attemptNumber: number;
  distance: number;
  outcome: string | null;
  points: number;
}

const distances = [4, 5, 6]; // meters, cycling pattern
const targetPoints = 15;

const outcomes = [
  { label: 'Holed', points: 3, key: 'holed' },
  { label: 'Good Pace', points: 1, key: 'good-pace' },
  { label: 'Long + Made', points: 0, key: 'long-made' },
  { label: 'Short', points: -3, key: 'short' },
  { label: 'Long + Miss', points: -3, key: 'long-miss' },
  { label: '4-Putt or worse', points: -5, key: 'four-putt' },
];

export default function AggressivePuttingScore() {
  const { toast } = useToast();
  const STORAGE_KEY = 'aggressive-putting-score-state';
  
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFinished, setIsFinished] = useState(false);
  const [lastScore, setLastScore] = useState<Score | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [showCompletionDialog, setShowCompletionDialog] = useState(false);
  const [savedResultId, setSavedResultId] = useState<string | null>(null);
  const [finalScore, setFinalScore] = useState(0);
  
  const tourAverage = 12.28;

  useEffect(() => {
    // Load existing drill state
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const state = JSON.parse(saved);
        setAttempts(state.attempts || [{ attemptNumber: 1, distance: distances[0], outcome: null, points: 0 }]);
        setCurrentIndex(state.currentIndex || 0);
        setIsFinished(state.isFinished || false);
      } catch (e) {
        console.error('Failed to restore drill state:', e);
        initializeDrill();
      }
    } else {
      initializeDrill();
    }
    
    // Load existing scores for display
    const scores: Score[] = getStorageItem(STORAGE_KEYS.AGGRESSIVE_PUTTING_SCORES, []);
    const displayName = getStorageItem(STORAGE_KEYS.DISPLAY_NAME, "User");
    const userScores = scores.filter(score => score.name === displayName);
    if (userScores.length > 0) {
      const mostRecentScore = userScores.reduce((latest, current) => 
        current.timestamp > latest.timestamp ? current : latest
      );
      setLastScore(mostRecentScore);
    }
  }, []);

  // Save state to localStorage whenever it changes
  useEffect(() => {
    if (attempts.length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        attempts,
        currentIndex,
        isFinished
      }));
    }
  }, [attempts, currentIndex, isFinished]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUserId(user?.id || null);
    });
  }, []);

  const initializeDrill = () => {
    localStorage.removeItem(STORAGE_KEY);
    setAttempts([{ attemptNumber: 1, distance: distances[0], outcome: null, points: 0 }]);
    setCurrentIndex(0);
    setIsFinished(false);
  };

  const totalPoints = attempts.reduce((sum, att) => sum + (att.outcome ? att.points : 0), 0);
  const currentAttempt = attempts[currentIndex];
  const currentDistance = currentAttempt?.distance || distances[currentIndex % distances.length];
  const completedCount = attempts.filter(a => a.outcome !== null).length;

  const handleOutcome = (outcome: string, pointChange: number) => {
    if (isFinished) return;

    const updatedAttempts = [...attempts];
    updatedAttempts[currentIndex] = {
      ...updatedAttempts[currentIndex],
      outcome,
      points: pointChange,
    };
    setAttempts(updatedAttempts);

    const newTotalPoints = updatedAttempts.reduce((sum, att) => sum + (att.outcome ? att.points : 0), 0);

    if (newTotalPoints >= targetPoints) {
      setIsFinished(true);
      const totalPutts = updatedAttempts.filter(a => a.outcome !== null).length;
      handleSaveToSupabase(totalPutts, updatedAttempts);
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

  const handleSave = (finalPutts: number) => {
    const displayName = getStorageItem(STORAGE_KEYS.DISPLAY_NAME, "User");
    
    const newScore: Score = {
      name: displayName,
      score: finalPutts,
      timestamp: Date.now(),
    };

    const existingScores: Score[] = getStorageItem(STORAGE_KEYS.AGGRESSIVE_PUTTING_SCORES, []);
    const updatedScores = [...existingScores, newScore];
    setStorageItem(STORAGE_KEYS.AGGRESSIVE_PUTTING_SCORES, updatedScores);
    
    setLastScore(newScore);
    
    const comparison = finalPutts < tourAverage ? "Better than tour average!" : 
                     finalPutts === tourAverage ? "Right on tour average!" : 
                     "Keep practicing to beat the tour average!";
    
    toast({
      title: "Score Saved!",
      description: `${finalPutts} putts - ${comparison}`,
    });
  };

  const handleSaveToSupabase = async (totalPutts: number, updatedAttempts: Attempt[]) => {
    // Always save to localStorage for backward compatibility
    handleSave(totalPutts);

    if (!userId) {
      toast({
        title: "Sign in required",
        description: "Please sign in to save your score to the cloud.",
        variant: "destructive",
      });
      return;
    }

    try {
      const { data: drillId, error: drillError } = await (supabase as any)
        .rpc('get_or_create_drill_by_title', { p_title: 'Aggressive Putting 4-6m' });

      if (drillError || !drillId) {
        console.error('Drill not found or could not create:', drillError);
        toast({
          title: "Error",
          description: "Could not save score to cloud.",
          variant: "destructive",
        });
        return;
      }

      const { data: insertedResult, error: saveError } = await (supabase as any)
        .from('drill_results')
        .insert({
          drill_id: drillId,
          user_id: userId,
          total_points: totalPutts,
          attempts_json: updatedAttempts.filter(a => a.outcome !== null),
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
        return;
      }

      toast({
        title: "Score saved!",
        description: `You completed the drill in ${totalPutts} putts!`,
      });
      
      setSavedResultId(insertedResult?.id || null);
      setFinalScore(totalPutts);
      localStorage.removeItem(STORAGE_KEY);
      setShowCompletionDialog(true);
    } catch (error) {
      console.error('Unexpected error:', error);
      toast({
        title: "Error",
        description: "An unexpected error occurred.",
        variant: "destructive",
      });
    }
  };

  const handleReset = () => {
    initializeDrill();
  };

  return (
    <div className="space-y-4">
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
              {currentDistance} meters
            </div>
          </div>

          {!isFinished && (
            <div className="space-y-3">
              <p className="text-sm font-medium text-center mb-2">Select outcome:</p>
              {outcomes.map((outcome) => (
                <Button 
                  key={outcome.key}
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
                  <span className="font-bold">{outcome.points > 0 ? '+' : ''}{outcome.points}</span>
                </Button>
              ))}
            </div>
          )}

          <Button onClick={handleReset} variant="ghost" className="w-full">
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
              {attempts
                .filter(a => a.outcome !== null)
                .reverse()
                .map((attempt, idx) => {
                  const originalIndex = attempts.findIndex(a => a.attemptNumber === attempt.attemptNumber);
                  return (
                    <div 
                      key={attempt.attemptNumber} 
                      className={`flex justify-between items-center p-2 bg-muted rounded cursor-pointer hover:bg-muted/80 ${
                        currentIndex === originalIndex ? 'ring-2 ring-primary' : ''
                      }`}
                      onClick={() => setCurrentIndex(originalIndex)}
                    >
                      <span className="text-sm">Putt {attempt.attemptNumber}: {attempt.distance} meters</span>
                      <span className="text-sm font-semibold">{attempt.outcome} ({attempt.points > 0 ? '+' : ''}{attempt.points})</span>
                    </div>
                  );
                })}
            </div>
          </CardContent>
        </Card>
      )}

      <DrillCompletionDialog
        open={showCompletionDialog}
        onOpenChange={setShowCompletionDialog}
        drillTitle="Aggressive Putting 4-6m"
        score={finalScore}
        unit="putts"
        resultId={savedResultId || undefined}
        onContinue={() => {
          setShowCompletionDialog(false);
        }}
      />
    </div>
  );
}
