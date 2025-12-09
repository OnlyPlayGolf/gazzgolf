import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Player {
  odId: string;
  displayName: string;
  handicap?: number;
  teeColor?: string;
  isTemporary?: boolean;
  isCurrentUser?: boolean;
}

interface SetupPlayerEditSheetProps {
  isOpen: boolean;
  onClose: () => void;
  player: Player | null;
  availableTees?: string[];
  onSave: (updatedPlayer: Player) => void;
}

export function SetupPlayerEditSheet({
  isOpen,
  onClose,
  player,
  availableTees = [],
  onSave,
}: SetupPlayerEditSheetProps) {
  const [displayName, setDisplayName] = useState("");
  const [handicap, setHandicap] = useState("");
  const [teeColor, setTeeColor] = useState("");

  useEffect(() => {
    if (player) {
      setDisplayName(player.displayName);
      setHandicap(player.handicap !== undefined ? String(player.handicap) : "");
      setTeeColor(player.teeColor || "");
    }
  }, [player]);

  const handleSave = () => {
    if (!player) return;

    const normalizedHandicap = handicap.replace(',', '.');
    const updatedPlayer: Player = {
      ...player,
      displayName: player.isTemporary || player.isCurrentUser
        ? (displayName.trim() || player.displayName)
        : player.displayName,
      handicap: normalizedHandicap ? parseFloat(normalizedHandicap) : undefined,
      teeColor: teeColor || player.teeColor,
    };
    
    onSave(updatedPlayer);
    onClose();
  };

  if (!player) return null;

  const canEditName = player.isTemporary && !player.isCurrentUser;

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
              disabled={!canEditName}
            />
            {!canEditName && !player.isCurrentUser && (
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
              placeholder="e.g. 15 or 2,4"
            />
          </div>

          {availableTees.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="player-tee">Tee Box</Label>
              <Select value={teeColor} onValueChange={setTeeColor}>
                <SelectTrigger id="player-tee">
                  <SelectValue placeholder="Select tee" />
                </SelectTrigger>
                <SelectContent>
                  {availableTees.map((tee) => (
                    <SelectItem key={tee} value={tee}>
                      {tee}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <Button onClick={handleSave} className="w-full">
            Save Changes
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
