import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Plus, ArrowLeft, Trash2, X, Check, Settings, CalendarDays } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { TopNavBar } from "@/components/TopNavBar";
import { RoundCard } from "@/components/RoundCard";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
import { getGameRoute, loadUnifiedRounds, invalidateUnifiedRoundsCache, type UnifiedRound } from "@/utils/unifiedRoundsLoader";
import { EventSettingsSheet } from "@/components/EventSettingsSheet";

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
  const [selectMode, setSelectMode] = useState(false);
  const [selectedRounds, setSelectedRounds] = useState<Set<string>>(new Set());
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);
  const [showCannotDeleteDialog, setShowCannotDeleteDialog] = useState(false);

  const [events, setEvents] = useState<{ id: string; name: string; creator_id: string }[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [eventSettingsOpen, setEventSettingsOpen] = useState(false);
  const [showCreateEventDialog, setShowCreateEventDialog] = useState(false);
  const [newEventName, setNewEventName] = useState("");
  const [createEventLoading, setCreateEventLoading] = useState(false);

  useEffect(() => {
    fetchPlayedRounds();
  }, []);

  const fetchEvents = async () => {
    if (!currentUserId) return;
    try {
      setEventsLoading(true);
      const { data, error } = await supabase
        .from("events")
        .select("id, name, creator_id")
        .order("created_at", { ascending: false });
      if (error) throw error;
      setEvents(data || []);
    } catch {
      setEvents([]);
    } finally {
      setEventsLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, [currentUserId]);

  const canDeleteRound = (r: UnifiedRound) =>
    !!currentUserId && r.ownerUserId === currentUserId;

  const handleCreateEvent = async () => {
    const name = newEventName.trim();
    if (!name) {
      toast({ title: "Event name required", description: "Enter a name for the event", variant: "destructive" });
      return;
    }
    if (!currentUserId) {
      toast({ title: "Not signed in", variant: "destructive" });
      return;
    }
    setCreateEventLoading(true);
    try {
      const { data: newEvent, error } = await supabase
        .from("events")
        .insert({
          name,
          creator_id: currentUserId,
          game_type: "round",
        })
        .select("id, name")
        .single();
      if (error) throw error;
      setEvents((prev) => [{ id: newEvent.id, name: newEvent.name, creator_id: currentUserId }, ...prev]);
      setSelectedEventId(newEvent.id);
      setNewEventName("");
      setShowCreateEventDialog(false);
      toast({ title: "Event created", description: `"${newEvent.name}" is selected. Add rounds to it from Event settings.` });
    } catch (err: any) {
      toast({ title: "Could not create event", description: err?.message || "Please try again", variant: "destructive" });
    } finally {
      setCreateEventLoading(false);
    }
  };

  const filteredRounds = selectedEventId
    ? rounds.filter((r) => (r as UnifiedRound & { event_id?: string | null }).event_id === selectedEventId)
    : rounds;

  const selectedEvent = selectedEventId ? events.find((e) => e.id === selectedEventId) : null;
  const isEventCreator = selectedEvent && currentUserId && selectedEvent.creator_id === currentUserId;
  
  const handleRoundClickInDeleteMode = (round: UnifiedRound) => {
    if (canDeleteRound(round)) {
      setRoundToDelete(round);
      setDeleteDialogOpen(true);
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
      setDeleteMode(false);
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

      // Delete round comments first
      await supabase.from('round_comments').delete().eq('round_id', roundId);

      let deleteResult: { error: any; count: number } = { error: null, count: 0 };

      // Delete based on game type
      if (gameType === 'round' || !gameType) {
        await supabase.from('holes').delete().eq('round_id', roundId);
        await supabase.from('round_players').delete().eq('round_id', roundId);
        const { data, error } = await supabase.from('rounds').delete().eq('id', roundId).select();
        deleteResult = { error, count: data?.length ?? 0 };
      } else if (gameType === 'match_play') {
        await supabase.from('match_play_holes').delete().eq('game_id', roundId);
        const { data, error } = await supabase.from('match_play_games').delete().eq('id', roundId).select();
        deleteResult = { error, count: data?.length ?? 0 };
      } else if (gameType === 'best_ball') {
        await supabase.from('best_ball_holes').delete().eq('game_id', roundId);
        const { data, error } = await supabase.from('best_ball_games').delete().eq('id', roundId).select();
        deleteResult = { error, count: data?.length ?? 0 };
      } else if (gameType === 'copenhagen') {
        await supabase.from('copenhagen_holes').delete().eq('game_id', roundId);
        const { data, error } = await supabase.from('copenhagen_games').delete().eq('id', roundId).select();
        deleteResult = { error, count: data?.length ?? 0 };
      } else if (gameType === 'scramble') {
        await supabase.from('scramble_holes').delete().eq('game_id', roundId);
        const { data, error } = await supabase.from('scramble_games').delete().eq('id', roundId).select();
        deleteResult = { error, count: data?.length ?? 0 };
      } else if (gameType === 'skins') {
        await supabase.from('skins_holes').delete().eq('game_id', roundId);
        const { data, error } = await supabase.from('skins_games').delete().eq('id', roundId).select();
        deleteResult = { error, count: data?.length ?? 0 };
      } else if (gameType === 'umbriago') {
        await supabase.from('umbriago_holes').delete().eq('game_id', roundId);
        const { data, error } = await supabase.from('umbriago_games').delete().eq('id', roundId).select();
        deleteResult = { error, count: data?.length ?? 0 };
      } else if (gameType === 'wolf') {
        await supabase.from('wolf_holes').delete().eq('game_id', roundId);
        const { data, error } = await supabase.from('wolf_games').delete().eq('id', roundId).select();
        deleteResult = { error, count: data?.length ?? 0 };
      }

      if (deleteResult.error) {
        throw deleteResult.error;
      }

      // Check if anything was actually deleted (RLS may have blocked it)
      if (deleteResult.count === 0) {
        setDeleteDialogOpen(false);
        setRoundToDelete(null);
        setShowCannotDeleteDialog(true);
        return;
      }

      // Optimistically update UI by removing the deleted round immediately
      // Check both id and gameType to handle cases where rounds might have the same id but different gameTypes
      setRounds(prev => prev.filter(r => 
        !(r.id === roundId && (r.gameType || 'round') === gameType)
      ));

      toast({
        title: "Round deleted",
        description: "The round has been deleted successfully.",
      });

      setDeleteMode(false);
      
      // Invalidate cache to ensure fresh data on refetch
      if (currentUserId) {
        invalidateUnifiedRoundsCache(currentUserId);
      }
      
      // Refetch to ensure everything is in sync (but UI already updated)
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

  const handleBulkDelete = async () => {
    const roundsToDelete = rounds.filter(r => selectedRounds.has(r.id));
    let successCount = 0;
    let failCount = 0;
    const deletedRoundIds = new Set<string>();

    for (const round of roundsToDelete) {
      const roundId = round.id;
      const gameType = round.gameType || 'round';

      try {
        // Delete pro stats data if it exists
        const { data: proRound } = await supabase
          .from('pro_stats_rounds')
          .select('id')
          .eq('external_round_id', roundId)
          .maybeSingle();

        if (proRound?.id) {
          await supabase.from('pro_stats_holes').delete().eq('pro_round_id', proRound.id);
          await supabase.from('pro_stats_rounds').delete().eq('id', proRound.id);
        }

        // Delete round comments
        await supabase.from('round_comments').delete().eq('round_id', roundId);

        let deleteResult: { error: any; count: number } = { error: null, count: 0 };

        // Delete based on game type
        if (gameType === 'round' || !gameType) {
          await supabase.from('holes').delete().eq('round_id', roundId);
          await supabase.from('round_players').delete().eq('round_id', roundId);
          const { data, error } = await supabase.from('rounds').delete().eq('id', roundId).select();
          deleteResult = { error, count: data?.length ?? 0 };
        } else if (gameType === 'match_play') {
          await supabase.from('match_play_holes').delete().eq('game_id', roundId);
          const { data, error } = await supabase.from('match_play_games').delete().eq('id', roundId).select();
          deleteResult = { error, count: data?.length ?? 0 };
        } else if (gameType === 'best_ball') {
          await supabase.from('best_ball_holes').delete().eq('game_id', roundId);
          const { data, error } = await supabase.from('best_ball_games').delete().eq('id', roundId).select();
          deleteResult = { error, count: data?.length ?? 0 };
        } else if (gameType === 'copenhagen') {
          await supabase.from('copenhagen_holes').delete().eq('game_id', roundId);
          const { data, error } = await supabase.from('copenhagen_games').delete().eq('id', roundId).select();
          deleteResult = { error, count: data?.length ?? 0 };
        } else if (gameType === 'scramble') {
          await supabase.from('scramble_holes').delete().eq('game_id', roundId);
          const { data, error } = await supabase.from('scramble_games').delete().eq('id', roundId).select();
          deleteResult = { error, count: data?.length ?? 0 };
        } else if (gameType === 'skins') {
          await supabase.from('skins_holes').delete().eq('game_id', roundId);
          const { data, error } = await supabase.from('skins_games').delete().eq('id', roundId).select();
          deleteResult = { error, count: data?.length ?? 0 };
        } else if (gameType === 'umbriago') {
          await supabase.from('umbriago_holes').delete().eq('game_id', roundId);
          const { data, error } = await supabase.from('umbriago_games').delete().eq('id', roundId).select();
          deleteResult = { error, count: data?.length ?? 0 };
        } else if (gameType === 'wolf') {
          await supabase.from('wolf_holes').delete().eq('game_id', roundId);
          const { data, error } = await supabase.from('wolf_games').delete().eq('id', roundId).select();
          deleteResult = { error, count: data?.length ?? 0 };
        }

        if (deleteResult.error) {
          throw deleteResult.error;
        }

        if (deleteResult.count > 0) {
          successCount++;
          deletedRoundIds.add(roundId);
          // Optimistically update UI by removing the deleted round immediately
          // Check both id and gameType to handle cases where rounds might have the same id but different gameTypes
          setRounds(prev => prev.filter(r => 
            !(r.id === roundId && (r.gameType || 'round') === gameType)
          ));
        } else {
          failCount++;
        }
      } catch (error) {
        console.error('Error deleting round:', roundId, error);
        failCount++;
      }
    }

    // Remove deleted rounds from selection
    setSelectedRounds(prev => {
      const next = new Set(prev);
      deletedRoundIds.forEach(id => next.delete(id));
      return next;
    });

    if (successCount > 0) {
      toast({
        title: `${successCount} round${successCount !== 1 ? 's' : ''} deleted`,
        description: "The rounds have been deleted successfully.",
      });
    }
    if (failCount > 0) {
      toast({
        title: `Failed to delete ${failCount} round${failCount !== 1 ? 's' : ''}`,
        variant: "destructive",
      });
    }

    setShowBulkDeleteDialog(false);
    setSelectedRounds(new Set());
    setSelectMode(false);
    setDeleteMode(false);
    
    // Invalidate cache to ensure fresh data on refetch
    if (currentUserId) {
      invalidateUnifiedRoundsCache(currentUserId);
    }
    
    // Reload to ensure everything is in sync
    await fetchPlayedRounds();
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
            All Rounds ({filteredRounds.length})
          </h1>
          {rounds.length > 0 && (
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
              {selectMode && selectedRounds.size > 0 && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setShowBulkDeleteDialog(true)}
                  className="h-9"
                >
                  Delete ({selectedRounds.size})
                </Button>
              )}
              <Button
                variant={(deleteMode || selectMode) ? "secondary" : "ghost"}
                size="icon"
                onClick={handleDeleteModeToggle}
                className="h-9 w-9"
                aria-label={deleteMode ? "Cancel delete" : "Delete rounds"}
              >
                {(deleteMode || selectMode) ? <X size={20} /> : <Trash2 size={20} />}
              </Button>
            </div>
          )}
        </header>

        {/* Event filter row - between title and year sections */}
        {rounds.length > 0 && (
          <div className="flex items-center gap-2 mb-4">
            <Select
              value={selectedEventId ?? "all"}
              onValueChange={(v) => setSelectedEventId(v === "all" ? null : v)}
              disabled={eventsLoading}
            >
              <SelectTrigger className="w-[280px] h-9 justify-start text-left">
                <CalendarDays className="h-4 w-4 mr-1.5 shrink-0" />
                <SelectValue placeholder="Event" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All rounds</SelectItem>
                {events.map((ev) => (
                  <SelectItem key={ev.id} value={ev.id}>{ev.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedEventId && (
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9"
                onClick={() => setEventSettingsOpen(true)}
                aria-label="Event settings"
                title="Event settings"
              >
                <Settings className="h-4 w-4" />
              </Button>
            )}
            <Button
              variant="default"
              size="sm"
              className="h-9 bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={() => setShowCreateEventDialog(true)}
            >
              <Plus className="h-4 w-4 mr-1" />
              New Event
            </Button>
          </div>
        )}

        {deleteMode && !selectMode && (
          <p className="text-sm text-destructive mb-4">
            Tap a round to delete it, or click "Select" to delete multiple
          </p>
        )}
        {selectMode && (
          <p className="text-sm text-destructive mb-4">
            {selectedRounds.size > 0 
              ? `${selectedRounds.size} round${selectedRounds.size !== 1 ? 's' : ''} selected` 
              : "Tap rounds to select them"}
          </p>
        )}


        {/* Rounds List */}
        {loading ? (
          <div className="text-center py-8 text-muted-foreground text-sm">
            Loading...
          </div>
        ) : filteredRounds.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <p className="mb-2">{selectedEventId ? "No rounds in this event" : "No rounds yet"}</p>
            <p className="text-sm">{selectedEventId ? "Add rounds from Event settings" : "Start playing to track your scores"}</p>
          </div>
        ) : (
          <main className="space-y-4">
            {(() => {
              // Group rounds by year
              const roundsByYear = filteredRounds.reduce((acc, round) => {
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
                    {roundsByYear[year].map((round) => {
                      const canDelete = canDeleteRound(round);
                      const isSelected = selectedRounds.has(round.id);
                      
                      // Determine click handler based on mode
                      let clickHandler: (() => void) | undefined;
                      if (selectMode) {
                        clickHandler = canDelete ? () => toggleRoundSelection(round.id) : () => setShowCannotDeleteDialog(true);
                      } else if (deleteMode) {
                        clickHandler = () => handleRoundClickInDeleteMode(round);
                      }
                      
                      return (
                        <div key={`${round.gameType}-${round.id}`} className="relative">
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
                            onClick={clickHandler}
                            disabled={deleteMode || selectMode}
                          />
                        </div>
                      );
                    })}
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

      {/* Bulk delete confirmation dialog */}
      <Dialog open={showCreateEventDialog} onOpenChange={setShowCreateEventDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create new event</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Name the event. You can add rounds to it from Event settings.
          </p>
          <div className="space-y-2">
            <Label htmlFor="new-event-name">Event name</Label>
            <Input
              id="new-event-name"
              placeholder="e.g. Weekend Championship"
              value={newEventName}
              onChange={(e) => setNewEventName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreateEvent()}
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setShowCreateEventDialog(false)} disabled={createEventLoading}>
              Cancel
            </Button>
            <Button onClick={handleCreateEvent} disabled={createEventLoading || !newEventName.trim()}>
              {createEventLoading ? "Creating…" : "Create & select"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <EventSettingsSheet
        open={eventSettingsOpen}
        onOpenChange={setEventSettingsOpen}
        eventId={selectedEventId}
        eventName={selectedEvent?.name}
        currentUserId={currentUserId}
        isCreator={!!isEventCreator}
        allRounds={rounds}
        onSaved={() => {
          invalidateUnifiedRoundsCache(currentUserId ?? undefined);
          fetchPlayedRounds();
          fetchEvents();
        }}
      />

      <AlertDialog open={showBulkDeleteDialog} onOpenChange={setShowBulkDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedRounds.size} Round{selectedRounds.size !== 1 ? 's' : ''}</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {selectedRounds.size} round{selectedRounds.size !== 1 ? 's' : ''}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete {selectedRounds.size} Round{selectedRounds.size !== 1 ? 's' : ''}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default PlayedRounds;
