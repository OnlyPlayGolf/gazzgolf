import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowLeft, Calendar, MapPin, Edit, Trash2, Share2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { RoundShareDialog } from "@/components/RoundShareDialog";

interface Summary {
  round_id: string;
  course_name: string;
  date_played: string;
  tee_set: string;
  holes_played: number;
  total_score: number;
  total_par: number;
  score_vs_par: number;
  fir_percentage: number;
  gir_percentage: number;
  updown_percentage: number;
  total_putts: number;
  three_putts: number;
  total_penalties: number;
}

interface CourseHole {
  hole_number: number;
  par: number;
  stroke_index: number;
}

interface HoleScore {
  hole_number: number;
  score: number;
  par: number;
}

const RoundSummary = () => {
  const { roundId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [roundName, setRoundName] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [roundOrigin, setRoundOrigin] = useState<string | null>(null);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [courseHoles, setCourseHoles] = useState<CourseHole[]>([]);
  const [holeScores, setHoleScores] = useState<Map<number, number>>(new Map());

  useEffect(() => {
    fetchSummary();
  }, [roundId]);

  const fetchSummary = async () => {
    try {
      const { data, error } = await supabase
        .from("round_summaries")
        .select("*")
        .eq("round_id", roundId)
        .single();

      if (error) throw error;
      setSummary(data);

      // Also fetch the round's origin and round_name, with fallback to pro_stats mapping
      const { data: roundData } = await supabase
        .from('rounds')
        .select('origin, round_name, course_name, user_id')
        .eq('id', roundId)
        .maybeSingle();

      setRoundName(roundData?.round_name || data.course_name);

      let origin = roundData?.origin || null;

      // If there's a pro_stats_rounds mapping, treat it as pro_stats
      const { data: proLink } = await supabase
        .from('pro_stats_rounds')
        .select('id')
        .eq('external_round_id', roundId)
        .maybeSingle();

      if (proLink?.id) origin = 'pro_stats';
      setRoundOrigin(origin);

      // Fetch course holes for scorecard
      if (roundData?.course_name) {
        const { data: courseData } = await supabase
          .from("courses")
          .select("id")
          .eq("name", roundData.course_name)
          .single();

        if (courseData) {
          const { data: holesData } = await supabase
            .from("course_holes")
            .select("hole_number, par, stroke_index")
            .eq("course_id", courseData.id)
            .order("hole_number");

          if (holesData) {
            // Filter based on holes_played
            const filteredHoles = data.holes_played === 9 
              ? holesData.slice(0, 9) 
              : holesData;
            setCourseHoles(filteredHoles);
          }
        }
      }

      // Fetch hole scores for the current user
      if (roundData?.user_id) {
        // First get the round_player id for this user
        const { data: playerData } = await supabase
          .from("round_players")
          .select("id")
          .eq("round_id", roundId)
          .eq("user_id", roundData.user_id)
          .single();

        if (playerData) {
          const { data: scoresData } = await supabase
            .from("holes")
            .select("hole_number, score")
            .eq("round_id", roundId)
            .eq("player_id", playerData.id);

          if (scoresData) {
            const scoresMap = new Map<number, number>();
            scoresData.forEach(h => scoresMap.set(h.hole_number, h.score));
            setHoleScores(scoresMap);
          }
        }
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

  if (loading) return <div className="p-4">Loading...</div>;
  if (!summary) return <div className="p-4">No data found</div>;

  const getScoreColor = (diff: number) => {
    if (diff <= 0) return "text-green-500";
    if (diff <= 5) return "text-yellow-500";
    return "text-red-500";
  };

  const formatScoreVsPar = (diff: number) => {
    if (diff === 0) return "E";
    if (diff > 0) return `+${diff}`;
    return diff.toString();
  };

  const handleDelete = async () => {
    try {
      // Delete holes first
      await supabase
        .from('holes')
        .delete()
        .eq('round_id', roundId);

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

  const frontNine = courseHoles.filter(h => h.hole_number <= 9);
  const backNine = courseHoles.filter(h => h.hole_number > 9);
  const hasBackNine = backNine.length > 0;

  const getFrontNineTotal = () => {
    return frontNine.reduce((sum, h) => {
      const score = holeScores.get(h.hole_number);
      return sum + (score && score > 0 ? score : 0);
    }, 0);
  };

  const getBackNineTotal = () => {
    return backNine.reduce((sum, h) => {
      const score = holeScores.get(h.hole_number);
      return sum + (score && score > 0 ? score : 0);
    }, 0);
  };

  const StatCard = ({ title, value, subtitle, progress }: any) => (
    <Card>
      <CardContent className="pt-6">
        <div className="space-y-2">
          <div className="text-sm text-muted-foreground">{title}</div>
          <div className="text-3xl font-bold">{value}</div>
          {subtitle && <div className="text-sm text-muted-foreground">{subtitle}</div>}
          {progress !== undefined && (
            <Progress value={progress} className="h-2" />
          )}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="pb-20 min-h-screen bg-background">
      <div className="p-4 space-y-4">
        <Button variant="ghost" onClick={() => navigate("/rounds")}>
          <ArrowLeft className="mr-2" size={20} />
          Back to Rounds
        </Button>

        {/* Final Result Header */}
        <div className="bg-primary text-primary-foreground rounded-lg p-4">
          <div className="text-center mb-2">
            <p className="text-sm opacity-90">{summary.course_name}</p>
            <p className="text-xs opacity-75">{format(new Date(summary.date_played), "MMMM d, yyyy")} • {summary.holes_played} holes</p>
          </div>
          <div className="flex items-center justify-center gap-8">
            <div className="text-center">
              <p className="text-4xl font-bold">{summary.total_score}</p>
              <p className="text-xs opacity-75">SCORE</p>
            </div>
            <div className="text-center">
              <p className={`text-4xl font-bold ${summary.score_vs_par <= 0 ? 'text-green-300' : ''}`}>
                {formatScoreVsPar(summary.score_vs_par)}
              </p>
              <p className="text-xs opacity-75">VS PAR</p>
            </div>
          </div>
        </div>

        {/* Scorecard */}
        {courseHoles.length > 0 && (
          <div className="border rounded-lg overflow-hidden w-full">
            {/* Front 9 */}
            <div className="w-full">
              <Table className="w-full table-fixed">
                <TableHeader>
                  <TableRow className="bg-primary/5">
                    <TableHead className="text-center font-bold text-[10px] px-0.5 py-1.5 bg-primary/5 w-[44px]">Hole</TableHead>
                    {frontNine.map(hole => (
                      <TableHead key={hole.hole_number} className="text-center font-bold text-[10px] px-0 py-1.5">
                        {hole.hole_number}
                      </TableHead>
                    ))}
                    <TableHead className="text-center font-bold text-[10px] px-0 py-1.5 bg-primary/10">Out</TableHead>
                    <TableHead className="text-center font-bold text-[10px] px-0 py-1.5 bg-primary/10">
                      {hasBackNine ? '' : 'Tot'}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-medium text-muted-foreground text-[10px] px-0.5 py-1 bg-background">Par</TableCell>
                    {frontNine.map(hole => (
                      <TableCell key={hole.hole_number} className="text-center font-semibold text-[10px] px-0 py-1">
                        {hole.par}
                      </TableCell>
                    ))}
                    <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1">
                      {frontNine.reduce((sum, h) => sum + h.par, 0)}
                    </TableCell>
                    <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1">
                      {hasBackNine ? '' : summary.total_par}
                    </TableCell>
                  </TableRow>
                  <TableRow className="font-bold">
                    <TableCell className="font-bold text-[10px] px-0.5 py-1 bg-background">Score</TableCell>
                    {frontNine.map(hole => {
                      const score = holeScores.get(hole.hole_number);
                      return (
                        <TableCell key={hole.hole_number} className="text-center font-bold text-[10px] px-0 py-1">
                          {score && score > 0 ? score : ''}
                        </TableCell>
                      );
                    })}
                    <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1">
                      {getFrontNineTotal() > 0 ? getFrontNineTotal() : ''}
                    </TableCell>
                    <TableCell className="text-center font-bold bg-primary/10 text-[10px] px-0 py-1">
                      {hasBackNine ? '' : summary.total_score}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>

            {/* Back 9 */}
            {hasBackNine && (
              <div className="w-full border-t">
                <Table className="w-full table-fixed">
                  <TableHeader>
                    <TableRow className="bg-primary/5">
                      <TableHead className="text-center font-bold text-[10px] px-0.5 py-1.5 bg-primary/5 w-[44px]">Hole</TableHead>
                      {backNine.map(hole => (
                        <TableHead key={hole.hole_number} className="text-center font-bold text-[10px] px-0 py-1.5">
                          {hole.hole_number}
                        </TableHead>
                      ))}
                      <TableHead className="text-center font-bold text-[10px] px-0 py-1.5 bg-primary/10">In</TableHead>
                      <TableHead className="text-center font-bold text-[10px] px-0 py-1.5 bg-primary/10">Tot</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell className="font-medium text-muted-foreground text-[10px] px-0.5 py-1 bg-background">Par</TableCell>
                      {backNine.map(hole => (
                        <TableCell key={hole.hole_number} className="text-center font-semibold text-[10px] px-0 py-1">
                          {hole.par}
                        </TableCell>
                      ))}
                      <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1">
                        {backNine.reduce((sum, h) => sum + h.par, 0)}
                      </TableCell>
                      <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1">
                        {summary.total_par}
                      </TableCell>
                    </TableRow>
                    <TableRow className="font-bold">
                      <TableCell className="font-bold text-[10px] px-0.5 py-1 bg-background">Score</TableCell>
                      {backNine.map(hole => {
                        const score = holeScores.get(hole.hole_number);
                        return (
                          <TableCell key={hole.hole_number} className="text-center font-bold text-[10px] px-0 py-1">
                            {score && score > 0 ? score : ''}
                          </TableCell>
                        );
                      })}
                      <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1">
                        {getBackNineTotal() > 0 ? getBackNineTotal() : ''}
                      </TableCell>
                      <TableCell className="text-center font-bold bg-primary/10 text-[10px] px-0 py-1">
                        {summary.total_score}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3">
          <StatCard
            title="FIR %"
            value={`${Math.round(summary.fir_percentage || 0)}%`}
            progress={summary.fir_percentage || 0}
          />
          <StatCard
            title="GIR %"
            value={`${Math.round(summary.gir_percentage || 0)}%`}
            progress={summary.gir_percentage || 0}
          />
          <StatCard
            title="Up & Down"
            value={`${Math.round(summary.updown_percentage || 0)}%`}
            progress={summary.updown_percentage || 0}
          />
          <StatCard
            title="Total Putts"
            value={summary.total_putts || 0}
            subtitle={`${(summary.total_putts / summary.holes_played).toFixed(1)} per hole`}
          />
          <StatCard
            title="3-Putts"
            value={summary.three_putts || 0}
          />
          <StatCard
            title="Penalties"
            value={summary.total_penalties || 0}
          />
        </div>

        <div className="flex gap-3">
          <Button 
            variant="outline"
            size="lg"
            className="flex-1"
            onClick={() => setShowShareDialog(true)}
          >
            <Share2 className="mr-2" size={18} />
            Share
          </Button>
          
          <Button 
            onClick={() => navigate("/rounds")} 
            className="flex-1" 
            size="lg"
          >
            Done
          </Button>
        </div>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" size="sm" className="w-full text-destructive hover:text-destructive">
              <Trash2 className="mr-2" size={16} />
              Delete Round
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Round?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete this round and all its data. This action cannot be undone.
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
      </div>

      <RoundShareDialog
        open={showShareDialog}
        onOpenChange={setShowShareDialog}
        roundName={roundName}
        courseName={summary.course_name}
        score={summary.total_score}
        scoreVsPar={summary.score_vs_par}
        holesPlayed={summary.holes_played}
        roundId={roundId}
        onContinue={() => navigate("/rounds")}
      />
    </div>
  );
};

export default RoundSummary;