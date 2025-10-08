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

  const ChipButton = ({ active, onClick, children }: any) => (
    <Button
      variant={active ? "default" : "outline"}
      size="sm"
      onClick={onClick}
      className="flex-1 min-w-[70px]"
    >
      {children}
    </Button>
  );

  if (loading) return <div className="p-4">Loading...</div>;

  const hole = getCurrentHoleData();
  const needsGIR = hole.approach_result !== "GIR";

  return (
    <div className="pb-20 min-h-screen bg-background">
      <div className="p-4 space-y-4">
        <Button variant="ghost" onClick={() => navigate("/rounds")}>
          <ArrowLeft className="mr-2" size={20} />
          Exit Round
        </Button>

        {/* Hole Header */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-3xl">Hole {currentHole}</CardTitle>
                <p className="text-muted-foreground">{round?.course_name}</p>
              </div>
              <div className="text-right">
                <div className="text-sm text-muted-foreground">Par</div>
                <div className="text-3xl font-bold">{hole.par}</div>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Par Selection */}
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-2">
              <div className="text-sm font-medium">Par</div>
              <div className="flex gap-2">
                {[3, 4, 5].map((p) => (
                  <ChipButton
                    key={p}
                    active={hole.par === p}
                    onClick={() => updateCurrentHole({ par: p })}
                  >
                    Par {p}
                  </ChipButton>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Score */}
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-2">
              <div className="text-sm font-medium">Score</div>
              <div className="flex gap-2 flex-wrap">
                {Array.from({ length: 9 }, (_, i) => i + 1).map((s) => (
                  <ChipButton
                    key={s}
                    active={hole.score === s}
                    onClick={() => updateCurrentHole({ score: s })}
                  >
                    {s}
                  </ChipButton>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tee */}
        {hole.par >= 4 && (
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-2">
                <div className="text-sm font-medium">Tee Shot</div>
                <div className="flex gap-2 flex-wrap">
                  {(["FIR", "MissL", "MissR", "Short", "Long", "Penalty"] as const).map((t) => (
                    <ChipButton
                      key={t}
                      active={hole.tee_result === t}
                      onClick={() => updateCurrentHole({ tee_result: t as TeeResult })}
                    >
                      {t}
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
            <div className="space-y-3">
              <div className="space-y-2">
                <div className="text-sm font-medium">Approach Distance</div>
                <div className="flex gap-2">
                  {(["200+", "120-200", "40-120", "<40"] as const).map((d) => (
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
              <div className="space-y-2">
                <div className="text-sm font-medium">Approach Result</div>
                <div className="flex gap-2 flex-wrap">
                  {(["GIR", "MissL", "MissR", "Short", "Long", "Penalty"] as const).map((r) => (
                    <ChipButton
                      key={r}
                      active={hole.approach_result === r}
                      onClick={() => updateCurrentHole({ approach_result: r as ApproachResult })}
                    >
                      {r}
                    </ChipButton>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Short Game */}
        {needsGIR && (
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-2">
                <div className="text-sm font-medium">Short Game</div>
                <div className="flex gap-2">
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

        {/* Putts */}
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-3">
              <div className="space-y-2">
                <div className="text-sm font-medium">Putts</div>
                <div className="flex gap-2">
                  {[1, 2, 3, 4].map((p) => (
                    <ChipButton
                      key={p}
                      active={hole.putts === p}
                      onClick={() => updateCurrentHole({ putts: p })}
                    >
                      {p}
                    </ChipButton>
                  ))}
                </div>
              </div>
              {hole.putts && hole.putts >= 1 && (
                <div className="space-y-2">
                  <div className="text-sm font-medium">First Putt Distance</div>
                  <div className="flex gap-2">
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

        {/* Extras */}
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-2">
              <div className="text-sm font-medium">Extras</div>
              <div className="flex gap-2">
                <ChipButton
                  active={hole.recovery}
                  onClick={() => updateCurrentHole({ recovery: !hole.recovery })}
                >
                  Recovery
                </ChipButton>
                <ChipButton
                  active={hole.penalties > 0}
                  onClick={() => updateCurrentHole({ penalties: hole.penalties > 0 ? 0 : 1 })}
                >
                  Penalty
                </ChipButton>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Navigation */}
        <div className="flex gap-2 pt-4">
          <Button
            variant="outline"
            onClick={() => setCurrentHole(Math.max(1, currentHole - 1))}
            disabled={currentHole === 1}
            className="flex-1"
          >
            <ChevronLeft size={20} />
            Previous
          </Button>
          <Button onClick={saveHole} className="flex-1" size="lg">
            {currentHole < round?.holes_played ? (
              <>
                Save & Next
                <ChevronRight size={20} />
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
