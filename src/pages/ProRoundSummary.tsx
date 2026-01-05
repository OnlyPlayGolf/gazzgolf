import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ArrowLeft, Calendar, MapPin, Edit, Trash2, ChevronRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface Shot {
  type: 'tee' | 'approach' | 'putt';
  startDistance: number;
  holed: boolean;
  endDistance?: number;
  strokesGained: number;
}

interface DBHoleData {
  par: number;
  pro_shot_data: any; // JSONB from database
}

interface Summary {
  round_id: string;
  course_name: string;
  date_played: string;
  tee_set: string;
  holes_played: number;
  total_score: number;
  total_par: number;
  score_vs_par: number;
}

interface SGBreakdown {
  offTheTee: number;
  approach200Plus: number;
  approach120_200: number;
  approach40_120: number;
  approachTotal: number;
  shortGameFairwayRough: number;
  shortGameBunker: number;
  shortGameTotal: number;
  putting0_2: number;
  putting2_7: number;
  putting7Plus: number;
  puttingTotal: number;
  total: number;
}

interface TraditionalStats {
  fairwaysHit: number;
  totalFairways: number;
  fairwayPercentage: number;
  greensInRegulation: number;
  totalGreens: number;
  girPercentage: number;
  totalPutts: number;
  threePutts: number;
  avgPuttsPerHole: number;
}

