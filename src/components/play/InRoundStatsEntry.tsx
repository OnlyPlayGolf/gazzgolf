import { useState, useEffect } from "react";
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

interface BasicStatsData {
  fairwayResult: 'hit' | 'left' | 'right' | null;
  chipBunkerShots: number;
  putts: number;
  gir: boolean;
}

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
}: InRoundStatsEntryProps) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Basic stats fields
  const [fairwayResult, setFairwayResult] = useState<'hit' | 'left' | 'right' | null>(null);
  const [chipBunkerShots, setChipBunkerShots] = useState("");
  const [putts, setPutts] = useState("");

  // Load existing stats if available
  useEffect(() => {
    loadExistingStats();
  }, [roundId, holeNumber, playerId]);

  // Reset saved indicator when hole changes
  useEffect(() => {
    setSaved(false);
  }, [holeNumber]);

  const loadExistingStats = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Look for existing pro_stats_holes linked to this round
      const { data: proRound } = await supabase
        .from('pro_stats_rounds')
        .select('id')
        .eq('external_round_id', roundId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (proRound) {
        const { data: existingHole } = await supabase
          .from('pro_stats_holes')
          .select('pro_shot_data, putts')
          .eq('pro_round_id', proRound.id)
          .eq('hole_number', holeNumber)
          .maybeSingle();

        if (existingHole?.pro_shot_data) {
          const shotData = existingHole.pro_shot_data as any;
          if (shotData.basicStats) {
            setFairwayResult(shotData.basicStats.fairwayResult || null);
            setChipBunkerShots(String(shotData.basicStats.chipBunkerShots || 0));
            setPutts(String(existingHole.putts || 0));
            setSaved(true);
          }
        }
      }
    } catch (error) {
      console.error("Error loading existing stats:", error);
    }
  };

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
        // Get round details for course name
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
                    onClick={() => setFairwayResult('left')}
                    className="flex-1"
                  >
                    Left
                  </Button>
                  <Button
                    size="sm"
                    variant={fairwayResult === 'hit' ? "default" : "outline"}
                    onClick={() => setFairwayResult('hit')}
                    className="flex-1"
                  >
                    Hit
                  </Button>
                  <Button
                    size="sm"
                    variant={fairwayResult === 'right' ? "default" : "outline"}
                    onClick={() => setFairwayResult('right')}
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
                onChange={(e) => setChipBunkerShots(e.target.value)}
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
                onChange={(e) => setPutts(e.target.value)}
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
