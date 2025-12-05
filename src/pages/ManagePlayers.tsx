import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ArrowLeft, Plus, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Player {
  userId: string;
  teeColor: string;
  displayName: string;
  username: string;
  avatarUrl?: string;
}

export default function ManagePlayers() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [friends, setFriends] = useState<any[]>([]);
  const [selectedPlayers, setSelectedPlayers] = useState<Player[]>([]);
  const [availableTees, setAvailableTees] = useState<string[]>([]);
  const [teeColor, setTeeColor] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      await fetchCurrentUser();
      await fetchFriends();
      
      // Get tees from URL params
      const teesParam = searchParams.get('tees');
      if (teesParam) {
        const tees = teesParam.split(',');
        setAvailableTees(tees);
        setTeeColor(tees[0] || 'White');
      }
      
      // Load existing players from sessionStorage if any
      const savedPlayers = sessionStorage.getItem('roundPlayers');
      const savedTee = sessionStorage.getItem('userTeeColor');
      if (savedPlayers) {
        setSelectedPlayers(JSON.parse(savedPlayers));
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
    const isAlreadyAdded = selectedPlayers.some(p => p.userId === friend.id);
    if (isAlreadyAdded) return;

    setSelectedPlayers(prev => [...prev, {
      userId: friend.id,
      teeColor: availableTees[0] || "White",
      displayName: friend.display_name || friend.username,
      username: friend.username,
      avatarUrl: friend.avatar_url
    }]);
  };

  const removePlayer = (userId: string) => {
    setSelectedPlayers(prev => prev.filter(p => p.userId !== userId));
  };

  const updatePlayerTee = (userId: string, newTee: string) => {
    setSelectedPlayers(prev => prev.map(p => 
      p.userId === userId ? { ...p, teeColor: newTee } : p
    ));
  };

  const handleSave = () => {
    // Save to sessionStorage
    sessionStorage.setItem('roundPlayers', JSON.stringify(selectedPlayers));
    sessionStorage.setItem('userTeeColor', teeColor);
    
    toast({
      title: "Players saved",
      description: "Your player selections have been saved",
    });
    
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
          <Button variant="ghost" size="icon" onClick={() => navigate('/rounds-play')}>
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
                <p className="text-sm text-muted-foreground">
                  Playing HCP: {currentUser.handicap || '+0'}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm">Tee box</Label>
              <Select value={teeColor} onValueChange={setTeeColor}>
                <SelectTrigger className="bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableTees.map((tee) => (
                    <SelectItem key={tee} value={tee}>{tee}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {/* Selected Players */}
        {selectedPlayers.map((player) => (
          <div key={player.userId} className="p-4 rounded-lg border bg-background space-y-4">
            <div className="flex items-start gap-3">
              <Avatar className="w-12 h-12">
                <AvatarImage src={player.avatarUrl} />
                <AvatarFallback className="bg-primary/10">
                  {player.displayName.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold">{player.displayName}</p>
                    <p className="text-sm text-muted-foreground">Playing HCP: +2</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removePlayer(player.userId)}
                  >
                    <X className="w-5 h-5" />
                  </Button>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm">Tee box</Label>
              <Select
                value={player.teeColor}
                onValueChange={(value) => updatePlayerTee(player.userId, value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableTees.map((tee) => (
                    <SelectItem key={tee} value={tee}>{tee}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
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

          {friends.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No friends available. Add friends to play together!
            </p>
          ) : (
            <div className="space-y-2">
              {friends.filter(f => !selectedPlayers.some(p => p.userId === f.id)).map((friend) => (
                <button
                  key={friend.id}
                  onClick={() => addPlayer(friend)}
                  className="w-full p-4 rounded-lg border hover:bg-accent transition-colors flex items-center gap-3 text-left"
                >
                  <Avatar className="w-10 h-10">
                    <AvatarImage src={friend.avatar_url} />
                    <AvatarFallback className="bg-primary/10">
                      {(friend.display_name || friend.username).charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <p className="font-medium">{friend.display_name || friend.username}</p>
                    <p className="text-sm text-muted-foreground">@{friend.username}</p>
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
    </div>
  );
}
