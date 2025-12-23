import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { User, Search, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn, parseHandicap, formatHandicap } from "@/lib/utils";
import { DEFAULT_MEN_TEE } from "@/components/TeeSelector";

interface Friend {
  id: string;
  display_name: string | null;
  username: string | null;
  handicap: string | null;
  avatar_url: string | null;
}

interface Player {
  odId: string;
  displayName: string;
  handicap?: number;
  teeColor?: string;
  isTemporary?: boolean;
}

interface SetupAddFriendSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onAddPlayer: (player: Player) => void;
  existingPlayerIds: string[];
  defaultTee?: string;
}

export function SetupAddFriendSheet({
  isOpen,
  onClose,
  onAddPlayer,
  existingPlayerIds,
  defaultTee = DEFAULT_MEN_TEE,
}: SetupAddFriendSheetProps) {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadFriends();
    }
  }, [isOpen]);

  const loadFriends = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: friendPairs } = await supabase
        .from('friends_pairs')
        .select('a, b');

      if (!friendPairs) return;

      const friendIds = friendPairs
        .map(pair => pair.a === user.id ? pair.b : pair.a)
        .filter((id): id is string => id !== null && id !== user.id);

      if (friendIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, display_name, username, handicap, avatar_url')
          .in('id', friendIds);

        if (profiles) {
          setFriends(profiles);
        }
      }
    } catch (error) {
      console.error('Error loading friends:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredFriends = friends.filter(friend => {
    if (existingPlayerIds.includes(friend.id)) return false;
    const name = friend.display_name || friend.username || "";
    return name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const handleSelectFriend = (friend: Friend) => {
    const handicapValue = parseHandicap(friend.handicap);
    
    const player: Player = {
      odId: friend.id,
      displayName: friend.display_name || friend.username || "Player",
      handicap: handicapValue,
      teeColor: defaultTee,
      isTemporary: false,
    };

    onAddPlayer(player);
    onClose();
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="bottom" className="h-[70vh] rounded-t-xl">
        <SheetHeader className="pb-4">
          <SheetTitle>Add Friend</SheetTitle>
        </SheetHeader>

        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search friends..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          <ScrollArea className="h-[calc(70vh-140px)]">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <p className="text-muted-foreground">Loading friends...</p>
              </div>
            ) : filteredFriends.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <User className="h-12 w-12 text-muted-foreground mb-2" />
                <p className="text-muted-foreground">
                  {searchQuery ? "No friends match your search" : "No friends available to add"}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredFriends.map((friend) => {
                  const handicapValue = parseHandicap(friend.handicap);
                  return (
                    <div
                      key={friend.id}
                      className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 cursor-pointer transition-colors"
                      onClick={() => handleSelectFriend(friend)}
                    >
                      <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                        <User size={20} className="text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">
                          {friend.display_name || friend.username}
                        </div>
                        {handicapValue !== undefined && (
                          <div className="text-sm text-muted-foreground">
                            HCP: {formatHandicap(handicapValue)}
                          </div>
                        )}
                      </div>
                      <Button variant="ghost" size="sm" className="flex-shrink-0">
                        <Check size={16} />
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </div>
      </SheetContent>
    </Sheet>
  );
}
