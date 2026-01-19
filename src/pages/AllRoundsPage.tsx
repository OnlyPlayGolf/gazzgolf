import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ChevronLeft, Trash2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { TopNavBar } from "@/components/TopNavBar";
import { RoundCard, RoundCardData } from "@/components/RoundCard";
import { loadUnifiedRounds } from "@/utils/unifiedRoundsLoader";
import { toast } from "sonner";
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

export default function AllRoundsPage() {
  const navigate = useNavigate();
  const { userId } = useParams<{ userId: string }>();
  const [rounds, setRounds] = useState<RoundCardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [profileName, setProfileName] = useState<string>("");
  const [isOwnProfile, setIsOwnProfile] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [deleteMode, setDeleteMode] = useState(false);
  const [roundToDelete, setRoundToDelete] = useState<RoundCardData | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [showCannotDeleteDialog, setShowCannotDeleteDialog] = useState(false);

  useEffect(() => {
    loadRounds();
  }, [userId]);

  const loadRounds = async () => {
    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    
    const targetUserId = userId || user?.id;
    
    if (!targetUserId) {
      navigate('/auth');
      return;
    }

    setCurrentUserId(user?.id || null);
    setIsOwnProfile(!userId || userId === user?.id);

    const { data: profileData } = await supabase
      .from('profiles')
      .select('display_name, username')
      .eq('id', targetUserId)
      .single();

    if (profileData) {
      setProfileName(profileData.display_name || profileData.username || 'User');
    }

    const unifiedRounds = await loadUnifiedRounds(targetUserId);
    setRounds(unifiedRounds);
    setLoading(false);
  };

  // Check if the current user owns this round and can delete it
  const canDeleteRound = (round: RoundCardData) => {
    return currentUserId && round.ownerUserId === currentUserId;
  };

  const handleRoundClick = (round: RoundCardData) => {
    if (canDeleteRound(round)) {
      setRoundToDelete(round);
    } else {
      setShowCannotDeleteDialog(true);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!roundToDelete) return;

    setDeleting(true);
    try {
      const gameType = roundToDelete.gameType || 'stroke_play';
      const roundId = roundToDelete.id;

      // Delete pro stats data if it exists (for any game type)
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

      // Delete round comments
      await supabase.from('round_comments').delete().eq('round_id', roundId);

      let deleteResult: { error: any; count: number | null } = { error: null, count: null };

      // Delete based on game type
      if (gameType === 'stroke_play' || gameType === 'round') {
        // Delete holes first
        await supabase.from('holes').delete().eq('round_id', roundId);
        // Delete round players
        await supabase.from('round_players').delete().eq('round_id', roundId);
        // Delete the round and check if it was actually deleted
        const { data, error } = await supabase
          .from('rounds')
          .delete()
          .eq('id', roundId)
          .select();
        deleteResult = { error, count: data?.length ?? 0 };
      } else if (gameType === 'match_play') {
        await supabase.from('match_play_holes').delete().eq('game_id', roundId);
        const { data, error } = await supabase
          .from('match_play_games')
          .delete()
          .eq('id', roundId)
          .select();
        deleteResult = { error, count: data?.length ?? 0 };
      } else if (gameType === 'best_ball') {
        await supabase.from('best_ball_holes').delete().eq('game_id', roundId);
        const { data, error } = await supabase
          .from('best_ball_games')
          .delete()
          .eq('id', roundId)
          .select();
        deleteResult = { error, count: data?.length ?? 0 };
      } else if (gameType === 'copenhagen') {
        await supabase.from('copenhagen_holes').delete().eq('game_id', roundId);
        const { data, error } = await supabase
          .from('copenhagen_games')
          .delete()
          .eq('id', roundId)
          .select();
        deleteResult = { error, count: data?.length ?? 0 };
      } else if (gameType === 'scramble') {
        await supabase.from('scramble_holes').delete().eq('game_id', roundId);
        const { data, error } = await supabase
          .from('scramble_games')
          .delete()
          .eq('id', roundId)
          .select();
        deleteResult = { error, count: data?.length ?? 0 };
      } else if (gameType === 'skins') {
        await supabase.from('skins_holes').delete().eq('game_id', roundId);
        const { data, error } = await supabase
          .from('skins_games')
          .delete()
          .eq('id', roundId)
          .select();
        deleteResult = { error, count: data?.length ?? 0 };
      } else if (gameType === 'umbriago') {
        await supabase.from('umbriago_holes').delete().eq('game_id', roundId);
        const { data, error } = await supabase
          .from('umbriago_games')
          .delete()
          .eq('id', roundId)
          .select();
        deleteResult = { error, count: data?.length ?? 0 };
      } else if (gameType === 'wolf') {
        await supabase.from('wolf_holes').delete().eq('game_id', roundId);
        const { data, error } = await supabase
          .from('wolf_games')
          .delete()
          .eq('id', roundId)
          .select();
        deleteResult = { error, count: data?.length ?? 0 };
      }

      if (deleteResult.error) {
        throw deleteResult.error;
      }

      // Check if anything was actually deleted (RLS may have blocked it)
      if (deleteResult.count === 0) {
        setRoundToDelete(null);
        setShowCannotDeleteDialog(true);
        return;
      }

      toast.success("Round deleted successfully");
      setRoundToDelete(null);
      setDeleteMode(false);
      loadRounds();
    } catch (error) {
      console.error('Error deleting round:', error);
      toast.error("Failed to delete round");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <TopNavBar />
      
      <div className="bg-card border-b border-border pt-16">
        <div className="p-4 max-w-2xl mx-auto">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(-1)}
            className="mb-3 -ml-2"
          >
            <ChevronLeft size={20} className="mr-1" />
            Back
          </Button>
          
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold">
              All Rounds ({rounds.length})
            </h1>
            {isOwnProfile && rounds.length > 0 && (
              <Button
                variant={deleteMode ? "destructive" : "ghost"}
                size="icon"
                onClick={() => setDeleteMode(!deleteMode)}
                className="h-9 w-9"
              >
                {deleteMode ? <X size={20} /> : <Trash2 size={20} />}
              </Button>
            )}
          </div>
          {deleteMode && (
            <p className="text-sm text-destructive mt-2">
              Tap a round to delete it
            </p>
          )}
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-4">
        {loading ? (
          <div className="text-center py-12 text-muted-foreground">
            Loading rounds...
          </div>
        ) : rounds.length > 0 ? (
          <div className="space-y-3">
            {rounds.map((round) => {
              const canDelete = canDeleteRound(round);
              return (
                <RoundCard 
                  key={`${round.gameType || 'round'}-${round.id}`}
                  round={round} 
                  onClick={deleteMode ? () => handleRoundClick(round) : undefined}
                  disabled={deleteMode}
                  className={deleteMode 
                    ? canDelete 
                      ? "ring-2 ring-destructive/50 hover:ring-destructive cursor-pointer" 
                      : "opacity-50 cursor-pointer"
                    : ""
                  }
                />
              );
            })}
          </div>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            No rounds found
          </div>
        )}
      </div>

      {/* Delete confirmation dialog for owned rounds */}
      <AlertDialog open={!!roundToDelete} onOpenChange={() => setRoundToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Round</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this round at {roundToDelete?.course_name}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteConfirm}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Cannot delete dialog for non-owned rounds */}
      <AlertDialog open={showCannotDeleteDialog} onOpenChange={setShowCannotDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cannot Delete Round</AlertDialogTitle>
            <AlertDialogDescription>
              You can only delete rounds you created.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setShowCannotDeleteDialog(false)}>
              Done
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
