import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Plus, ArrowLeft, Trash2, ChevronRight, X } from "lucide-react";
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
import { getGameRoute, loadUnifiedRounds, type UnifiedRound } from "@/utils/unifiedRoundsLoader";

const PlayedRounds = () => {
  const navigate = useNavigate();
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

  const getScoreDisplay = (round: UnifiedRound) => {
    if (!isStrokeRound(round)) return "-";
    const diff = round.score;
    if (diff === 0) return "E";
    return diff > 0 ? `+${diff}` : `${diff}`;
  };

  const handleDeleteRound = async () => {
    if (!roundToDelete) return;
    const roundId = roundToDelete.id;

    try {
      const { error: holesError } = await supabase
        .from("holes")
        .delete()
        .eq("round_id", roundId);

      if (holesError) throw holesError;

      const { error: playersError } = await supabase
        .from("round_players")
        .delete()
        .eq("round_id", roundId);

      if (playersError) throw playersError;

      const { error: roundError } = await supabase
        .from("rounds")
        .delete()
        .eq("id", roundId);

      if (roundError) throw roundError;

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
          <main className="divide-y divide-border rounded-lg border bg-card overflow-hidden">
            {rounds.map((round) => {
              const scoreText = getScoreDisplay(round);
              const showStrokeScore = isStrokeRound(round);
              const canDelete = canDeleteRound(round);

              return (
                <article
                  key={`${round.gameType}-${round.id}`}
                  className={`flex items-center gap-3 px-3 py-3 hover:bg-muted/50 transition-colors cursor-pointer ${
                    deleteMode && canDelete ? "ring-2 ring-destructive/50 hover:ring-destructive" : ""
                  }`}
                  onClick={() => {
                    if (deleteMode && canDelete) {
                      setRoundToDelete(round);
                      setDeleteDialogOpen(true);
                    } else {
                      navigate(getGameRoute(round.gameType || "round", round.id));
                    }
                  }}
                >
                  {/* Date */}
                  <div className="w-12 text-center flex-shrink-0">
                    <div className="text-xs text-muted-foreground uppercase">
                      {format(new Date(round.date), "MMM")}
                    </div>
                    <div className="text-lg font-semibold">
                      {format(new Date(round.date), "d")}
                    </div>
                  </div>

                  {/* Round Name & Details */}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">
                      {round.round_name || round.gameMode}
                    </div>
                    <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
                      <span className="truncate">{round.course_name}</span>
                      {typeof round.holesPlayed === "number" && (
                        <span>• {round.holesPlayed}H</span>
                      )}
                      {round.teeSet && <span>• {round.teeSet}</span>}
                      {round.playerCount > 1 && <span>• {round.playerCount} players</span>}
                      <span>• {round.gameMode}</span>
                    </div>
                  </div>

                  {/* Score / Action */}
                  <div className="flex items-center gap-2">
                    <div className="text-right">
                      <div
                        className={`font-bold ${
                          !showStrokeScore || scoreText === "-"
                            ? "text-muted-foreground"
                            : scoreText.startsWith("+")
                              ? "text-destructive"
                              : scoreText === "E"
                                ? "text-foreground"
                                : "text-green-600"
                        }`}
                      >
                        {showStrokeScore ? scoreText : "View"}
                      </div>
                      {showStrokeScore && typeof round.totalScore === "number" && (
                        <div className="text-xs text-muted-foreground">
                          {round.totalScore}
                        </div>
                      )}
                    </div>

                    <ChevronRight size={16} className="text-muted-foreground" />
                  </div>
                </article>
              );
            })}
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
