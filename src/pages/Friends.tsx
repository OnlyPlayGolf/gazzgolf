import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ProfilePhoto } from "@/components/ProfilePhoto";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Users, UserPlus, Search, Check, X, ArrowUp, ArrowDown, MessageCircle, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { User as SupabaseUser } from '@supabase/supabase-js';
import { TopNavBar } from "@/components/TopNavBar";
import { parseHandicapForSort } from "@/lib/utils";

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
  
  // Remove friend dialog
  const [isRemoveDialogOpen, setIsRemoveDialogOpen] = useState(false);
  const [friendToRemove, setFriendToRemove] = useState<Friend | null>(null);

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
        .rpc('search_profiles', { q: friendSearch.trim(), max_results: 10 });

      if (error) throw error;

      // Enrich results with friendship status
      const enrichedResults = await Promise.all(
        (data || []).map(async (profile: any) => {
          const { data: friendship } = await supabase
            .from('friendships')
            .select('id, status, requester')
            .or(`and(requester.eq.${user.id},addressee.eq.${profile.id}),and(requester.eq.${profile.id},addressee.eq.${user.id})`)
            .maybeSingle();

          return {
            ...profile,
            friendshipStatus: friendship?.status || null,
            isRequester: friendship?.requester === user.id
          };
        })
      );

      setSearchResults(enrichedResults);
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
      // Check if friendship already exists in either direction
      const { data: existing } = await supabase
        .from('friendships')
        .select('id, status, requester, addressee')
        .or(`and(requester.eq.${user.id},addressee.eq.${friendId}),and(requester.eq.${friendId},addressee.eq.${user.id})`)
        .maybeSingle();

      if (existing) {
        if (existing.status === 'accepted') {
          toast({
            title: "Already friends",
            description: "You are already friends with this user",
            variant: "destructive"
          });
        } else if (existing.requester === user.id) {
          toast({
            title: "Request pending",
            description: "You already sent a friend request to this user",
            variant: "destructive"
          });
        } else {
          toast({
            title: "Request pending",
            description: "This user has already sent you a friend request. Check your friend requests!",
            variant: "destructive"
          });
        }
        return;
      }

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
      const hcpA = parseHandicapForSort(a.handicap);
      const hcpB = parseHandicapForSort(b.handicap);
      comparison = hcpA - hcpB;
    } else if (sortField === 'club') {
      const clubA = (a.home_club || '').toLowerCase();
      const clubB = (b.home_club || '').toLowerCase();
      comparison = clubA.localeCompare(clubB, 'sv');
    }

    return sortOrder === 'asc' ? comparison : -comparison;
  });

  const handleMessageFriend = async (friendId: string) => {
    if (!user) return;

    try {
      // Check if conversation already exists
      const { data: existingConversation } = await supabase
        .from('conversations')
        .select('id, conversation_participants!inner(user_id)')
        .eq('type', 'friend')
        .or(`conversation_participants.user_id.eq.${user.id},conversation_participants.user_id.eq.${friendId}`);

      let conversationId: string;

      if (existingConversation && existingConversation.length > 0) {
        // Find conversation where both users are participants
        const conv = existingConversation.find(c => {
          const participants = c.conversation_participants as any[];
          return participants.some(p => p.user_id === user.id) && 
                 participants.some(p => p.user_id === friendId);
        });
        
        if (conv) {
          conversationId = conv.id;
        } else {
          // Create new conversation
          const { data: newConv, error: convError } = await supabase
            .from('conversations')
            .insert({ type: 'friend' })
            .select()
            .single();

          if (convError) throw convError;
          conversationId = newConv.id;

          // Add participants
          const { error: participantsError } = await supabase
            .from('conversation_participants')
            .insert([
              { conversation_id: conversationId, user_id: user.id },
              { conversation_id: conversationId, user_id: friendId }
            ]);

          if (participantsError) throw participantsError;
        }
      } else {
        // Create new conversation
        const { data: newConv, error: convError } = await supabase
          .from('conversations')
          .insert({ type: 'friend' })
          .select()
          .single();

        if (convError) throw convError;
        conversationId = newConv.id;

        // Add participants
        const { error: participantsError } = await supabase
          .from('conversation_participants')
          .insert([
            { conversation_id: conversationId, user_id: user.id },
            { conversation_id: conversationId, user_id: friendId }
          ]);

        if (participantsError) throw participantsError;
      }

      // Navigate to messages page with conversation ID
      navigate(`/messages?conversation=${conversationId}`);
    } catch (error) {
      console.error('Error creating/finding conversation:', error);
      toast({
        title: "Error",
        description: "Failed to start conversation",
        variant: "destructive"
      });
    }
  };

  const handleRemoveFriend = async () => {
    if (!user || !friendToRemove) return;

    try {
      const { error } = await supabase
        .from('friendships')
        .delete()
        .or(`and(requester.eq.${user.id},addressee.eq.${friendToRemove.id}),and(requester.eq.${friendToRemove.id},addressee.eq.${user.id})`);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Friend removed successfully"
      });

      setIsRemoveDialogOpen(false);
      setFriendToRemove(null);
      loadUserData();
    } catch (error) {
      console.error('Error removing friend:', error);
      toast({
        title: "Error",
        description: "Failed to remove friend",
        variant: "destructive"
      });
    }
  };

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
          <div className="flex items-center gap-3 mb-2">
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => navigate("/profile")}
              className="rounded-full flex-shrink-0"
            >
              <ArrowLeft size={20} />
            </Button>
            <h1 className="text-2xl font-bold text-foreground">Friends</h1>
          </div>
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
                            <div 
                              className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity flex-1"
                              onClick={() => {
                                setIsAddFriendOpen(false);
                                navigate(`/user/${result.id}`);
                              }}
                            >
                              <ProfilePhoto
                                alt={result.display_name || result.username || "?"}
                                fallback={result.display_name || result.username || "?"}
                                size="md"
                              />
                              <div>
                                <p className="font-medium">{result.display_name || result.username}</p>
                                {result.display_name && <p className="text-sm text-muted-foreground">@{result.username}</p>}
                              </div>
                            </div>
                            {result.friendshipStatus === 'accepted' ? (
                              <Button size="sm" variant="secondary" disabled>
                                <Check size={16} className="mr-1" />
                                Friends
                              </Button>
                            ) : result.friendshipStatus === 'pending' ? (
                              <Button size="sm" variant="outline" disabled>
                                {result.isRequester ? 'Pending' : 'Respond'}
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSendFriendRequest(result.id);
                                }}
                              >
                                <UserPlus size={16} />
                              </Button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </DialogContent>
              </Dialog>
            </CardContent>
          </Card>

          {/* Incoming Friend Requests - Only show when there are requests */}
          {incomingRequests.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserPlus size={20} className="text-primary" />
                  Friend Requests
                  <Badge variant="secondary">{incomingRequests.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {incomingRequests.map((request) => (
                    <div key={request.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div 
                        className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity flex-1"
                        onClick={() => navigate(`/user/${request.id}`)}
                      >
                        <ProfilePhoto
                          alt={request.display_name || request.username || "?"}
                          fallback={request.display_name || request.username || "?"}
                          size="md"
                        />
                        <div>
                          <p className="font-medium">{request.display_name || request.username}</p>
                          {request.display_name && <p className="text-sm text-muted-foreground">@{request.username}</p>}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleFriendRequestResponse(request.id, true);
                          }}
                          className="bg-primary hover:bg-primary/90"
                        >
                          <Check size={16} />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleFriendRequestResponse(request.id, false);
                          }}
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
                      <div 
                        className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity flex-1"
                        onClick={() => navigate(`/user/${request.id}`)}
                      >
                        <ProfilePhoto
                          alt={request.display_name || request.username || "?"}
                          fallback={request.display_name || request.username || "?"}
                          size="md"
                        />
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
                      {sortField === 'name' && (
                        sortOrder === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
                      )}
                    </button>
                    <button
                      onClick={() => handleSort('handicap')}
                      className="flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Handicap
                      {sortField === 'handicap' && (
                        sortOrder === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
                      )}
                    </button>
                    <button
                      onClick={() => handleSort('club')}
                      className="flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors text-left"
                    >
                      Club
                      {sortField === 'club' && (
                        sortOrder === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
                      )}
                    </button>
                  </div>

                  {/* Friends List */}
                  {sortedFriends.map((friend) => (
                    <Card key={friend.id}>
                      <CardContent className="p-4">
                        <div className="flex flex-col gap-3">
                          <div 
                            className="flex items-center gap-4 cursor-pointer hover:opacity-80 transition-opacity"
                            onClick={() => navigate(`/user/${friend.id}`)}
                          >
                            <ProfilePhoto
                              alt={friend.display_name || friend.username || "?"}
                              fallback={friend.display_name || friend.username || "?"}
                              size="lg"
                              className="h-12 w-12"
                            />
                            
                            <div className="flex-1 min-w-0">
                              <h3 className="font-semibold text-base truncate">{friend.display_name || friend.username}</h3>
                              <p className="text-muted-foreground text-sm">
                                {friend.handicap ? `HCP: ${friend.handicap}` : 'HCP: -'}
                              </p>
                              <p className="text-muted-foreground text-sm truncate">
                                {friend.home_club || '-'}
                              </p>
                            </div>
                          </div>

                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="flex-1"
                              onClick={() => handleMessageFriend(friend.id)}
                            >
                              <MessageCircle size={16} className="mr-1" />
                              Message
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="flex-1 text-destructive hover:text-destructive"
                              onClick={() => {
                                setFriendToRemove(friend);
                                setIsRemoveDialogOpen(true);
                              }}
                            >
                              Remove
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Remove Friend Confirmation Dialog */}
      <AlertDialog open={isRemoveDialogOpen} onOpenChange={setIsRemoveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Friend</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove {friendToRemove?.display_name || friendToRemove?.username} from your friends list? This action will remove the friendship for both of you.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setFriendToRemove(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemoveFriend}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remove Friend
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Friends;
