import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Target, TrendingUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { DrillCompletionDialog } from "@/components/DrillCompletionDialog";

interface DriverControlComponentProps {
  onTabChange?: (tab: string) => void;
  onScoreSaved?: () => void;
}

interface ShotStructure {
  fairwayPoints: number;
  missLeftPoints: number;
  missRightPoints: number;
}

interface Attempt {
  shotNumber: number;
  result: 'fairway' | 'miss-left' | 'miss-right';
  points: number;
  bonusPoints: number;
  shotStructure: ShotStructure;
}

const generateRandomSequence = (): ShotStructure[] => {
  const shots: ShotStructure[] = [];
  
  for (let i = 0; i < 14; i++) {
    shots.push({
      fairwayPoints: 1,
      missLeftPoints: [0, -1, -2][Math.floor(Math.random() * 3)],
      missRightPoints: [0, -1, -2][Math.floor(Math.random() * 3)],
    });
  }
  
  return shots;
};

const DriverControlComponent = ({ onTabChange, onScoreSaved }: DriverControlComponentProps) => {
  const STORAGE_KEY = 'driver-control-drill-state';
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [currentShot, setCurrentShot] = useState(1);
  const [isActive, setIsActive] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [bonusStreak, setBonusStreak] = useState(0);
  const [shotSequence, setShotSequence] = useState<ShotStructure[]>([]);
  const [showCompletionDialog, setShowCompletionDialog] = useState(false);
  const [finalScore, setFinalScore] = useState(0);
  
  const [selectedResult, setSelectedResult] = useState<string>("");
  
  const { toast } = useToast();

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

  const handleStartDrill = () => {
    const sequence = generateRandomSequence();
    setAttempts([]);
    setCurrentShot(1);
    setIsActive(true);
    setBonusStreak(0);
    setShotSequence(sequence);
    setSelectedResult("");
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      attempts: [],
      currentShot: 1,
      isActive: true,
      bonusStreak: 0,
      shotSequence: sequence
    }));
  };

  const handleResetDrill = () => {
    handleStartDrill();
  };

  const handleRecordShot = () => {
    if (!selectedResult) {
      toast({
        title: "Missing Selection",
        description: "Please select the shot result",
        variant: "destructive",
      });
      return;
    }

    const currentShotStructure = shotSequence[currentShot - 1];
    const result = selectedResult as 'fairway' | 'miss-left' | 'miss-right';
    
    let basePoints = 0;
    if (result === 'fairway') {
      basePoints = currentShotStructure.fairwayPoints;
    } else if (result === 'miss-left') {
      basePoints = currentShotStructure.missLeftPoints;
    } else if (result === 'miss-right') {
      basePoints = currentShotStructure.missRightPoints;
    }

    let newBonusStreak = bonusStreak;
    let bonusPoints = 0;

    if (result === 'fairway') {
      newBonusStreak++;
      if (newBonusStreak > 3) {
        bonusPoints = 1;
      }
    } else {
      newBonusStreak = 0;
    }

    const attempt: Attempt = {
      shotNumber: currentShot,
      result,
      points: basePoints,
      bonusPoints,
      shotStructure: currentShotStructure,
    };

    const newAttempts = [...attempts, attempt];
    setAttempts(newAttempts);
    setBonusStreak(newBonusStreak);

    if (currentShot === 14) {
      setIsActive(false);
      handleSaveScore(newAttempts);
    } else {
      setCurrentShot(currentShot + 1);
      setSelectedResult("");
    }
  };

  const handleSaveScore = async (finalAttempts: Attempt[]) => {
    if (!userId) {
      toast({
        title: "Not signed in",
        description: "Please sign in to save your score",
        variant: "destructive",
      });
      return;
    }

    if (finalAttempts.length === 0) {
      toast({
        title: "No data",
        description: "Complete at least one shot to save",
        variant: "destructive",
      });
      return;
    }

    try {
      const { data: drillData, error: drillError } = await supabase
        .rpc('get_or_create_drill_by_title', { p_title: 'Driver Control' });

      if (drillError) throw drillError;

      const totalScore = finalAttempts.reduce((sum, a) => sum + a.points + a.bonusPoints, 0);

      const { error: insertError } = await supabase
        .from('drill_results')
        .insert([{
          drill_id: drillData,
          user_id: userId,
          total_points: totalScore,
          attempts_json: finalAttempts as any,
        }]);

      if (insertError) throw insertError;

      toast({
        title: "Score saved!",
        description: `Your score of ${totalScore} points has been saved.`,
      });

      localStorage.removeItem(STORAGE_KEY);
      setFinalScore(totalScore);
      setShowCompletionDialog(true);
    } catch (error) {
      console.error('Error saving score:', error);
      toast({
        title: "Error",
        description: "Failed to save score. Please try again.",
        variant: "destructive",
      });
    }
  };

  const currentShotStructure = shotSequence[currentShot - 1];

  if (!isActive || !currentShotStructure) {
    return null;
  }

  return (
    <div className="w-full max-w-2xl mx-auto space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Target className="h-6 w-6" />
              Shot {currentShot} of 14
            </span>
            <span className="text-xl font-bold">{totalPoints} pts</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {bonusStreak === 2 && (
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
              <p className="text-sm font-semibold text-amber-600">
                ⚡ One more fairway to start the bonus!
              </p>
            </div>
          )}
          {bonusStreak >= 3 && (
            <div className="bg-primary text-primary-foreground border border-primary/20 rounded-lg p-3">
              <p className="text-sm font-semibold text-primary flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Bonus Active! {bonusStreak} consecutive fairways
              </p>
            </div>
          )}

          <div className="space-y-4">
            <div className="bg-muted/50 p-4 rounded-lg space-y-2">
              <h3 className="font-semibold text-sm">Shot {currentShot} Point Structure:</h3>
              <div className="grid grid-cols-3 gap-2 text-sm">
                <div className="text-center p-2 bg-background rounded">
                  <div className="font-semibold">Miss Left</div>
                  <div className="text-lg">{currentShotStructure?.missLeftPoints}</div>
                </div>
                <div className="text-center p-2 bg-primary text-primary-foreground rounded">
                  <div className="font-semibold">Fairway</div>
                  <div className="text-lg text-primary">+{currentShotStructure?.fairwayPoints}</div>
                </div>
                <div className="text-center p-2 bg-background rounded">
                  <div className="font-semibold">Miss Right</div>
                  <div className="text-lg">{currentShotStructure?.missRightPoints}</div>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <Label className="text-base font-semibold">Record Your Shot:</Label>
              <RadioGroup value={selectedResult} onValueChange={setSelectedResult}>
                <div className="flex items-center space-x-2 p-3 rounded-lg border hover:bg-muted/50">
                  <RadioGroupItem value="miss-left" id="miss-left" />
                  <Label htmlFor="miss-left" className="flex-1 cursor-pointer">
                    Miss Left ({currentShotStructure?.missLeftPoints} pts)
                  </Label>
                </div>
                <div className="flex items-center space-x-2 p-3 rounded-lg border hover:bg-muted/50 border-primary">
                  <RadioGroupItem value="fairway" id="fairway" />
                  <Label htmlFor="fairway" className="flex-1 cursor-pointer font-semibold">
                    Fairway Hit (+{currentShotStructure?.fairwayPoints} pt{bonusStreak >= 3 ? ' + 1 bonus' : ''})
                  </Label>
                </div>
                <div className="flex items-center space-x-2 p-3 rounded-lg border hover:bg-muted/50">
                  <RadioGroupItem value="miss-right" id="miss-right" />
                  <Label htmlFor="miss-right" className="flex-1 cursor-pointer">
                    Miss Right ({currentShotStructure?.missRightPoints} pts)
                  </Label>
                </div>
              </RadioGroup>
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={handleRecordShot} className="flex-1" size="lg">
              Next Shot
            </Button>
            <Button onClick={handleResetDrill} variant="outline" size="lg">
              Reset Drill
            </Button>
          </div>
        </CardContent>
      </Card>

      {attempts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Shot History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {attempts.map((attempt) => (
                <div key={attempt.shotNumber} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                  <div className="flex items-center gap-3">
                    <span className="font-semibold">Shot {attempt.shotNumber}</span>
                    <span className="text-sm text-muted-foreground capitalize">
                      {attempt.result.replace('-', ' ')}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={attempt.points >= 0 ? 'text-primary font-semibold' : 'text-destructive font-semibold'}>
                      {attempt.points >= 0 ? '+' : ''}{attempt.points}
                    </span>
                    {attempt.bonusPoints > 0 && (
                      <span className="text-xs bg-primary/20 text-primary px-2 py-1 rounded">
                        +{attempt.bonusPoints} bonus
                      </span>
                    )}
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
        drillTitle="Driver Control"
        score={finalScore}
        unit="points"
        onContinue={() => {
          onScoreSaved?.();
        }}
      />
    </div>
  );
};

export default DriverControlComponent;
