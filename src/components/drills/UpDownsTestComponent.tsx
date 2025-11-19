import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Target } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

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

  // Load state from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const state = JSON.parse(saved);
        setStations(state.stations || []);
        setCurrentStationIndex(state.currentStationIndex || 0);
        setDrillStarted(state.drillStarted || false);
      } catch (e) {
        console.error('Failed to restore drill state:', e);
      }
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
    setDrillStarted(true);
  };

  const recordShots = (shots: number) => {
    const updatedStations = [...stations];
    updatedStations[currentStationIndex].shots = shots;
    setStations(updatedStations);

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

  if (!drillStarted) {
    return (
      <Card className="mx-auto max-w-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-6 w-6" />
            18 Up & Downs
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Complete 18 randomized short game stations testing your up and down ability from various lies and distances.
            </p>
            
            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <h3 className="font-semibold text-sm">Stations:</h3>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Bunker shots: 10m (×2), 20m (×2)</li>
                <li>• Rough chips: 10m (×2), 20m (×2)</li>
                <li>• Fairway chips: 10m (×2), 15m (×4), 20m (×2), 30m (×2)</li>
              </ul>
            </div>

            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <h3 className="font-semibold text-sm">Scoring:</h3>
              <p className="text-sm text-muted-foreground">
                Record how many shots it takes to hole out from each station. Your score is the total number of shots needed. Lower is better!
              </p>
            </div>

            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <h3 className="font-semibold text-sm">Note:</h3>
              <p className="text-sm text-muted-foreground">
                This drill can be done on the practice area or on the course (one station per hole).
              </p>
            </div>
          </div>

          <Button onClick={startDrill} className="w-full">
            Start Drill
          </Button>
        </CardContent>
      </Card>
    );
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
    <Card className="mx-auto max-w-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="h-6 w-6" />
          18 Up & Downs
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="bg-primary/10 rounded-lg p-4 text-center">
          <p className="text-sm text-muted-foreground mb-1">Station {currentStationIndex + 1} of 18</p>
          <p className="text-2xl font-bold">
            {currentStation.lie} - {currentStation.distance}m
          </p>
        </div>

        <div className="space-y-4">
          <p className="text-sm font-semibold">How many shots to hole out?</p>
          <RadioGroup onValueChange={(value) => recordShots(parseInt(value))}>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="1" id="1-shot" />
              <Label htmlFor="1-shot">1 shot (Up & Down!)</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="2" id="2-shots" />
              <Label htmlFor="2-shots">2 shots</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="3" id="3-shots" />
              <Label htmlFor="3-shots">3 shots</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="4" id="4-shots" />
              <Label htmlFor="4-shots">4+ shots</Label>
            </div>
          </RadioGroup>
        </div>

        <div className="bg-muted/50 rounded-lg p-3">
          <p className="text-sm text-muted-foreground">
            Completed: {currentStationIndex} / 18 stations
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default UpDownsTestComponent;
