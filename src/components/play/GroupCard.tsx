import { useState } from "react";
import { GripVertical, Pencil, Plus, Trash2, X, Users } from "lucide-react";
import { Draggable, Droppable } from "@hello-pangea/dnd";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PlayerGroup, Player } from "@/types/playSetup";

interface GroupCardProps {
  group: PlayerGroup;
  groupIndex: number;
  availableTees: string[];
  canDelete: boolean;
  onUpdateName: (name: string) => void;
  onAddPlayer: () => void;
  onRemovePlayer: (playerId: string) => void;
  onUpdatePlayerTee: (playerId: string, tee: string) => void;
  onDeleteGroup: () => void;
}

const formatHandicap = (handicap: number | undefined): string => {
  if (handicap === undefined) return "";
  if (handicap > 0) return `+${handicap}`;
  return `${handicap}`;
};

export function GroupCard({
  group,
  groupIndex,
  availableTees,
  canDelete,
  onUpdateName,
  onAddPlayer,
  onRemovePlayer,
  onUpdatePlayerTee,
  onDeleteGroup,
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
        <Droppable droppableId={group.id} type="player">
          {(provided, snapshot) => (
            <div
              ref={provided.innerRef}
              {...provided.droppableProps}
              className={`min-h-[60px] rounded-lg transition-colors ${
                snapshot.isDraggingOver ? "bg-primary/10 border-2 border-dashed border-primary" : ""
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
                          className={`flex items-center gap-3 p-2 rounded-lg bg-muted/30 border border-border/50 ${
                            snapshot.isDragging ? "shadow-lg ring-2 ring-primary" : ""
                          }`}
                        >
                          <div
                            {...provided.dragHandleProps}
                            className="cursor-grab active:cursor-grabbing"
                          >
                            <GripVertical className="w-4 h-4 text-muted-foreground" />
                          </div>
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={player.avatarUrl} />
                            <AvatarFallback className="text-xs bg-primary/10">
                              {player.displayName.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1">
                              <p className="text-sm font-medium truncate">{player.displayName}</p>
                              {player.isTemporary && (
                                <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded">Guest</span>
                              )}
                            </div>
                            {player.handicap !== undefined && (
                              <p className="text-xs text-muted-foreground">
                                HCP: {formatHandicap(player.handicap)}
                              </p>
                            )}
                          </div>
                          <Select
                            value={player.teeColor}
                            onValueChange={(tee) => onUpdatePlayerTee(player.odId, tee)}
                          >
                            <SelectTrigger className="w-20 h-7 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {availableTees.map((tee) => (
                                <SelectItem key={tee} value={tee} className="text-xs">
                                  {tee}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-destructive"
                            onClick={() => onRemovePlayer(player.odId)}
                          >
                            <X className="w-4 h-4" />
                          </Button>
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
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={onAddPlayer}
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Player to {group.name}
        </Button>
      </CardContent>
    </Card>
  );
}
