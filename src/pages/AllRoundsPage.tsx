import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ChevronLeft, Trash2, X, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { TopNavBar } from "@/components/TopNavBar";
import { RoundCard, RoundCardData } from "@/components/RoundCard";
import { loadUnifiedRounds } from "@/utils/unifiedRoundsLoader";
import { toast } from "@/lib/notify";
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
  const [selectMode, setSelectMode] = useState(false);
  const [selectedRounds, setSelectedRounds] = useState<Set<string>>(new Set());
  const [roundToDelete, setRoundToDelete] = useState<RoundCardData | null>(null);
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);
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

  const toggleRoundSelection = (roundId: string) => {
    setSelectedRounds(prev => {
      const next = new Set(prev);
      if (next.has(roundId)) {
        next.delete(roundId);
      } else {
        next.add(roundId);
      }
      return next;
    });
  };

  const handleSelectModeToggle = () => {
    if (selectMode) {
      // Exiting select mode - clear selections
      setSelectMode(false);
      setSelectedRounds(new Set());
    } else {
      // Entering select mode
      setSelectMode(true);
      setDeleteMode(false); // Exit single delete mode if active
    }
  };

  const handleDeleteModeToggle = () => {
    if (deleteMode) {
      // Exiting delete mode
      setDeleteMode(false);
    } else {
      // Entering delete mode - also exit select mode
      setDeleteMode(true);
      setSelectMode(false);
      setSelectedRounds(new Set());
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

  // Helper function to delete a single round by data
  const deleteRoundById = async (round: RoundCardData): Promise<boolean> => {
    const gameType = round.gameType || 'stroke_play';
    const roundId = round.id;

    // Delete pro stats data if it exists (for any game type)
    const { data: proRound } = await supabase
      .from('pro_stats_rounds')
      .select('id')
      .eq('external_round_id', roundId)
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

    // Delete round comments
    await supabase.from('round_comments').delete().eq('round_id', roundId);

    let deleteResult: { error: any; count: number | null } = { error: null, count: null };

    // Delete based on game type
    if (gameType === 'stroke_play' || gameType === 'round') {
      await supabase.from('holes').delete().eq('round_id', roundId);
      await supabase.from('round_players').delete().eq('round_id', roundId);
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

    return (deleteResult.count ?? 0) > 0;
  };

  const handleBulkDeleteConfirm = async () => {
    setDeleting(true);
    let successCount = 0;
    let failCount = 0;

    try {
      // Get the rounds to delete
      const roundsToDelete = rounds.filter(r => selectedRounds.has(r.id));

      for (const round of roundsToDelete) {
        try {
          const deleted = await deleteRoundById(round);
          if (deleted) {
            successCount++;
          } else {
            failCount++;
          }
        } catch (error) {
          console.error('Error deleting round:', round.id, error);
          failCount++;
        }
      }

      if (successCount > 0) {
        toast.success(`${successCount} round${successCount !== 1 ? 's' : ''} deleted successfully`);
      }
      if (failCount > 0) {
        toast.error(`Failed to delete ${failCount} round${failCount !== 1 ? 's' : ''}`);
      }

      // Reset state and reload
      setShowBulkDeleteDialog(false);
      setSelectedRounds(new Set());
      setSelectMode(false);
      setDeleteMode(false);
      loadRounds();
    } catch (error) {
      console.error('Error in bulk delete:', error);
      toast.error("Failed to delete rounds");
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
              <div className="flex items-center gap-2">
                {deleteMode && !selectMode && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSelectModeToggle}
                    className="h-9"
                  >
                    Select
                  </Button>
                )}
                {selectMode && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSelectModeToggle}
                    className="h-9"
                  >
                    Cancel
                  </Button>
                )}
                <Button
                  variant={(deleteMode || selectMode) ? "destructive" : "ghost"}
                  size="icon"
                  onClick={handleDeleteModeToggle}
                  className="h-9 w-9"
                >
                  {(deleteMode || selectMode) ? <X size={20} /> : <Trash2 size={20} />}
                </Button>
              </div>
            )}
          </div>
          {deleteMode && !selectMode && (
            <p className="text-sm text-destructive mt-2">
              Tap a round to delete it, or click "Select" to delete multiple
            </p>
          )}
          {selectMode && (
            <p className="text-sm text-destructive mt-2">
              {selectedRounds.size > 0 
                ? `${selectedRounds.size} round${selectedRounds.size !== 1 ? 's' : ''} selected` 
                : "Tap rounds to select them"}
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
              const isSelected = selectedRounds.has(round.id);
              
              // Determine click handler based on mode
              let clickHandler: (() => void) | undefined;
              if (selectMode) {
                clickHandler = canDelete ? () => toggleRoundSelection(round.id) : () => setShowCannotDeleteDialog(true);
              } else if (deleteMode) {
                clickHandler = () => handleRoundClick(round);
              }
              
              return (
                <div key={`${round.gameType || 'round'}-${round.id}`} className="relative">
                  {selectMode && (
                    <div 
                      className={`absolute left-2 top-1/2 -translate-y-1/2 z-10 w-6 h-6 rounded-full border-2 flex items-center justify-center cursor-pointer ${
                        canDelete 
                          ? isSelected 
                            ? "bg-destructive border-destructive" 
                            : "bg-background border-muted-foreground hover:border-destructive"
                          : "bg-muted border-muted-foreground/50 cursor-not-allowed"
                      }`}
                      onClick={canDelete ? () => toggleRoundSelection(round.id) : () => setShowCannotDeleteDialog(true)}
                    >
                      {isSelected && <Check size={14} className="text-white" />}
                    </div>
                  )}
                  <RoundCard 
                    round={round} 
                    onClick={clickHandler}
                    disabled={deleteMode || selectMode}
                    className={`${selectMode ? "ml-10" : ""} ${
                      deleteMode && !selectMode
                        ? canDelete 
                          ? "ring-2 ring-destructive/50 hover:ring-destructive cursor-pointer" 
                          : "opacity-50 cursor-pointer"
                        : selectMode
                          ? canDelete
                            ? isSelected
                              ? "ring-2 ring-destructive cursor-pointer"
                              : "cursor-pointer hover:ring-1 hover:ring-destructive/50"
                            : "opacity-50 cursor-pointer"
                          : ""
                    }`}
                  />
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            No rounds found
          </div>
        )}
      </div>

      {/* Floating Delete Selected button */}
      {selectMode && selectedRounds.size > 0 && (
        <div className="fixed bottom-6 left-0 right-0 flex justify-center z-50 px-4">
          <Button
            variant="destructive"
            size="lg"
            onClick={() => setShowBulkDeleteDialog(true)}
            className="shadow-lg"
          >
            Delete Selected ({selectedRounds.size})
          </Button>
        </div>
      )}

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

      {/* Bulk delete confirmation dialog */}
      <AlertDialog open={showBulkDeleteDialog} onOpenChange={setShowBulkDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedRounds.size} Round{selectedRounds.size !== 1 ? 's' : ''}</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {selectedRounds.size} round{selectedRounds.size !== 1 ? 's' : ''}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleBulkDeleteConfirm}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Deleting..." : `Delete ${selectedRounds.size} Round${selectedRounds.size !== 1 ? 's' : ''}`}
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
