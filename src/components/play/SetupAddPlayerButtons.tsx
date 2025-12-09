import { UserPlus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SetupAddPlayerButtonsProps {
  onAddFriend: () => void;
  onAddGuest: () => void;
}

export function SetupAddPlayerButtons({ onAddFriend, onAddGuest }: SetupAddPlayerButtonsProps) {
  return (
    <div className="flex gap-2">
      <Button
        variant="outline"
        className="flex-1 gap-2"
        onClick={onAddFriend}
      >
        <Users size={16} />
        Add Friend
      </Button>
      <Button
        variant="outline"
        className="flex-1 gap-2"
        onClick={onAddGuest}
      >
        <UserPlus size={16} />
        Add Guest
      </Button>
    </div>
  );
}
