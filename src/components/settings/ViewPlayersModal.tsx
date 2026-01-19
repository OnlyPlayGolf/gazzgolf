import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ProfilePhoto } from "@/components/ProfilePhoto";
import { GamePlayer } from "./GameDetailsSection";
import { getTeeDisplayName } from "@/components/TeeSelector";

interface ViewPlayersModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  players: GamePlayer[];
}

function formatHandicap(handicap: number | null | undefined): string {
  if (handicap === null || handicap === undefined) return "-";
  if (handicap < 0) return `+${Math.abs(handicap)}`;
  return handicap.toString();
}

export function ViewPlayersModal({ 
  open, 
  onOpenChange, 
  players
}: ViewPlayersModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Players</DialogTitle>
        </DialogHeader>
        <div className="space-y-2 max-h-[60vh] overflow-y-auto">
          {[...players].sort((a, b) => a.name.localeCompare(b.name)).map((player, idx) => (
            <div 
              key={idx} 
              className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <ProfilePhoto
                  src={player.avatarUrl}
                  alt={player.name}
                  fallback={player.name}
                  size="md"
                />
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{player.name}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {player.team && <span>{player.team}</span>}
                    {player.tee && <span>• {getTeeDisplayName(player.tee)} tees</span>}
                  </div>
                </div>
              </div>
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
