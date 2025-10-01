import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Target } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface AggressivePuttingComponentProps {
  onTabChange: (tab: string) => void;
  onScoreSaved?: () => void;
}

interface Attempt {
  distance: number;
  holed: boolean;
  withinOne: boolean;
  points: number;
}

const distances = [4, 5, 6]; // meters

const AggressivePuttingComponent = ({ onTabChange, onScoreSaved }: AggressivePuttingComponentProps) => {
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [currentDistance, setCurrentDistance] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUserId(user?.id || null);
    });
  }, []);

  const totalPoints = attempts.reduce((sum, attempt) => sum + attempt.points, 0);
  const currentDistanceValue = distances[currentDistance % distances.length];

  const handleStartDrill = () => {
    setIsActive(true);
    setAttempts([]);
    setCurrentDistance(0);
    onTabChange('score');
  };

  const addAttempt = (holed: boolean, withinOne: boolean = false) => {
    let points = 0;
    if (holed) points = 3;
    else if (withinOne) points = 1;

    const newAttempt: Attempt = {
      distance: currentDistanceValue,
      holed,
      withinOne: !holed && withinOne,
      points,
    };

    setAttempts(prev => [...prev, newAttempt]);
    setCurrentDistance(prev => prev + 1);

    if (totalPoints + points >= 15) {
      // Drill completed
      handleSaveScore(totalPoints + points);
    }
  };

  const handleSaveScore = async (finalScore: number) => {
    if (!userId) {
      toast({
        title: "Sign in required",
        description: "Please sign in to save your score.",
        variant: "destructive",
      });
      setIsActive(false);
      return;
    }

    try {
      // Get drill UUID from title
      const { data: drillData, error: drillError } = await supabase
        .from('drills')
        .select('id')
        .eq('title', 'Aggressive Putting')
        .single();

      if (drillError || !drillData) {
        console.error('Drill not found:', drillError);
        toast({
          title: "Error",
          description: "Could not save score.",
          variant: "destructive",
        });
        setIsActive(false);
        return;
      }

      // Save drill result to Supabase
      const { error: saveError } = await (supabase as any)
        .from('drill_results')
        .insert({
          drill_id: drillData.id,
          user_id: userId,
          total_points: finalScore,
          attempts_json: attempts
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
        description: `You reached 15 points in ${attempts.length + 1} attempts`,
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
    setCurrentDistance(0);
  };

  return (
    <div className="space-y-6">
      {/* Instructions Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="text-primary" size={20} />
            Instructions
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            Putt from distances of 4m, 5m, and 6m in that order, repeating the cycle. 
            Score 3 points for holed putts, 1 point for putts finishing within 1m. 
            Reach 15 points as quickly as possible.
          </p>
          
          <div className="p-3 bg-muted/50 rounded-md">
            <h4 className="font-medium mb-2">Scoring:</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Holed putt: <span className="font-medium text-foreground">3 points</span></li>
              <li>• Within 1m: <span className="font-medium text-foreground">1 point</span></li>
              <li>• Miss: <span className="font-medium text-foreground">0 points</span></li>
            </ul>
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
            <CardTitle>Current Attempt</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center">
              <div className="text-3xl font-bold text-primary">{currentDistanceValue}m</div>
              <div className="text-muted-foreground">Attempt #{attempts.length + 1}</div>
            </div>
            
            <div className="text-center">
              <div className="text-lg font-medium">Current Score: {totalPoints}/15</div>
            </div>
            
            <div className="grid grid-cols-3 gap-2">
              <Button 
                onClick={() => addAttempt(true)}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                Holed
                <br />
                <span className="text-xs">(3 pts)</span>
              </Button>
              <Button 
                onClick={() => addAttempt(false, true)}
                className="bg-yellow-600 hover:bg-yellow-700 text-white"
              >
                Within 1m
                <br />
                <span className="text-xs">(1 pt)</span>
              </Button>
              <Button 
                onClick={() => addAttempt(false, false)}
                variant="secondary"
              >
                Miss
                <br />
                <span className="text-xs">(0 pts)</span>
              </Button>
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

      {/* Attempts History */}
      {attempts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Attempt History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {attempts.map((attempt, index) => (
                <div key={index} className="flex justify-between items-center p-2 rounded-md bg-muted/50">
                  <span className="text-sm">#{index + 1} - {attempt.distance}m</span>
                  <span className={`text-sm font-medium ${
                    attempt.holed ? 'text-green-600' : 
                    attempt.withinOne ? 'text-yellow-600' : 
                    'text-muted-foreground'
                  }`}>
                    {attempt.holed ? 'Holed' : attempt.withinOne ? 'Within 1m' : 'Miss'} 
                    ({attempt.points} pts)
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default AggressivePuttingComponent;