import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Plus, ArrowLeft, Trash2, ChevronRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { TopNavBar } from "@/components/TopNavBar";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Round {
  id: string;
  course_name: string;
  round_name?: string;
  date_played: string;
  tee_set: string;
  holes_played: number;
  total_score?: number;
  total_par?: number;
  player_count?: number;
}

const PlayedRounds = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [rounds, setRounds] = useState<Round[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [roundToDelete, setRoundToDelete] = useState<string | null>(null);

  useEffect(() => {
    fetchPlayedRounds();
  }, []);

  const fetchPlayedRounds = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }

      const { data: roundsData, error: roundsError } = await supabase
        .from("rounds")
        .select("*")
        .eq("user_id", user.id)
        .or("origin.eq.play,origin.is.null,origin.eq.tracker")
        .order("date_played", { ascending: false });

      if (roundsError) throw roundsError;

      const roundsWithScores = await Promise.all(
        (roundsData || []).map(async (round) => {
          const { data: summaryData } = await supabase
            .from("round_summaries")
            .select("total_score, total_par")
            .eq("round_id", round.id)
            .maybeSingle();

          const { count: playerCount } = await supabase
            .from("round_players")
            .select("*", { count: 'exact', head: true })
            .eq("round_id", round.id);

          return {
            id: round.id,
            course_name: round.course_name,
            round_name: round.round_name,
            date_played: round.date_played,
            tee_set: round.tee_set,
            holes_played: round.holes_played,
            total_score: summaryData?.total_score,
            total_par: summaryData?.total_par,
            player_count: playerCount || 0,
          };
        })
      );

      setRounds(roundsWithScores as Round[]);
    } catch (error: any) {
      toast({
        title: "Error loading rounds",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getScoreDisplay = (round: Round) => {
    if (!round.total_score || !round.total_par) return "-";
    const diff = round.total_score - round.total_par;
    if (diff === 0) return "E";
    return diff > 0 ? `+${diff}` : `${diff}`;
  };

  const handleDeleteRound = async () => {
    if (!roundToDelete) return;

    try {
      const { error: holesError } = await supabase
        .from("holes")
        .delete()
        .eq("round_id", roundToDelete);

      if (holesError) throw holesError;

      const { error: playersError } = await supabase
        .from("round_players")
        .delete()
        .eq("round_id", roundToDelete);

      if (playersError) throw playersError;

      const { error: roundError } = await supabase
        .from("rounds")
        .delete()
        .eq("id", roundToDelete);

      if (roundError) throw roundError;

      toast({
        title: "Round deleted",
        description: "The round has been deleted successfully.",
      });

      fetchPlayedRounds();
    } catch (error: any) {
      console.error("Error deleting round:", error);
      toast({
        title: "Error deleting round",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setDeleteDialogOpen(false);
      setRoundToDelete(null);
    }
  };

  return (
    <div className="pb-20 min-h-screen bg-background">
      <TopNavBar />
      <div className="px-4 pt-20">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => navigate(-1)}
            className="rounded-full"
          >
            <ArrowLeft size={20} />
          </Button>
          <h1 className="text-xl font-semibold text-foreground">All Rounds</h1>
        </div>

        {/* New Round Button */}
        <Button onClick={() => navigate("/rounds-play")} className="w-full mb-4">
          <Plus className="mr-2" size={18} />
          New Round
        </Button>

        {/* Rounds List */}
        {loading ? (
          <div className="text-center py-8 text-muted-foreground text-sm">Loading...</div>
        ) : rounds.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <p className="mb-2">No rounds yet</p>
            <p className="text-sm">Start playing to track your scores</p>
          </div>
        ) : (
          <div className="divide-y divide-border rounded-lg border bg-card overflow-hidden">
            {rounds.map((round) => (
              <div
                key={round.id}
                className="flex items-center gap-3 px-3 py-3 hover:bg-muted/50 transition-colors cursor-pointer"
                onClick={() => navigate(`/rounds/${round.id}/detail`)}
              >
                {/* Date */}
                <div className="w-12 text-center flex-shrink-0">
                  <div className="text-xs text-muted-foreground uppercase">
                    {format(new Date(round.date_played), "MMM")}
                  </div>
                  <div className="text-lg font-semibold">
                    {format(new Date(round.date_played), "d")}
                  </div>
                </div>

                {/* Round Name & Details */}
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{round.round_name || 'Untitled Round'}</div>
                  <div className="text-xs text-muted-foreground flex items-center gap-2">
                    <span>{round.course_name}</span>
                    <span>• {round.holes_played}H</span>
                    {round.tee_set && <span>• {round.tee_set}</span>}
                    {round.player_count > 1 && <span>• {round.player_count} players</span>}
                  </div>
                </div>

                {/* Score */}
                <div className="flex items-center gap-2">
                  <div className="text-right">
                    <div className={`font-bold ${
                      getScoreDisplay(round) === '-' ? 'text-muted-foreground' :
                      getScoreDisplay(round).startsWith('+') ? 'text-destructive' :
                      getScoreDisplay(round) === 'E' ? 'text-foreground' : 'text-green-600'
                    }`}>
                      {getScoreDisplay(round)}
                    </div>
                    {round.total_score && (
                      <div className="text-xs text-muted-foreground">{round.total_score}</div>
                    )}
                  </div>

                  {/* Delete Button */}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      setRoundToDelete(round.id);
                      setDeleteDialogOpen(true);
                    }}
                  >
                    <Trash2 size={16} />
                  </Button>

                  <ChevronRight size={16} className="text-muted-foreground" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Round</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this round? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setRoundToDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteRound}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default PlayedRounds;
