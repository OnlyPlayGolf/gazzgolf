import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { DrillCompletionDialog } from "@/components/DrillCompletionDialog";

interface ShortPuttingTestComponentProps {
  onTabChange?: (tab: string) => void;
  onScoreSaved?: () => void;
}

interface TeePosition {
  name: string;
  distance: number; // in feet
}

const ShortPuttingTestComponent = ({ onTabChange, onScoreSaved }: ShortPuttingTestComponentProps) => {
  const STORAGE_KEY = 'short-putting-test-drill-state';
  const [teePositions, setTeePositions] = useState<TeePosition[]>([
    { name: '12 o\'clock', distance: 3 },
    { name: '3 o\'clock', distance: 3 },
    { name: '6 o\'clock', distance: 3 },
    { name: '9 o\'clock', distance: 3 },
  ]);
  const [currentTeeIndex, setCurrentTeeIndex] = useState(0);
  const [consecutiveMakes, setConsecutiveMakes] = useState(0);
  const [drillStarted, setDrillStarted] = useState(false);
  const [drillEnded, setDrillEnded] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
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
        setTeePositions(state.teePositions || [
          { name: '12 o\'clock', distance: 3 },
          { name: '3 o\'clock', distance: 3 },
          { name: '6 o\'clock', distance: 3 },
          { name: '9 o\'clock', distance: 3 },
        ]);
        setCurrentTeeIndex(state.currentTeeIndex || 0);
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
        teePositions,
        currentTeeIndex,
        consecutiveMakes,
        drillStarted,
        drillEnded
      }));
    }
  }, [teePositions, currentTeeIndex, consecutiveMakes, drillStarted, drillEnded]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUserId(user?.id || null);
    });
  }, []);

  // Auto-save when drill ends (miss clicked)
  useEffect(() => {
    if (drillEnded && consecutiveMakes > 0 && userId && !showCompletionDialog && !savedResultId && !isSavingRef.current) {
      isSavingRef.current = true;
      saveScore().finally(() => {
        isSavingRef.current = false;
      });
    }
  }, [drillEnded, consecutiveMakes, userId, showCompletionDialog, savedResultId]);

  const handleMake = () => {
    // Increase distance for current tee
    const newPositions = [...teePositions];
    newPositions[currentTeeIndex].distance += 1;
    setTeePositions(newPositions);

    // Increment score
    setConsecutiveMakes(prev => prev + 1);

    // Move to next tee
    setCurrentTeeIndex((prev) => (prev + 1) % 4);
  };

  const handleMiss = () => {
    setDrillEnded(true);
  };

  const saveScore = async (): Promise<void> => {
    if (!userId) {
      toast({
        title: "Sign in required",
        description: "Please sign in to save your score.",
        variant: "destructive",
      });
      return;
    }

    if (consecutiveMakes === 0) {
      toast({
        title: "No putts made",
        description: "Make at least one putt before saving your score.",
        variant: "destructive",
      });
      return;
    }

    try {
      const drillTitle = 'Short Putting Test';
      
      const { data: drillData, error: drillError } = await supabase
        .rpc('get_or_create_drill_by_title', { p_title: drillTitle });

      if (drillError) throw drillError;

      const { data: insertedResult, error: insertError } = await supabase
        .from('drill_results')
        .insert([{
          drill_id: drillData,
          user_id: userId,
          total_points: consecutiveMakes,
          attempts_json: {
            consecutive_makes: consecutiveMakes,
            final_distances: teePositions,
          } as any,
        }])
        .select('id')
        .single();

      if (insertError) throw insertError;

      toast({
        title: "Score saved!",
        description: `You made ${consecutiveMakes} consecutive putts!`,
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
    localStorage.removeItem(STORAGE_KEY);
    setDrillStarted(true);
    setDrillEnded(false);
    setConsecutiveMakes(0);
    setCurrentTeeIndex(0);
    setShowCompletionDialog(false);
    setSavedResultId(null);
    isSavingRef.current = false;
    setTeePositions([
      { name: '12 o\'clock', distance: 3 },
      { name: '3 o\'clock', distance: 3 },
      { name: '6 o\'clock', distance: 3 },
      { name: '9 o\'clock', distance: 3 },
    ]);
  };

  const handleReset = () => {
    handleStartDrill();
  };

  return (
    <div className="space-y-6">
      {drillStarted && (
        <>
          {/* Current Tee Positions */}
          <Card>
            <CardHeader>
              <CardTitle>Tee Positions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3">
                {teePositions.map((tee, index) => (
                  <div 
                    key={index}
                    className={`p-3 rounded-lg border-2 transition-all ${
                      index === currentTeeIndex && !drillEnded
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-muted bg-muted/50'
                    }`}
                  >
                    <div className="text-sm font-medium">{tee.name}</div>
                    <div className="text-2xl font-bold">{tee.distance} ft</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Current Status */}
          <Card>
            <CardContent className="pt-6">
              <div className="text-center space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground">Consecutive Makes</p>
                  <p className="text-4xl font-bold">{consecutiveMakes}</p>
                </div>

                {!drillEnded && (
                  <>
                    <div className="py-4 border-t border-b">
                      <p className="text-sm text-muted-foreground mb-2">Current Putt</p>
                      <p className="text-xl font-semibold">
                        {teePositions[currentTeeIndex].name} - {teePositions[currentTeeIndex].distance} ft
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <Button
                        onClick={handleMake}
                        className="bg-primary hover:bg-primary/90 text-primary-foreground"
                      >
                        <CheckCircle2 className="mr-2" size={18} />
                        Made It
                      </Button>
                      <Button
                        onClick={handleMiss}
                        variant="destructive"
                      >
                        <XCircle className="mr-2" size={18} />
                        Missed
                      </Button>
                    </div>

                    <Button
                      onClick={handleReset}
                      variant="outline"
                      className="w-full"
                    >
                      Reset Drill
                    </Button>
                  </>
                )}

                {drillEnded && (
                  <div className="space-y-4">
                    <div className="p-4 bg-muted/50 rounded-lg">
                      <p className="text-lg font-semibold mb-2">Test Complete!</p>
                      <p className="text-muted-foreground">
                        You made {consecutiveMakes} consecutive {consecutiveMakes === 1 ? 'putt' : 'putts'}
                      </p>
                    </div>

                    <Button
                      onClick={handleReset}
                      variant="outline"
                      className="w-full"
                    >
                      Try Again
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </>
      )}

      <DrillCompletionDialog
        open={showCompletionDialog}
        onOpenChange={setShowCompletionDialog}
        drillTitle="Short Putting Test"
        score={consecutiveMakes}
        unit="putts"
        resultId={savedResultId || undefined}
        onContinue={() => {
          onScoreSaved?.();
        }}
      />
    </div>
  );
};

export default ShortPuttingTestComponent;
