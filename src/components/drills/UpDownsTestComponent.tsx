import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Target, ChevronLeft, ChevronRight } from "lucide-react";
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
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userId, setUserId] = useState<string | null>(null);
  const [drillStarted, setDrillStarted] = useState(false);
  const [showCompletionDialog, setShowCompletionDialog] = useState(false);
  const [finalScore, setFinalScore] = useState(0);
  const [savedResultId, setSavedResultId] = useState<string | null>(null);
  const isSavingRef = useRef(false);
  const { toast } = useToast();

  const initializeStations = () => {
    const baseStations = [
      { lie: 'Bunker', distance: 10 },
      { lie: 'Bunker', distance: 10 },
      { lie: 'Bunker', distance: 20 },
      { lie: 'Bunker', distance: 20 },
      { lie: 'Rough', distance: 10 },
      { lie: 'Rough', distance: 10 },
      { lie: 'Rough', distance: 20 },
      { lie: 'Rough', distance: 20 },
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

    const shuffled = [...baseStations].sort(() => Math.random() - 0.5);
    
    return shuffled.map(station => ({
      ...station,
      shots: null,
    }));
  };

  const startDrill = () => {
    localStorage.removeItem(STORAGE_KEY);
    const newStations = initializeStations();
    setStations(newStations);
    setCurrentIndex(0);
    setDrillStarted(true);
    setShowCompletionDialog(false);
    setSavedResultId(null);
    setFinalScore(0);
    isSavingRef.current = false;
  };

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const state = JSON.parse(saved);
        setStations(state.stations || []);
        setCurrentIndex(state.currentIndex || 0);
        setDrillStarted(state.drillStarted || false);
      } catch (e) {
        console.error('Failed to restore drill state:', e);
        startDrill();
      }
    } else {
      startDrill();
    }
  }, []);

  useEffect(() => {
    if (stations.length > 0 && drillStarted) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        stations,
        currentIndex,
        drillStarted
      }));
    }
  }, [stations, currentIndex, drillStarted]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUserId(user?.id || null);
    });
  }, []);

  // Computed values
  const isComplete = drillStarted && stations.every(s => s.shots !== null);
  const totalShots = stations.reduce((sum, s) => sum + (s.shots || 0), 0);
  const upAndDowns = stations.filter(s => s.shots !== null && s.shots <= 2).length;
  const currentStation = stations[currentIndex];
  const canGoBack = currentIndex > 0;
  const canGoForward = currentIndex < 17 && currentStation?.shots !== null;

  const saveScore = async (): Promise<void> => {
    if (!userId) {
      toast({
        title: "Please sign in",
        description: "You need to be signed in to save your score.",
        variant: "destructive",
      });
      return;
    }

    const scoreToSave = totalShots;

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

      const { data: insertedResult, error: resultError } = await (supabase as any)
        .from('drill_results')
        .insert({
          drill_id: drillId,
          user_id: userId,
          total_points: scoreToSave,
          attempts_json: stations,
        })
        .select('id')
        .single();

      if (resultError) throw resultError;

      toast({
        title: "Score saved!",
        description: `${scoreToSave} total shots recorded.`,
      });

      setFinalScore(scoreToSave);
      setSavedResultId(insertedResult?.id || null);
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

  // Auto-save when drill is completed
  useEffect(() => {
    if (isComplete && userId && !showCompletionDialog && !savedResultId && drillStarted && totalShots > 0 && !isSavingRef.current) {
      isSavingRef.current = true;
      saveScore().finally(() => {
        isSavingRef.current = false;
      });
    }
  }, [isComplete, userId, showCompletionDialog, savedResultId, drillStarted, totalShots]);

  const submitScore = (score: number) => {
    const updatedStations = [...stations];
    updatedStations[currentIndex].shots = score;
    setStations(updatedStations);

    // Check if all 18 are complete
    const allComplete = updatedStations.every(s => s.shots !== null);
    if (allComplete) {
      // Drill complete - show summary
    } else if (currentIndex < stations.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const handleBack = () => {
    if (canGoBack) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const handleForward = () => {
    if (canGoForward) {
      setCurrentIndex(currentIndex + 1);
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
            <div className="bg-muted rounded-lg p-4 text-center">
              <p className="text-sm text-muted-foreground mb-1">Up & Downs</p>
              <p className="text-3xl font-bold text-foreground">{upAndDowns}/18</p>
            </div>
            <div className="bg-muted rounded-lg p-4 text-center">
              <p className="text-sm text-muted-foreground mb-1">Total Shots</p>
              <p className="text-3xl font-bold text-primary">{totalShots}</p>
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="font-semibold text-sm">All Stations:</h3>
            <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto">
              {stations.map((station, idx) => (
                <div 
                  key={idx} 
                  className="bg-muted/50 rounded p-2 text-sm flex justify-between items-center cursor-pointer hover:bg-muted"
                  onClick={() => setCurrentIndex(idx)}
                >
                  <span className="flex items-center gap-2">
                    <span className="text-muted-foreground">{idx + 1}.</span>
                    <span>
                      {station.lie} {station.distance} meters
                    </span>
                  </span>
                  <span className={station.shots !== null && station.shots <= 2 ? "text-primary font-semibold" : ""}>
                    {station.shots}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <Button onClick={startDrill} variant="outline" className="w-full">
            Start New Drill
          </Button>
        </CardContent>

        <DrillCompletionDialog
          open={showCompletionDialog}
          onOpenChange={setShowCompletionDialog}
          drillTitle="18 Up & Downs"
          score={finalScore}
          unit="shots"
          onContinue={() => {
            onScoreSaved?.();
          }}
        />
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Station {currentIndex + 1} of 18</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Navigation Arrows */}
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              size="icon"
              onClick={handleBack}
              disabled={!canGoBack}
              className="h-10 w-10"
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <span className="text-sm text-muted-foreground">
              {currentIndex + 1} / 18
            </span>
            <Button
              variant="outline"
              size="icon"
              onClick={handleForward}
              disabled={!canGoForward}
              className="h-10 w-10"
            >
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>

          <div className="text-center">
            <div className="text-lg font-medium">
              Total: {totalShots} shots
            </div>
          </div>

          <div className="p-3 bg-muted/50 rounded-md text-center">
            <div className="text-sm text-muted-foreground">Current Station</div>
            <div className="text-2xl font-bold text-foreground">
              {currentStation?.lie} {currentStation?.distance} meters
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-sm font-medium text-center mb-3">How many shots to hole out?</div>
            <div className="grid grid-cols-5 gap-2">
              {[1, 2, 3, 4, 5].map((num) => (
                <Button
                  key={num}
                  onClick={() => submitScore(num)}
                  className={`h-16 text-lg font-semibold bg-primary hover:bg-primary/90 text-primary-foreground ${
                    currentStation?.shots === num ? 'ring-2 ring-offset-2 ring-primary' : ''
                  }`}
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
      {stations.filter(s => s.shots !== null).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Station History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {stations
                .map((station, index) => ({ station, index }))
                .filter(({ station }) => station.shots !== null)
                .reverse()
                .map(({ station, index }) => (
                  <div 
                    key={index} 
                    className={`flex justify-between items-center p-2 rounded-md bg-muted/50 cursor-pointer hover:bg-muted/80 ${
                      currentIndex === index ? 'ring-2 ring-primary' : ''
                    }`}
                    onClick={() => setCurrentIndex(index)}
                  >
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">Station #{index + 1}</span>
                      <span className="text-xs text-muted-foreground">{station.lie} {station.distance} meters</span>
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
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      <DrillCompletionDialog
        open={showCompletionDialog}
        onOpenChange={setShowCompletionDialog}
        drillTitle="18 Up & Downs"
        score={finalScore}
        unit="shots"
        resultId={savedResultId || undefined}
        onContinue={() => {
          onScoreSaved?.();
        }}
      />
    </div>
  );
};

export default UpDownsTestComponent;
