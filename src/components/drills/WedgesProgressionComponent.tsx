import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { DrillCompletionDialog } from "@/components/DrillCompletionDialog";

interface WedgesProgressionComponentProps {
  onTabChange?: (tab: string) => void;
  onScoreSaved?: () => void;
}

interface DistanceProgress {
  distance: number;
  attempts: number[];
  completed: boolean;
}

const distances = [60, 65, 70, 75, 80, 85, 90, 95, 100, 105, 110, 115, 120];

const WedgesProgressionComponent = ({ onTabChange, onScoreSaved }: WedgesProgressionComponentProps) => {
  const STORAGE_KEY = 'wedges-progression-drill-state';
  const [progress, setProgress] = useState<DistanceProgress[]>([]);
  const [currentDistanceIndex, setCurrentDistanceIndex] = useState(0);
  const [userId, setUserId] = useState<string | null>(null);
  const [drillStarted, setDrillStarted] = useState(false);
  const [showCompletionDialog, setShowCompletionDialog] = useState(false);
  const [savedScore, setSavedScore] = useState(0);
  const [savedResultId, setSavedResultId] = useState<string | null>(null);
  const isSavingRef = useRef(false);
  const { toast } = useToast();

  // Load state from localStorage on mount or auto-start
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const state = JSON.parse(saved);
        setProgress(state.progress || []);
        setCurrentDistanceIndex(state.currentDistanceIndex || 0);
        setDrillStarted(state.drillStarted || false);
      } catch (e) {
        console.error('Failed to restore drill state:', e);
        initializeDrill();
      }
    } else {
      initializeDrill();
    }
  }, []);

  // Save state to localStorage whenever it changes
  useEffect(() => {
    if (drillStarted) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        progress,
        currentDistanceIndex,
        drillStarted
      }));
    }
  }, [progress, currentDistanceIndex, drillStarted]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUserId(user?.id || null);
    });
  }, []);

  // Computed values
  const totalShots = progress.reduce((sum, p) => sum + p.attempts.length, 0);
  const completedDistances = progress.filter(p => p.completed).length;
  const isCompleted = completedDistances === distances.length;

  const saveScore = async (): Promise<void> => {
    if (!userId) {
      toast({
        title: "Sign in required",
        description: "Please sign in to save your score.",
        variant: "destructive",
      });
      return;
    }

    if (totalShots === 0) {
      toast({
        title: "No attempts recorded",
        description: "Please complete at least one shot before saving.",
        variant: "destructive",
      });
      return;
    }

    // Capture the score before any state changes
    const scoreToSave = totalShots;

    try {
      const drillTitle = "Åberg's Wedge Ladder";
      
      const { data: drillData, error: drillError } = await supabase
        .rpc('get_or_create_drill_by_title', { p_title: drillTitle });

      if (drillError) throw drillError;

      const { data: insertedResult, error: insertError } = await supabase
        .from('drill_results')
        .insert([{
          drill_id: drillData,
          user_id: userId,
          total_points: scoreToSave,
          attempts_json: progress as any,
        }])
        .select('id')
        .single();

      if (insertError) throw insertError;

      toast({
        title: "Score saved!",
        description: `Your score of ${scoreToSave} shots has been saved.`,
      });

      setSavedScore(scoreToSave);
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

  // Auto-save when drill is completed
  useEffect(() => {
    if (isCompleted && userId && !showCompletionDialog && !savedResultId && drillStarted && totalShots > 0 && !isSavingRef.current) {
      isSavingRef.current = true;
      saveScore().finally(() => {
        isSavingRef.current = false;
      });
    }
  }, [isCompleted, userId, showCompletionDialog, savedResultId, drillStarted, totalShots]);

  const initializeDrill = () => {
    localStorage.removeItem(STORAGE_KEY);
    const initialProgress: DistanceProgress[] = distances.map(distance => ({
      distance,
      attempts: [],
      completed: false,
    }));
    setProgress(initialProgress);
    setCurrentDistanceIndex(0);
    setDrillStarted(true);
    setShowCompletionDialog(false);
    setSavedResultId(null);
    setSavedScore(0);
    isSavingRef.current = false;
    onTabChange?.('score');
  };

  const recordAttempt = (successful: boolean) => {
    const targetDistance = distances[currentDistanceIndex];
    
    setProgress(prev => {
      const updated = [...prev];
      // Record the attempt (we just increment the count, not storing actual distances anymore)
      updated[currentDistanceIndex].attempts.push(targetDistance);
      
      // Mark as completed if successful
      if (successful) {
        updated[currentDistanceIndex].completed = true;
      }
      
      return updated;
    });

    // If completed, move to next distance
    if (successful) {
      if (currentDistanceIndex < distances.length - 1) {
        setCurrentDistanceIndex(currentDistanceIndex + 1);
        toast({
          title: "Distance completed!",
          description: `Moving to ${distances[currentDistanceIndex + 1]}m`,
        });
      } else {
        toast({
          title: "Drill completed!",
          description: "All distances completed!",
        });
      }
    }
  };

  const handleReset = () => {
    initializeDrill();
  };

  if (!drillStarted) {
    return null;
  }

  return (
    <div className="p-4 pb-24 space-y-4">
      <Card>
        <CardContent className="space-y-3">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Total Shots:</span>
            <span className="font-bold text-2xl">{totalShots}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Completed:</span>
            <span>{completedDistances}/{distances.length}</span>
          </div>
          
          <Button
            onClick={handleReset}
            variant="outline"
            className="w-full"
          >
            Reset Drill
          </Button>
        </CardContent>
      </Card>

      {!isCompleted && (
        <Card>
          <CardHeader>
            <CardTitle className="text-primary">
              Current: {distances[currentDistanceIndex]}m
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground mb-3 text-center">
                Did you hit within 3 meters?
              </p>
              <div className="grid grid-cols-2 gap-3">
                <Button 
                  onClick={() => recordAttempt(true)}
                  variant="default"
                  size="lg"
                  className="h-16"
                >
                  <CheckCircle2 className="mr-2 h-5 w-5" />
                  Hit Target
                </Button>
                <Button 
                  onClick={() => recordAttempt(false)}
                  variant="outline"
                  size="lg"
                  className="h-16"
                >
                  Try Again
                </Button>
              </div>
            </div>
            
            {progress[currentDistanceIndex]?.attempts.length > 0 && (
              <div>
                <p className="text-sm font-medium mb-2">Attempts at {distances[currentDistanceIndex]}m:</p>
                <p className="text-2xl font-bold text-primary">{progress[currentDistanceIndex].attempts.length}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>All Distances</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {progress.map((p, idx) => (
            <div
              key={p.distance}
              className={`p-3 rounded border ${
                p.completed
                  ? 'border-green-500/50 bg-green-500/10'
                  : idx === currentDistanceIndex
                  ? 'border-primary bg-primary/5'
                  : 'border-border'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {p.completed && <CheckCircle2 size={20} className="text-green-600" />}
                  <span className="font-medium">{p.distance}m</span>
                </div>
                <span className="text-sm text-muted-foreground">
                  {p.attempts.length} {p.attempts.length === 1 ? 'shot' : 'shots'}
                </span>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <DrillCompletionDialog
        open={showCompletionDialog}
        onOpenChange={setShowCompletionDialog}
        drillTitle="Åberg's Wedge Ladder"
        score={savedScore}
        unit="shots"
        resultId={savedResultId || undefined}
        onContinue={() => {
          onScoreSaved?.();
          onTabChange?.('leaderboard');
        }}
      />
    </div>
  );
};

export default WedgesProgressionComponent;
