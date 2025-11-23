import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Target } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface PGATour18ComponentProps {
  onTabChange?: (tab: string) => void;
  onScoreSaved?: () => void;
}

interface PuttAttempt {
  puttNumber: number;
  distance: string;
  putts: number;
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
  // Fisher-Yates shuffle
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

const PGATour18Component = ({ onTabChange, onScoreSaved }: PGATour18ComponentProps) => {
  const STORAGE_KEY = 'pga-tour-18-drill-state';
  const [attempts, setAttempts] = useState<PuttAttempt[]>([]);
  const [currentPutt, setCurrentPutt] = useState(1);
  const [isActive, setIsActive] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [distanceSequence, setDistanceSequence] = useState<string[]>([]);
  const { toast } = useToast();

  // Load state from localStorage on mount or auto-start
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const state = JSON.parse(saved);
        setAttempts(state.attempts || []);
        setCurrentPutt(state.currentPutt || 1);
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

  // Save state to localStorage whenever it changes
  useEffect(() => {
    if (isActive) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        attempts,
        currentPutt,
        isActive,
        distanceSequence
      }));
    }
  }, [attempts, currentPutt, isActive, distanceSequence]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUserId(user?.id || null);
    });
  }, []);

  const totalPuttsCount = attempts.reduce((sum, att) => sum + att.putts, 0);
  const currentDistance = distanceSequence[currentPutt - 1];

  const handleStartDrill = () => {
    localStorage.removeItem(STORAGE_KEY);
    setIsActive(true);
    setAttempts([]);
    setCurrentPutt(1);
    setDistanceSequence(generateRandomSequence());
    onTabChange?.('score');
  };

  const handleResetDrill = () => {
    localStorage.removeItem(STORAGE_KEY);
    setIsActive(false);
    setAttempts([]);
    setCurrentPutt(1);
    setDistanceSequence([]);
  };

  const handlePuttSelection = (numPutts: number) => {
    const newAttempt: PuttAttempt = {
      puttNumber: currentPutt,
      distance: currentDistance,
      putts: numPutts,
    };

    const newAttempts = [...attempts, newAttempt];
    setAttempts(newAttempts);

    if (currentPutt === 18) {
      // Drill completed
      handleSaveScore(newAttempts);
    } else {
      setCurrentPutt(currentPutt + 1);
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

    const totalPutts = finalAttempts.reduce((sum, att) => sum + att.putts, 0);

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
      
      toast({
        title: "Drill Completed!",
        description: `Total Putts: ${totalPutts}`,
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
      setIsActive(false);
    }
  };

  const resetDrill = () => {
    localStorage.removeItem(STORAGE_KEY);
    setIsActive(true);
    setAttempts([]);
    setCurrentPutt(1);
    setDistanceSequence(generateRandomSequence());
  };

  return (
    <div className="space-y-6">
      {/* Active Drill */}
      {isActive && currentDistance && (
        <Card>
          <CardHeader>
            <CardTitle>Putt #{currentPutt} of 18</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
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
                    className="h-16 text-lg font-semibold bg-primary hover:bg-primary/90 text-primary-foreground"
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
      {attempts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Putt History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {[...attempts].reverse().map((attempt, index) => (
                <div key={index} className="flex justify-between items-center p-2 rounded-md bg-muted/50">
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
    </div>
  );
};

export default PGATour18Component;