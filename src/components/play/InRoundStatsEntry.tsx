import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Check, ChevronDown, ChevronUp } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { InRoundStrokesGained } from "./InRoundStrokesGained";

export type StatsMode = 'none' | 'basic' | 'strokes_gained';

interface InRoundStatsEntryProps {
  statsMode: StatsMode;
  roundId: string;
  holeNumber: number;
  par: number;
  score: number;
  playerId: string;
  isCurrentUser: boolean;
  holeDistance?: number;
  onStatsSaved?: () => void;
  courseName?: string;
  holesPlayed?: number;
}

export function InRoundStatsEntry({
  statsMode,
  roundId,
  holeNumber,
  par,
  score,
  playerId,
  isCurrentUser,
  holeDistance,
  onStatsSaved,
  courseName,
  holesPlayed,
}: InRoundStatsEntryProps) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Simple local state - no parent control
  const [fairwayResult, setFairwayResult] = useState<'hit' | 'left' | 'right' | null>(null);
  const [chipBunkerShots, setChipBunkerShots] = useState("");
  const [putts, setPutts] = useState("");
  
  // Track if user has edited to prevent load from overwriting
  const hasUserEdited = useRef(false);
  
  // Track previous hole number to detect actual hole changes
  const prevHoleRef = useRef<number | null>(null);

  // Load existing stats when component mounts or hole changes
  useEffect(() => {
    // Only reset edit tracking when hole ACTUALLY changes (not on remounts)
    if (prevHoleRef.current !== null && prevHoleRef.current !== holeNumber) {
      hasUserEdited.current = false;
      setSaved(false);
      setFairwayResult(null);
      setChipBunkerShots("");
      setPutts("");
    }
    prevHoleRef.current = holeNumber;
    
    // Abort flag to ignore stale responses from previous effect runs
    let isStale = false;
    
    const loadExistingStats = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || isStale) return;

      // Find the pro_stats_round for this round
      const { data: proRound } = await supabase
        .from('pro_stats_rounds')
        .select('id')
        .eq('external_round_id', roundId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (!proRound || isStale) return;

      // Get the hole stats
      const { data: holeStats } = await supabase
        .from('pro_stats_holes')
        .select('putts, pro_shot_data')
        .eq('pro_round_id', proRound.id)
        .eq('hole_number', holeNumber)
        .maybeSingle();

      // Check stale flag, hasUserEdited, AND holeStats before setting state
      if (isStale || !holeStats || hasUserEdited.current) return;

      // Restore values from database
      const basicStats = (holeStats.pro_shot_data as any)?.basicStats;
      if (basicStats) {
        setFairwayResult(basicStats.fairwayResult || null);
        setChipBunkerShots(basicStats.chipBunkerShots?.toString() || "");
      }
      if (holeStats.putts !== null && holeStats.putts !== undefined) {
        setPutts(holeStats.putts.toString());
      }
      setSaved(true); // Mark as already saved since we loaded existing data
    };

    loadExistingStats();
    
    // Cleanup: mark this effect as stale if it re-runs
    return () => {
      isStale = true;
    };
  }, [roundId, holeNumber]);

  const calculateGIR = (holePar: number, holeScore: number, holePutts: number): boolean => {
    const strokesBeforePutting = holeScore - holePutts;
    const regulationStrokes = holePar - 2;
    return strokesBeforePutting <= regulationStrokes;
  };

  const saveBasicStats = async () => {
    const puttsNum = parseInt(putts);
    const chipBunkerNum = parseInt(chipBunkerShots) || 0;

    // Validate putts
    if (isNaN(puttsNum) || puttsNum < 0) {
      toast({ title: "Enter valid putts", variant: "destructive" });
      return;
    }

    if (puttsNum > score) {
      toast({ title: "Putts cannot exceed score", variant: "destructive" });
      return;
    }

    // For non-par-3 holes, require fairway selection
    if (par !== 3 && !fairwayResult) {
      toast({ title: "Select fairway result", variant: "destructive" });
      return;
    }

    setSaving(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({ title: "Not logged in", variant: "destructive" });
        return;
      }

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
        // Use passed course info or try to get from rounds table
        let courseNameToUse = courseName;
        let holesPlayedToUse = holesPlayed || 18;
        
        if (!courseNameToUse) {
          // Fallback: try to get from rounds table (for standard stroke play rounds)
          const { data: roundData } = await supabase
            .from('rounds')
            .select('course_name, holes_played')
            .eq('id', roundId)
            .maybeSingle();
          
          if (roundData) {
            courseNameToUse = roundData.course_name;
            holesPlayedToUse = roundData.holes_played || 18;
          }
        }

        const { data: newRound, error: createError } = await supabase
          .from('pro_stats_rounds')
          .insert({
            user_id: user.id,
            external_round_id: roundId,
            course_name: courseNameToUse || null,
            holes_played: holesPlayedToUse,
          })
          .select('id')
          .single();

        if (createError) throw createError;
        proRoundId = newRound.id;
      }

      // Save the hole stats
      const gir = calculateGIR(par, score, puttsNum);
      
      const { error: upsertError } = await supabase
        .from('pro_stats_holes')
        .upsert({
          pro_round_id: proRoundId,
          hole_number: holeNumber,
          par,
          score,
          putts: puttsNum,
          pro_shot_data: {
            basicStats: {
              fairwayResult: par === 3 ? null : fairwayResult,
              chipBunkerShots: chipBunkerNum,
              gir,
            },
          },
        }, { onConflict: 'pro_round_id,hole_number' });

      if (upsertError) throw upsertError;

      setSaved(true);
      setIsOpen(false);
      onStatsSaved?.();
    } catch (error: any) {
      console.error("Error saving stats:", error);
      toast({ title: "Error saving stats", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  // Don't render if not current user or stats mode is none
  if (!isCurrentUser || statsMode === 'none' || score <= 0) {
    return null;
  }

  // For strokes gained, use the dedicated component
  if (statsMode === 'strokes_gained') {
    return (
      <InRoundStrokesGained
        roundId={roundId}
        holeNumber={holeNumber}
        par={par}
        score={score}
        holeDistance={holeDistance}
        onStatsSaved={onStatsSaved}
        courseName={courseName}
        holesPlayed={holesPlayed}
      />
    );
  }

  const gir = putts ? calculateGIR(par, score, parseInt(putts) || 0) : null;

  return (
    <Card className="mt-4 border-primary/30">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer py-3 hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-medium flex items-center gap-2">
                📊 Hole Stats
                {saved && (
                  <Badge variant="secondary" className="text-xs">
                    <Check size={12} className="mr-1" /> Saved
                  </Badge>
                )}
              </CardTitle>
              {isOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <CardContent className="space-y-4 pt-0">
            {/* Fairway (only for par 4 and 5) */}
            {par !== 3 && (
              <div className="space-y-2">
                <Label className="text-sm">Fairway</Label>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant={fairwayResult === 'left' ? "default" : "outline"}
                    onClick={() => {
                      hasUserEdited.current = true;
                      setFairwayResult('left');
                    }}
                    className="flex-1"
                  >
                    Left
                  </Button>
                  <Button
                    size="sm"
                    variant={fairwayResult === 'hit' ? "default" : "outline"}
                    onClick={() => {
                      hasUserEdited.current = true;
                      setFairwayResult('hit');
                    }}
                    className="flex-1"
                  >
                    Hit
                  </Button>
                  <Button
                    size="sm"
                    variant={fairwayResult === 'right' ? "default" : "outline"}
                    onClick={() => {
                      hasUserEdited.current = true;
                      setFairwayResult('right');
                    }}
                    className="flex-1"
                  >
                    Right
                  </Button>
                </div>
              </div>
            )}

            {/* Chip/Bunker Shots */}
            <div className="space-y-2">
              <Label className="text-sm">Chip/Bunker Shots</Label>
              <Input
                type="number"
                inputMode="numeric"
                value={chipBunkerShots}
                onChange={(e) => {
                  hasUserEdited.current = true;
                  setChipBunkerShots(e.target.value);
                }}
                onWheel={(e) => (e.target as HTMLInputElement).blur()}
                placeholder="0"
                className="text-center h-10"
              />
            </div>

            {/* Putts */}
            <div className="space-y-2">
              <Label className="text-sm">Putts</Label>
              <Input
                type="number"
                inputMode="numeric"
                value={putts}
                onChange={(e) => {
                  hasUserEdited.current = true;
                  setPutts(e.target.value);
                }}
                onWheel={(e) => (e.target as HTMLInputElement).blur()}
                placeholder="Enter putts"
                className="text-center h-10"
              />
            </div>

            {/* GIR Preview */}
            {gir !== null && (
              <div className="p-2 bg-muted rounded-lg text-center">
                <p className="text-xs text-muted-foreground">Green in Regulation</p>
                <p className="font-bold text-sm">
                  {gir ? "✓ Yes" : "✗ No"}
                </p>
              </div>
            )}

            {/* Save Button */}
            <Button 
              onClick={saveBasicStats} 
              disabled={saving}
              className="w-full" 
              size="sm"
            >
              {saving ? "Saving..." : saved ? "Update Stats" : "Save Stats"}
            </Button>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
