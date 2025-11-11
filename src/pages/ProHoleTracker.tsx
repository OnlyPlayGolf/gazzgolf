import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { parsePuttingBaseline, parseLongGameBaseline, type LieType } from "@/utils/csvParser";
import { createStrokesGainedCalculator } from "@/utils/strokesGained";

interface Shot {
  type: 'tee' | 'approach' | 'putt';
  startDistance: number;
  startLie: LieType | 'green';
  holed: boolean;
  endDistance?: number;
  endLie?: LieType | 'green';
  strokesGained: number;
}

interface ProHoleData {
  par: number;
  shots: Shot[];
}

const ProHoleTracker = () => {
  const { roundId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [round, setRound] = useState<any>(null);
  const [currentHole, setCurrentHole] = useState(1);
  const [holeData, setHoleData] = useState<Record<number, ProHoleData>>({});
  const [loading, setLoading] = useState(true);
  const [sgCalculator, setSgCalculator] = useState<any>(null);
  
  // Current shot inputs
  const [par, setPar] = useState(4);
  const [shotType, setShotType] = useState<'tee' | 'approach' | 'putt'>('tee');
  const [startDistance, setStartDistance] = useState("");
  const [startLie, setStartLie] = useState<LieType | 'green'>('tee');
  const [holed, setHoled] = useState(false);
  const [endDistance, setEndDistance] = useState("");
  const [endLie, setEndLie] = useState<LieType | 'green' | ''>(''); // No preset

  useEffect(() => {
    loadBaselineData();
    fetchRound();
  }, [roundId]);

  // Reset holed state when end lie changes away from green
  useEffect(() => {
    if (endLie !== 'green') {
      setHoled(false);
    }
  }, [endLie]);

  // Auto-set shot type based on start lie
  useEffect(() => {
    if (startLie === 'tee') {
      setShotType('tee');
    } else if (startLie === 'green' as any) {
      setShotType('putt');
    } else {
      setShotType('approach');
    }
  }, [startLie]);

  // Auto-add shot when all fields are filled
  useEffect(() => {
    if (startDistance && endDistance && endLie && sgCalculator) {
      const start = parseFloat(startDistance);
      const end = parseFloat(endDistance);
      
      // Don't auto-add if we're putting (start on green) - need to select holed/missed
      if (startLie === 'green') {
        return;
      }
      
      if (!isNaN(start) && !isNaN(end)) {
        // Small delay to allow UI to update
        const timer = setTimeout(() => {
          addShot();
        }, 300);
        return () => clearTimeout(timer);
      }
    }
  }, [endLie, startDistance, endDistance]);

  const loadBaselineData = async () => {
    try {
      const [puttingTable, longgameTable] = await Promise.all([
        parsePuttingBaseline('/src/assets/putt_baseline.csv'),
        parseLongGameBaseline('/src/assets/shot_baseline.csv'),
      ]);
      const calculator = createStrokesGainedCalculator(puttingTable, longgameTable);
      setSgCalculator(calculator);
    } catch (error) {
      console.error('Error loading baseline data:', error);
      toast({
        title: "Error loading baseline data",
        description: "Using default calculations",
        variant: "destructive",
      });
      // Set loading to false even on error so the page can be used
      setLoading(false);
    }
  };

  const fetchRound = async () => {
    try {
      const { data: roundData, error: roundError } = await supabase
        .from("rounds")
        .select("*")
        .eq("id", roundId)
        .single();

      if (roundError) throw roundError;
      setRound(roundData);
    } catch (error: any) {
      toast({
        title: "Error loading round",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getCurrentHoleData = (): ProHoleData => {
    return holeData[currentHole] || { par, shots: [] };
  };

  const addShot = () => {
    if (!sgCalculator) {
      toast({ title: "Baseline data not loaded", variant: "destructive" });
      return;
    }

    const start = parseFloat(startDistance);
    
    // Validation: must select end lie
    if (!endLie) {
      toast({ title: "Select end lie", variant: "destructive" });
      return;
    }
    
    // Validation: if end lie is green, must specify holed/missed
    if (endLie === 'green' && !holed) {
      // For green, if not holed, need end distance for the miss
      const end = parseFloat(endDistance);
      if (isNaN(end)) {
        toast({ title: "For missed putts, enter the remaining distance", variant: "destructive" });
        return;
      }
    } else if (endLie !== 'green') {
      // For non-green shots, always need end distance
      const end = parseFloat(endDistance);
      if (isNaN(end)) {
        toast({ title: "Enter end distance", variant: "destructive" });
        return;
      }
    }
    
    if (isNaN(start)) {
      toast({ title: "Invalid start distance", variant: "destructive" });
      return;
    }

    const end = holed ? 0 : parseFloat(endDistance);

    const drillType = shotType === 'putt' ? 'putting' : 'longGame';
    const sg = sgCalculator.calculateStrokesGained(
      drillType,
      start,
      startLie,
      holed,
      holed ? 'green' : endLie as LieType | 'green',
      end
    );

    const newShot: Shot = {
      type: shotType,
      startDistance: start,
      startLie,
      holed,
      endDistance: holed ? undefined : end,
      endLie: holed ? undefined : (endLie as LieType | 'green'),
      strokesGained: sg,
    };

    const currentData = getCurrentHoleData();
    setHoleData({
      ...holeData,
      [currentHole]: {
        par,
        shots: [...currentData.shots, newShot],
      },
    });

    // Reset inputs and set next shot's start to this shot's end
    if (holed) {
      // Hole is complete, automatically finish
      setStartDistance("");
      setEndDistance("");
      setHoled(false);
      
      // Auto-finish hole after a short delay to allow state to update
      setTimeout(() => {
        finishHoleAfterUpdate([...currentData.shots, newShot]);
      }, 100);
    } else {
      setStartDistance(endDistance); // Next shot starts where this one ended
      setStartLie(endLie as LieType | 'green'); // Next shot starts from this lie
      setEndDistance("");
      setEndLie(''); // Reset end lie for next shot
      setHoled(false);
      
      // Auto-set next shot type
      if (endLie === 'green') {
        setShotType('putt');
      } else {
        setShotType('approach');
      }
    }
  };

  const finishHoleAfterUpdate = async (shots: Shot[]) => {
    const totalScore = shots.length;

    // Save to database with detailed shot data
    try {
      const { error } = await supabase.from("holes").upsert([
        {
          round_id: roundId!,
          hole_number: currentHole,
          par,
          score: totalScore,
          putts: shots.filter(s => s.type === 'putt').length,
          pro_shot_data: JSON.parse(JSON.stringify(shots)), // Store all shot details as JSON
        },
      ], { onConflict: "round_id,hole_number" });

      if (error) throw error;

      if (currentHole < round.holes_played) {
        setCurrentHole(currentHole + 1);
        setPar(4);
        setShotType('tee');
        setStartLie('tee');
      } else {
        navigate(`/rounds/${roundId}/pro-summary`);
      }
    } catch (error: any) {
      toast({
        title: "Error saving hole",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const finishHole = async () => {
    const data = getCurrentHoleData();
    
    if (data.shots.length === 0) {
      toast({ title: "Add at least one shot", variant: "destructive" });
      return;
    }

    const lastShot = data.shots[data.shots.length - 1];
    if (!lastShot.holed) {
      toast({ title: "Last shot must be holed", variant: "destructive" });
      return;
    }

    const totalScore = data.shots.length;

    // Save to database with detailed shot data
    try {
      const { error } = await supabase.from("holes").upsert([
        {
          round_id: roundId!,
          hole_number: currentHole,
          par: data.par,
          score: totalScore,
          putts: data.shots.filter(s => s.type === 'putt').length,
          pro_shot_data: JSON.parse(JSON.stringify(data.shots)), // Store all shot details as JSON
        },
      ], { onConflict: "round_id,hole_number" });

      if (error) throw error;

      if (currentHole < round.holes_played) {
        setCurrentHole(currentHole + 1);
        setPar(4);
        setShotType('tee');
        setStartLie('tee');
      } else {
        navigate(`/rounds/${roundId}/pro-summary`);
      }
    } catch (error: any) {
      toast({
        title: "Error saving hole",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const deleteLastShot = () => {
    const currentData = getCurrentHoleData();
    if (currentData.shots.length === 0) return;

    setHoleData({
      ...holeData,
      [currentHole]: {
        ...currentData,
        shots: currentData.shots.slice(0, -1),
      },
    });
  };

  if (loading) return <div className="p-4">Loading...</div>;

  const currentData = getCurrentHoleData();
  const totalSG = currentData.shots.reduce((sum, shot) => sum + shot.strokesGained, 0);

  return (
    <div className="pb-20 min-h-screen bg-background">
      <div className="sticky top-0 z-10 bg-background border-b">
        <div className="p-4">
          <div className="flex items-center justify-between mb-2">
            <Button variant="ghost" size="sm" onClick={() => navigate("/rounds")}>
              <ArrowLeft className="mr-2" size={18} />
              Exit
            </Button>
            <Badge variant="outline" className="text-lg px-3 py-1">
              Hole {currentHole} of {round?.holes_played}
            </Badge>
          </div>
          <div className="text-center">
            <h1 className="text-xl font-bold">{round?.course_name}</h1>
            <p className="text-sm text-muted-foreground">
              Par {par} • {currentData.shots.length} shots
            </p>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Par Selection */}
        <Card>
          <CardContent className="pt-6">
            <Label>Par</Label>
            <div className="flex gap-2 mt-2">
              {[3, 4, 5].map((p) => (
                <Button
                  key={p}
                  variant={par === p ? "default" : "outline"}
                  onClick={() => setPar(p)}
                  size="lg"
                  className="flex-1"
                >
                  {p}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Shot Entry */}
        <Card className="border-primary">
          <CardContent className="pt-6 space-y-4">
            {currentData.shots.length > 0 && (
              <div>
                <Label>Shot Type (auto)</Label>
                <div className="text-sm text-muted-foreground mt-2 p-2 bg-muted rounded">
                  {shotType.charAt(0).toUpperCase() + shotType.slice(1)} from {startLie}
                </div>
              </div>
            )}

            <div>
              <Label>Start Distance (m)</Label>
              <Input
                type="number"
                value={startDistance}
                onChange={(e) => setStartDistance(e.target.value)}
                placeholder="Enter distance in meters"
                className="mt-2"
              />
            </div>

            <div>
              <Label>End Distance (m)</Label>
              <Input
                type="number"
                value={endDistance}
                onChange={(e) => setEndDistance(e.target.value)}
                placeholder="Distance to hole"
                className="mt-2"
              />
            </div>

            <div>
              <Label>End Lie</Label>
              <div className="grid grid-cols-3 gap-2 mt-2">
                {(['green', 'fairway', 'rough', 'sand'] as const).map((lie) => (
                  <Button
                    key={lie}
                    variant={endLie === lie ? "default" : "outline"}
                    onClick={() => setEndLie(lie)}
                    size="sm"
                  >
                    {lie.charAt(0).toUpperCase() + lie.slice(1)}
                  </Button>
                ))}
              </div>
            </div>

            {startLie === 'green' && (
              <div>
                <Label>Result</Label>
                <div className="flex gap-2 mt-2">
                  <Button
                    variant={holed ? "default" : "outline"}
                    onClick={() => {
                      setHoled(true);
                      // Auto-add shot when holed
                      setTimeout(() => {
                        const start = parseFloat(startDistance);
                        if (!isNaN(start)) {
                          addShot();
                        }
                      }, 100);
                    }}
                    className="flex-1"
                  >
                    Holed
                  </Button>
                  <Button
                    variant={!holed ? "default" : "outline"}
                    onClick={() => {
                      setHoled(false);
                      // Auto-add shot when missed
                      setTimeout(() => {
                        const start = parseFloat(startDistance);
                        const end = parseFloat(endDistance);
                        if (!isNaN(start) && !isNaN(end)) {
                          addShot();
                        }
                      }, 100);
                    }}
                    className="flex-1"
                  >
                    Missed
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Shots List */}
        {currentData.shots.length > 0 && (
          <Card>
            <CardContent className="pt-6 space-y-2">
              <div className="flex justify-between items-center mb-2">
                <Label>Shots ({currentData.shots.length})</Label>
                <Button variant="ghost" size="sm" onClick={deleteLastShot}>
                  Delete Last
                </Button>
              </div>
              {currentData.shots.map((shot, idx) => (
                <div key={idx} className="p-3 border rounded-lg text-sm">
                  <div className="flex justify-between">
                    <span className="font-medium">
                      {shot.type.charAt(0).toUpperCase() + shot.type.slice(1)} • {shot.startDistance}m
                      {shot.holed && " • Holed"}
                    </span>
                  </div>
                  {!shot.holed && (
                    <div className="text-muted-foreground text-xs mt-1">
                      → {shot.endDistance}m ({shot.endLie})
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-background border-t p-4">
        <Button onClick={finishHole} size="lg" className="w-full">
          {currentHole < round?.holes_played ? (
            <>
              Finish Hole <ChevronRight size={20} className="ml-2" />
            </>
          ) : (
            "Complete Round"
          )}
        </Button>
      </div>
    </div>
  );
};

export default ProHoleTracker;
