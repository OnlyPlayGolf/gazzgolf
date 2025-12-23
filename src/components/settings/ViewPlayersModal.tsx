import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { GamePlayer } from "./GameDetailsSection";
import { getTeeDisplayName } from "@/components/TeeSelector";

interface ViewPlayersModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  players: GamePlayer[];
  useHandicaps?: boolean;
}

function formatHandicap(handicap: number | null | undefined): string {
  if (handicap === null || handicap === undefined) return "-";
  if (handicap > 0) return `+${handicap}`;
  return handicap.toString();
}

export function ViewPlayersModal({ 
  open, 
  onOpenChange, 
  players,
  useHandicaps = false
}: ViewPlayersModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Players</DialogTitle>
        </DialogHeader>
        <div className="space-y-2 max-h-[60vh] overflow-y-auto">
          {players.map((player, idx) => (
            <div 
              key={idx} 
              className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
            >
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{player.name}</p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {player.team && <span>{player.team}</span>}
                  {player.tee && <span>• {getTeeDisplayName(player.tee)} tees</span>}
                </div>
              </div>
              {useHandicaps && player.handicap !== undefined && (
                <div className="text-right shrink-0 ml-2">
                  <p className="text-xs text-muted-foreground">HCP</p>
                  <p className="font-medium">{formatHandicap(player.handicap)}</p>
                </div>
              )}
            </div>
          ))}
          {players.length === 0 && (
            <p className="text-center text-muted-foreground py-4">No players</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
