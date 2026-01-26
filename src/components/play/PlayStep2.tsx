import { Users, Plus, Calendar } from "lucide-react";
import { DragDropContext, DropResult } from "@hello-pangea/dnd";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { PlaySetupState, PlayerGroup, Player, createDefaultGroup, RoundType } from "@/types/playSetup";
import { GroupCard } from "@/components/play/GroupCard";
import { AddPlayerDialog } from "@/components/play/AddPlayerDialog";
import { PlayerEditSheet } from "@/components/play/PlayerEditSheet";
import { TeeSelector } from "@/components/TeeSelector";
import { CourseScorecard } from "@/components/CourseScorecard";
import { AIConfigSummary } from "@/components/play/AIConfigSummary";
import { STANDARD_TEE_OPTIONS, DEFAULT_MEN_TEE } from "@/components/TeeSelector";

interface Course {
  id: string;
  name: string;
  location: string;
  tee_names?: Record<string, string> | null;
}

interface PlayStep2Props {
  setupState: PlaySetupState;
  setSetupState: React.Dispatch<React.SetStateAction<PlaySetupState>>;
  selectedCourse: Course | null;
  numberOfRoundsText: string;
  setNumberOfRoundsText: (text: string) => void;
  availableCourseTees: string[];
  courseTeeNames: Record<string, string> | null;
  datePopoverOpen: boolean;
  setDatePopoverOpen: (open: boolean) => void;
  handleDefaultTeeChange: (tee: string) => void;
  addPlayerDialogOpen: boolean;
  setAddPlayerDialogOpen: (open: boolean) => void;
  activeGroupId: string | null;
  setActiveGroupId: (id: string | null) => void;
  editingPlayer: Player | null;
  setEditingPlayer: (player: Player | null) => void;
  editingPlayerGroupId: string | null;
  setEditingPlayerGroupId: (id: string | null) => void;
  playerEditSheetOpen: boolean;
  setPlayerEditSheetOpen: (open: boolean) => void;
  onPlayerClick: (groupId: string, player: Player) => void;
  onSavePlayer: (updatedPlayer: Player) => void;
  getAllPlayerIds: () => string[];
  playerValidationError: string | null;
  loading: boolean;
  onBack: () => void;
  onStartRound: () => void;
}

