import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Hammer, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

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
  const { toast } = useToast();

  // Load state from localStorage on mount
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
      }
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
          description: "All distances completed. Save your score below.",
        });
      }
    }
  };

  const handleReset = () => {
    localStorage.removeItem(STORAGE_KEY);
    setProgress([]);
    setCurrentDistanceIndex(0);
    setDrillStarted(false);
  };

  const totalShots = progress.reduce((sum, p) => sum + p.attempts.length, 0);
  const completedDistances = progress.filter(p => p.completed).length;
  const isCompleted = completedDistances === distances.length;

  const saveScore = async () => {
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

    try {
      const drillTitle = "Åberg's Wedge Ladder";
      
      const { data: drillData, error: drillError } = await supabase
        .rpc('get_or_create_drill_by_title', { p_title: drillTitle });

      if (drillError) throw drillError;

      const { error: insertError } = await supabase
        .from('drill_results')
        .insert([{
          drill_id: drillData,
          user_id: userId,
          total_points: totalShots,
          attempts_json: progress as any,
        }]);

      if (insertError) throw insertError;

      toast({
        title: "Score saved!",
        description: `Your score of ${totalShots} shots has been saved.`,
      });

      localStorage.removeItem(STORAGE_KEY);
      if (onScoreSaved) {
        onScoreSaved();
      }

      onTabChange?.('leaderboard');
    } catch (error: any) {
      toast({
        title: "Error saving score",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  if (!drillStarted) {
    return (
      <div className="p-4 space-y-6">
        <Card className="border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-primary">
              <Hammer size={24} />
              Wedges 60–120 m — Progression
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3 text-foreground">
              <p className="font-medium">Drill Overview:</p>
              <ul className="space-y-2 text-sm text-muted-foreground ml-4">
                <li>• 13 distances from 60-120 meters (5m increments)</li>
                <li>• Hit each distance within 3 meters to advance</li>
                <li>• If you miss, retry the same distance</li>
                <li>• Score is the total number of shots needed</li>
                <li>• Lower score is better</li>
              </ul>
            </div>

            <div className="space-y-2">
              <p className="font-medium text-foreground">Distances:</p>
              <div className="flex flex-wrap gap-2">
                {distances.map(d => (
                  <span key={d} className="px-2 py-1 bg-muted rounded text-sm">
                    {d}m
                  </span>
                ))}
              </div>
            </div>

            <Button 
              onClick={initializeDrill}
              className="w-full"
            >
              Start Drill
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 pb-24 space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Progress: {completedDistances}/{distances.length} distances</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Total shots: {totalShots}</p>
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

      {totalShots > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total Shots:</span>
              <span className="font-bold text-2xl">{totalShots}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Completed:</span>
              <span>{completedDistances}/{distances.length}</span>
            </div>
            
            {userId ? (
              <div className="space-y-2">
                <Button
                  onClick={saveScore}
                  className="w-full"
                  disabled={totalShots === 0}
                >
                  Save Score
                </Button>
                <Button
                  onClick={handleReset}
                  variant="outline"
                  className="w-full"
                >
                  Reset Drill
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-sm text-center text-muted-foreground">
                  Sign in to save your score
                </p>
                <Button
                  onClick={handleReset}
                  variant="outline"
                  className="w-full"
                >
                  Reset Drill
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default WedgesProgressionComponent;
