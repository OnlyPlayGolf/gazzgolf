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
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [handicap, setHandicap] = useState("");

  const handleAdd = () => {
    if (!firstName.trim()) return;
    
    const displayName = lastName.trim() 
      ? `${firstName.trim()} ${lastName.trim()}`
      : firstName.trim();
    
    const player: Player = {
      odId: `temp_${Date.now()}`,
      displayName,
      handicap: parseHandicap(handicap),
      teeColor: defaultTee,
      isTemporary: true,
    };

    onAddPlayer(player);
    setFirstName("");
    setLastName("");
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
            <Label htmlFor="guest-first-name">First Name *</Label>
            <Input
              id="guest-first-name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="Enter first name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="guest-last-name">Last Name (optional)</Label>
            <Input
              id="guest-last-name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="Enter last name"
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

          <Button onClick={handleAdd} disabled={!firstName.trim()} className="w-full">
            Add Player
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
