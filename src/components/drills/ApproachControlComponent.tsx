import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

interface ApproachControlComponentProps {
  onTabChange?: (tab: string) => void;
  onScoreSaved?: () => void;
}

interface Attempt {
  shotNumber: number;
  distance: number;
  requiredSide: 'left' | 'right';
  correctSide: boolean;
  proximityMeters: number;
  points: number;
  bonusPoints: number;
}

const generateRandomSequence = (): Array<{ distance: number; side: 'left' | 'right' }> => {
  // Fixed set of 14 shots: 7 left and 7 right with predefined distances
  const shots: Array<{ distance: number; side: 'left' | 'right' }> = [
    { distance: 130, side: 'left' },
    { distance: 140, side: 'left' },
    { distance: 150, side: 'left' },
    { distance: 160, side: 'left' },
    { distance: 170, side: 'left' },
    { distance: 175, side: 'left' },
    { distance: 180, side: 'left' },
    { distance: 135, side: 'right' },
    { distance: 145, side: 'right' },
    { distance: 155, side: 'right' },
    { distance: 165, side: 'right' },
    { distance: 170, side: 'right' },
    { distance: 175, side: 'right' },
    { distance: 180, side: 'right' },
  ];

  // Shuffle using Fisher-Yates algorithm
  for (let i = shots.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shots[i], shots[j]] = [shots[j], shots[i]];
  }

  return shots;
};

