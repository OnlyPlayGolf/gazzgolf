import { UserPlus, Users, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface SetupAddPlayerButtonsProps {
  onAddFriend: () => void;
  onAddGuest: () => void;
}

export function SetupAddPlayerButtons({ onAddFriend, onAddGuest }: SetupAddPlayerButtonsProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="w-full gap-2">
          <Plus size={16} />
          Add Player
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="center" className="w-48">
        <DropdownMenuItem onClick={onAddFriend} className="gap-2 cursor-pointer">
          <Users size={16} />
          Add Friend
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onAddGuest} className="gap-2 cursor-pointer">
          <UserPlus size={16} />
          Add Guest
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
