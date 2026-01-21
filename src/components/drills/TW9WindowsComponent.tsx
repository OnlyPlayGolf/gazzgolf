import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/lib/notify";
import { Check, X } from "lucide-react";
import { DrillCompletionDialog } from "@/components/DrillCompletionDialog";

interface TW9WindowsComponentProps {
  onTabChange?: (tab: string) => void;
  onScoreSaved?: () => void;
}

type Window = {
  height: 'Low' | 'Middle' | 'High';
  shape: 'Fade' | 'Straight' | 'Draw';
  completed: boolean;
  attempts: number;
};

const HEIGHT_OPTIONS = ['Low', 'Middle', 'High'] as const;
const SHAPE_OPTIONS = ['Fade', 'Straight', 'Draw'] as const;

export function TW9WindowsComponent({ onTabChange, onScoreSaved }: TW9WindowsComponentProps) {
  const [windows, setWindows] = useState<Window[]>([]);
  const [currentWindowIndex, setCurrentWindowIndex] = useState(0);
  const [totalShots, setTotalShots] = useState(0);
  const [userId, setUserId] = useState<string | null>(null);
  const [drillStarted, setDrillStarted] = useState(false);
  const [showCompletionDialog, setShowCompletionDialog] = useState(false);
  const [savedScore, setSavedScore] = useState(0);

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id || null);
    };
    fetchUser();
  }, []);

  useEffect(() => {
    const savedState = localStorage.getItem('tw9WindowsState');
    if (savedState) {
      const parsed = JSON.parse(savedState);
      // Ensure all windows have attempts field
      const windowsWithAttempts = parsed.windows.map((w: Window) => ({
        ...w,
        attempts: typeof w.attempts === 'number' ? w.attempts : 0
      }));
      setWindows(windowsWithAttempts);
      setCurrentWindowIndex(parsed.currentWindowIndex);
      setTotalShots(parsed.totalShots);
      setDrillStarted(parsed.drillStarted);
    } else {
      initializeDrill();
    }
  }, []);

  useEffect(() => {
    if (drillStarted) {
      localStorage.setItem('tw9WindowsState', JSON.stringify({
        windows,
        currentWindowIndex,
        totalShots,
        drillStarted
      }));
    }
  }, [windows, currentWindowIndex, totalShots, drillStarted]);

  const initializeDrill = () => {
    // Create all 9 window combinations
    const allWindows: Window[] = [];
    HEIGHT_OPTIONS.forEach(height => {
      SHAPE_OPTIONS.forEach(shape => {
        allWindows.push({ height, shape, completed: false, attempts: 0 });
      });
    });

    // Randomize order
    const shuffled = allWindows.sort(() => Math.random() - 0.5);
    
    setWindows(shuffled);
    setCurrentWindowIndex(0);
    setTotalShots(0);
    setDrillStarted(true);
    localStorage.removeItem('tw9WindowsState');
  };

  const handleNextShot = () => {
    // Mark current window as completed and increment attempts
    const updatedWindows = [...windows];
    updatedWindows[currentWindowIndex].completed = true;
    updatedWindows[currentWindowIndex].attempts = (updatedWindows[currentWindowIndex].attempts || 0) + 1;
    setWindows(updatedWindows);
    setTotalShots(totalShots + 1);

    // Find next incomplete window
    const nextIndex = updatedWindows.findIndex((w, i) => i > currentWindowIndex && !w.completed);
    if (nextIndex !== -1) {
      setCurrentWindowIndex(nextIndex);
    }
  };

  const handleTryAgain = () => {
    // Increment attempts for current window
    const updatedWindows = [...windows];
    updatedWindows[currentWindowIndex].attempts = (updatedWindows[currentWindowIndex].attempts || 0) + 1;
    setWindows(updatedWindows);
    setTotalShots(totalShots + 1);
  };

  const handleReset = () => {
    initializeDrill();
  };

  const saveScore = async () => {
    if (!userId) {
      toast.error("Please sign in to save your score");
      return;
    }

    // Capture the score before any state changes
    const scoreToSave = totalShots;

    try {
      const { data: drillData, error: drillError } = await supabase
        .rpc('get_or_create_drill_by_title', { 
          p_title: "TW's 9 Windows Test" 
        });

      if (drillError) throw drillError;

      const attemptsJson = windows.map((window, index) => ({
        windowNumber: index + 1,
        height: window.height,
        shape: window.shape,
        completed: window.completed,
        attempts: window.attempts
      }));

      const { error: insertError } = await supabase
        .from('drill_results')
        .insert({
          drill_id: drillData,
          user_id: userId,
          total_points: scoreToSave,
          attempts_json: attemptsJson
        });

      if (insertError) throw insertError;

      toast.success(`Score saved! Total shots: ${scoreToSave}`);
      setSavedScore(scoreToSave);
      localStorage.removeItem('tw9WindowsState');
      setShowCompletionDialog(true);
    } catch (error) {
      console.error('Error saving score:', error);
      toast.error("Failed to save score");
    }
  };

  const allCompleted = windows.every(w => w.completed);
  const currentWindow = windows[currentWindowIndex];

  if (!drillStarted || !currentWindow) {
    return null;
  }

  if (allCompleted) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Drill Complete!</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center space-y-2">
              <p className="text-4xl font-bold text-primary">{totalShots}</p>
              <p className="text-sm text-muted-foreground">Total Shots</p>
            </div>

            <div className="space-y-2">
              <h3 className="font-semibold text-sm">Windows Completed</h3>
              <div className="grid grid-cols-3 gap-2">
                {windows.map((window, index) => (
                  <div key={index} className="p-2 border rounded text-xs bg-muted">
                    <div className="flex items-center justify-between">
                      <span>{window.height} {window.shape}</span>
                      <Check className="h-3 w-3 text-green-600" />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {userId ? (
              <Button onClick={saveScore} className="w-full">
                Save Score
              </Button>
            ) : (
              <p className="text-sm text-muted-foreground text-center">
                Sign in to save your score
              </p>
            )}

            <Button onClick={initializeDrill} variant="outline" className="w-full">
              Start New Drill
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Current Window</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-center space-y-2 p-6 border-2 border-primary rounded-lg bg-muted">
            <p className="text-3xl font-bold">{currentWindow.height}</p>
            <p className="text-2xl font-semibold text-primary">{currentWindow.shape}</p>
          </div>

          <div className="flex gap-2">
            <Button 
              onClick={handleNextShot} 
              className="flex-1"
            >
              <Check className="mr-2 h-4 w-4" />
              Next Shot
            </Button>
            <Button 
              onClick={handleTryAgain} 
              variant="outline"
              className="flex-1"
            >
              <X className="mr-2 h-4 w-4" />
              Try Again
            </Button>
          </div>

          <Button 
            onClick={handleReset} 
            variant="ghost"
            className="w-full"
          >
            Reset Drill
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Progress</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex justify-between text-sm">
            <span>Total Shots:</span>
            <span className="font-bold">{totalShots}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span>Completed:</span>
            <span className="font-bold">{windows.filter(w => w.completed).length}/9</span>
          </div>

          <div className="space-y-2">
            <h3 className="font-semibold text-sm">All Windows</h3>
            <div className="grid grid-cols-3 gap-2">
              {windows.map((window, index) => (
                <div 
                  key={index} 
                  className={`p-2 border rounded text-xs ${
                    window.completed 
                      ? 'bg-green-50 border-green-600' 
                      : index === currentWindowIndex 
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-muted'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="truncate">{window.height} {window.shape}</span>
                    {window.completed && <Check className="h-3 w-3 text-green-600" />}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <DrillCompletionDialog
        open={showCompletionDialog}
        onOpenChange={setShowCompletionDialog}
        drillTitle="TW's 9 Windows Test"
        score={savedScore}
        unit="shots"
        onContinue={() => {
          onScoreSaved?.();
        }}
      />
    </div>
  );
}