const ApproachControlComponent = ({ onTabChange, onScoreSaved }: ApproachControlComponentProps) => {
  const STORAGE_KEY = 'approach-control-drill-state';
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [currentShot, setCurrentShot] = useState(1);
  const [isActive, setIsActive] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [bonusStreak, setBonusStreak] = useState(0);
  const [shotSequence, setShotSequence] = useState<Array<{ distance: number; side: 'left' | 'right' }>>([]);
  
  // Current shot input state
  const [correctSide, setCorrectSide] = useState<string>("");
  const [inside10m, setInside10m] = useState<string>("");
  const [inside15m, setInside15m] = useState<string>("");
  const [inside5m, setInside5m] = useState<string>("");
  
  const { toast } = useToast();

  // Load state from localStorage on mount or auto-start
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const state = JSON.parse(saved);
        setAttempts(state.attempts || []);
        setCurrentShot(state.currentShot || 1);
        setIsActive(state.isActive || false);
        setBonusStreak(state.bonusStreak || 0);
        setShotSequence(state.shotSequence || []);
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
        currentShot,
        isActive,
        bonusStreak,
        shotSequence
      }));
    }
  }, [attempts, currentShot, isActive, bonusStreak, shotSequence]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUserId(user?.id || null);
    });
  }, []);

  const totalPoints = attempts.reduce((sum, attempt) => sum + attempt.points + attempt.bonusPoints, 0);
  const maxPoints = 14 * 3; // 42 points if all perfect

  const handleStartDrill = () => {
    localStorage.removeItem(STORAGE_KEY);
    setIsActive(true);
    setAttempts([]);
    setCurrentShot(1);
    setBonusStreak(0);
    setShotSequence(generateRandomSequence());
    resetInputs();
    onTabChange?.('score');
  };

  const resetInputs = () => {
    setCorrectSide("");
    setInside10m("");
    setInside15m("");
    setInside5m("");
  };

  const calculatePoints = (isCorrectSide: boolean, inside10: boolean, inside15: boolean, inside5: boolean): number => {
    if (isCorrectSide) {
      // 3 Points: correct side and inside 10 meters
      if (inside10) return 3;
      // 1 Point: Correct side and inside 15 meters
      if (inside15) return 1;
      // 0 Points: Correct side but outside 15 meters
      return 0;
    } else {
      // 2 Points: wrong side but inside 5 meters
      if (inside5) return 2;
      // -1 Point: Wrong side and outside 5 meters
      return -1;
    }
  };

  const currentShotInfo = shotSequence[currentShot - 1];

  const addAttempt = () => {
    const isCorrectSide = correctSide === "yes";
    
    // Validate based on correct side
    if (!correctSide) {
      toast({
        title: "Missing information",
        description: "Please answer if you landed on the correct side.",
        variant: "destructive",
      });
      return;
    }

    if (isCorrectSide) {
      if (!inside10m) {
        toast({
          title: "Missing information",
          description: "Please answer if you were inside 10 meters.",
          variant: "destructive",
        });
        return;
      }
      if (inside10m === "no" && !inside15m) {
        toast({
          title: "Missing information",
          description: "Please answer if you were inside 15 meters.",
          variant: "destructive",
        });
        return;
      }
    } else {
      if (!inside5m) {
        toast({
          title: "Missing information",
          description: "Please answer if you were inside 5 meters.",
          variant: "destructive",
        });
        return;
      }
    }

    const inside10 = inside10m === "yes";
    const inside15 = inside15m === "yes";
    const inside5 = inside5m === "yes";
    
    const basePoints = calculatePoints(isCorrectSide, inside10, inside15, inside5);
    
    // Estimate proximity for display purposes
    let estimatedProximity = 0;
    if (isCorrectSide) {
      if (inside10) estimatedProximity = 7;
      else if (inside15) estimatedProximity = 12;
      else estimatedProximity = 18;
    } else {
      if (inside5) estimatedProximity = 3;
      else estimatedProximity = 8;
    }
    let bonus = 0;
    let newBonusStreak = bonusStreak;

    // Check for bonus - starts after 3 consecutive 3-pointers
    if (basePoints === 3) {
      if (bonusStreak >= 3) {
        // Already have 3+ consecutive 3-pointers, add bonus
        bonus = 1;
        newBonusStreak = bonusStreak + 1;
      } else {
        // Building towards bonus
        newBonusStreak = bonusStreak + 1;
      }
    } else {
      // Missed a 3-pointer, reset streak
      newBonusStreak = 0;
    }

    setBonusStreak(newBonusStreak);

    const newAttempt: Attempt = {
      shotNumber: currentShot,
      distance: currentShotInfo.distance,
      requiredSide: currentShotInfo.side,
      correctSide: isCorrectSide,
      proximityMeters: estimatedProximity,
      points: basePoints,
      bonusPoints: bonus,
    };

    const newAttempts = [...attempts, newAttempt];
    setAttempts(newAttempts);
    
    if (currentShot === 14) {
      // Drill completed
      handleSaveScore(newAttempts);
    } else {
      setCurrentShot(currentShot + 1);
      resetInputs();
    }
  };

  const handleSaveScore = async (finalAttempts: Attempt[]) => {
    if (!userId) {
      toast({
        title: "Sign in required",
        description: "Please sign in to save your score.",
        variant: "destructive",
      });
      setIsActive(false);
      return;
    }

    const finalScore = finalAttempts.reduce((sum, att) => sum + att.points + att.bonusPoints, 0);

    try {
      const { data: drillId, error: drillError } = await (supabase as any)
        .rpc('get_or_create_drill_by_title', { p_title: 'Approach Control' });

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
          total_points: finalScore,
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
        description: `Total Score: ${finalScore} points (out of ${maxPoints})`,
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
    setIsActive(false);
    setAttempts([]);
    setCurrentShot(1);
    setBonusStreak(0);
    setShotSequence([]);
    resetInputs();
  };

  return (
    <div className="space-y-6">
      {/* Active Drill */}
      {isActive && currentShotInfo && (
        <Card>
          <CardHeader>
            <CardTitle>Shot #{currentShot} of 14</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="p-3 bg-primary/10 rounded-md text-center">
              <div className="text-sm text-muted-foreground">Distance</div>
              <div className="text-xl font-bold text-primary">{currentShotInfo.distance}m</div>
              <div className="text-sm font-medium text-foreground mt-1 capitalize">Target: {currentShotInfo.side} side</div>
            </div>
            
            <div className="text-center">
              <div className="text-lg font-medium">
                Current Score: {totalPoints} points
              </div>
              {bonusStreak >= 3 && (
                <div className="text-sm text-primary font-medium mt-1">
                  🔥 Bonus Streak Active! ({bonusStreak} consecutive 3-pointers)
                </div>
              )}
              {bonusStreak > 0 && bonusStreak < 3 && (
                <div className="text-sm text-muted-foreground mt-1">
                  {3 - bonusStreak} more 3-pointer{3 - bonusStreak > 1 ? 's' : ''} to activate bonus
                </div>
              )}
            </div>
            
            {/* Input Form */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Did you land on the {currentShotInfo.side} side?</Label>
                <RadioGroup value={correctSide} onValueChange={(value) => {
                  setCorrectSide(value);
                  setInside10m("");
                  setInside15m("");
                  setInside5m("");
                }}>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="yes" id="side-yes" />
                    <Label htmlFor="side-yes">Yes</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="no" id="side-no" />
                    <Label htmlFor="side-no">No</Label>
                  </div>
                </RadioGroup>
              </div>

              {correctSide === "yes" && (
                <>
                  <div className="space-y-2">
                    <Label>Was it inside 10 meters?</Label>
                    <RadioGroup value={inside10m} onValueChange={(value) => {
                      setInside10m(value);
                      if (value === "yes") setInside15m("");
                    }}>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="yes" id="inside10-yes" />
                        <Label htmlFor="inside10-yes">Yes</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="no" id="inside10-no" />
                        <Label htmlFor="inside10-no">No</Label>
                      </div>
                    </RadioGroup>
                  </div>

                  {inside10m === "no" && (
                    <div className="space-y-2">
                      <Label>Was it inside 15 meters?</Label>
                      <RadioGroup value={inside15m} onValueChange={setInside15m}>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="yes" id="inside15-yes" />
                          <Label htmlFor="inside15-yes">Yes</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="no" id="inside15-no" />
                          <Label htmlFor="inside15-no">No</Label>
                        </div>
                      </RadioGroup>
                    </div>
                  )}
                </>
              )}

              {correctSide === "no" && (
                <div className="space-y-2">
                  <Label>Was it inside 5 meters?</Label>
                  <RadioGroup value={inside5m} onValueChange={setInside5m}>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="yes" id="inside5-yes" />
                      <Label htmlFor="inside5-yes">Yes</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="no" id="inside5-no" />
                      <Label htmlFor="inside5-no">No</Label>
                    </div>
                  </RadioGroup>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Button 
                onClick={addAttempt}
                className="bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                Record Shot
              </Button>
              <Button 
                onClick={resetDrill}
                variant="outline"
              >
                Reset Drill
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Attempts History */}
      {attempts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Shot History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {[...attempts].reverse().map((attempt, index) => (
                <div key={index} className="flex justify-between items-center p-2 rounded-md bg-muted/50">
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">Shot #{attempt.shotNumber}</span>
                    <span className="text-xs text-muted-foreground">{attempt.distance}m • {attempt.requiredSide} side</span>
                    <span className="text-xs text-muted-foreground">{attempt.proximityMeters.toFixed(1)}m proximity</span>
                  </div>
                  <div className="text-right">
                    <span className={`text-sm font-medium ${
                      attempt.points === 3 ? 'text-green-600' : 
                      attempt.points === 2 ? 'text-blue-600' :
                      attempt.points === 1 ? 'text-yellow-600' :
                      attempt.points === 0 ? 'text-muted-foreground' :
                      'text-destructive'
                    }`}>
                      {attempt.points > 0 ? '+' : ''}{attempt.points} pts
                      {attempt.bonusPoints > 0 && (
                        <span className="text-primary"> +{attempt.bonusPoints} bonus</span>
                      )}
                    </span>
                    <div className="text-xs text-muted-foreground">
                      {attempt.correctSide ? '✓ Side' : '✗ Side'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 p-3 bg-primary/10 rounded-md">
              <div className="text-center font-medium">
                Total: {totalPoints} / {maxPoints} points
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ApproachControlComponent;
