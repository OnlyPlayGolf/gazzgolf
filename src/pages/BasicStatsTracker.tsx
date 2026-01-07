import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ChevronRight, ChevronLeft, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface BasicHoleData {
  par: number;
  score: number;
  putts: number;
  chipBunkerShots: number;
  fairwayResult: 'hit' | 'left' | 'right' | null; // null for par 3s
}

interface CourseHole {
  hole_number: number;
  par: number;
}

const BasicStatsTracker = () => {
  const { roundId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [round, setRound] = useState<any>(null);
  const [currentHole, setCurrentHole] = useState(1);
  const [holeData, setHoleData] = useState<Record<number, BasicHoleData>>({});
  const [loading, setLoading] = useState(true);
  const [proRoundId, setProRoundId] = useState<string | null>(null);
  const [courseHoles, setCourseHoles] = useState<CourseHole[]>([]);
  
  // Current hole inputs
  const [par, setPar] = useState(4);
  const [score, setScore] = useState("");
  const [putts, setPutts] = useState("");
  const [chipBunkerShots, setChipBunkerShots] = useState("");
  const [fairwayResult, setFairwayResult] = useState<'hit' | 'left' | 'right' | null>(null);

  useEffect(() => {
    fetchRound();
    fetchCourseData();
  }, [roundId]);

  useEffect(() => {
    const initializeRound = async () => {
      const prId = await ensureProRound();
      if (prId) {
        await loadExistingHoles(prId);
      }
    };
    if (round && !proRoundId) {
      initializeRound();
    }
  }, [roundId, round]);

  useEffect(() => {
    if (courseHoles.length > 0) {
      const holePar = getHolePar(currentHole);
      setPar(holePar);
    }
  }, [courseHoles, currentHole]);

  // Load saved data for current hole
  useEffect(() => {
    const savedHole = holeData[currentHole];
    if (savedHole) {
      setPar(savedHole.par);
      setScore(String(savedHole.score));
      setPutts(String(savedHole.putts));
      setChipBunkerShots(String(savedHole.chipBunkerShots));
      setFairwayResult(savedHole.fairwayResult);
    } else {
      // Reset for new hole
      setScore("");
      setPutts("");
      setChipBunkerShots("");
      setFairwayResult(par === 3 ? null : null);
    }
  }, [currentHole, holeData]);

  const ensureProRound = async (): Promise<string | null> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

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

    const { data: created, error: createErr } = await supabase
      .from('pro_stats_rounds')
      .insert([{ 
        user_id: user.id, 
        external_round_id: roundId, 
        course_name: round?.course_name ?? null, 
        holes_played: round?.holes_played ?? 18 
      }])
      .select('id')
      .single();

    if (createErr) {
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
      .select("hole_number, par")
      .eq("course_id", courseId)
      .order("hole_number");

    if (!error && data) {
      setCourseHoles(data);
    }
  };

  const loadExistingHoles = async (prId: string) => {
    const { data: existingHoles, error } = await supabase
      .from("pro_stats_holes")
      .select("hole_number, par, score, putts, pro_shot_data")
      .eq("pro_round_id", prId)
      .order("hole_number");

    if (error || !existingHoles || existingHoles.length === 0) {
      return;
    }

    const loadedHoleData: Record<number, BasicHoleData> = {};
    let lastCompletedHole = 0;

    existingHoles.forEach((hole) => {
      // Try to load basic stats from pro_shot_data
      const shotData = hole.pro_shot_data as any;
      if (shotData && shotData.basicStats) {
        loadedHoleData[hole.hole_number] = {
          par: hole.par,
          score: hole.score,
          putts: hole.putts || 0,
          chipBunkerShots: shotData.basicStats.chipBunkerShots || 0,
          fairwayResult: shotData.basicStats.fairwayResult || null,
        };
        lastCompletedHole = Math.max(lastCompletedHole, hole.hole_number);
      }
    });

    setHoleData(loadedHoleData);

    const totalHoles = round?.holes_played || 18;
    const nextHole = lastCompletedHole + 1;
    
    if (nextHole <= totalHoles) {
      setCurrentHole(nextHole);
    } else {
      setCurrentHole(lastCompletedHole || 1);
    }
  };

  const getHolePar = (holeNumber: number): number => {
    const hole = courseHoles.find(h => h.hole_number === holeNumber);
    return hole?.par || 4;
  };

  const calculateGIR = (holePar: number, holeScore: number, holePutts: number): boolean => {
    // GIR = reached green in (par - 2) strokes
    // If score - putts <= par - 2, then GIR was made
    const strokesBeforePutting = holeScore - holePutts;
    const regulationStrokes = holePar - 2;
    return strokesBeforePutting <= regulationStrokes;
  };

  const saveHole = async () => {
    const scoreNum = parseInt(score);
    const puttsNum = parseInt(putts);
    const chipBunkerNum = parseInt(chipBunkerShots) || 0;

    if (isNaN(scoreNum) || scoreNum < 1) {
      toast({ title: "Enter a valid score", variant: "destructive" });
      return;
    }

    if (isNaN(puttsNum) || puttsNum < 0) {
      toast({ title: "Enter valid putts", variant: "destructive" });
      return;
    }

    if (puttsNum > scoreNum) {
      toast({ title: "Putts cannot exceed score", variant: "destructive" });
      return;
    }

    // For non-par-3 holes, require fairway selection
    if (par !== 3 && !fairwayResult) {
      toast({ title: "Select fairway result", variant: "destructive" });
      return;
    }

    const newHoleData: BasicHoleData = {
      par,
      score: scoreNum,
      putts: puttsNum,
      chipBunkerShots: chipBunkerNum,
      fairwayResult: par === 3 ? null : fairwayResult,
    };

    setHoleData({
      ...holeData,
      [currentHole]: newHoleData,
    });

    // Save to database
    try {
      const prId = proRoundId || await ensureProRound();
      if (!prId) return;

      const { error } = await supabase.from("pro_stats_holes").upsert([
        {
          pro_round_id: prId,
          hole_number: currentHole,
          par,
          score: scoreNum,
          putts: puttsNum,
          pro_shot_data: {
            basicStats: {
              chipBunkerShots: chipBunkerNum,
              fairwayResult: par === 3 ? null : fairwayResult,
              gir: calculateGIR(par, scoreNum, puttsNum),
            }
          },
        },
      ], { onConflict: "pro_round_id,hole_number" });

      if (error) throw error;

      // Move to next hole or finish
      if (currentHole < (round?.holes_played || 18)) {
        setCurrentHole(currentHole + 1);
      } else {
        // All holes complete
        toast({ title: "Round complete!", description: "All holes saved" });
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

  const goToPreviousHole = () => {
    if (currentHole > 1) {
      setCurrentHole(currentHole - 1);
    }
  };

  const goToNextHole = () => {
    if (currentHole < (round?.holes_played || 18)) {
      setCurrentHole(currentHole + 1);
    }
  };

  // Calculate running totals
  const getTotalScore = () => {
    return Object.values(holeData).reduce((sum, h) => sum + (h.score || 0), 0);
  };

  const getTotalPar = () => {
    return Object.values(holeData).reduce((sum, h) => sum + (h.par || 0), 0);
  };

  const getScoreToPar = () => {
    const totalScore = getTotalScore();
    const totalPar = getTotalPar();
    if (Object.keys(holeData).length === 0) return "";
    const diff = totalScore - totalPar;
    if (diff > 0) return `+${diff}`;
    if (diff < 0) return `${diff}`;
    return "E";
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="pb-20 min-h-screen bg-background">
      <div className="p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <Button variant="ghost" onClick={() => navigate(-1)}>
            <ArrowLeft className="mr-2" size={20} />
            Back
          </Button>
          <div className="text-right">
            <p className="text-sm text-muted-foreground">{round?.course_name}</p>
            <p className="font-bold text-lg">{getScoreToPar()}</p>
          </div>
        </div>

        {/* Hole Navigation */}
        <div className="flex items-center justify-between mb-6">
          <Button 
            variant="outline" 
            size="icon" 
            onClick={goToPreviousHole}
            disabled={currentHole === 1}
          >
            <ChevronLeft size={20} />
          </Button>
          
          <div className="text-center">
            <h2 className="text-2xl font-bold">Hole {currentHole}</h2>
            <p className="text-muted-foreground">Par {par}</p>
          </div>
          
          <Button 
            variant="outline" 
            size="icon" 
            onClick={goToNextHole}
            disabled={currentHole >= (round?.holes_played || 18)}
          >
            <ChevronRight size={20} />
          </Button>
        </div>

        {/* Completed indicator */}
        {holeData[currentHole] && (
          <Badge variant="secondary" className="mb-4 w-full justify-center py-2">
            <Check className="mr-2" size={16} />
            Hole saved - editing
          </Badge>
        )}

        <Card>
          <CardContent className="space-y-6 pt-6">
            {/* Par Selector */}
            <div className="space-y-2">
              <Label>Par</Label>
              <div className="flex gap-2">
                {[3, 4, 5].map((p) => (
                  <Button
                    key={p}
                    variant={par === p ? "default" : "outline"}
                    onClick={() => setPar(p)}
                    className="flex-1"
                  >
                    {p}
                  </Button>
                ))}
              </div>
            </div>

            {/* Score */}
            <div className="space-y-2">
              <Label>Score</Label>
              <Input
                type="number"
                inputMode="numeric"
                value={score}
                onChange={(e) => setScore(e.target.value)}
                placeholder="Enter score"
                className="text-center text-2xl h-14"
              />
            </div>

            {/* Fairway (only for par 4 and 5) */}
            {par !== 3 && (
              <div className="space-y-2">
                <Label>Fairway</Label>
                <div className="flex gap-2">
                  <Button
                    variant={fairwayResult === 'left' ? "default" : "outline"}
                    onClick={() => setFairwayResult('left')}
                    className="flex-1"
                  >
                    Left
                  </Button>
                  <Button
                    variant={fairwayResult === 'hit' ? "default" : "outline"}
                    onClick={() => setFairwayResult('hit')}
                    className="flex-1"
                  >
                    Hit
                  </Button>
                  <Button
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
              <Label>Chip/Bunker Shots</Label>
              <Input
                type="number"
                inputMode="numeric"
                value={chipBunkerShots}
                onChange={(e) => setChipBunkerShots(e.target.value)}
                placeholder="0"
                className="text-center text-xl h-12"
              />
            </div>

            {/* Putts */}
            <div className="space-y-2">
              <Label>Putts</Label>
              <Input
                type="number"
                inputMode="numeric"
                value={putts}
                onChange={(e) => setPutts(e.target.value)}
                placeholder="Enter putts"
                className="text-center text-xl h-12"
              />
            </div>

            {/* GIR Preview */}
            {score && putts && (
              <div className="p-3 bg-muted rounded-lg text-center">
                <p className="text-sm text-muted-foreground">Green in Regulation</p>
                <p className="font-bold text-lg">
                  {calculateGIR(par, parseInt(score), parseInt(putts)) ? "✓ Yes" : "✗ No"}
                </p>
              </div>
            )}

            {/* Save Button */}
            <Button onClick={saveHole} className="w-full" size="lg">
              {currentHole < (round?.holes_played || 18) ? "Save & Next Hole" : "Finish Round"}
            </Button>
          </CardContent>
        </Card>

        {/* Hole Progress */}
        <div className="mt-6 flex flex-wrap gap-2 justify-center">
          {Array.from({ length: round?.holes_played || 18 }, (_, i) => i + 1).map((hole) => (
            <Button
              key={hole}
              variant={holeData[hole] ? "default" : currentHole === hole ? "secondary" : "outline"}
              size="sm"
              className="w-10 h-10"
              onClick={() => setCurrentHole(hole)}
            >
              {hole}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default BasicStatsTracker;
