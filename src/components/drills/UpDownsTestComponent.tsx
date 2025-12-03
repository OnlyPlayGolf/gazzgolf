import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Target } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { DrillCompletionDialog } from "@/components/DrillCompletionDialog";

interface UpDownsTestComponentProps {
  onTabChange?: (tab: string) => void;
  onScoreSaved?: () => void;
}

interface Station {
  lie: string;
  distance: number;
  shots: number | null;
}

const UpDownsTestComponent = ({ onTabChange, onScoreSaved }: UpDownsTestComponentProps) => {
  const STORAGE_KEY = '18-up-downs-test-state';
  const [stations, setStations] = useState<Station[]>([]);
  const [currentStationIndex, setCurrentStationIndex] = useState(0);
  const [userId, setUserId] = useState<string | null>(null);
  const [drillStarted, setDrillStarted] = useState(false);
  const [currentScore, setCurrentScore] = useState(0);
  const [showCompletionDialog, setShowCompletionDialog] = useState(false);
  const { toast } = useToast();

  // Initialize stations with randomized order
  const initializeStations = () => {
    const baseStations = [
      // Bunker shots (2 of each)
      { lie: 'Bunker', distance: 10 },
      { lie: 'Bunker', distance: 10 },
      { lie: 'Bunker', distance: 20 },
      { lie: 'Bunker', distance: 20 },
      // Rough chips (2 of each)
      { lie: 'Rough', distance: 10 },
      { lie: 'Rough', distance: 10 },
      { lie: 'Rough', distance: 20 },
      { lie: 'Rough', distance: 20 },
      // Fairway chips
      { lie: 'Fairway', distance: 10 },
      { lie: 'Fairway', distance: 10 },
      { lie: 'Fairway', distance: 15 },
      { lie: 'Fairway', distance: 15 },
      { lie: 'Fairway', distance: 15 },
      { lie: 'Fairway', distance: 15 },
      { lie: 'Fairway', distance: 20 },
      { lie: 'Fairway', distance: 20 },
      { lie: 'Fairway', distance: 30 },
      { lie: 'Fairway', distance: 30 },
    ];

    // Randomize the order
    const shuffled = [...baseStations].sort(() => Math.random() - 0.5);
    
    return shuffled.map(station => ({
      ...station,
      shots: null,
    }));
  };

  // Load state from localStorage on mount or auto-start
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const state = JSON.parse(saved);
        setStations(state.stations || []);
        setCurrentStationIndex(state.currentStationIndex || 0);
        setDrillStarted(state.drillStarted || false);
        setCurrentScore(0); // Always reset current score on load
      } catch (e) {
        console.error('Failed to restore drill state:', e);
        startDrill();
      }
    } else {
      startDrill();
    }
  }, []);

  // Save state to localStorage whenever it changes
  useEffect(() => {
    if (stations.length > 0 && drillStarted) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        stations,
        currentStationIndex,
        drillStarted
      }));
    }
  }, [stations, currentStationIndex, drillStarted]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUserId(user?.id || null);
    });
  }, []);

  const startDrill = () => {
    localStorage.removeItem(STORAGE_KEY);
    const newStations = initializeStations();
    setStations(newStations);
    setCurrentStationIndex(0);
    setCurrentScore(0);
    setDrillStarted(true);
  };

  const addToScore = (value: number) => {
    setCurrentScore(prev => prev + value);
  };

  const submitScore = (score?: number) => {
    const scoreToSubmit = score ?? currentScore;
    
    if (scoreToSubmit === 0) {
      toast({
        title: "Invalid score",
        description: "Please enter a score greater than 0",
        variant: "destructive",
      });
      return;
    }

    const updatedStations = [...stations];
    updatedStations[currentStationIndex].shots = scoreToSubmit;
    setStations(updatedStations);
    setCurrentScore(0);

    if (currentStationIndex < stations.length - 1) {
      setCurrentStationIndex(currentStationIndex + 1);
    }
  };

  const isComplete = drillStarted && stations.every(s => s.shots !== null);
  const totalShots = stations.reduce((sum, s) => sum + (s.shots || 0), 0);
  const upAndDowns = stations.filter(s => s.shots === 1).length;

  const saveScore = async () => {
    if (!userId) {
      toast({
        title: "Please sign in",
        description: "You need to be signed in to save your score.",
        variant: "destructive",
      });
      return;
    }

    try {
      const { data: drillId, error: drillError } = await (supabase as any)
        .rpc('get_or_create_drill_by_title', { p_title: '18 Up & Downs' });

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
          total_points: totalShots,
          attempts_json: stations,
        });

      if (resultError) throw resultError;

      toast({
        title: "Score saved!",
        description: `${totalShots} total shots recorded.`,
      });

      localStorage.removeItem(STORAGE_KEY);
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

  if (!drillStarted) {
    return null;
  }

  if (isComplete) {
    return (
      <Card className="mx-auto max-w-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-6 w-6" />
            18 Up & Downs - Complete
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-primary/10 rounded-lg p-4 text-center">
              <p className="text-sm text-muted-foreground mb-1">Total Shots</p>
              <p className="text-3xl font-bold text-primary">{totalShots}</p>
            </div>
            <div className="bg-green-500/10 rounded-lg p-4 text-center">
              <p className="text-sm text-muted-foreground mb-1">Up & Downs</p>
              <p className="text-3xl font-bold text-green-600">{upAndDowns}/18</p>
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="font-semibold text-sm">All Stations:</h3>
            <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto">
              {stations.map((station, idx) => (
                <div 
                  key={idx} 
                  className="bg-muted/50 rounded p-2 text-sm flex justify-between items-center"
                >
                  <span>
                    {station.lie} {station.distance}m
                  </span>
                  <span className={station.shots === 1 ? "text-green-600 font-semibold" : ""}>
                    {station.shots} {station.shots === 1 ? 'shot' : 'shots'}
                  </span>
                </div>
              ))}
            </div>
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

          <Button onClick={startDrill} variant="outline" className="w-full">
            Start New Drill
          </Button>
        </CardContent>
      </Card>
    );
  }

  const currentStation = stations[currentStationIndex];

  return (
    <div className="space-y-6">
      {/* Active Drill */}
      <Card>
        <CardHeader>
          <CardTitle>Station {currentStationIndex + 1} of 18</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="p-3 bg-primary/10 rounded-md text-center">
            <div className="text-sm text-muted-foreground">Current Station</div>
            <div className="text-2xl font-bold text-primary">
              {currentStation.lie} - {currentStation.distance}m
            </div>
          </div>

          <div className="text-center">
            <div className="text-lg font-medium">
              Current Score: {currentScore || 0}
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-sm font-medium text-center mb-3">How many shots to hole out?</div>
            <div className="grid grid-cols-5 gap-2">
              {[1, 2, 3, 4, 5].map((num) => (
                <Button
                  key={num}
                  onClick={() => submitScore(num)}
                  className="h-16 text-lg font-semibold bg-primary hover:bg-primary/90 text-primary-foreground"
                >
                  {num}
                </Button>
              ))}
            </div>
          </div>

          <Button 
            onClick={startDrill}
            variant="outline"
            className="w-full"
          >
            Reset Drill
          </Button>
        </CardContent>
      </Card>

      {/* Station History */}
      {currentStationIndex > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Station History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {stations.slice(0, currentStationIndex).reverse().map((station, index) => {
                const actualIndex = currentStationIndex - 1 - index;
                return (
                  <div key={actualIndex} className="flex justify-between items-center p-2 rounded-md bg-muted/50">
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">Station #{actualIndex + 1}</span>
                      <span className="text-xs text-muted-foreground">{station.lie} - {station.distance}m</span>
                    </div>
                    <div className="text-right">
                      <span className={`text-sm font-medium ${
                        station.shots === 1 ? 'text-green-600' : 
                        station.shots === 2 ? 'text-blue-600' :
                        station.shots === 3 ? 'text-yellow-600' :
                        'text-muted-foreground'
                      }`}>
                        {station.shots} {station.shots === 1 ? 'shot' : 'shots'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      <DrillCompletionDialog
        open={showCompletionDialog}
        onOpenChange={setShowCompletionDialog}
        drillTitle="18 Up & Downs"
        score={totalShots}
        unit="shots"
        onContinue={() => {
          onScoreSaved?.();
        }}
      />
    </div>
  );
};

export default UpDownsTestComponent;
