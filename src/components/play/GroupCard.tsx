import { useState } from "react";
import { GripVertical, Pencil, Plus, Trash2, X, Users } from "lucide-react";
import { Draggable, Droppable } from "@hello-pangea/dnd";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { PlayerGroup, Player } from "@/types/playSetup";
import { formatHandicap } from "@/lib/utils";
import { TeeSelector } from "@/components/TeeSelector";

interface GroupCardProps {
  group: PlayerGroup;
  groupIndex: number;
  availableTees: string[];
  courseTeeNames?: Record<string, string> | null;
  canDelete: boolean;
  onUpdateName: (name: string) => void;
  onAddPlayer: () => void;
  onRemovePlayer: (playerId: string) => void;
  onUpdatePlayerTee: (playerId: string, tee: string) => void;
  onDeleteGroup: () => void;
  onPlayerClick: (player: Player) => void;
  dragHandleProps?: any;
  enableDrag?: boolean;
}

const formatPlayerName = (player: Player): string => {
  return player.displayName || "Guest Player";
};

interface PlayerRowProps {
  player: Player;
  availableTees: string[];
  courseTeeNames?: Record<string, string> | null;
  onPlayerClick: (player: Player) => void;
  onUpdatePlayerTee: (playerId: string, tee: string) => void;
  onRemovePlayer: (playerId: string) => void;
  showDragHandle?: boolean;
  dragHandleProps?: any;
}

function PlayerRow({
  player,
  availableTees,
  courseTeeNames,
  onPlayerClick,
  onUpdatePlayerTee,
  onRemovePlayer,
  showDragHandle = false,
  dragHandleProps,
}: PlayerRowProps) {
  return (
    <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/30 border border-border/50">
      {showDragHandle && (
        <div
          {...dragHandleProps}
          className="cursor-grab active:cursor-grabbing shrink-0"
        >
          <GripVertical className="w-4 h-4 text-muted-foreground" />
        </div>
      )}
      
      <button
        onClick={() => onPlayerClick(player)}
        className="flex items-center gap-2 flex-1 min-w-0 text-left hover:bg-muted/50 rounded p-1 -m-1 transition-colors"
      >
        <Avatar className="h-8 w-8 shrink-0">
          <AvatarImage src={player.avatarUrl} />
          <AvatarFallback className="text-xs bg-primary text-primary-foreground">
            {formatPlayerName(player).charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium leading-tight">
            {formatPlayerName(player)}
          </p>
          {player.handicap !== undefined && (
            <p className="text-xs text-muted-foreground whitespace-nowrap">
              HCP: {formatHandicap(player.handicap)}
            </p>
          )}
        </div>
      </button>
      
      <TeeSelector
        value={player.teeColor}
        onValueChange={(tee) => onUpdatePlayerTee(player.odId, tee)}
        teeCount={availableTees.length || 5}
        courseTeeNames={courseTeeNames}
        triggerClassName="w-20 h-7 text-xs shrink-0 px-2"
      />
      
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0"
        onClick={(e) => {
          e.stopPropagation();
          onRemovePlayer(player.odId);
        }}
      >
        <X className="w-4 h-4" />
      </Button>
    </div>
  );
}

export function GroupCard({
  group,
  groupIndex,
  availableTees,
  courseTeeNames,
  canDelete,
  onUpdateName,
  onAddPlayer,
  onRemovePlayer,
  onUpdatePlayerTee,
  onDeleteGroup,
  onPlayerClick,
  dragHandleProps,
  enableDrag = false,
}: GroupCardProps) {
  const [isEditingName, setIsEditingName] = useState(false);
  const [editName, setEditName] = useState(group.name);

  const handleSaveName = () => {
    onUpdateName(editName);
    setIsEditingName(false);
  };

  return (
    <Card className="border-2 border-border/50">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {enableDrag && dragHandleProps && (
              <div
                {...dragHandleProps}
                className="cursor-grab active:cursor-grabbing p-1 -ml-1 hover:bg-muted rounded"
              >
                <GripVertical className="w-4 h-4 text-muted-foreground" />
              </div>
            )}
            <Users className="w-4 h-4 text-primary" />
            {isEditingName ? (
              <div className="flex items-center gap-2">
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="h-8 w-32"
                  autoFocus
                  onKeyDown={(e) => e.key === "Enter" && handleSaveName()}
                />
                <Button size="sm" variant="ghost" onClick={handleSaveName}>
                  Save
                </Button>
              </div>
            ) : (
              <button
                onClick={() => setIsEditingName(true)}
                className="flex items-center gap-1 font-semibold text-sm hover:text-primary transition-colors"
              >
                {group.name}
                <Pencil className="w-3 h-3 text-muted-foreground" />
              </button>
            )}
            <span className="text-xs text-muted-foreground">
              ({group.players.length} player{group.players.length !== 1 ? "s" : ""})
            </span>
          </div>
          {canDelete && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-destructive"
              onClick={onDeleteGroup}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {enableDrag ? (
          <Droppable droppableId={group.id} type="player">
            {(provided, snapshot) => (
              <div
                ref={provided.innerRef}
                {...provided.droppableProps}
                className={`min-h-[60px] rounded-lg transition-colors ${
                  snapshot.isDraggingOver ? "bg-primary text-primary-foreground border-2 border-dashed border-primary" : ""
                }`}
              >
                {group.players.length === 0 && !snapshot.isDraggingOver ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Drag players here or add new ones
                  </p>
                ) : (
                  <div className="space-y-2">
                    {group.players.map((player, playerIndex) => (
                      <Draggable key={player.odId} draggableId={player.odId} index={playerIndex}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            className={snapshot.isDragging ? "shadow-lg ring-2 ring-primary rounded-lg" : ""}
                          >
                            <PlayerRow
                              player={player}
                              availableTees={availableTees}
                              courseTeeNames={courseTeeNames}
                              onPlayerClick={onPlayerClick}
                              onUpdatePlayerTee={onUpdatePlayerTee}
                              onRemovePlayer={onRemovePlayer}
                              showDragHandle={true}
                              dragHandleProps={provided.dragHandleProps}
                            />
                          </div>
                        )}
                      </Draggable>
                    ))}
                  </div>
                )}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        ) : (
          <div className="min-h-[60px] rounded-lg">
            {group.players.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Add players to this group
              </p>
            ) : (
              <div className="space-y-2">
                {group.players.map((player) => (
                  <PlayerRow
                    key={player.odId}
                    player={player}
                    availableTees={availableTees}
                    courseTeeNames={courseTeeNames}
                    onPlayerClick={onPlayerClick}
                    onUpdatePlayerTee={onUpdatePlayerTee}
                    onRemovePlayer={onRemovePlayer}
                    showDragHandle={false}
                  />
                ))}
              </div>
            )}
          </div>
        )}
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={onAddPlayer}
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Player
        </Button>
      </CardContent>
    </Card>
  );
}
