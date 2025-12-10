import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Target, ChevronLeft, ChevronRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { DrillCompletionDialog } from "@/components/DrillCompletionDialog";

interface PGATour18ComponentProps {
  onTabChange?: (tab: string) => void;
  onScoreSaved?: () => void;
}

interface PuttAttempt {
  puttNumber: number;
  distance: string;
  putts: number | null;
}

const baseDistances = [
  "1.5m (5ft)",
  "12m",
  "0.6m (2ft)",
  "4m",
  "1.2m (4ft)",
  "16m",
  "8m",
  "3m",
  "6m",
  "9m",
  "0.9m (3ft)",
  "7m",
  "2.1m (7ft)",
  "3.5m",
  "10m",
  "1.8m (6ft)",
  "5m",
  "2.4m (8ft)",
];

const generateRandomSequence = (): string[] => {
  const shuffled = [...baseDistances];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

const PGATour18Component = ({ onTabChange, onScoreSaved }: PGATour18ComponentProps) => {
  const STORAGE_KEY = 'pga-tour-18-drill-state';
  const [attempts, setAttempts] = useState<PuttAttempt[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [distanceSequence, setDistanceSequence] = useState<string[]>([]);
  const [showCompletionDialog, setShowCompletionDialog] = useState(false);
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

  const totalPuttsCount = attempts.reduce((sum, att) => sum + (att.putts || 0), 0);
  const currentDistance = distanceSequence[currentIndex];
  const currentAttempt = attempts[currentIndex];
  const completedCount = attempts.filter(a => a.putts !== null).length;

  const handleStartDrill = () => {
    localStorage.removeItem(STORAGE_KEY);
    const distances = generateRandomSequence();
    setDistanceSequence(distances);
    setIsActive(true);
    setAttempts(distances.map((d, i) => ({
      puttNumber: i + 1,
      distance: d,
      putts: null
    })));
    setCurrentIndex(0);
    onTabChange?.('score');
  };

  const handleResetDrill = () => {
    localStorage.removeItem(STORAGE_KEY);
    setIsActive(false);
    setAttempts([]);
    setCurrentIndex(0);
    setDistanceSequence([]);
  };

  const handlePuttSelection = (numPutts: number) => {
    const updatedAttempts = [...attempts];
    updatedAttempts[currentIndex] = {
      ...updatedAttempts[currentIndex],
      putts: numPutts,
    };
    setAttempts(updatedAttempts);

    // Check if all 18 are complete
    const allComplete = updatedAttempts.every(a => a.putts !== null);
    if (allComplete) {
      handleSaveScore(updatedAttempts);
    } else if (currentIndex < 17) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const canGoBack = currentIndex > 0;
  const canGoForward = currentIndex < 17 && currentAttempt?.putts !== null;

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

    const totalPutts = finalAttempts.reduce((sum, att) => sum + (att.putts || 0), 0);

    try {
      const { data: drillId, error: drillError } = await (supabase as any)
        .rpc('get_or_create_drill_by_title', { p_title: 'PGA Tour 18 Holes' });

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
          total_points: totalPutts,
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

      setIsActive(false);
      setFinalScore(totalPutts);
      setShowCompletionDialog(true);
      localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.error('Error:', error);
      toast({
        title: "Error",
        description: "An unexpected error occurred.",
        variant: "destructive",
      });
      setIsActive(false);
    }
  };

  const resetDrill = () => {
    localStorage.removeItem(STORAGE_KEY);
    const distances = generateRandomSequence();
    setDistanceSequence(distances);
    setIsActive(true);
    setAttempts(distances.map((d, i) => ({
      puttNumber: i + 1,
      distance: d,
      putts: null
    })));
    setCurrentIndex(0);
  };

  return (
    <div className="space-y-6">
      {/* Active Drill */}
      {isActive && currentDistance && (
        <Card>
          <CardHeader>
            <CardTitle>Putt #{currentIndex + 1} of 18</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
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

            <div className="p-3 bg-primary/10 rounded-md text-center">
              <div className="text-sm text-muted-foreground">Distance</div>
              <div className="text-2xl font-bold text-primary">{currentDistance}</div>
            </div>

            <div className="text-center">
              <div className="text-lg font-medium">
                Current Total: {totalPuttsCount} putts
              </div>
            </div>

            <div className="space-y-2">
              <div className="grid grid-cols-5 gap-2">
                {[1, 2, 3, 4, 5].map((num) => (
                  <Button
                    key={num}
                    onClick={() => handlePuttSelection(num)}
                    className={`h-16 text-lg font-semibold bg-primary hover:bg-primary/90 text-primary-foreground ${
                      currentAttempt?.putts === num ? 'ring-2 ring-offset-2 ring-primary' : ''
                    }`}
                  >
                    {num}
                  </Button>
                ))}
              </div>
            </div>

            <Button 
              onClick={resetDrill}
              variant="outline"
              className="w-full"
            >
              Reset Drill
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Shot History */}
      {attempts.filter(a => a.putts !== null).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Putt History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {[...attempts].filter(a => a.putts !== null).reverse().map((attempt, index) => (
                <div 
                  key={attempt.puttNumber} 
                  className={`flex justify-between items-center p-2 rounded-md bg-muted/50 cursor-pointer hover:bg-muted/80 ${
                    currentIndex === attempt.puttNumber - 1 ? 'ring-2 ring-primary' : ''
                  }`}
                  onClick={() => setCurrentIndex(attempt.puttNumber - 1)}
                >
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">Putt #{attempt.puttNumber}</span>
                    <span className="text-xs text-muted-foreground">{attempt.distance}</span>
                  </div>
                  <div className="text-right">
                    <span className={`text-sm font-medium ${
                      attempt.putts === 1 ? 'text-green-600' : 
                      attempt.putts === 2 ? 'text-blue-600' :
                      attempt.putts === 3 ? 'text-yellow-600' :
                      'text-muted-foreground'
                    }`}>
                      {attempt.putts} {attempt.putts === 1 ? 'putt' : 'putts'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <DrillCompletionDialog
        open={showCompletionDialog}
        onOpenChange={setShowCompletionDialog}
        drillTitle="PGA Tour 18 Holes"
        score={finalScore}
        unit="putts"
        onContinue={() => {
          onScoreSaved?.();
        }}
      />
    </div>
  );
};

export default PGATour18Component;
