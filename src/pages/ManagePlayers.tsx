import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowLeft, Plus, X, UserPlus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { TeeSelector, getTeeDisplayName } from "@/components/TeeSelector";
import { DEFAULT_TEE_OPTIONS } from "@/utils/teeSystem";

interface Player {
  odId: string;
  teeColor: string;
  displayName: string;
  username: string;
  avatarUrl?: string;
  isTemporary?: boolean;
}

// Keep userId for backwards compatibility but internally use odId
interface PlayerWithUserId extends Player {
  userId: string;
}

export default function ManagePlayers() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [friends, setFriends] = useState<any[]>([]);
  const [selectedPlayers, setSelectedPlayers] = useState<PlayerWithUserId[]>([]);
  const [teeCount, setTeeCount] = useState(5);
  const [teeColor, setTeeColor] = useState("medium");
  const [loading, setLoading] = useState(true);
  
  // Temporary player dialog
  const [showAddTempPlayer, setShowAddTempPlayer] = useState(false);
  const [tempPlayerName, setTempPlayerName] = useState("");
  const [tempPlayerHandicap, setTempPlayerHandicap] = useState("");

  useEffect(() => {
    const loadData = async () => {
      await fetchCurrentUser();
      await fetchFriends();
      
      // Get tee count from URL params
      const teesParam = searchParams.get('tees');
      if (teesParam) {
        const tees = teesParam.split(',');
        setTeeCount(tees.length || 5);
      }
      
      // Load existing players from sessionStorage if any
      const savedPlayers = sessionStorage.getItem('roundPlayers');
      const savedTee = sessionStorage.getItem('userTeeColor');
      if (savedPlayers) {
        const parsed = JSON.parse(savedPlayers);
        // Map old format to new format if needed
        const mapped = parsed.map((p: any) => ({
          ...p,
          odId: p.odId || p.userId,
          userId: p.userId || p.odId
        }));
        setSelectedPlayers(mapped);
      }
      if (savedTee) {
        setTeeColor(savedTee);
      }
      
      setLoading(false);
    };
    
    loadData();
  }, [searchParams]);

  const fetchCurrentUser = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error) throw error;
      setCurrentUser(data);
    } catch (error: any) {
      console.error("Error fetching current user:", error);
    }
  };

  const fetchFriends = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Query accepted friendships
      const { data, error } = await supabase
        .from('friendships')
        .select('requester, addressee, user_a, user_b, status')
        .or(`requester.eq.${user.id},addressee.eq.${user.id},user_a.eq.${user.id},user_b.eq.${user.id}`)
        .eq('status', 'accepted');

      if (error) {
        console.error("Error fetching friendships:", error);
        return;
      }

      // Get unique friend IDs
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

      // Fetch profiles for friends
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .in('id', Array.from(friendIds));

      if (profilesError) {
        console.error("Error fetching friend profiles:", profilesError);
        return;
      }

      setFriends(profiles || []);
    } catch (error: any) {
      console.error("Error in fetchFriends:", error);
    }
  };

  const addPlayer = (friend: any) => {
    const isAlreadyAdded = selectedPlayers.some(p => p.odId === friend.id);
    if (isAlreadyAdded) return;

    setSelectedPlayers(prev => [...prev, {
      odId: friend.id,
      userId: friend.id,
      teeColor: "medium",
      displayName: friend.display_name || friend.username,
      username: friend.username,
      avatarUrl: friend.avatar_url,
      isTemporary: false
    }]);
  };

  const addTemporaryPlayer = () => {
    if (!tempPlayerName.trim()) {
      toast({
        title: "Name required",
        description: "Please enter a name for the player",
        variant: "destructive"
      });
      return;
    }

    const tempId = `temp_${Date.now()}`;
    setSelectedPlayers(prev => [...prev, {
      odId: tempId,
      userId: tempId,
      teeColor: "medium",
      displayName: tempPlayerName.trim(),
      username: tempPlayerName.trim().toLowerCase().replace(/\s+/g, '_'),
      isTemporary: true
    }]);

    setTempPlayerName("");
    setTempPlayerHandicap("");
    setShowAddTempPlayer(false);
    
    toast({
      title: "Player added",
      description: `${tempPlayerName} has been added as a temporary player`
    });
  };

  const removePlayer = (odId: string) => {
    setSelectedPlayers(prev => prev.filter(p => p.odId !== odId));
  };

  const updatePlayerTee = (odId: string, newTee: string) => {
    setSelectedPlayers(prev => prev.map(p => 
      p.odId === odId ? { ...p, teeColor: newTee } : p
    ));
  };

  const savePlayersToStorage = () => {
    sessionStorage.setItem('roundPlayers', JSON.stringify(selectedPlayers));
    sessionStorage.setItem('userTeeColor', teeColor);
  };

  const handleSave = () => {
    savePlayersToStorage();
    
    toast({
      title: "Players saved",
      description: "Your player selections have been saved",
    });
    
    navigate('/rounds-play');
  };

  const handleBack = () => {
    savePlayersToStorage();
    navigate('/rounds-play');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
        <div className="flex items-center justify-between p-4">
          <Button variant="ghost" size="icon" onClick={handleBack}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-lg font-bold">PLAYERS</h1>
          <div className="w-10" />
        </div>
      </div>

      <div className="p-4 space-y-6 max-w-2xl mx-auto">
        {/* Players Section Header */}
        <div className="p-4 rounded-lg bg-primary text-primary-foreground">
          <h2 className="font-bold text-lg">Players</h2>
        </div>

        {/* Current User */}
        {currentUser && (
          <div className="p-4 rounded-lg bg-primary/5 border-2 border-primary space-y-4">
            <div className="flex items-center gap-3">
              <Avatar className="w-12 h-12">
                <AvatarImage src={currentUser.avatar_url} />
                <AvatarFallback className="bg-primary text-primary-foreground">
                  {(currentUser.display_name || currentUser.username || 'U').charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <p className="font-semibold">
                  {currentUser.display_name || currentUser.username}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm">Tee box</Label>
              <TeeSelector
                value={teeColor}
                onValueChange={setTeeColor}
                teeCount={teeCount}
                triggerClassName="bg-background"
              />
            </div>
          </div>
        )}

        {/* Selected Players */}
        {selectedPlayers.map((player) => (
          <div key={player.odId} className="p-4 rounded-lg border bg-background space-y-4">
            <div className="flex items-start gap-3">
              <Avatar className="w-12 h-12">
                <AvatarImage src={player.avatarUrl} />
                <AvatarFallback className={player.isTemporary ? "bg-muted" : "bg-primary text-primary-foreground"}>
                  {player.displayName.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold">{player.displayName}</p>
                      {player.isTemporary && (
                        <span className="text-xs bg-muted px-2 py-0.5 rounded">Guest</span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {player.isTemporary ? "Temporary player" : "Playing HCP: +2"}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removePlayer(player.odId)}
                  >
                    <X className="w-5 h-5" />
                  </Button>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm">Tee box</Label>
              <TeeSelector
                value={player.teeColor}
                onValueChange={(value) => updatePlayerTee(player.odId, value)}
                teeCount={teeCount}
              />
            </div>
          </div>
        ))}

        {/* Add Players Section */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center">
              <Plus className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="font-semibold">Add Players & Groups</span>
          </div>

          {/* Add Temporary Player Button */}
          <Button
            variant="outline"
            onClick={() => setShowAddTempPlayer(true)}
            className="w-full"
          >
            <UserPlus className="w-4 h-4 mr-2" />
            Add Temporary Player (Guest)
          </Button>

          {friends.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No friends available. Add friends to play together!
            </p>
          ) : (
            <div className="space-y-2">
              {friends.filter(f => !selectedPlayers.some(p => p.odId === f.id)).map((friend) => (
                <button
                  key={friend.id}
                  onClick={() => addPlayer(friend)}
                  className="w-full p-4 rounded-lg border hover:bg-accent transition-colors flex items-center gap-3 text-left"
                >
                  <Avatar className="w-10 h-10">
                    <AvatarImage src={friend.avatar_url} />
                    <AvatarFallback className="bg-primary text-primary-foreground">
                      {(friend.display_name || friend.username).charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <p className="font-medium">{friend.display_name || friend.username}</p>
                    <p className="text-sm text-muted-foreground">
                      {friend.handicap ? `HCP ${friend.handicap}` : 'HCP -'}
                      {friend.home_club ? ` · ${friend.home_club}` : ''}
                    </p>
                  </div>
                  <Plus className="w-5 h-5 text-primary" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Start Round Button */}
        <div className="pt-4 pb-8">
          <Button onClick={handleSave} className="w-full" size="lg">
            Start Round
          </Button>
        </div>
      </div>

      {/* Add Temporary Player Dialog */}
      <Dialog open={showAddTempPlayer} onOpenChange={setShowAddTempPlayer}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-primary" />
              Add Temporary Player
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label htmlFor="temp-name">Player Name *</Label>
              <Input
                id="temp-name"
                placeholder="e.g. John Doe"
                value={tempPlayerName}
                onChange={(e) => setTempPlayerName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="temp-handicap">Handicap (optional)</Label>
              <Input
                id="temp-handicap"
                placeholder="e.g. 15"
                value={tempPlayerHandicap}
                onChange={(e) => setTempPlayerHandicap(e.target.value)}
              />
            </div>

            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowAddTempPlayer(false)} className="flex-1">
                Cancel
              </Button>
              <Button onClick={addTemporaryPlayer} className="flex-1">
                Add Player
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}