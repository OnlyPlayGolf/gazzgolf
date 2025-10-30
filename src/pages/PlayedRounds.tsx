import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Calendar, MapPin, Trophy, Users, Trash2 } from "lucide-react";
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

      // Fetch rounds created with the Play flow
      const { data: roundsData, error: roundsError } = await supabase
        .from("rounds")
        .select("*")
        .eq("user_id", user.id)
        .eq("origin", "play")
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
    if (!round.total_score || !round.total_par) return "In Progress";
    const diff = round.total_score - round.total_par;
    if (diff === 0) return "E";
    return diff > 0 ? `+${diff}` : `${diff}`;
  };

  const handleDeleteRound = async () => {
    if (!roundToDelete) return;

    try {
      // Delete all holes for this round
      const { error: holesError } = await supabase
        .from("holes")
        .delete()
        .eq("round_id", roundToDelete);

      if (holesError) throw holesError;

      // Delete all round players
      const { error: playersError } = await supabase
        .from("round_players")
        .delete()
        .eq("round_id", roundToDelete);

      if (playersError) throw playersError;

      // Delete the round
      const { error: roundError } = await supabase
        .from("rounds")
        .delete()
        .eq("id", roundToDelete);

      if (roundError) throw roundError;

      toast({
        title: "Round deleted",
        description: "The round has been deleted successfully.",
      });

      // Refresh the rounds list
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
      <div className="p-4 pt-20">
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-foreground mb-2">Played Rounds</h1>
              <p className="text-muted-foreground">Rounds played with friends</p>
            </div>
          </div>
          <Button onClick={() => navigate("/rounds-play")} size="lg" className="w-full">
            <Plus className="mr-2" size={20} />
            New Round
          </Button>
        </div>

        {loading ? (
          <div className="text-center py-8 text-muted-foreground">Loading rounds...</div>
        ) : rounds.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-12 text-center">
              <Trophy className="mx-auto mb-4 text-muted-foreground" size={48} />
              <h3 className="text-lg font-semibold mb-2">No played rounds yet</h3>
              <p className="text-muted-foreground mb-4">
                Start playing rounds with friends
              </p>
              <Button onClick={() => navigate("/rounds-play")}>
                <Plus className="mr-2" size={20} />
                Play Your First Round
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {rounds.map((round) => (
              <Card
                key={round.id}
                className="cursor-pointer hover:border-primary transition-colors"
                onClick={() => navigate(`/rounds/${round.id}/summary`)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div 
                      className="flex-1 cursor-pointer"
                      onClick={() => navigate(`/rounds/${round.id}/summary`)}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <MapPin size={16} className="text-primary" />
                        <h3 className="font-semibold text-foreground">{round.course_name}</h3>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Calendar size={14} />
                          <span>{format(new Date(round.date_played), "MMM d, yyyy")}</span>
                        </div>
                        {round.tee_set && (
                          <span className="px-2 py-0.5 bg-muted rounded text-xs">
                            {round.tee_set}
                          </span>
                        )}
                        <span>{round.holes_played} holes</span>
                        {round.player_count > 1 && (
                          <div className="flex items-center gap-1">
                            <Users size={14} />
                            <span>{round.player_count}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <div className="text-2xl font-bold text-primary">
                          {getScoreDisplay(round)}
                        </div>
                        {round.total_score && (
                          <div className="text-sm text-muted-foreground">
                            {round.total_score}
                          </div>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={(e) => {
                          e.stopPropagation();
                          setRoundToDelete(round.id);
                          setDeleteDialogOpen(true);
                        }}
                      >
                        <Trash2 size={18} />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
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
