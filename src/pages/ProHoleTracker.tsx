import { useEffect, useState, useRef } from "react";
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

interface CourseHole {
  hole_number: number;
  par: number;
  white_distance: number | null;
  yellow_distance: number | null;
  blue_distance: number | null;
  red_distance: number | null;
  orange_distance: number | null;
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
  const [proRoundId, setProRoundId] = useState<string | null>(null);
  const [courseHoles, setCourseHoles] = useState<CourseHole[]>([]);
  const [teeSet, setTeeSet] = useState<string>("");
  
  // Current shot inputs
  const [par, setPar] = useState(4);
  const [shotType, setShotType] = useState<'tee' | 'approach' | 'putt'>('tee');
  const [startDistance, setStartDistance] = useState("");
  const [startLie, setStartLie] = useState<LieType | 'green'>('tee');
  const [holed, setHoled] = useState(false);
  const [endDistance, setEndDistance] = useState("");
  const [endLie, setEndLie] = useState<LieType | 'green' | ''>(''); // No preset
  
  // Ref for the 2-second auto-advance timer when user enters 0
  const zeroInputTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    loadBaselineData();
    fetchRound();
    fetchCourseData();
  }, [roundId]);

  // Ensure a Pro Stats round exists for this route and user
  useEffect(() => {
    if (!proRoundId) {
      ensureProRound();
    }
  }, [roundId, round]);

  // Set initial hole data when course holes are loaded
  useEffect(() => {
    if (courseHoles.length > 0 && teeSet) {
      const holePar = getHolePar(currentHole);
      const holeDistance = getHoleDistance(currentHole);
      setPar(holePar);
      if (holeDistance && !startDistance) {
        setStartDistance(String(holeDistance));
      }
    }
  }, [courseHoles, teeSet, currentHole]);

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
    // Clean up zero input timer on unmount or when dependencies change
    return () => {
      if (zeroInputTimerRef.current) {
        clearTimeout(zeroInputTimerRef.current);
        zeroInputTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (startDistance && endDistance && sgCalculator) {
      // Normalize decimal separator: replace comma with period
      const normalizedEnd = endDistance.replace(',', '.');
      const start = parseFloat(startDistance.replace(',', '.'));
      const end = parseFloat(normalizedEnd);
      
      // For putting (on green), auto-add for any valid end distance
      if (startLie === 'green') {
        if (!isNaN(start) && !isNaN(end)) {
          // If end distance is exactly 0 (user typed "0"), use 2-second delay
          if (normalizedEnd === '0') {
            // Clear any existing timer
            if (zeroInputTimerRef.current) {
              clearTimeout(zeroInputTimerRef.current);
            }
            // Start 2-second delay - if user doesn't continue typing, advance
            zeroInputTimerRef.current = setTimeout(() => {
              zeroInputTimerRef.current = null;
              addShot(); // addShot handles end=0 as holed
            }, 2000);
            return () => {
              if (zeroInputTimerRef.current) {
                clearTimeout(zeroInputTimerRef.current);
                zeroInputTimerRef.current = null;
              }
            };
          }
          
          // For non-zero values, use normal 300ms delay
          const timer = setTimeout(() => {
            if (end > 0) {
              setEndLie('green'); // Missed putts stay on green
            }
            addShot(); // addShot handles end=0 as holed
          }, 300);
          return () => clearTimeout(timer);
        }
        return;
      }
      
      // For non-putting shots, require endLie to be selected
      if (!endLie) return;
      
      if (!isNaN(start) && !isNaN(end)) {
        // If end distance is exactly 0 (user typed "0"), use 2-second delay
        if (normalizedEnd === '0') {
          // Clear any existing timer
          if (zeroInputTimerRef.current) {
            clearTimeout(zeroInputTimerRef.current);
          }
          // Start 2-second delay
          zeroInputTimerRef.current = setTimeout(() => {
            zeroInputTimerRef.current = null;
            addShot();
          }, 2000);
          return () => {
            if (zeroInputTimerRef.current) {
              clearTimeout(zeroInputTimerRef.current);
              zeroInputTimerRef.current = null;
            }
          };
        }
        
        // Small delay to allow UI to update for non-zero values
        const timer = setTimeout(() => {
          addShot();
        }, 300);
        return () => clearTimeout(timer);
      }
    }
  }, [endLie, startDistance, endDistance, startLie]);

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

  const ensureProRound = async (): Promise<string | null> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    // Try to find existing pro stats round mapped to this external round id
    const { data: existing } = await supabase
      .from('pro_stats_rounds')
      .select('id')
      .eq('user_id', user.id)
      .eq('external_round_id', roundId!)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing?.id) {
      setProRoundId(existing.id);
      return existing.id;
    }

    // Create one only if it doesn't exist
    const { data: created, error: createErr } = await supabase
      .from('pro_stats_rounds')
      .insert([{ user_id: user.id, external_round_id: roundId, course_name: round?.course_name ?? null, holes_played: round?.holes_played ?? 18 }])
      .select('id')
      .single();

    if (createErr) {
      // Check if it's a duplicate key error - if so, fetch it instead
      if (createErr.code === '23505') {
        const { data: refetch } = await supabase
          .from('pro_stats_rounds')
          .select('id')
          .eq('user_id', user.id)
          .eq('external_round_id', roundId!)
          .single();
        
        if (refetch?.id) {
          setProRoundId(refetch.id);
          return refetch.id;
        }
      }
      console.error('ensureProRound error', createErr);
      toast({ title: 'Error preparing stats round', variant: 'destructive' });
      return null;
    }

    setProRoundId(created.id);
    return created.id;
  };

  const fetchRound = async () => {
    try {
      const { data: roundData, error: roundError } = await supabase
        .from("rounds")
        .select("*")
        .eq("id", roundId)
        .maybeSingle();

      if (roundError) throw roundError;
      setRound(roundData);
      
      // Get tee set from sessionStorage or round data
      const storedTeeSet = sessionStorage.getItem('proStatsTeeSet');
      setTeeSet(storedTeeSet || roundData?.tee_set || 'White');
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

  const fetchCourseData = async () => {
    const courseId = sessionStorage.getItem('proStatsCourseId');
    if (!courseId) return;

    const { data, error } = await supabase
      .from("course_holes")
      .select("hole_number, par, white_distance, yellow_distance, blue_distance, red_distance, orange_distance")
      .eq("course_id", courseId)
      .order("hole_number");

    if (!error && data) {
      setCourseHoles(data);
    }
  };

  const getHoleDistance = (holeNumber: number): number | null => {
    const hole = courseHoles.find(h => h.hole_number === holeNumber);
    if (!hole) return null;

    const teeKey = teeSet.toLowerCase();
    switch (teeKey) {
      case 'white': return hole.white_distance;
      case 'yellow': return hole.yellow_distance;
      case 'blue': return hole.blue_distance;
      case 'red': return hole.red_distance;
      case 'orange': return hole.orange_distance;
      default: return hole.white_distance;
    }
  };

  const getHolePar = (holeNumber: number): number => {
    const hole = courseHoles.find(h => h.hole_number === holeNumber);
    return hole?.par || 4;
  };

  const getCurrentHoleData = (): ProHoleData => {
    return holeData[currentHole] || { par, shots: [] };
  };

  const addShot = () => {
    if (!sgCalculator) {
      toast({ title: "Baseline data not loaded", variant: "destructive" });
      return;
    }

    // Normalize decimal separators (accept both . and ,)
    const normalizedStartDistance = startDistance.replace(',', '.');
    const normalizedEndDistance = endDistance.replace(',', '.');
    
    const start = parseFloat(normalizedStartDistance);
    
    if (isNaN(start)) {
      toast({ title: "Invalid start distance", variant: "destructive" });
      return;
    }

    // If holed, we don't need end distance or end lie
    if (holed) {
      const drillType = shotType === 'putt' ? 'putting' : 'longGame';
      const sg = sgCalculator.calculateStrokesGained(
        drillType,
        start,
        startLie,
        true,
        'green',
        0
      );

      const newShot: Shot = {
        type: shotType,
        startDistance: start,
        startLie,
        holed: true,
        endDistance: undefined,
        endLie: undefined,
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

      // Reset and auto-finish hole
      setStartDistance("");
      setEndDistance("");
      setHoled(false);
      
      setTimeout(() => {
        finishHoleAfterUpdate([...currentData.shots, newShot]);
      }, 100);
      return;
    }
    
    // Validate end distance (using normalized value)
    const end = parseFloat(normalizedEndDistance);
    if (isNaN(end)) {
      toast({ title: "Enter end distance", variant: "destructive" });
      return;
    }

    // If end distance is 0, treat as holed shot
    if (end === 0) {
      const drillType = shotType === 'putt' ? 'putting' : 'longGame';
      const sg = sgCalculator.calculateStrokesGained(
        drillType,
        start,
        startLie,
        true,
        'green',
        0
      );

      const newShot: Shot = {
        type: shotType,
        startDistance: start,
        startLie,
        holed: true,
        endDistance: undefined,
        endLie: undefined,
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

      // Reset and auto-finish hole
      setStartDistance("");
      setEndDistance("");
      setHoled(false);
      
      setTimeout(() => {
        finishHoleAfterUpdate([...currentData.shots, newShot]);
      }, 100);
      return;
    }
    
    // For non-holed shots, validate end lie
    if (!endLie) {
      toast({ title: "Select end lie", variant: "destructive" });
      return;
    }

    const drillType = shotType === 'putt' ? 'putting' : 'longGame';
    const sg = sgCalculator.calculateStrokesGained(
      drillType,
      start,
      startLie,
      false,
      endLie as LieType | 'green',
      end
    );

    const newShot: Shot = {
      type: shotType,
      startDistance: start,
      startLie,
      holed: false,
      endDistance: end,
      endLie: endLie as LieType | 'green',
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
  };

  // Explicit holed-shot adder to avoid end-lie validation on putts
  const addHoledShot = () => {
    if (!sgCalculator) {
      toast({ title: "Baseline data not loaded", variant: "destructive" });
      return;
    }
    const start = parseFloat(startDistance);
    if (isNaN(start)) {
      toast({ title: "Invalid start distance", variant: "destructive" });
      return;
    }

    const drillType = shotType === 'putt' ? 'putting' : 'longGame';
    const sg = sgCalculator.calculateStrokesGained(
      drillType,
      start,
      startLie,
      true,
      'green',
      0
    );

    const newShot: Shot = {
      type: shotType,
      startDistance: start,
      startLie,
      holed: true,
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

    setStartDistance("");
    setEndDistance("");
    setHoled(false);

    setTimeout(() => {
      finishHoleAfterUpdate([...currentData.shots, newShot]);
    }, 50);
  };

  const finishHoleAfterUpdate = async (shots: Shot[]) => {
    const totalScore = shots.length;

    // Save to database with detailed shot data
    try {
      // First verify the round exists and belongs to the user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: "Authentication required",
          description: "Please log in to save your round",
          variant: "destructive",
        });
        return;
      }

      // Proceed without owner-only check; RLS will validate membership/ownership on insert/update

      // Ensure pro stats round exists
      const prId = proRoundId || await ensureProRound();
      if (!prId) return;

      const { error } = await supabase.from("pro_stats_holes").upsert([
        {
          pro_round_id: prId,
          hole_number: currentHole,
          par,
          score: totalScore,
          putts: shots.filter(s => s.type === 'putt').length,
          pro_shot_data: JSON.parse(JSON.stringify(shots)),
        },
      ], { onConflict: "pro_round_id,hole_number" });

      if (error) {
        console.error("Hole save error:", error);
        throw error;
      }

      if (currentHole < round.holes_played) {
        const nextHole = currentHole + 1;
        setCurrentHole(nextHole);
        setPar(getHolePar(nextHole));
        setShotType('tee');
        setStartLie('tee');
        const nextDistance = getHoleDistance(nextHole);
        setStartDistance(nextDistance ? String(nextDistance) : "");
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
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({ title: "Authentication required", description: "Please log in", variant: "destructive" });
        return;
      }

      // Ensure pro stats round exists
      const prId = proRoundId || await ensureProRound();
      if (!prId) return;

      const { error } = await supabase.from("pro_stats_holes").upsert([
        {
          pro_round_id: prId,
          hole_number: currentHole,
          par: data.par,
          score: totalScore,
          putts: data.shots.filter(s => s.type === 'putt').length,
          pro_shot_data: JSON.parse(JSON.stringify(data.shots)),
        },
      ], { onConflict: "pro_round_id,hole_number" });

      if (error) throw error;

      if (currentHole < round.holes_played) {
        const nextHole = currentHole + 1;
        setCurrentHole(nextHole);
        setPar(getHolePar(nextHole));
        setShotType('tee');
        setStartLie('tee');
        const nextDistance = getHoleDistance(nextHole);
        setStartDistance(nextDistance ? String(nextDistance) : "");
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
            <Button variant="ghost" size="sm" onClick={() => navigate(`/rounds/${roundId}/pro-summary`)}>
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
              Hole {currentHole} • Par {par}
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
            <div className="text-center">
              <span className="text-lg font-semibold">Shot {currentData.shots.length + 1}</span>
            </div>

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
                {(startLie === 'green' 
                  ? ['green'] as const
                  : ['green', 'fairway', 'rough', 'sand'] as const
                ).map((lie) => (
                  <Button
                    key={lie}
                    variant={endLie === lie ? "default" : "outline"}
                    onClick={() => setEndLie(lie)}
                    size="sm"
                  >
                    {lie.charAt(0).toUpperCase() + lie.slice(1)}
                  </Button>
                ))}
                <Button
                  variant="outline"
                  onClick={() => {
                    setHoled(true);
                    setTimeout(() => {
                      addHoledShot();
                    }, 50);
                  }}
                  size="sm"
                >
                  Holed
                </Button>
              </div>
            </div>
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
              {[...currentData.shots].reverse().map((shot, idx) => (
                <div key={currentData.shots.length - 1 - idx} className="p-3 border rounded-lg text-sm">
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
        <div className="flex gap-3">
          <Button 
            variant="outline" 
            size="lg" 
            className="flex-1"
            disabled={currentHole <= 1}
            onClick={() => {
              const prevHole = currentHole - 1;
              setCurrentHole(prevHole);
              setPar(getHolePar(prevHole));
              setShotType('tee');
              setStartLie('tee');
              const prevDistance = getHoleDistance(prevHole);
              setStartDistance(prevDistance ? String(prevDistance) : "");
              setEndDistance("");
              setEndLie('');
            }}
          >
            Previous Hole
          </Button>
          {currentHole < round?.holes_played ? (
            <Button onClick={finishHole} size="lg" className="flex-1">
              Next Hole <ChevronRight size={20} className="ml-2" />
            </Button>
          ) : (
            <Button onClick={finishHole} size="lg" className="flex-1">
              Finish Round
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProHoleTracker;
