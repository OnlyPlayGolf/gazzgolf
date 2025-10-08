import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type TeeResult = Database["public"]["Enums"]["tee_result"];
type ApproachBucket = Database["public"]["Enums"]["approach_bucket"];
type ApproachResult = Database["public"]["Enums"]["approach_result"];
type FirstPuttBand = Database["public"]["Enums"]["first_putt_band"];

interface HoleData {
  par: number;
  score: number;
  tee_result?: TeeResult;
  approach_bucket?: ApproachBucket;
  approach_result?: ApproachResult;
  up_and_down: boolean;
  sand_save: boolean;
  putts?: number;
  first_putt_band?: FirstPuttBand;
  penalties: number;
  recovery: boolean;
}

const HoleTracker = () => {
  const { roundId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [round, setRound] = useState<any>(null);
  const [currentHole, setCurrentHole] = useState(1);
  const [holeData, setHoleData] = useState<Record<number, HoleData>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRound();
  }, [roundId]);

  const fetchRound = async () => {
    try {
      const { data: roundData, error: roundError } = await supabase
        .from("rounds")
        .select("*")
        .eq("id", roundId)
        .single();

      if (roundError) throw roundError;
      setRound(roundData);

      // Fetch existing hole data
      const { data: holesData } = await supabase
        .from("holes")
        .select("*")
        .eq("round_id", roundId);

      if (holesData) {
        const holesMap: Record<number, HoleData> = {};
        holesData.forEach((hole) => {
          holesMap[hole.hole_number] = {
            par: hole.par,
            score: hole.score,
            tee_result: hole.tee_result || undefined,
            approach_bucket: hole.approach_bucket || undefined,
            approach_result: hole.approach_result || undefined,
            up_and_down: hole.up_and_down || false,
            sand_save: hole.sand_save || false,
            putts: hole.putts || undefined,
            first_putt_band: hole.first_putt_band || undefined,
            penalties: hole.penalties || 0,
            recovery: hole.recovery || false,
          };
        });
        setHoleData(holesMap);
      }
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

  const getCurrentHoleData = (): HoleData => {
    return holeData[currentHole] || {
      par: 4,
      score: 0,
      up_and_down: false,
      sand_save: false,
      penalties: 0,
      recovery: false,
    };
  };

  const updateCurrentHole = (updates: Partial<HoleData>) => {
    setHoleData({
      ...holeData,
      [currentHole]: { ...getCurrentHoleData(), ...updates },
    });
  };

  const saveHole = async () => {
    const data = getCurrentHoleData();
    
    if (!data.score || !data.putts) {
      toast({
        title: "Incomplete data",
        description: "Please enter score and putts",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase.from("holes").upsert(
        [
          {
            round_id: roundId!,
            hole_number: currentHole,
            par: data.par,
            score: data.score,
            tee_result: data.tee_result || null,
            approach_bucket: data.approach_bucket || null,
            approach_result: data.approach_result || null,
            up_and_down: data.up_and_down,
            sand_save: data.sand_save,
            putts: data.putts || null,
            first_putt_band: data.first_putt_band || null,
            penalties: data.penalties,
            recovery: data.recovery,
          },
        ],
        { onConflict: "round_id,hole_number" }
      );

      if (error) throw error;

      if (currentHole < round.holes_played) {
        setCurrentHole(currentHole + 1);
      } else {
        navigate(`/rounds/${roundId}/summary`);
      }
    } catch (error: any) {
      toast({
        title: "Error saving hole",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const ChipButton = ({ active, onClick, children, size = "default" }: any) => (
    <Button
      variant={active ? "default" : "outline"}
      size={size}
      onClick={onClick}
      className="min-w-[80px]"
    >
      {children}
    </Button>
  );

  if (loading) return <div className="p-4">Loading...</div>;

  const hole = getCurrentHoleData();
  const needsGIR = hole.approach_result !== "GIR";

  return (
    <div className="pb-20 min-h-screen bg-background">
      {/* Fixed Header */}
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
            <h1 className="text-2xl font-bold">{round?.course_name}</h1>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-6">
        {/* Par & Score - Compact */}
        <Card>
          <CardContent className="pt-6">
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-3">
                <div className="text-sm font-medium text-muted-foreground">Par</div>
                <div className="flex gap-2">
                  {[3, 4, 5].map((p) => (
                    <ChipButton
                      key={p}
                      active={hole.par === p}
                      onClick={() => updateCurrentHole({ par: p })}
                      size="lg"
                    >
                      {p}
                    </ChipButton>
                  ))}
                </div>
              </div>
              <div className="space-y-3">
                <div className="text-sm font-medium text-muted-foreground">Score</div>
                <div className="flex gap-2">
                  {[...Array(Math.min(5, hole.par + 2))].map((_, i) => {
                    const s = hole.par - 1 + i;
                    return (
                      <ChipButton
                        key={s}
                        active={hole.score === s}
                        onClick={() => updateCurrentHole({ score: s })}
                        size="lg"
                      >
                        {s}
                      </ChipButton>
                    );
                  })}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tee Shot - Only for Par 4/5 */}
        {hole.par >= 4 && (
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-3">
                <div className="text-sm font-medium text-muted-foreground">Tee Shot</div>
                <div className="grid grid-cols-3 gap-2">
                  {(["FIR", "MissL", "MissR", "Short", "Long", "Penalty"] as const).map((t) => (
                    <ChipButton
                      key={t}
                      active={hole.tee_result === t}
                      onClick={() => updateCurrentHole({ tee_result: t as TeeResult })}
                    >
                      {t === "FIR" ? "Fairway" : t}
                    </ChipButton>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Approach */}
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-4">
              <div className="space-y-3">
                <div className="text-sm font-medium text-muted-foreground">Approach Distance</div>
                <div className="grid grid-cols-4 gap-2">
                  {(["<40", "40-120", "120-200", "200+"] as const).map((d) => (
                    <ChipButton
                      key={d}
                      active={hole.approach_bucket === d}
                      onClick={() => updateCurrentHole({ approach_bucket: d as ApproachBucket })}
                    >
                      {d}m
                    </ChipButton>
                  ))}
                </div>
              </div>
              <div className="space-y-3">
                <div className="text-sm font-medium text-muted-foreground">Result</div>
                <div className="grid grid-cols-3 gap-2">
                  {(["GIR", "Short", "Long", "MissL", "MissR", "Penalty"] as const).map((r) => (
                    <ChipButton
                      key={r}
                      active={hole.approach_result === r}
                      onClick={() => updateCurrentHole({ approach_result: r as ApproachResult })}
                    >
                      {r === "GIR" ? "Green" : r}
                    </ChipButton>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Short Game - Only if missed green */}
        {needsGIR && (
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-3">
                <div className="text-sm font-medium text-muted-foreground">Short Game</div>
                <div className="grid grid-cols-2 gap-2">
                  <ChipButton
                    active={hole.up_and_down}
                    onClick={() => updateCurrentHole({ up_and_down: !hole.up_and_down })}
                  >
                    Up & Down
                  </ChipButton>
                  <ChipButton
                    active={hole.sand_save}
                    onClick={() => updateCurrentHole({ sand_save: !hole.sand_save })}
                  >
                    Sand Save
                  </ChipButton>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Putting */}
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-4">
              <div className="space-y-3">
                <div className="text-sm font-medium text-muted-foreground">Putts</div>
                <div className="grid grid-cols-4 gap-2">
                  {[0, 1, 2, 3].map((p) => (
                    <ChipButton
                      key={p}
                      active={hole.putts === p}
                      onClick={() => updateCurrentHole({ putts: p })}
                      size="lg"
                    >
                      {p}
                    </ChipButton>
                  ))}
                </div>
              </div>
              {hole.putts !== undefined && hole.putts >= 1 && (
                <div className="space-y-3">
                  <div className="text-sm font-medium text-muted-foreground">First Putt Distance</div>
                  <div className="grid grid-cols-3 gap-2">
                    {(["0-2", "2-7", "7+"] as const).map((b) => (
                      <ChipButton
                        key={b}
                        active={hole.first_putt_band === b}
                        onClick={() => updateCurrentHole({ first_putt_band: b as FirstPuttBand })}
                      >
                        {b}m
                      </ChipButton>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Penalties & Recovery */}
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-3">
              <div className="text-sm font-medium text-muted-foreground">Other</div>
              <div className="grid grid-cols-2 gap-2">
                <ChipButton
                  active={hole.penalties > 0}
                  onClick={() => updateCurrentHole({ penalties: hole.penalties > 0 ? 0 : 1 })}
                >
                  Penalty
                </ChipButton>
                <ChipButton
                  active={hole.recovery}
                  onClick={() => updateCurrentHole({ recovery: !hole.recovery })}
                >
                  Recovery
                </ChipButton>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Fixed Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-background border-t p-4">
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={() => setCurrentHole(Math.max(1, currentHole - 1))}
            disabled={currentHole === 1}
            size="lg"
            className="flex-1"
          >
            <ChevronLeft size={20} />
          </Button>
          <Button onClick={saveHole} size="lg" className="flex-[2]">
            {currentHole < round?.holes_played ? (
              <>
                Next Hole
                <ChevronRight size={20} className="ml-2" />
              </>
            ) : (
              "Finish Round"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default HoleTracker;
