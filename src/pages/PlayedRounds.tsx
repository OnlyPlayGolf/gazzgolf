import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Plus, ArrowLeft, Trash2, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { TopNavBar } from "@/components/TopNavBar";
import { RoundCard } from "@/components/RoundCard";
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
import { getGameRoute, loadUnifiedRounds, type UnifiedRound } from "@/utils/unifiedRoundsLoader";

const PlayedRounds = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [rounds, setRounds] = useState<UnifiedRound[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [roundToDelete, setRoundToDelete] = useState<UnifiedRound | null>(null);
  const [deleteMode, setDeleteMode] = useState(false);

  useEffect(() => {
    fetchPlayedRounds();
  }, []);

  const isStrokeRound = (r: UnifiedRound) => r.gameType === "round" || !r.gameType;
  const canDeleteRound = (r: UnifiedRound) =>
    isStrokeRound(r) && !!currentUserId && r.ownerUserId === currentUserId;

  const fetchPlayedRounds = async () => {
    try {
      setLoading(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        navigate("/auth");
        return;
      }

      setCurrentUserId(user.id);

      const unified = await loadUnifiedRounds(user.id);
      setRounds(unified);
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


  const handleDeleteRound = async () => {
    if (!roundToDelete) return;
    const roundId = roundToDelete.id;
    const gameType = roundToDelete.gameType || 'round';

    try {
      let deleteError: any = null;

      // Delete based on game type
      if (gameType === 'round' || !gameType) {
        await supabase.from('holes').delete().eq('round_id', roundId);
        await supabase.from('round_players').delete().eq('round_id', roundId);
        const { error } = await supabase.from('rounds').delete().eq('id', roundId);
        deleteError = error;
      } else if (gameType === 'match_play') {
        await supabase.from('match_play_holes').delete().eq('game_id', roundId);
        const { error } = await supabase.from('match_play_games').delete().eq('id', roundId);
        deleteError = error;
      } else if (gameType === 'best_ball') {
        await supabase.from('best_ball_holes').delete().eq('game_id', roundId);
        const { error } = await supabase.from('best_ball_games').delete().eq('id', roundId);
        deleteError = error;
      } else if (gameType === 'copenhagen') {
        await supabase.from('copenhagen_holes').delete().eq('game_id', roundId);
        const { error } = await supabase.from('copenhagen_games').delete().eq('id', roundId);
        deleteError = error;
      } else if (gameType === 'scramble') {
        await supabase.from('scramble_holes').delete().eq('game_id', roundId);
        const { error } = await supabase.from('scramble_games').delete().eq('id', roundId);
        deleteError = error;
      } else if (gameType === 'skins') {
        await supabase.from('skins_holes').delete().eq('game_id', roundId);
        const { error } = await supabase.from('skins_games').delete().eq('id', roundId);
        deleteError = error;
      } else if (gameType === 'umbriago') {
        await supabase.from('umbriago_holes').delete().eq('game_id', roundId);
        const { error } = await supabase.from('umbriago_games').delete().eq('id', roundId);
        deleteError = error;
      } else if (gameType === 'wolf') {
        await supabase.from('wolf_holes').delete().eq('game_id', roundId);
        const { error } = await supabase.from('wolf_games').delete().eq('id', roundId);
        deleteError = error;
      }

      if (deleteError) {
        throw deleteError;
      }

      toast({
        title: "Round deleted",
        description: "The round has been deleted successfully.",
      });

      setDeleteMode(false);
      fetchPlayedRounds();
    } catch (error: any) {
      console.error("Error deleting round:", error);
      toast({
        title: "Error deleting round",
        description: error.message || "Failed to delete round",
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
        <header className="flex items-center gap-3 mb-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            className="rounded-full"
            aria-label="Back"
          >
            <ArrowLeft size={20} />
          </Button>
          <h1 className="text-xl font-semibold text-foreground flex-1">
            All Rounds ({rounds.length})
          </h1>
          {rounds.length > 0 && (
            <Button
              variant={deleteMode ? "destructive" : "ghost"}
              size="icon"
              onClick={() => setDeleteMode(!deleteMode)}
              className="h-9 w-9"
              aria-label={deleteMode ? "Cancel delete" : "Delete rounds"}
            >
              {deleteMode ? <X size={20} /> : <Trash2 size={20} />}
            </Button>
          )}
        </header>
        {deleteMode && (
          <p className="text-sm text-destructive mb-4">
            Tap a round to delete it
          </p>
        )}

        {/* New Round Button */}
        <Button onClick={() => navigate("/rounds-play")} className="w-full mb-4">
          <Plus className="mr-2" size={18} />
          New Round
        </Button>

        {/* Rounds List */}
        {loading ? (
          <div className="text-center py-8 text-muted-foreground text-sm">
            Loading...
          </div>
        ) : rounds.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <p className="mb-2">No rounds yet</p>
            <p className="text-sm">Start playing to track your scores</p>
          </div>
        ) : (
          <main className="space-y-4">
            {(() => {
              // Group rounds by year
              const roundsByYear = rounds.reduce((acc, round) => {
                const year = new Date(round.date).getFullYear().toString();
                if (!acc[year]) acc[year] = [];
                acc[year].push(round);
                return acc;
              }, {} as Record<string, UnifiedRound[]>);

              // Sort years descending (most recent first)
              const sortedYears = Object.keys(roundsByYear).sort((a, b) => parseInt(b) - parseInt(a));

              return sortedYears.map((year) => (
                <section key={year}>
                  <h2 className="text-lg font-semibold text-foreground mb-2 px-1">{year}</h2>
                  <div className="space-y-3">
                    {roundsByYear[year].map((round) => (
                      <div
                        key={`${round.gameType}-${round.id}`}
                        onClick={() => {
                          if (deleteMode) {
                            setRoundToDelete(round);
                            setDeleteDialogOpen(true);
                          }
                        }}
                      >
                        <RoundCard
                          round={round}
                          className={deleteMode ? "ring-2 ring-destructive/50 hover:ring-destructive" : ""}
                        />
                      </div>
                    ))}
                  </div>
                </section>
              ));
            })()}
          </main>
        )}
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Round</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this round at {roundToDelete?.course_name}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setRoundToDelete(null)}>
              Cancel
            </AlertDialogCancel>
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
