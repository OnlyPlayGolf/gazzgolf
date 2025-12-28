import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DEFAULT_MEN_TEE } from "@/components/TeeSelector";
import { parseHandicap } from "@/lib/utils";

interface Player {
  odId: string;
  displayName: string;
  handicap?: number;
  teeColor?: string;
  isTemporary?: boolean;
}

interface SetupAddGuestSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onAddPlayer: (player: Player) => void;
  defaultTee?: string;
}

export function SetupAddGuestSheet({
  isOpen,
  onClose,
  onAddPlayer,
  defaultTee = DEFAULT_MEN_TEE,
}: SetupAddGuestSheetProps) {
  const [name, setName] = useState("");
  const [handicap, setHandicap] = useState("");

  const handleAdd = () => {
    const player: Player = {
      odId: `temp_${Date.now()}`,
      displayName: name.trim() || "Guest Player",
      handicap: parseHandicap(handicap),
      teeColor: defaultTee,
      isTemporary: true,
    };

    onAddPlayer(player);
    setName("");
    setHandicap("");
    onClose();
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="bottom" className="h-auto max-h-[60vh] rounded-t-xl">
        <SheetHeader className="pb-4">
          <SheetTitle>Add Guest Player</SheetTitle>
        </SheetHeader>

        <div className="space-y-4 pb-6">
          <div className="space-y-2">
            <Label htmlFor="guest-name">Name</Label>
            <Input
              id="guest-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter player name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="guest-handicap">Handicap (optional)</Label>
            <Input
              id="guest-handicap"
              value={handicap}
              onChange={(e) => setHandicap(e.target.value)}
              placeholder="e.g. 15 or +2.4"
            />
          </div>

          <Button onClick={handleAdd} className="w-full">
            Add Player
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
