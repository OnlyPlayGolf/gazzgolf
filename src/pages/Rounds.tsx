import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
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
} from "@/components/ui/alert-dialog";
import { Plus, Calendar, MapPin, Trophy, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { TopNavBar } from "@/components/TopNavBar";

interface Round {
  id: string;
  course_name: string;
  date_played: string;
  tee_set: string;
  holes_played: number;
  total_score?: number;
  total_par?: number;
  origin?: string;
}

const Rounds = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [rounds, setRounds] = useState<Round[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [roundToDelete, setRoundToDelete] = useState<string | null>(null);

  useEffect(() => {
    fetchRounds();
  }, []);

  const fetchRounds = async () => {
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
        .or('origin.is.null,origin.eq.tracker,origin.eq.pro_stats')
        .order("date_played", { ascending: false });

      if (roundsError) throw roundsError;

      const roundIds = (roundsData || []).map(r => r.id);
      const { data: proLinks } = await supabase
        .from('pro_stats_rounds')
        .select('external_round_id')
        .in('external_round_id', roundIds);
      const proSet = new Set((proLinks || []).map((r: any) => r.external_round_id));

      const roundsWithScores = await Promise.all(
        (roundsData || []).map(async (round) => {
          const { data: summaryData } = await supabase
            .from('round_summaries')
            .select('total_score, total_par')
            .eq('round_id', round.id)
            .maybeSingle();

          return {
            ...round,
            origin: proSet.has(round.id) ? 'pro_stats' : (round.origin ?? null),
            total_score: summaryData?.total_score,
            total_par: summaryData?.total_par,
          };
        })
      );

      setRounds(roundsWithScores);
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

  const handleDeleteClick = (roundId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setRoundToDelete(roundId);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!roundToDelete) return;

    try {
      // Delete pro stats holes first if they exist
      const { data: proRound } = await supabase
        .from('pro_stats_rounds')
        .select('id')
        .eq('external_round_id', roundToDelete)
        .maybeSingle();

      if (proRound?.id) {
        await supabase
          .from('pro_stats_holes')
          .delete()
          .eq('pro_round_id', proRound.id);
        
        await supabase
          .from('pro_stats_rounds')
          .delete()
          .eq('id', proRound.id);
      }

      // Delete regular holes
      await supabase
        .from('holes')
        .delete()
        .eq('round_id', roundToDelete);

      // Delete the round
      const { error } = await supabase
        .from('rounds')
        .delete()
        .eq('id', roundToDelete);

      if (error) throw error;

      toast({
        title: "Round deleted",
        description: "The round has been removed",
      });

      fetchRounds();
    } catch (error: any) {
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
              <h1 className="text-2xl font-bold text-foreground mb-2">Round Stats</h1>
              <p className="text-muted-foreground">Log and review your rounds</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Button onClick={() => navigate("/rounds/setup")} size="lg" variant="outline">
              <Plus className="mr-2" size={20} />
              New Round
            </Button>
            <Button onClick={() => navigate("/rounds/pro-setup")} size="lg" className="border-primary">
              <Plus className="mr-2" size={20} />
              Pro Round
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-8 text-muted-foreground">Loading rounds...</div>
        ) : rounds.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-12 text-center">
              <Trophy className="mx-auto mb-4 text-muted-foreground" size={48} />
              <h3 className="text-lg font-semibold mb-2">No rounds yet</h3>
              <p className="text-muted-foreground mb-4">
                Start tracking your golf rounds and improve your game
              </p>
              <Button onClick={() => navigate("/rounds/setup")}>
                <Plus className="mr-2" size={20} />
                Start Your First Round
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {rounds.map((round) => (
              <Card
                key={round.id}
                className="cursor-pointer hover:border-primary transition-colors"
                onClick={() => navigate(`/rounds/${round.id}/${round.origin === 'pro_stats' ? 'pro-summary' : 'summary'}`)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
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
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
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
                        className="text-destructive hover:text-destructive"
                        onClick={(e) => handleDeleteClick(round.id, e)}
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

        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Round?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete this round and all its data. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
};

export default Rounds;
