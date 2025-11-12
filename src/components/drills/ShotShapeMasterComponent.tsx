import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Target, TrendingUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

interface ShotShapeMasterComponentProps {
  onTabChange?: (tab: string) => void;
  onScoreSaved?: () => void;
}

interface Attempt {
  shotNumber: number;
  correctShape: boolean;
  hitFairway: boolean;
  missDistance?: number; // in meters, only if missed fairway
  points: number;
  bonusPoints: number;
}

const ShotShapeMasterComponent = ({ onTabChange, onScoreSaved }: ShotShapeMasterComponentProps) => {
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [currentShot, setCurrentShot] = useState(1);
  const [isActive, setIsActive] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [bonusStreak, setBonusStreak] = useState(0);
  
  // Current shot input state
  const [correctShape, setCorrectShape] = useState<string>("");
  const [hitFairway, setHitFairway] = useState<string>("");
  const [missDistance, setMissDistance] = useState<string>("");
  
  const { toast } = useToast();

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUserId(user?.id || null);
    });
  }, []);

  const totalPoints = attempts.reduce((sum, attempt) => sum + attempt.points + attempt.bonusPoints, 0);
  const maxPoints = 14 * 3; // 42 points if all perfect

  const handleStartDrill = () => {
    setIsActive(true);
    setAttempts([]);
    setCurrentShot(1);
    setBonusStreak(0);
    resetInputs();
    onTabChange?.('score');
  };

  const resetInputs = () => {
    setCorrectShape("");
    setHitFairway("");
    setMissDistance("");
  };

  const calculatePoints = (isCorrectShape: boolean, didHitFairway: boolean, distance?: number): number => {
    if (isCorrectShape && didHitFairway) return 3;
    if (!isCorrectShape && didHitFairway) return 2;
    if (isCorrectShape && !didHitFairway && distance && distance <= 10) return 1;
    return 0;
  };

  const addAttempt = () => {
    if (!correctShape || !hitFairway) {
      toast({
        title: "Missing information",
        description: "Please answer all required fields.",
        variant: "destructive",
      });
      return;
    }

    const isCorrectShape = correctShape === "yes";
    const didHitFairway = hitFairway === "yes";
    const distance = didHitFairway ? undefined : (missDistance ? parseFloat(missDistance) : undefined);

    // Validate distance if fairway was missed
    if (!didHitFairway && !distance) {
      toast({
        title: "Missing distance",
        description: "Please enter how far you missed the fairway.",
        variant: "destructive",
      });
      return;
    }

    const basePoints = calculatePoints(isCorrectShape, didHitFairway, distance);
    let bonus = 0;
    let newBonusStreak = bonusStreak;

    // Check for bonus
    if (basePoints === 3) {
      if (bonusStreak >= 2) {
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
      correctShape: isCorrectShape,
      hitFairway: didHitFairway,
      missDistance: distance,
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
        .rpc('get_or_create_drill_by_title', { p_title: 'Shot Shape Master' });

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
    resetInputs();
  };

  return (
    <div className="space-y-6">
      {/* Instructions Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="text-primary" size={20} />
            Shot Shape Master
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="font-semibold text-lg mb-2">Instructions</h3>
            <p className="text-muted-foreground mb-2">
              Hit 14 tee shots, attempting to hit your intended shot shape and fairway.
            </p>
          </div>
          
          <div className="p-3 bg-muted/50 rounded-md">
            <h4 className="font-medium mb-2">Scoring:</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• <span className="font-medium text-foreground">3 Points:</span> Correct shot shape + hit fairway</li>
              <li>• <span className="font-medium text-foreground">2 Points:</span> Wrong shot shape + hit fairway</li>
              <li>• <span className="font-medium text-foreground">1 Point:</span> Correct shot shape + missed fairway by ≤10m</li>
              <li>• <span className="font-medium text-foreground">0 Points:</span> Wrong shape + missed OR missed fairway by &gt;10m</li>
            </ul>
          </div>

          <div className="p-3 bg-primary/10 rounded-md">
            <h4 className="font-medium mb-2 flex items-center gap-2">
              <TrendingUp size={16} className="text-primary" />
              Bonus Streak:
            </h4>
            <p className="text-sm text-muted-foreground">
              After 3 consecutive 3-pointers, earn +1 bonus point for each additional 3-pointer until you miss one.
            </p>
            <p className="text-xs text-muted-foreground mt-2 font-mono">
              Example: 3, 3, 3, (bonus starts) → 3+1, 3+1, miss → streak resets
            </p>
          </div>
          
          {!isActive && (
            <Button 
              onClick={handleStartDrill}
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              Start Drill
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Active Drill */}
      {isActive && (
        <Card>
          <CardHeader>
            <CardTitle>Shot #{currentShot} of 14</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="text-center">
              <div className="text-lg font-medium">
                Current Score: {totalPoints} points
              </div>
              {bonusStreak >= 2 && (
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
                <Label>Did you hit your intended shot shape?</Label>
                <RadioGroup value={correctShape} onValueChange={setCorrectShape}>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="yes" id="shape-yes" />
                    <Label htmlFor="shape-yes">Yes</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="no" id="shape-no" />
                    <Label htmlFor="shape-no">No</Label>
                  </div>
                </RadioGroup>
              </div>

              <div className="space-y-2">
                <Label>Did you hit the fairway?</Label>
                <RadioGroup value={hitFairway} onValueChange={setHitFairway}>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="yes" id="fairway-yes" />
                    <Label htmlFor="fairway-yes">Yes</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="no" id="fairway-no" />
                    <Label htmlFor="fairway-no">No</Label>
                  </div>
                </RadioGroup>
              </div>

              {hitFairway === "no" && (
                <div className="space-y-2">
                  <Label htmlFor="miss-distance">How far did you miss the fairway? (meters)</Label>
                  <Input
                    id="miss-distance"
                    type="number"
                    placeholder="e.g., 5"
                    value={missDistance}
                    onChange={(e) => setMissDistance(e.target.value)}
                    min="0"
                    step="0.1"
                  />
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
              {attempts.map((attempt, index) => (
                <div key={index} className="flex justify-between items-center p-2 rounded-md bg-muted/50">
                  <span className="text-sm">Shot #{attempt.shotNumber}</span>
                  <div className="text-right">
                    <span className={`text-sm font-medium ${
                      attempt.points === 3 ? 'text-green-600' : 
                      attempt.points === 2 ? 'text-blue-600' :
                      attempt.points === 1 ? 'text-yellow-600' : 
                      'text-muted-foreground'
                    }`}>
                      {attempt.points} pts
                      {attempt.bonusPoints > 0 && (
                        <span className="text-primary"> +{attempt.bonusPoints} bonus</span>
                      )}
                    </span>
                    <div className="text-xs text-muted-foreground">
                      {attempt.correctShape ? '✓ Shape' : '✗ Shape'} • {attempt.hitFairway ? '✓ Fairway' : '✗ Fairway'}
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

export default ShotShapeMasterComponent;