export function PlayStep2({
  setupState,
  setSetupState,
  selectedCourse,
  numberOfRoundsText,
  setNumberOfRoundsText,
  availableCourseTees,
  courseTeeNames,
  datePopoverOpen,
  setDatePopoverOpen,
  handleDefaultTeeChange,
  addPlayerDialogOpen,
  setAddPlayerDialogOpen,
  activeGroupId,
  setActiveGroupId,
  editingPlayer,
  setEditingPlayer,
  editingPlayerGroupId,
  setEditingPlayerGroupId,
  playerEditSheetOpen,
  setPlayerEditSheetOpen,
  onPlayerClick,
  onSavePlayer,
  getAllPlayerIds,
  playerValidationError,
  loading,
  onBack,
  onStartRound,
}: PlayStep2Props) {
  const getTotalPlayers = () => setupState.groups.reduce((acc, g) => acc + g.players.length, 0);

  const addGroup = () => {
    setSetupState(prev => ({
      ...prev,
      groups: [...prev.groups, createDefaultGroup(prev.groups.length)]
    }));
  };

  const updateGroupName = (groupId: string, name: string) => {
    setSetupState(prev => ({
      ...prev,
      groups: prev.groups.map(g => g.id === groupId ? { ...g, name } : g)
    }));
  };

  const deleteGroup = (groupId: string) => {
    setSetupState(prev => ({
      ...prev,
      groups: prev.groups.filter(g => g.id !== groupId)
    }));
  };

  const addPlayerToGroup = (groupId: string, player: Player) => {
    player.teeColor = player.teeColor || setupState.teeColor || "medium";
    setSetupState(prev => ({
      ...prev,
      groups: prev.groups.map(g =>
        g.id === groupId ? { ...g, players: [...g.players, player] } : g
      )
    }));
    setAddPlayerDialogOpen(false);
  };

  const removePlayerFromGroup = (groupId: string, playerId: string) => {
    setSetupState(prev => ({
      ...prev,
      groups: prev.groups.map(g =>
        g.id === groupId ? { ...g, players: g.players.filter(p => p.odId !== playerId) } : g
      )
    }));
  };

  const updatePlayerTee = (groupId: string, playerId: string, tee: string) => {
    setSetupState(prev => ({
      ...prev,
      groups: prev.groups.map(g =>
        g.id === groupId
          ? { ...g, players: g.players.map(p => p.odId === playerId ? { ...p, teeColor: tee } : p) }
          : g
      )
    }));
  };

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;

    const sourceGroupId = result.source.droppableId;
    const destGroupId = result.destination.droppableId;
    const sourceIndex = result.source.index;
    const destIndex = result.destination.index;

    if (sourceGroupId === destGroupId) {
      // Reorder within same group
      setSetupState(prev => ({
        ...prev,
        groups: prev.groups.map(g => {
          if (g.id !== sourceGroupId) return g;
          const newPlayers = [...g.players];
          const [removed] = newPlayers.splice(sourceIndex, 1);
          newPlayers.splice(destIndex, 0, removed);
          return { ...g, players: newPlayers };
        })
      }));
    } else {
      // Move player between groups
      setSetupState(prev => {
        const sourceGroup = prev.groups.find(g => g.id === sourceGroupId);
        if (!sourceGroup) return prev;

        const player = sourceGroup.players[sourceIndex];
        if (!player) return prev;

        return {
          ...prev,
          groups: prev.groups.map(g => {
            if (g.id === sourceGroupId) {
              // Remove from source group
              return { ...g, players: g.players.filter((_, idx) => idx !== sourceIndex) };
            } else if (g.id === destGroupId) {
              // Add to destination group at the correct index
              const newPlayers = [...g.players];
              newPlayers.splice(destIndex, 0, player);
              return { ...g, players: newPlayers };
            }
            return g;
          })
        };
      });
    }
  };

  return (
    <>
      <div className="p-4 pt-20 max-w-2xl mx-auto space-y-4">
        {/* Header Card - Round Info */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Round Setup</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Round Name & Date Row */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Round Name</Label>
                <Input
                  value={setupState.roundName}
                  onChange={(e) => setSetupState(prev => ({ ...prev, roundName: e.target.value }))}
                  placeholder="Round 1"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Date</Label>
                <Popover open={datePopoverOpen} onOpenChange={setDatePopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left font-normal">
                      <Calendar className="mr-2 h-4 w-4" />
                      {format(new Date(setupState.datePlayed + 'T12:00:00'), "MMM d, yyyy")}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={new Date(setupState.datePlayed + 'T12:00:00')}
                      onSelect={(date) => {
                        if (date) {
                          const year = date.getFullYear();
                          const month = String(date.getMonth() + 1).padStart(2, '0');
                          const day = String(date.getDate()).padStart(2, '0');
                          setSetupState(prev => ({ 
                            ...prev, 
                            datePlayed: `${year}-${month}-${day}`
                          }));
                          setDatePopoverOpen(false);
                        }
                      }}
                      initialFocus
                      className="p-3 pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {/* Number of Rounds (Stroke Play only) */}
            {setupState.gameFormat === "stroke_play" && (
              <div className="space-y-1.5">
                <Label className="text-xs">Number of Rounds</Label>
                <Input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  value={numberOfRoundsText}
                  onChange={(e) => {
                    const nextRaw = e.target.value;
                    // Allow empty while typing; allow digits only
                    if (nextRaw !== "" && !/^\d+$/.test(nextRaw)) return;

                    setNumberOfRoundsText(nextRaw);

                    const parsed = nextRaw ? parseInt(nextRaw, 10) : NaN;
                    if (Number.isFinite(parsed) && parsed > 0) {
                      setSetupState(prev => ({ ...prev, numberOfRounds: parsed }));
                    }
                  }}
                  onBlur={() => {
                    const raw = numberOfRoundsText.trim();
                    const parsed = raw ? parseInt(raw, 10) : NaN;
                    const next = Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
                    setNumberOfRoundsText(String(next));
                    setSetupState(prev => ({ ...prev, numberOfRounds: next }));
                  }}
                />
              </div>
            )}

            {/* Round Type */}
            <div className="space-y-1.5">
              <Label className="text-xs">Round Type</Label>
              <Select 
                value={setupState.roundType} 
                onValueChange={(v) => setSetupState(prev => ({ ...prev, roundType: v as RoundType }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select round type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fun_practice">Fun/Practice</SelectItem>
                  <SelectItem value="qualifying">Qualifying</SelectItem>
                  <SelectItem value="tournament">Tournament</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Tee Selection (course-specific) */}
            <div className="space-y-1.5">
              <Label className="text-xs">Tees</Label>
              <TeeSelector
                value={setupState.teeColor}
                onValueChange={(tee) => handleDefaultTeeChange(tee)}
                teeCount={availableCourseTees.length || 5}
                courseTeeNames={courseTeeNames}
                triggerClassName="w-full justify-between"
                disabled={!selectedCourse}
              />
            </div>
          </CardContent>
        </Card>

        {/* Course Scorecard */}
        {selectedCourse && (
          <CourseScorecard
            courseId={selectedCourse.id}
            selectedTee={setupState.teeColor}
            selectedHoles={setupState.selectedHoles === "custom" ? "18" : setupState.selectedHoles}
          />
        )}

        {/* AI Config Summary */}
        <AIConfigSummary
          isApplied={setupState.aiConfigApplied}
          summary={setupState.aiConfigSummary}
          assumptions={setupState.aiAssumptions}
        />

        {/* Groups & Players */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Users className="w-5 h-5 text-primary" />
                Groups & Players
              </CardTitle>
              <span className="text-sm text-muted-foreground">
                {getTotalPlayers()} player{getTotalPlayers() !== 1 ? "s" : ""}
              </span>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <DragDropContext onDragEnd={handleDragEnd}>
              <div className="space-y-3">
                {setupState.groups.map((group, index) => (
                  <GroupCard
                    key={group.id}
                    group={group}
                    groupIndex={index}
                    availableTees={selectedCourse ? availableCourseTees : STANDARD_TEE_OPTIONS.map(t => t.value)}
                    courseTeeNames={courseTeeNames}
                    canDelete={setupState.groups.length > 1}
                    onUpdateName={(name) => updateGroupName(group.id, name)}
                    onAddPlayer={() => {
                      setActiveGroupId(group.id);
                      setAddPlayerDialogOpen(true);
                    }}
                    onRemovePlayer={(playerId) => removePlayerFromGroup(group.id, playerId)}
                    onUpdatePlayerTee={(playerId, tee) => updatePlayerTee(group.id, playerId, tee)}
                    onDeleteGroup={() => deleteGroup(group.id)}
                    onPlayerClick={(player) => onPlayerClick(group.id, player)}
                    enableDrag={true}
                  />
                ))}
              </div>
            </DragDropContext>
            
            <Button variant="outline" className="w-full" onClick={addGroup}>
              <Plus className="w-4 h-4 mr-2" />
              Add Group
            </Button>
          </CardContent>
        </Card>

        {/* Navigation and Start Button */}
        <div className="space-y-2">
          {playerValidationError && (
            <p className="text-sm text-destructive text-center">{playerValidationError}</p>
          )}
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={onBack}
              className="flex-1 h-12 text-base font-semibold"
              size="lg"
            >
              Back
            </Button>
            <Button
              onClick={onStartRound}
              disabled={loading || !selectedCourse || !!playerValidationError}
              className="flex-1 h-12 text-base font-semibold"
              size="lg"
            >
              {loading ? "Starting..." : "Continue"}
            </Button>
          </div>
        </div>
      </div>

      {/* Dialogs */}
      <AddPlayerDialog
        isOpen={addPlayerDialogOpen}
        onClose={() => setAddPlayerDialogOpen(false)}
        onAddPlayer={(player) => activeGroupId && addPlayerToGroup(activeGroupId, player)}
        existingPlayerIds={getAllPlayerIds()}
        defaultTee={setupState.teeColor || DEFAULT_MEN_TEE}
      />

      <PlayerEditSheet
        isOpen={playerEditSheetOpen}
        onClose={() => {
          setPlayerEditSheetOpen(false);
          setEditingPlayer(null);
          setEditingPlayerGroupId(null);
        }}
        player={editingPlayer}
        availableTees={STANDARD_TEE_OPTIONS.map(t => t.value)}
        courseTeeNames={courseTeeNames}
        onSave={onSavePlayer}
      />
    </>
  );
}