const ProRoundSummary = () => {
  const { roundId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [sgBreakdown, setSgBreakdown] = useState<SGBreakdown | null>(null);
  const [traditionalStats, setTraditionalStats] = useState<TraditionalStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [roundId]);

  const fetchData = async () => {
    try {
      // Fetch round summary
      const { data: summaryData, error: summaryError } = await supabase
        .from("round_summaries")
        .select("*")
        .eq("round_id", roundId)
        .single();

      if (summaryError) throw summaryError;
      setSummary(summaryData);

      // Get pro stats round ID - use the one with the most holes if there are duplicates
      const { data: proRounds } = await supabase
        .from('pro_stats_rounds')
        .select('id')
        .eq('external_round_id', roundId);

      if (!proRounds || proRounds.length === 0) {
        console.log('No Pro Stats data found for this round');
        return;
      }

      // If multiple pro_stats_rounds exist, find the one with holes
      let proRoundId = proRounds[0].id;
      if (proRounds.length > 1) {
        // Check which one has holes
        const holeCounts = await Promise.all(
          proRounds.map(async (pr) => {
            const { count } = await supabase
              .from('pro_stats_holes')
              .select('*', { count: 'exact', head: true })
              .eq('pro_round_id', pr.id);
            return { id: pr.id, count: count || 0 };
          })
        );
        const best = holeCounts.sort((a, b) => b.count - a.count)[0];
        proRoundId = best.id;
      }

      // Fetch all holes with pro shot data from pro_stats_holes
      const { data: holesData, error: holesError } = await supabase
        .from("pro_stats_holes")
        .select("par, pro_shot_data")
        .eq("pro_round_id", proRoundId)
        .not("pro_shot_data", "is", null);

      if (holesError) throw holesError;

      console.log('Pro Stats holes found:', holesData?.length || 0);

      // Calculate detailed strokes gained breakdown
      if (holesData && holesData.length > 0) {
        const breakdown = calculateSGBreakdown(holesData as DBHoleData[]);
        console.log('Strokes Gained Breakdown:', breakdown);
        setSgBreakdown(breakdown);
        
        const tradStats = calculateTraditionalStats(holesData as DBHoleData[]);
        console.log('Traditional Stats:', tradStats);
        setTraditionalStats(tradStats);
      }
    } catch (error: any) {
      toast({
        title: "Error loading summary",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const calculateSGBreakdown = (holes: DBHoleData[]): SGBreakdown => {
    let offTheTee = 0;
    let approach200Plus = 0;
    let approach120_200 = 0;
    let approach40_120 = 0;
    let shortGameFairwayRough = 0;
    let shortGameBunker = 0;
    let putting0_2 = 0;
    let putting2_7 = 0;
    let putting7Plus = 0;

    holes.forEach((hole) => {
      if (!hole.pro_shot_data) return;
      
      const shots = hole.pro_shot_data as Shot[];
      shots.forEach((shot) => {
        const sg = shot.strokesGained;

        if (shot.type === 'tee' && hole.par >= 4) {
          offTheTee += sg;
        } else if (shot.type === 'approach') {
          const dist = shot.startDistance;
          if (dist >= 200) {
            approach200Plus += sg;
          } else if (dist >= 120) {
            approach120_200 += sg;
          } else if (dist >= 40) {
            approach40_120 += sg;
          } else {
            // Short game approach
            shortGameFairwayRough += sg;
          }
        } else if (shot.type === 'putt') {
          const dist = shot.startDistance;
          if (dist <= 2) {
            putting0_2 += sg;
          } else if (dist <= 7) {
            putting2_7 += sg;
          } else {
            putting7Plus += sg;
          }
        }
      });
    });

    const approachTotal = approach200Plus + approach120_200 + approach40_120;
    const shortGameTotal = shortGameFairwayRough + shortGameBunker;
    const puttingTotal = putting0_2 + putting2_7 + putting7Plus;
    const total = offTheTee + approachTotal + shortGameTotal + puttingTotal;

    return {
      offTheTee,
      approach200Plus,
      approach120_200,
      approach40_120,
      approachTotal,
      shortGameFairwayRough,
      shortGameBunker,
      shortGameTotal,
      putting0_2,
      putting2_7,
      putting7Plus,
      puttingTotal,
      total,
    };
  };

  const calculateTraditionalStats = (holes: DBHoleData[]): TraditionalStats => {
    let fairwaysHit = 0;
    let totalFairways = 0;
    let greensInRegulation = 0;
    let totalGreens = holes.length;
    let totalPutts = 0;
    let threePutts = 0;

    holes.forEach((hole) => {
      if (!hole.pro_shot_data) return;
      
      const shots = hole.pro_shot_data as Shot[];
      const puttCount = shots.filter(s => s.type === 'putt').length;
      totalPutts += puttCount;
      
      if (puttCount >= 3) threePutts++;

      // Count fairways (par 4 and 5 only)
      if (hole.par >= 4) {
        totalFairways++;
        const teeShot = shots.find(s => s.type === 'tee');
        // Assume fairway hit if tee shot exists and didn't hole out (reasonable assumption for pro stats)
        if (teeShot && !teeShot.holed) {
          fairwaysHit++;
        }
      }

      // GIR: reached green in regulation (par - 2 strokes or less)
      const strokesUsed = shots.length;
      const regulationStrokes = hole.par - 2;
      
      // Find if green was reached in regulation
      let reachedGreenInReg = false;
      let strokesBeforeGreen = 0;
      for (const shot of shots) {
        strokesBeforeGreen++;
        if (shot.type === 'putt' || shot.holed) {
          // Reached green
          if (strokesBeforeGreen <= regulationStrokes) {
            reachedGreenInReg = true;
          }
          break;
        }
      }
      if (reachedGreenInReg) greensInRegulation++;
    });

    return {
      fairwaysHit,
      totalFairways,
      fairwayPercentage: totalFairways > 0 ? (fairwaysHit / totalFairways) * 100 : 0,
      greensInRegulation,
      totalGreens,
      girPercentage: totalGreens > 0 ? (greensInRegulation / totalGreens) * 100 : 0,
      totalPutts,
      threePutts,
      avgPuttsPerHole: holes.length > 0 ? totalPutts / holes.length : 0,
    };
  };

  if (loading) return <div className="p-4">Loading...</div>;
  if (!summary) return <div className="p-4">No data found</div>;

  const getScoreColor = (diff: number) => {
    if (diff <= 0) return "text-green-500";
    if (diff <= 5) return "text-yellow-500";
    return "text-red-500";
  };

  const getSGColor = (value: number) => {
    if (value > 0) return "text-green-500";
    if (value < 0) return "text-red-500";
    return "text-muted-foreground";
  };

  const formatSG = (value: number) => {
    return value >= 0 ? `+${value.toFixed(2)}` : value.toFixed(2);
  };

  const handleDelete = async () => {
    try {
      // Get pro stats round
      const { data: proRound } = await supabase
        .from('pro_stats_rounds')
        .select('id')
        .eq('external_round_id', roundId)
        .maybeSingle();

      if (proRound?.id) {
        // Delete pro stats holes
        await supabase
          .from('pro_stats_holes')
          .delete()
          .eq('pro_round_id', proRound.id);
        
        // Delete pro stats round
        await supabase
          .from('pro_stats_rounds')
          .delete()
          .eq('id', proRound.id);
      }

      // Delete the round
      const { error } = await supabase
        .from('rounds')
        .delete()
        .eq('id', roundId);

      if (error) throw error;

      toast({
        title: "Round deleted",
        description: "The round has been removed",
      });

      navigate('/rounds');
    } catch (error: any) {
      toast({
        title: "Error deleting round",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const StatRow = ({ label, value, isBold = false }: any) => (
    <div className={`flex justify-between py-2 border-b ${isBold ? 'font-bold' : ''}`}>
      <span className="text-foreground">{label}</span>
      <span className={getSGColor(value)}>{formatSG(value)}</span>
    </div>
  );

  return (
    <div className="pb-20 min-h-screen bg-background">
      <div className="p-4 space-y-4">
        <Button variant="ghost" onClick={() => navigate("/practice")}>
          <ArrowLeft className="mr-2" size={20} />
          Back to Practice
        </Button>

        {/* Header Card - matches StatsRoundsHistory design */}
        <Card className="bg-gradient-to-br from-primary/5 via-primary/10 to-primary/5 border border-primary/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              {/* Left: Score */}
              <div className="flex-shrink-0 w-14 text-center">
                <div className={`text-2xl font-bold ${summary.score_vs_par <= 0 ? "text-emerald-600" : "text-foreground"}`}>
                  {summary.score_vs_par === 0 ? "E" : 
                   summary.score_vs_par > 0 ? `+${summary.score_vs_par}` : 
                   summary.score_vs_par}
                </div>
              </div>
              
              {/* Middle: Details */}
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-foreground truncate">
                  {summary.course_name}
                </h3>
                <div className="flex items-center gap-1.5 mt-1 text-sm text-muted-foreground">
                  <span>{format(new Date(summary.date_played), "MMM d")}</span>
                  <span>·</span>
                  <span>{summary.holes_played} holes</span>
                </div>
                <div className="mt-1">
                  <span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary text-xs">
                    Fun/Practice
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Traditional Stats */}
        {traditionalStats && (
          <Card>
            <CardHeader>
              <CardTitle>Traditional Stats</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between items-center pb-2 border-b">
                  <span className="text-foreground font-medium">Fairways Hit</span>
                  <span className="text-foreground font-semibold">
                    {traditionalStats.fairwaysHit}/{traditionalStats.totalFairways} ({traditionalStats.fairwayPercentage.toFixed(1)}%)
                  </span>
                </div>
                
                <div className="flex justify-between items-center pb-2 border-b">
                  <span className="text-foreground font-medium">Greens in Regulation</span>
                  <span className="text-foreground font-semibold">
                    {traditionalStats.greensInRegulation}/{traditionalStats.totalGreens} ({traditionalStats.girPercentage.toFixed(1)}%)
                  </span>
                </div>
                
                <div className="flex justify-between items-center pb-2 border-b">
                  <span className="text-foreground font-medium">Total Putts</span>
                  <span className="text-foreground font-semibold">{traditionalStats.totalPutts}</span>
                </div>
                
                <div className="flex justify-between items-center pb-2 border-b">
                  <span className="text-foreground font-medium">Avg Putts/Hole</span>
                  <span className="text-foreground font-semibold">{traditionalStats.avgPuttsPerHole.toFixed(2)}</span>
                </div>
                
                <div className="flex justify-between items-center pb-2 border-b">
                  <span className="text-foreground font-medium">Three Putts</span>
                  <span className="text-foreground font-semibold">{traditionalStats.threePutts}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Strokes Gained Breakdown */}
        {sgBreakdown && (
          <Card>
            <CardHeader>
              <CardTitle>Strokes Gained</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                <div className="grid grid-cols-2 gap-4 pb-2 border-b font-semibold text-sm text-muted-foreground">
                  <span>Category</span>
                  <span className="text-right">Value</span>
                </div>

                <StatRow label="Off the Tee (Par 4/5)" value={sgBreakdown.offTheTee} isBold />
                
                <StatRow label="Approach 40-240m Total" value={sgBreakdown.approachTotal} isBold />
                <StatRow label="  200+ m" value={sgBreakdown.approach200Plus} />
                <StatRow label="  120-200 m" value={sgBreakdown.approach120_200} />
                <StatRow label="  40-120 m" value={sgBreakdown.approach40_120} />
                
                <StatRow label="Short Game Total" value={sgBreakdown.shortGameTotal} isBold />
                <StatRow label="  Fairway & Rough" value={sgBreakdown.shortGameFairwayRough} />
                <StatRow label="  Bunker" value={sgBreakdown.shortGameBunker} />
                
                <StatRow label="Putting Total" value={sgBreakdown.puttingTotal} isBold />
                <StatRow label="  0-2 m" value={sgBreakdown.putting0_2} />
                <StatRow label="  2-7 m" value={sgBreakdown.putting2_7} />
                <StatRow label="  7+ m" value={sgBreakdown.putting7Plus} />
                
                <div className="pt-2 border-t-2 border-primary">
                  <StatRow label="Strokes Gained Total" value={sgBreakdown.total} isBold />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="flex gap-3">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="lg" className="flex-1">
                <Trash2 className="mr-2" size={18} />
                Delete Round
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Round?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete this Pro Stats round and all its data. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          
          <Button 
            onClick={() => navigate("/rounds")} 
            className="flex-1" 
            size="lg"
          >
            Done
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ProRoundSummary;
