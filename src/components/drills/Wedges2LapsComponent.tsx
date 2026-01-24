import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { DrillCompletionDialog } from "@/components/DrillCompletionDialog";

interface Wedges2LapsComponentProps {
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
  '2m': '2m',
  '3m': '3m',
  '4m': '4m',
  'long': 'Green',
  'missed': 'No green',
};

const Wedges2LapsComponent = ({ onTabChange, onScoreSaved }: Wedges2LapsComponentProps) => {
  const STORAGE_KEY = 'wedges-2-laps-drill-state';
  const [attempts, setAttempts] = useState<Shot[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [drillStarted, setDrillStarted] = useState(false);
  const [showCompletionDialog, setShowCompletionDialog] = useState(false);
  const [savedResultId, setSavedResultId] = useState<string | null>(null);
  const isSavingRef = useRef(false);
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
    const newAttempts: Shot[] = shots.map((shot, index) => ({
      shotIndex: index,
      distance: shot.distance,
      lap: shot.lap,
      outcome: null,
      points: 0,
    }));
    setAttempts(newAttempts);
    setDrillStarted(true);
    setShowCompletionDialog(false);
    setSavedResultId(null);
    isSavingRef.current = false;
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

  const totalPoints = attempts.reduce((sum, attempt) => sum + attempt.points, 0);
  const completedAttempts = attempts.filter(a => a.outcome !== null).length;
  const totalAttempts = shots.length;
  const isComplete = completedAttempts === totalAttempts;

  // Auto-save when drill is completed
  useEffect(() => {
    if (isComplete && userId && !showCompletionDialog && !savedResultId && attempts.length > 0 && !isSavingRef.current) {
      isSavingRef.current = true;
      saveScore().finally(() => {
        isSavingRef.current = false;
      });
    }
  }, [isComplete, userId, showCompletionDialog, savedResultId, attempts.length]);

  const saveScore = async (): Promise<void> => {
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
      const drillTitle = 'Wedge Game 40-80m';
      
      const { data: drillData, error: drillError } = await supabase
        .rpc('get_or_create_drill_by_title', { p_title: drillTitle });

      if (drillError) throw drillError;

      const { data: insertedResult, error: insertError } = await supabase
        .from('drill_results')
        .insert([{
          drill_id: drillData,
          user_id: userId,
          total_points: totalPoints,
          attempts_json: attempts as any,
        }])
        .select('id')
        .single();

      if (insertError) throw insertError;

      toast({
        title: "Score saved!",
        description: `Your score of ${totalPoints} points has been saved.`,
      });

      setSavedResultId(insertedResult?.id || null);
      localStorage.removeItem(STORAGE_KEY);
      setShowCompletionDialog(true);
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
                <div className="space-y-2">
                  <Button
                    onClick={handleReset}
                    variant="outline"
                    className="w-full"
                  >
                    Reset Drill
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
                <Button
                  onClick={handleReset}
                  variant="outline"
                  className="w-full mt-4"
                >
                  Reset Drill
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Record Your Score */}
          <Card>
            <CardHeader>
              <CardTitle>Record Your Score</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {attempts.map((attempt, idx) => (
                  <div key={attempt.shotIndex}>
                    {attempt.shotIndex === 9 && (
                      <div className="pt-2 pb-4 border-t">
                        <h4 className="text-lg font-semibold text-primary">Lap 2</h4>
                      </div>
                    )}
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="font-medium">
                          Shot {attempt.shotIndex + 1} - {attempt.distance.replace('m', ' meters')}
                        </span>
                        {attempt.outcome && (
                          <span className={`text-sm ${
                            attempt.points >= 2 ? 'text-green-500' : 
                            attempt.points === 1 ? 'text-yellow-500' :
                            attempt.points === 0 ? 'text-green-500' : 'text-red-500'
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
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}

      <DrillCompletionDialog
        open={showCompletionDialog}
        onOpenChange={setShowCompletionDialog}
        drillTitle="Wedge Game 40-80m"
        score={totalPoints}
        unit="points"
        resultId={savedResultId || undefined}
        onContinue={() => {
          onScoreSaved?.();
        }}
      />
    </div>
  );
};

export default Wedges2LapsComponent;
