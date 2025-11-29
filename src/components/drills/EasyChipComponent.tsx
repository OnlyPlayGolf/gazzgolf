import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Target, CheckCircle2, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface EasyChipComponentProps {
  onTabChange?: (tab: string) => void;
  onScoreSaved?: () => void;
}

const EasyChipComponent = ({ onTabChange, onScoreSaved }: EasyChipComponentProps) => {
  const STORAGE_KEY = 'easy-chip-drill-state';
  const [consecutiveMakes, setConsecutiveMakes] = useState(0);
  const [drillStarted, setDrillStarted] = useState(false);
  const [drillEnded, setDrillEnded] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const { toast } = useToast();

  // Load state from localStorage on mount or auto-start
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const state = JSON.parse(saved);
        setConsecutiveMakes(state.consecutiveMakes || 0);
        setDrillStarted(state.drillStarted || false);
        setDrillEnded(state.drillEnded || false);
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
    if (drillStarted) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        consecutiveMakes,
        drillStarted,
        drillEnded
      }));
    }
  }, [consecutiveMakes, drillStarted, drillEnded]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUserId(user?.id || null);
    });
  }, []);

  const handleMake = () => {
    setConsecutiveMakes(prev => prev + 1);
  };

  const handleMiss = () => {
    setDrillEnded(true);
  };

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
      const { data: drillId, error: drillError } = await (supabase as any)
        .rpc('get_or_create_drill_by_title', { p_title: 'Easy Chip Drill' });

      if (drillError || !drillId) {
        console.error('Drill not found or could not create:', drillError);
        toast({
          title: "Error",
          description: "Could not save score.",
          variant: "destructive",
        });
        return;
      }

      const { error: resultError } = await (supabase as any)
        .from('drill_results')
        .insert({
          drill_id: drillId,
          user_id: userId,
          total_points: consecutiveMakes,
          attempts_json: { consecutive_makes: consecutiveMakes }
        });

      if (resultError) throw resultError;

      toast({
        title: "Score saved!",
        description: `${consecutiveMakes} consecutive chip${consecutiveMakes !== 1 ? 's' : ''} recorded.`,
      });

      localStorage.removeItem(STORAGE_KEY);
      onScoreSaved?.();
    } catch (error) {
      console.error('Error saving score:', error);
      toast({
        title: "Error",
        description: "Failed to save score. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleStartDrill = () => {
    localStorage.removeItem(STORAGE_KEY);
    setDrillStarted(true);
    setDrillEnded(false);
    setConsecutiveMakes(0);
    onTabChange?.('score');
  };

  const resetDrill = () => {
    localStorage.removeItem(STORAGE_KEY);
    setDrillStarted(false);
    setDrillEnded(false);
    setConsecutiveMakes(0);
  };

  return (
    <div className="space-y-6">
      {drillEnded ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="text-primary" size={20} />
              Easy Chip Drill - Complete
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-primary/10 rounded-lg p-6 text-center">
              <p className="text-sm text-muted-foreground mb-2">Consecutive Chips Made</p>
              <p className="text-4xl font-bold text-primary">{consecutiveMakes}</p>
            </div>

            {userId ? (
              <Button onClick={saveScore} className="w-full">
                Save Score
              </Button>
            ) : (
              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-2">Sign in to save your score</p>
                <Button onClick={() => window.location.href = '/auth'} variant="outline" className="w-full">
                  Sign In
                </Button>
              </div>
            )}

            <Button onClick={handleStartDrill} variant="outline" className="w-full">
              Try Again
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Easy Chip Drill</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="p-3 bg-primary/10 rounded-md text-center">
              <div className="text-sm text-muted-foreground">Distance</div>
              <div className="text-2xl font-bold text-primary">10 meters from fairway</div>
            </div>

            <div className="text-center">
              <div className="text-lg font-medium">
                Consecutive Makes: {consecutiveMakes}
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium text-center mb-3">Did you land within one wedge length?</div>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  onClick={handleMake}
                  className="h-16 text-lg font-semibold bg-green-600 hover:bg-green-700 text-white"
                >
                  <CheckCircle2 className="mr-2" size={20} />
                  Yes
                </Button>
                <Button
                  onClick={handleMiss}
                  className="h-16 text-lg font-semibold bg-red-600 hover:bg-red-700 text-white"
                >
                  <XCircle className="mr-2" size={20} />
                  No
                </Button>
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
    </div>
  );
};

export default EasyChipComponent;
