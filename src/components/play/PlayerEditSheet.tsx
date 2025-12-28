import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Player } from "@/types/playSetup";
import { TeeSelector } from "@/components/TeeSelector";
import { formatHandicap, parseHandicap } from "@/lib/utils";

interface PlayerEditSheetProps {
  isOpen: boolean;
  onClose: () => void;
  player: Player | null;
  availableTees: string[];
  courseTeeNames?: Record<string, string> | null;
  onSave: (updatedPlayer: Player) => void;
}

export function PlayerEditSheet({
  isOpen,
  onClose,
  player,
  availableTees,
  courseTeeNames,
  onSave,
}: PlayerEditSheetProps) {
  const [displayName, setDisplayName] = useState("");
  const [handicap, setHandicap] = useState("");
  const [teeColor, setTeeColor] = useState("");

  useEffect(() => {
    if (player) {
      setDisplayName(player.isTemporary 
        ? player.displayName.replace(" (Guest)", "") 
        : player.displayName
      );
      // Format handicap for display (plus handicaps shown with "+")
      setHandicap(formatHandicap(player.handicap));
      setTeeColor(player.teeColor);
    }
  }, [player]);

  const handleSave = () => {
    if (!player) return;

    const updatedPlayer: Player = {
      ...player,
      displayName: player.isTemporary 
        ? (displayName.trim() || "Guest Player")
        : displayName.trim() || player.displayName,
      handicap: parseHandicap(handicap),
      teeColor: teeColor || player.teeColor,
    };
    
    onSave(updatedPlayer);
    onClose();
  };

  if (!player) return null;

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="bottom" className="h-auto max-h-[80vh] rounded-t-xl">
        <SheetHeader className="pb-4">
          <SheetTitle>Edit Player</SheetTitle>
        </SheetHeader>
        
        <div className="space-y-4 pb-6">
          <div className="space-y-2">
            <Label htmlFor="player-name">Name</Label>
            <Input
              id="player-name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Player name"
              disabled={!player.isTemporary}
            />
            {!player.isTemporary && (
              <p className="text-xs text-muted-foreground">
                Only guest player names can be edited
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="player-handicap">Handicap</Label>
            <Input
              id="player-handicap"
              value={handicap}
              onChange={(e) => setHandicap(e.target.value)}
              placeholder="e.g. 15 or +2.4"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="player-tee">Tee Box</Label>
            <TeeSelector
              value={teeColor}
              onValueChange={setTeeColor}
              teeCount={availableTees.length || 5}
              courseTeeNames={courseTeeNames}
            />
          </div>

          <Button onClick={handleSave} className="w-full">
            Save Changes
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
