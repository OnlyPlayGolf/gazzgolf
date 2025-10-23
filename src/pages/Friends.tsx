import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Users, UserPlus, Search, MessageCircle, UserCircle2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { User as SupabaseUser } from '@supabase/supabase-js';

interface Friend {
  id: string;
  display_name: string | null;
  username: string | null;
  handicap: string | null;
  home_club: string | null;
  status: 'accepted' | 'pending' | 'blocked';
  is_requester: boolean;
}

const Friends = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [incomingRequests, setIncomingRequests] = useState<Friend[]>([]);
  const [outgoingRequests, setOutgoingRequests] = useState<Friend[]>([]);
  
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
              .select('display_name, username, handicap, home_club')
              .eq('id', friendship.requester)
              .single();

            if (requesterProfile) {
              incoming.push({
                id: friendship.requester,
                display_name: requesterProfile.display_name,
                username: requesterProfile.username,
                handicap: requesterProfile.handicap,
                home_club: requesterProfile.home_club,
                status: 'pending',
                is_requester: false
              });
            }
          } else {
            const { data: addresseeProfile } = await supabase
              .from('profiles')
              .select('display_name, username, handicap, home_club')
              .eq('id', friendship.addressee)
              .single();

            if (addresseeProfile) {
              outgoing.push({
                id: friendship.addressee,
                display_name: addresseeProfile.display_name,
                username: addresseeProfile.username,
                handicap: addresseeProfile.handicap,
                home_club: addresseeProfile.home_club,
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

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-full max-w-md mx-4 p-6 bg-card border rounded-lg">
          <p className="text-center text-muted-foreground mb-4">Please sign in to view friends</p>
          <Button onClick={() => navigate('/auth')} className="w-full">
            Sign In
          </Button>
        </div>
      </div>
    );
  }

  const getInitials = (name: string | null, username: string | null) => {
    const displayName = name || username || '?';
    return displayName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <div className="pb-20 min-h-screen bg-background">
      <div className="p-4 space-y-8">
        {/* Add Friend Button */}
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
                            {getInitials(result.display_name, result.username)}
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

        {/* Friend Requests Section */}
        {incomingRequests.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Users size={24} />
              <h2 className="text-2xl font-bold">Friend Requests ({incomingRequests.length})</h2>
            </div>
            <div className="space-y-3">
              {incomingRequests.map((request) => (
                <div key={request.id} className="flex items-center justify-between p-4 bg-card border rounded-lg">
                  <div className="flex items-center gap-4">
                    <Avatar className="h-16 w-16">
                      <AvatarFallback className="text-xl font-semibold">
                        {getInitials(request.display_name, request.username)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-lg font-semibold">{request.display_name || request.username}</p>
                      <div className="flex items-center gap-3 text-sm text-muted-foreground">
                        <span>HCP: {request.handicap || '+2.3'}</span>
                        <span className="flex items-center gap-1">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
                          </svg>
                          {request.home_club || 'Djursholms GK'}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => handleFriendRequestResponse(request.id, true)}
                      className="bg-green-700 hover:bg-green-800 text-white"
                    >
                      Accept
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => handleFriendRequestResponse(request.id, false)}
                    >
                      Decline
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* My Friends Section */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Users size={24} />
            <h2 className="text-2xl font-bold">My Friends ({friends.length})</h2>
          </div>
          
          {friends.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No friends yet. Add some friends to get started!</p>
          ) : (
            <div className="bg-card border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[250px]">
                      <div className="flex items-center gap-1">
                        Name <span className="text-xs">↑</span>
                      </div>
                    </TableHead>
                    <TableHead>Handicap</TableHead>
                    <TableHead>Golf Club</TableHead>
                    <TableHead>Level</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {friends.map((friend) => (
                    <TableRow key={friend.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-12 w-12">
                            <AvatarFallback className="text-base font-semibold">
                              {getInitials(friend.display_name, friend.username)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="font-medium">{friend.display_name || friend.username}</span>
                        </div>
                      </TableCell>
                      <TableCell>{friend.handicap || '-'}</TableCell>
                      <TableCell className="text-muted-foreground">{friend.home_club || '-'}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="rounded-full">Level 1</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button variant="ghost" size="icon">
                            <MessageCircle size={20} />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={() => navigate(`/user/${friend.id}`)}
                          >
                            <UserCircle2 size={20} />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Friends;
