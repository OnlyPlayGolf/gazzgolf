import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Users, UserPlus, Search, Check, X, ArrowUpDown } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { User as SupabaseUser } from '@supabase/supabase-js';
import { TopNavBar } from "@/components/TopNavBar";

interface Friend {
  id: string;
  display_name: string | null;
  username: string | null;
  handicap: string | null;
  home_club: string | null;
  status: 'accepted' | 'pending' | 'blocked';
  is_requester: boolean;
}

type SortField = 'name' | 'handicap' | 'club';
type SortOrder = 'asc' | 'desc';

const Friends = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [incomingRequests, setIncomingRequests] = useState<Friend[]>([]);
  const [outgoingRequests, setOutgoingRequests] = useState<Friend[]>([]);
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  
  // Dialog states
  const [isAddFriendOpen, setIsAddFriendOpen] = useState(false);
  const [friendSearch, setFriendSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setUser(session?.user ?? null);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (user) {
      loadUserData();
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('friendships-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'friendships',
        },
        () => {
          loadUserData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const loadUserData = async () => {
    if (!user) return;

    try {
      // Load friends
      const { data: friendshipsData, error: friendshipsError } = await supabase
        .from('friendships')
        .select('*')
        .or(`requester.eq.${user.id},addressee.eq.${user.id}`);

      if (friendshipsError) throw friendshipsError;

      const acceptedFriends: Friend[] = [];
      const incoming: Friend[] = [];
      const outgoing: Friend[] = [];

      for (const friendship of friendshipsData || []) {
        if (friendship.status === 'accepted') {
          const friendId = friendship.requester === user.id ? friendship.addressee : friendship.requester;
          const { data: friendProfile } = await supabase
            .from('profiles')
            .select('display_name, username, handicap, home_club')
            .eq('id', friendId)
            .single();

          if (friendProfile) {
            acceptedFriends.push({
              id: friendId,
              display_name: friendProfile.display_name,
              username: friendProfile.username,
              handicap: friendProfile.handicap,
              home_club: friendProfile.home_club,
              status: 'accepted',
              is_requester: friendship.requester === user.id
            });
          }
        } else if (friendship.status === 'pending') {
          if (friendship.addressee === user.id) {
            const { data: requesterProfile } = await supabase
              .from('profiles')
              .select('display_name, username')
              .eq('id', friendship.requester)
              .single();

            if (requesterProfile) {
              incoming.push({
                id: friendship.requester,
                display_name: requesterProfile.display_name,
                username: requesterProfile.username,
                handicap: null,
                home_club: null,
                status: 'pending',
                is_requester: false
              });
            }
          } else {
            const { data: addresseeProfile } = await supabase
              .from('profiles')
              .select('display_name, username')
              .eq('id', friendship.addressee)
              .single();

            if (addresseeProfile) {
              outgoing.push({
                id: friendship.addressee,
                display_name: addresseeProfile.display_name,
                username: addresseeProfile.username,
                handicap: null,
                home_club: null,
                status: 'pending',
                is_requester: true
              });
            }
          }
        }
      }

      setFriends(acceptedFriends);
      setIncomingRequests(incoming);
      setOutgoingRequests(outgoing);
    } catch (error) {
      console.error('Error loading user data:', error);
    }
  };

  const handleSearchFriends = async () => {
    if (!friendSearch.trim() || !user) return;
    setLoading(true);
    
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, display_name')
        .or(`username.ilike.%${friendSearch}%,display_name.ilike.%${friendSearch}%`)
        .neq('id', user.id)
        .limit(10);

      if (error) throw error;
      setSearchResults(data || []);
    } catch (error) {
      console.error('Error searching friends:', error);
      toast({
        title: "Error",
        description: "Failed to search for users",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSendFriendRequest = async (friendId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('friendships')
        .insert({
          requester: user.id,
          addressee: friendId,
          status: 'pending'
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Friend request sent"
      });
      
      setIsAddFriendOpen(false);
      setFriendSearch("");
      setSearchResults([]);
      loadUserData();
    } catch (error) {
      console.error('Error sending friend request:', error);
      toast({
        title: "Error",
        description: "Failed to send friend request",
        variant: "destructive"
      });
    }
  };

  const handleFriendRequestResponse = async (friendshipId: string, accept: boolean) => {
    if (!user) return;

    try {
      if (accept) {
        const { error } = await supabase
          .from('friendships')
          .update({ status: 'accepted' })
          .eq('requester', friendshipId)
          .eq('addressee', user.id);

        if (error) throw error;

        toast({
          title: "Success",
          description: "Friend request accepted"
        });
      } else {
        const { error } = await supabase
          .from('friendships')
          .delete()
          .eq('requester', friendshipId)
          .eq('addressee', user.id);

        if (error) throw error;

        toast({
          title: "Success",
          description: "Friend request declined"
        });
      }

      loadUserData();
    } catch (error) {
      console.error('Error handling friend request:', error);
      toast({
        title: "Error",
        description: "Failed to process friend request",
        variant: "destructive"
      });
    }
  };

  const parseHandicap = (handicap: string | null): number => {
    if (!handicap) return 999; // Put null handicaps at the end
    const trimmed = handicap.trim();
    if (trimmed.startsWith('+')) {
      // Plus handicaps are actually better (lower), so negate them
      return -parseFloat(trimmed.substring(1));
    }
    return parseFloat(trimmed);
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const sortedFriends = [...friends].sort((a, b) => {
    let comparison = 0;

    if (sortField === 'name') {
      const nameA = (a.display_name || a.username || '').toLowerCase();
      const nameB = (b.display_name || b.username || '').toLowerCase();
      comparison = nameA.localeCompare(nameB, 'sv');
    } else if (sortField === 'handicap') {
      const hcpA = parseHandicap(a.handicap);
      const hcpB = parseHandicap(b.handicap);
      comparison = hcpA - hcpB;
    } else if (sortField === 'club') {
      const clubA = (a.home_club || '').toLowerCase();
      const clubB = (b.home_club || '').toLowerCase();
      comparison = clubA.localeCompare(clubB, 'sv');
    }

    return sortOrder === 'asc' ? comparison : -comparison;
  });

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-full max-w-md mx-4">
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground mb-4">Please sign in to view friends</p>
            <Button onClick={() => navigate('/auth')} className="w-full">
              Sign In
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="pb-20 min-h-screen bg-background">
      <TopNavBar />
      <div className="p-4 pt-20">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground mb-2">Friends</h1>
          <p className="text-muted-foreground">Manage your friends and requests</p>
        </div>

        <div className="space-y-6">
          {/* Add Friend Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserPlus size={20} className="text-primary" />
                Add Friends
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Dialog open={isAddFriendOpen} onOpenChange={setIsAddFriendOpen}>
                <DialogTrigger asChild>
                  <Button className="w-full">
                    <UserPlus size={16} className="mr-2" />
                    Add Friend
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add Friend</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="friend-search">Search by username or name</Label>
                      <div className="flex gap-2 mt-2">
                        <Input
                          id="friend-search"
                          value={friendSearch}
                          onChange={(e) => setFriendSearch(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleSearchFriends()}
                          placeholder="Enter username or name"
                        />
                        <Button onClick={handleSearchFriends} disabled={loading}>
                          <Search size={16} />
                        </Button>
                      </div>
                    </div>
                    
                    {searchResults.length > 0 && (
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {searchResults.map((result) => (
                          <div key={result.id} className="flex items-center justify-between p-3 border rounded-lg">
                            <div className="flex items-center gap-3">
                              <Avatar>
                                <AvatarFallback>
                                  {(result.display_name || result.username || '?')[0].toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="font-medium">{result.display_name || result.username}</p>
                                {result.display_name && <p className="text-sm text-muted-foreground">@{result.username}</p>}
                              </div>
                            </div>
                            <Button
                              size="sm"
                              onClick={() => handleSendFriendRequest(result.id)}
                            >
                              <UserPlus size={16} />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </DialogContent>
              </Dialog>
            </CardContent>
          </Card>

          {/* Incoming Requests */}
          {incomingRequests.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  Friend Requests
                  <Badge variant="secondary">{incomingRequests.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {incomingRequests.map((request) => (
                    <div key={request.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <Avatar>
                          <AvatarFallback>
                            {(request.display_name || request.username || '?')[0].toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{request.display_name || request.username}</p>
                          {request.display_name && <p className="text-sm text-muted-foreground">@{request.username}</p>}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => handleFriendRequestResponse(request.id, true)}
                          className="bg-primary hover:bg-primary/90"
                        >
                          <Check size={16} />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleFriendRequestResponse(request.id, false)}
                        >
                          <X size={16} />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Outgoing Requests */}
          {outgoingRequests.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  Pending Requests
                  <Badge variant="secondary">{outgoingRequests.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {outgoingRequests.map((request) => (
                    <div key={request.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <Avatar>
                          <AvatarFallback>
                            {(request.display_name || request.username || '?')[0].toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{request.display_name || request.username}</p>
                          {request.display_name && <p className="text-sm text-muted-foreground">@{request.username}</p>}
                        </div>
                      </div>
                      <Badge variant="outline">Pending</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Friends List */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users size={20} className="text-primary" />
                My Friends
                {friends.length > 0 && <Badge variant="secondary">{friends.length}</Badge>}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {friends.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No friends yet. Add some friends to get started!</p>
              ) : (
                <div className="space-y-3">
                  {/* Table Headers */}
                  <div className="grid grid-cols-[1fr_100px_1fr] gap-4 px-3 pb-2 border-b">
                    <button
                      onClick={() => handleSort('name')}
                      className="flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors text-left"
                    >
                      Name
                      <ArrowUpDown size={14} />
                    </button>
                    <button
                      onClick={() => handleSort('handicap')}
                      className="flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Handicap
                      <ArrowUpDown size={14} />
                    </button>
                    <button
                      onClick={() => handleSort('club')}
                      className="flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors text-left"
                    >
                      Club
                      <ArrowUpDown size={14} />
                    </button>
                  </div>

                  {/* Friends List */}
                  {sortedFriends.map((friend) => (
                    <div key={friend.id} className="grid grid-cols-[1fr_100px_1fr] gap-4 items-center p-3 border rounded-lg">
                      <div className="flex items-center gap-3 min-w-0">
                        <Avatar className="flex-shrink-0">
                          <AvatarFallback>
                            {(friend.display_name || friend.username || '?')[0].toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="font-medium truncate">{friend.display_name || friend.username}</p>
                          {friend.display_name && <p className="text-sm text-muted-foreground truncate">@{friend.username}</p>}
                        </div>
                      </div>
                      <div className="text-sm">
                        {friend.handicap ? `HCP: ${friend.handicap}` : '-'}
                      </div>
                      <div className="text-sm truncate">
                        {friend.home_club || '-'}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Friends;
