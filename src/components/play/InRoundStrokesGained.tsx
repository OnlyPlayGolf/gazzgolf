import { useState, useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Check, ChevronDown, ChevronUp, Trash2 } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { parsePuttingBaseline, parseLongGameBaseline, type LieType } from "@/utils/csvParser";
import { createStrokesGainedCalculator } from "@/utils/strokesGained";

interface Shot {
  type: 'tee' | 'approach' | 'putt';
  startDistance: number;
  startLie: LieType | 'green';
  holed: boolean;
  endDistance?: number;
  endLie?: LieType | 'green' | 'OB';
  strokesGained: number;
  isOB?: boolean;
}

interface InRoundStrokesGainedProps {
  roundId: string;
  holeNumber: number;
  par: number;
  score: number;
  holeDistance?: number;
  onStatsSaved?: () => void;
}

export function InRoundStrokesGained({
  roundId,
  holeNumber,
  par,
  score,
  holeDistance,
  onStatsSaved,
}: InRoundStrokesGainedProps) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  
  // SG Calculator
  const [sgCalculator, setSgCalculator] = useState<any>(null);
  
  // Shot tracking
  const [shots, setShots] = useState<Shot[]>([]);
  
  // Current shot inputs
  const [shotType, setShotType] = useState<'tee' | 'approach' | 'putt'>('tee');
  const [startDistance, setStartDistance] = useState("");
  const [startLie, setStartLie] = useState<LieType | 'green'>('tee');
  const [endDistance, setEndDistance] = useState("");
  const [endLie, setEndLie] = useState<LieType | 'green' | 'OB' | ''>('');
  const [missedSide, setMissedSide] = useState<'left' | 'right' | ''>('');
  
  const autoAdvanceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Load baseline data on mount
  useEffect(() => {
    loadBaselineData();
  }, []);

  // Load existing stats when hole changes
  useEffect(() => {
    loadExistingStats();
    // Reset inputs for new hole
    setEndDistance("");
    setEndLie('');
    setMissedSide('');
    setSaved(false);
  }, [holeNumber, roundId]);

  // Set initial start distance from hole distance
  useEffect(() => {
    if (holeDistance && shots.length === 0 && !startDistance) {
      setStartDistance(String(holeDistance));
    }
  }, [holeDistance, shots.length, startDistance]);

  // Auto-set shot type based on start lie
  useEffect(() => {
    if (startLie === 'tee') {
      setShotType('tee');
    } else if (startLie === 'green') {
      setShotType('putt');
    } else {
      setShotType('approach');
    }
  }, [startLie]);

  // Reset holed when end lie changes
  useEffect(() => {
    if (endLie !== 'green') {
      // Clear missed side if not relevant
      if (endLie !== 'rough' && endLie !== 'sand' && endLie !== 'OB') {
        setMissedSide('');
      }
    }
  }, [endLie]);

  // Auto-advance when inputs are complete
  useEffect(() => {
    return () => {
      if (autoAdvanceTimerRef.current) {
        clearTimeout(autoAdvanceTimerRef.current);
        autoAdvanceTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (startDistance && endDistance && sgCalculator && endLie) {
      const normalizedEnd = endDistance.replace(',', '.');
      const start = parseFloat(startDistance.replace(',', '.'));
      const end = parseFloat(normalizedEnd);
      
      // For tee shots to rough/bunker/OB, require missed side
      if (startLie === 'tee' && (endLie === 'rough' || endLie === 'sand' || endLie === 'OB') && !missedSide) return;
      
      if (!isNaN(start) && !isNaN(end)) {
        // Clear any existing timer
        if (autoAdvanceTimerRef.current) {
          clearTimeout(autoAdvanceTimerRef.current);
        }
        
        // 1.5 second delay for auto-advance
        const delay = normalizedEnd === '0' ? 2000 : 1500;
        autoAdvanceTimerRef.current = setTimeout(() => {
          autoAdvanceTimerRef.current = null;
          addShot();
        }, delay);
        
        return () => {
          if (autoAdvanceTimerRef.current) {
            clearTimeout(autoAdvanceTimerRef.current);
            autoAdvanceTimerRef.current = null;
          }
        };
      }
    }
  }, [endLie, startDistance, endDistance, startLie, missedSide, sgCalculator]);

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
    }
  };

  const loadExistingStats = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: proRound } = await supabase
        .from('pro_stats_rounds')
        .select('id')
        .eq('external_round_id', roundId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (proRound) {
        const { data: existingHole } = await supabase
          .from('pro_stats_holes')
          .select('pro_shot_data, score')
          .eq('pro_round_id', proRound.id)
          .eq('hole_number', holeNumber)
          .maybeSingle();

        if (existingHole?.pro_shot_data && Array.isArray(existingHole.pro_shot_data)) {
          const loadedShots = existingHole.pro_shot_data as unknown as Shot[];
          setShots(loadedShots);
          setSaved(true);
          
          // Set up for next shot based on last shot
          const lastShot = loadedShots[loadedShots.length - 1];
          if (lastShot && !lastShot.holed) {
            if (lastShot.endDistance !== undefined) {
              setStartDistance(String(lastShot.endDistance));
            }
            if (lastShot.endLie && lastShot.endLie !== 'OB') {
              setStartLie(lastShot.endLie as LieType | 'green');
            }
          } else if (lastShot?.holed) {
            // Hole complete
            setStartDistance("");
            setEndDistance("");
            setStartLie('tee');
          }
        } else {
          // No existing data for this hole
          setShots([]);
          setStartDistance(holeDistance ? String(holeDistance) : "");
          setStartLie('tee');
        }
      } else {
        // No pro round yet
        setShots([]);
        setStartDistance(holeDistance ? String(holeDistance) : "");
        setStartLie('tee');
      }
    } catch (error) {
      console.error("Error loading existing stats:", error);
    }
  };

  const addShot = () => {
    if (!sgCalculator) {
      toast({ title: "Stats not ready", variant: "destructive" });
      return;
    }

    const start = parseFloat(startDistance.replace(',', '.'));
    const end = parseFloat(endDistance.replace(',', '.'));
    
    if (isNaN(start)) return;

    // Handle holed shot (end = 0)
    if (end === 0 || isNaN(end)) {
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

      const newShots = [...shots, newShot];
      setShots(newShots);
      saveShots(newShots);
      
      // Reset inputs
      setStartDistance("");
      setEndDistance("");
      setEndLie('');
      return;
    }

    if (!endLie) return;

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
      endLie: endLie as LieType | 'green' | 'OB',
      strokesGained: sg,
    };

    const newShots = [...shots, newShot];
    setShots(newShots);
    saveShots(newShots);

    // Set up for next shot
    setStartDistance(endDistance);
    setStartLie(endLie as LieType | 'green');
    setEndDistance("");
    setEndLie('');
    setMissedSide('');
  };

  const addHoledShot = () => {
    if (!sgCalculator) return;
    
    const start = parseFloat(startDistance.replace(',', '.'));
    if (isNaN(start)) {
      toast({ title: "Enter start distance", variant: "destructive" });
      return;
    }

    const drillType = shotType === 'putt' ? 'putting' : 'longGame';
    const sg = sgCalculator.calculateStrokesGained(drillType, start, startLie, true, 'green', 0);

    const newShot: Shot = {
      type: shotType,
      startDistance: start,
      startLie,
      holed: true,
      strokesGained: sg,
    };

    const newShots = [...shots, newShot];
    setShots(newShots);
    saveShots(newShots);

    setStartDistance("");
    setEndDistance("");
    setEndLie('');
  };

  const addOBShot = () => {
    if (!sgCalculator) return;
    
    const start = parseFloat(startDistance.replace(',', '.'));
    if (isNaN(start)) {
      toast({ title: "Enter start distance first", variant: "destructive" });
      return;
    }

    // OB shot + penalty stroke
    const obShot: Shot = {
      type: shotType,
      startDistance: start,
      startLie,
      holed: false,
      endDistance: start,
      endLie: 'OB',
      strokesGained: 0,
      isOB: true,
    };

    const penaltyShot: Shot = {
      type: shotType,
      startDistance: start,
      startLie,
      holed: false,
      endDistance: start,
      endLie: startLie,
      strokesGained: 0,
      isOB: false,
    };

    const newShots = [...shots, obShot, penaltyShot];
    setShots(newShots);
    saveShots(newShots);

    setEndDistance("");
    setEndLie('');
    setMissedSide('');
  };

  const deleteLastShot = () => {
    if (shots.length === 0) return;

    const newShots = shots.slice(0, -1);
    setShots(newShots);
    saveShots(newShots);

    // Reset inputs
    if (newShots.length === 0) {
      setStartDistance(holeDistance ? String(holeDistance) : "");
      setStartLie('tee');
    } else {
      const lastShot = newShots[newShots.length - 1];
      if (lastShot.endDistance !== undefined) {
        setStartDistance(String(lastShot.endDistance));
      }
      if (lastShot.endLie && lastShot.endLie !== 'OB') {
        setStartLie(lastShot.endLie as LieType | 'green');
      }
    }
    setEndDistance("");
    setEndLie('');
    setMissedSide('');
  };

  const saveShots = async (shotsToSave: Shot[]) => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Ensure pro_stats_round exists
      let proRoundId: string;
      const { data: existingRound } = await supabase
        .from('pro_stats_rounds')
        .select('id')
        .eq('external_round_id', roundId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (existingRound) {
        proRoundId = existingRound.id;
      } else {
        const { data: roundData } = await supabase
          .from('rounds')
          .select('course_name, holes_played')
          .eq('id', roundId)
          .single();

        const { data: newRound, error: createError } = await supabase
          .from('pro_stats_rounds')
          .insert({
            user_id: user.id,
            external_round_id: roundId,
            course_name: roundData?.course_name || null,
            holes_played: roundData?.holes_played || 18,
          })
          .select('id')
          .single();

        if (createError) throw createError;
        proRoundId = newRound.id;
      }

      // Count putts
      const putts = shotsToSave.filter(s => s.type === 'putt').length;
      const totalScore = shotsToSave.length;

      const { error: upsertError } = await supabase
        .from('pro_stats_holes')
        .upsert({
          pro_round_id: proRoundId,
          hole_number: holeNumber,
          par,
          score: totalScore,
          putts,
          pro_shot_data: JSON.parse(JSON.stringify(shotsToSave)),
        }, { onConflict: 'pro_round_id,hole_number' });

      if (upsertError) throw upsertError;

      setSaved(true);
      onStatsSaved?.();
    } catch (error: any) {
      console.error("Error saving shots:", error);
      toast({ title: "Error saving stats", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const isHoleComplete = shots.length > 0 && shots[shots.length - 1]?.holed;
  const totalSG = shots.reduce((sum, shot) => sum + shot.strokesGained, 0);

  return (
    <Card className="mt-4 border-primary/30">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <div className="cursor-pointer py-3 px-4 hover:bg-muted/50 transition-colors flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-medium">📊 Strokes Gained</span>
              {saved && (
                <Badge variant="secondary" className="text-xs">
                  <Check size={12} className="mr-1" /> Saved
                </Badge>
              )}
              {shots.length > 0 && (
                <Badge variant="outline" className="text-xs">
                  {shots.length} shots • SG: {totalSG >= 0 ? '+' : ''}{totalSG.toFixed(2)}
                </Badge>
              )}
            </div>
            {isOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </div>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <CardContent className="space-y-4 pt-0 pb-4">
            {!isHoleComplete && (
              <>
                {/* Current Shot Info */}
                <div className="flex justify-between items-center bg-muted/50 p-2 rounded">
                  <span className="text-sm font-medium">Shot {shots.length + 1}</span>
                  <span className="text-xs text-muted-foreground">
                    {shotType.charAt(0).toUpperCase() + shotType.slice(1)} from {startLie}
                  </span>
                </div>

                {/* Start Distance */}
                <div className="space-y-1">
                  <Label className="text-xs">Start Distance (m)</Label>
                  <Input
                    type="number"
                    inputMode="decimal"
                    value={startDistance}
                    onChange={(e) => setStartDistance(e.target.value)}
                    placeholder="Distance to hole"
                    className="h-9 text-center"
                  />
                </div>

                {/* End Distance */}
                <div className="space-y-1">
                  <Label className="text-xs">End Distance (m)</Label>
                  <Input
                    type="number"
                    inputMode="decimal"
                    value={endDistance}
                    onChange={(e) => setEndDistance(e.target.value)}
                    placeholder="Distance after shot"
                    className="h-9 text-center"
                  />
                </div>

                {/* End Lie */}
                <div className="space-y-1">
                  <Label className="text-xs">End Lie</Label>
                  <div className="grid grid-cols-3 gap-1">
                    {(['green', 'fairway', 'rough', 'sand'] as const).map((lie) => (
                      <Button
                        key={lie}
                        variant={endLie === lie ? "default" : "outline"}
                        onClick={() => setEndLie(lie)}
                        size="sm"
                        className="text-xs h-8"
                      >
                        {lie === 'sand' ? 'Bunker' : lie.charAt(0).toUpperCase() + lie.slice(1)}
                      </Button>
                    ))}
                    <Button
                      variant="outline"
                      onClick={addHoledShot}
                      size="sm"
                      className="text-xs h-8"
                    >
                      Holed
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => setEndLie('OB')}
                      size="sm"
                      className="text-xs h-8"
                    >
                      OB
                    </Button>
                  </div>
                </div>

                {/* Missed Side */}
                {startLie === 'tee' && (endLie === 'rough' || endLie === 'sand' || endLie === 'OB') && (
                  <div className="space-y-1">
                    <Label className="text-xs">Missed Side</Label>
                    <div className="flex gap-2">
                      <Button
                        variant={missedSide === 'left' ? "default" : "outline"}
                        onClick={() => {
                          setMissedSide('left');
                          if (endLie === 'OB') setTimeout(addOBShot, 50);
                        }}
                        size="sm"
                        className="flex-1 h-8"
                      >
                        Left
                      </Button>
                      <Button
                        variant={missedSide === 'right' ? "default" : "outline"}
                        onClick={() => {
                          setMissedSide('right');
                          if (endLie === 'OB') setTimeout(addOBShot, 50);
                        }}
                        size="sm"
                        className="flex-1 h-8"
                      >
                        Right
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Shots List */}
            {shots.length > 0 && (
              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <Label className="text-xs">Shots ({shots.length})</Label>
                  <Button variant="ghost" size="sm" onClick={deleteLastShot} className="h-6 text-xs">
                    <Trash2 size={12} className="mr-1" /> Delete Last
                  </Button>
                </div>
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {[...shots].reverse().map((shot, idx) => {
                    const shotNumber = shots.length - idx;
                    return (
                      <div key={shots.length - 1 - idx} className={`p-2 border rounded text-xs ${shot.isOB ? 'border-destructive bg-destructive/10' : ''}`}>
                        <div className="flex justify-between items-center">
                          <span>
                            <span className="font-medium mr-1">#{shotNumber}</span>
                            {shot.type} • {shot.startDistance}m
                            {shot.holed && " → Holed"}
                            {shot.isOB && " → OB"}
                          </span>
                          <span className={shot.strokesGained >= 0 ? 'text-green-600' : 'text-red-600'}>
                            {shot.strokesGained >= 0 ? '+' : ''}{shot.strokesGained.toFixed(2)}
                          </span>
                        </div>
                        {!shot.holed && !shot.isOB && (
                          <div className="text-muted-foreground ml-4">
                            → {shot.endDistance}m ({shot.endLie})
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {isHoleComplete && (
              <div className="text-center py-2 bg-green-50 dark:bg-green-900/20 rounded">
                <p className="text-sm font-medium text-green-700 dark:text-green-400">
                  ✓ Hole complete ({shots.length} shots)
                </p>
                <p className="text-xs text-muted-foreground">
                  Total SG: {totalSG >= 0 ? '+' : ''}{totalSG.toFixed(2)}
                </p>
              </div>
            )}

            {saving && (
              <p className="text-xs text-center text-muted-foreground">Saving...</p>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
