import { User, X, Pencil, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn, formatHandicap } from "@/lib/utils";
import { DraggableProvidedDragHandleProps } from "@hello-pangea/dnd";
import { getTeeDisplayName } from "@/components/TeeSelector";

interface Player {
  odId: string;
  displayName: string;
  handicap?: number;
  teeColor?: string;
  isTemporary?: boolean;
  isCurrentUser?: boolean;
}

interface SetupPlayerCardProps {
  player: Player;
  onEdit: () => void;
  onRemove?: () => void;
  showTee?: boolean;
  availableTees?: string[];
  dragHandleProps?: DraggableProvidedDragHandleProps | null;
  showDragHandle?: boolean;
}

export function SetupPlayerCard({
  player,
  onEdit,
  onRemove,
  showTee = true,
  dragHandleProps,
  showDragHandle = false,
}: SetupPlayerCardProps) {
  const hasHandicap = player.handicap !== undefined;

  return (
    <div
      className={cn(
        "flex items-center gap-3 p-3 rounded-lg border bg-card transition-colors flex-1 min-w-0",
        player.isCurrentUser && "border-primary/30 bg-primary/5",
        dragHandleProps && "cursor-grab active:cursor-grabbing"
      )}
      {...(dragHandleProps || {})}
    >
      {/* Drag Handle Icon */}
      {showDragHandle && (
        <div className="flex-shrink-0">
          <GripVertical size={16} className="text-muted-foreground" />
        </div>
      )}

      {/* Avatar */}
      <div className={cn(
        "w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0",
        player.isCurrentUser ? "bg-primary/20" : "bg-muted"
      )}>
        <User size={20} className={player.isCurrentUser ? "text-primary" : "text-muted-foreground"} />
      </div>

      {/* Name and Handicap */}
      <div className="flex-1 min-w-0">
        <div className="font-medium text-foreground truncate">
          {player.displayName}
          {player.isCurrentUser && <span className="text-xs text-muted-foreground ml-1">(You)</span>}
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {hasHandicap && (
            <span className="whitespace-nowrap">HCP: {formatHandicap(player.handicap)}</span>
          )}
          {hasHandicap && showTee && player.teeColor && <span>•</span>}
          {showTee && player.teeColor && (
            <span className="truncate">{getTeeDisplayName(player.teeColor)}</span>
          )}
          {!hasHandicap && !player.teeColor && <span>Tap to edit</span>}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 flex-shrink-0">
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          onClick={(e) => {
            e.stopPropagation();
            onEdit();
          }}
        >
          <Pencil size={14} />
        </Button>
        {onRemove && !player.isCurrentUser && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 text-destructive hover:text-destructive"
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
          >
            <X size={14} />
          </Button>
        )}
      </div>
    </div>
  );
}
