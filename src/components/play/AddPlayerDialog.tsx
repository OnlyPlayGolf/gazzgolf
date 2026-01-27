import { useState, useEffect } from "react";
import { Plus, UserPlus, Search, Users } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { Player } from "@/types/playSetup";

interface AddPlayerDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onAddPlayer: (player: Player) => void;
  existingPlayerIds: string[];
  defaultTee: string;
}

export function AddPlayerDialog({
  isOpen,
  onClose,
  onAddPlayer,
  existingPlayerIds,
  defaultTee,
}: AddPlayerDialogProps) {
  const [friends, setFriends] = useState<any[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [friendsLoading, setFriendsLoading] = useState(true);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  
  // Temp player form
  const [tempFirstName, setTempFirstName] = useState("");
  const [tempLastName, setTempLastName] = useState("");
  const [tempHandicap, setTempHandicap] = useState("");

  useEffect(() => {
    if (isOpen) {
      fetchFriends();
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const q = searchQuery.trim();
    if (!q) {
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }

    const timeoutId = setTimeout(async () => {
      try {
        setSearchLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data, error } = await supabase
          .rpc('search_profiles', { q, max_results: 20 });

        if (error) {
          console.error("Error searching players:", error);
          setSearchResults([]);
          return;
        }

        const available = (data || []).filter((p: any) =>
          p?.id &&
          p.id !== user.id &&
          !existingPlayerIds.includes(p.id)
        );

        setSearchResults(available);
      } finally {
        setSearchLoading(false);
      }
    }, 250);

    return () => clearTimeout(timeoutId);
  }, [isOpen, searchQuery, existingPlayerIds]);

  const fetchFriends = async () => {
    try {
      setFriendsLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setCurrentUserId(user.id);

      const { data, error } = await supabase
        .from('friendships')
        .select('requester, addressee, user_a, user_b, status')
        .or(`requester.eq.${user.id},addressee.eq.${user.id},user_a.eq.${user.id},user_b.eq.${user.id}`)
        .eq('status', 'accepted');

      if (error) throw error;

      const friendIds = new Set<string>();
      data?.forEach((friendship: any) => {
        if (friendship.requester === user.id && friendship.addressee) {
          friendIds.add(friendship.addressee);
        } else if (friendship.addressee === user.id && friendship.requester) {
          friendIds.add(friendship.requester);
        }
        if (friendship.user_a === user.id && friendship.user_b) {
          friendIds.add(friendship.user_b);
        } else if (friendship.user_b === user.id && friendship.user_a) {
          friendIds.add(friendship.user_a);
        }
      });

      if (friendIds.size === 0) {
        setFriends([]);
        return;
      }

      const { data: profiles } = await supabase
        .from('profiles')
        .select('*')
        .in('id', Array.from(friendIds));

      setFriends(profiles || []);
    } catch (error) {
      console.error("Error fetching friends:", error);
    } finally {
      setFriendsLoading(false);
    }
  };

  const handleAddFriend = (friend: any) => {
    const player: Player = {
      odId: friend.id,
      teeColor: defaultTee,
      displayName: friend.display_name || friend.username,
      username: friend.username,
      avatarUrl: friend.avatar_url,
      isTemporary: false,
      handicap: friend.handicap ? parseFloat(friend.handicap) : undefined,
    };
    onAddPlayer(player);
  };

  const handleAddTempPlayer = () => {
    if (!tempFirstName.trim()) return;
    
    const displayName = tempLastName.trim() 
      ? `${tempFirstName.trim()} ${tempLastName.trim()}`
      : tempFirstName.trim();
    const normalizedHandicap = tempHandicap.replace(',', '.');
    
    const player: Player = {
      odId: `temp_${Date.now()}`,
      teeColor: defaultTee,
      displayName,
      username: displayName.toLowerCase().replace(/\s+/g, '_'),
      isTemporary: true,
      handicap: normalizedHandicap ? parseFloat(normalizedHandicap) : undefined,
    };
    onAddPlayer(player);
    setTempFirstName("");
    setTempLastName("");
    setTempHandicap("");
  };

  const filteredFriends = friends
    .filter((f) => !existingPlayerIds.includes(f.id))
    .sort((a, b) => {
      const nameA = (a.display_name || a.username || '').toLowerCase();
      const nameB = (b.display_name || b.username || '').toLowerCase();
      return nameA.localeCompare(nameB);
    });

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add Player</DialogTitle>
        </DialogHeader>
        
        <Tabs defaultValue="friends" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="friends">Players</TabsTrigger>
            <TabsTrigger value="guest">Guest Player</TabsTrigger>
          </TabsList>
          
          <TabsContent value="friends" className="space-y-4 mt-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search players..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            
            {/* Friends header */}
            {!searchQuery.trim() && filteredFriends.length > 0 && (
              <div className="flex items-center gap-2 pt-2">
                <Users className="w-4 h-4 text-muted-foreground" />
                <h3 className="text-sm font-medium text-foreground">Friends</h3>
              </div>
            )}
            
            <div className="max-h-64 overflow-y-auto space-y-2">
              {friendsLoading ? (
                <p className="text-center text-muted-foreground py-4">Loading...</p>
              ) : searchLoading ? (
                <p className="text-center text-muted-foreground py-4">Searching...</p>
              ) : (searchQuery.trim() ? searchResults : filteredFriends).length === 0 ? (
                <p className="text-center text-muted-foreground py-4">
                  {searchQuery ? "No players found" : "No players available to add"}
                </p>
              ) : (
                (searchQuery.trim() ? searchResults : filteredFriends).map((friend) => {
                  const handicap = friend.handicap ? parseFloat(friend.handicap) : undefined;
                  const formatHandicap = (hcp: number | undefined): string => {
                    if (hcp === undefined) return "";
                    if (hcp < 0) return `+${Math.abs(hcp)}`;
                    return hcp.toString();
                  };
                  return (
                    <button
                      key={friend.id}
                      onClick={() => handleAddFriend(friend)}
                      className="w-full p-3 rounded-lg border hover:bg-accent transition-colors flex items-center gap-3 text-left"
                    >
                      <Avatar className="h-9 w-9">
                        <AvatarImage src={friend.avatar_url} />
                        <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                          {(friend.display_name || friend.username)?.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">
                          {friend.display_name || friend.username}
                        </p>
                        {friend.username && (
                          <p className="text-xs text-muted-foreground">
                            @{friend.username}
                            {handicap !== undefined && ` · HCP: ${formatHandicap(handicap)}`}
                          </p>
                        )}
                      </div>
                      <Plus className="w-5 h-5 text-primary" />
                    </button>
                  );
                })
              )}
            </div>
          </TabsContent>
          
          <TabsContent value="guest" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="guest-first-name">First Name *</Label>
              <Input
                id="guest-first-name"
                placeholder="Enter first name"
                value={tempFirstName}
                onChange={(e) => setTempFirstName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="guest-last-name">Last Name (optional)</Label>
              <Input
                id="guest-last-name"
                placeholder="Enter last name"
                value={tempLastName}
                onChange={(e) => setTempLastName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="guest-handicap">Handicap (optional)</Label>
              <Input
                id="guest-handicap"
                placeholder="e.g. 15 or 2,4"
                value={tempHandicap}
                onChange={(e) => setTempHandicap(e.target.value)}
              />
            </div>
            <Button
              onClick={handleAddTempPlayer}
              disabled={!tempFirstName.trim()}
              className="w-full"
            >
              <UserPlus className="w-4 h-4 mr-2" />
              Add Guest Player
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
