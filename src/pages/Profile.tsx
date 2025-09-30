import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Users, Trophy, Settings, Crown, Star, Plus, Search, UserPlus, Check, X, LogOut } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { User as SupabaseUser, Session } from '@supabase/supabase-js';

interface Friend {
  id: string;
  display_name: string | null;
  username: string | null;
  status: 'accepted' | 'pending' | 'blocked';
  is_requester: boolean;
}

interface Group {
  id: string;
  name: string;
  owner_id: string;
  role: 'owner' | 'admin' | 'member';
  member_count: number;
}

interface DrillResult {
  id: string;
  user_id: string;
  display_name: string | null;
  username: string | null;
  total_points: number;
}

const Profile = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [favoriteGroupId, setFavoriteGroupId] = useState<string | null>(null);
  const [incomingRequests, setIncomingRequests] = useState<Friend[]>([]);
  const [outgoingRequests, setOutgoingRequests] = useState<Friend[]>([]);
  
  // Dialog states
  const [isAddFriendOpen, setIsAddFriendOpen] = useState(false);
  const [isCreateGroupOpen, setIsCreateGroupOpen] = useState(false);
  const [friendSearch, setFriendSearch] = useState("");
  const [groupName, setGroupName] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        if (!session?.user) {
          navigate('/auth');
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (!session?.user) {
        navigate('/auth');
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  useEffect(() => {
    if (user) {
      loadUserData();
    }
  }, [user]);

  // Realtime subscription for friendships changes
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('friendships-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'friendships'
        },
        () => {
          // Refetch data when friendships change
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
      // Load user profile
      const { data: profileData } = await (supabase as any)
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      
      setProfile(profileData);

      // Load friends from canonical friends_pairs view
      const { data: friendsPairsData } = await (supabase as any)
        .from('friends_pairs')
        .select('a, b')
        .or(`a.eq.${user.id},b.eq.${user.id}`);

      // Get the friend IDs (the other user in each pair)
      const friendIds = friendsPairsData?.map((pair: any) => 
        pair.a === user.id ? pair.b : pair.a
      ) || [];

      // Fetch friend profiles
      let friendsList: Friend[] = [];
      if (friendIds.length > 0) {
        const { data: profilesData } = await (supabase as any)
          .from('profiles')
          .select('id, display_name, username')
          .in('id', friendIds);

        friendsList = profilesData?.map((p: any) => ({
          id: p.id,
          display_name: p.display_name,
          username: p.username,
          status: 'accepted' as const,
          is_requester: false
        })) || [];
      }

      setFriends(friendsList);

      // Load incoming friend requests
      const { data: incomingData } = await (supabase as any)
        .from('friendships')
        .select('id, requester, addressee, status')
        .eq('addressee', user.id)
        .eq('status', 'pending');

      // Fetch requester profiles for incoming
      let incomingList: Friend[] = [];
      if (incomingData && incomingData.length > 0) {
        const requesterIds = incomingData.map((r: any) => r.requester);
        const { data: profilesData } = await (supabase as any)
          .from('profiles')
          .select('id, display_name, username')
          .in('id', requesterIds);

        incomingList = incomingData.map((r: any) => {
          const profile = profilesData?.find((p: any) => p.id === r.requester);
          return {
            id: r.id,
            display_name: profile?.display_name || null,
            username: profile?.username || null,
            status: r.status,
            is_requester: false
          };
        });
      }

      setIncomingRequests(incomingList);

      // Load outgoing friend requests
      const { data: outgoingData } = await (supabase as any)
        .from('friendships')
        .select('id, requester, addressee, status')
        .eq('requester', user.id)
        .eq('status', 'pending');

      // Fetch addressee profiles for outgoing
      let outgoingList: Friend[] = [];
      if (outgoingData && outgoingData.length > 0) {
        const addresseeIds = outgoingData.map((r: any) => r.addressee);
        const { data: profilesData } = await (supabase as any)
          .from('profiles')
          .select('id, display_name, username')
          .in('id', addresseeIds);

        outgoingList = outgoingData.map((r: any) => {
          const profile = profilesData?.find((p: any) => p.id === r.addressee);
          return {
            id: r.id,
            display_name: profile?.display_name || null,
            username: profile?.username || null,
            status: r.status,
            is_requester: true
          };
        });
      }

      setOutgoingRequests(outgoingList);

      // Load groups
      const { data: groupsData } = await (supabase as any)
        .from('group_members')
        .select(`
          groups(id, name, owner_id),
          role
        `)
        .eq('user_id', user.id);

      const groupsList = groupsData?.map((g: any) => ({
        id: g.groups.id,
        name: g.groups.name,
        owner_id: g.groups.owner_id,
        role: g.role,
        member_count: 0 // We could do a separate query for this if needed
      })) || [];

      setGroups(groupsList);

      // Load favorite group
      const { data: settingsData } = await (supabase as any)
        .from('user_settings')
        .select('favourite_group_id')
        .eq('user_id', user.id)
        .single();

      if (settingsData?.favourite_group_id) {
        setFavoriteGroupId(settingsData.favourite_group_id);
      }

    } catch (error) {
      console.error('Error loading user data:', error);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/auth');
  };

  const handleUpdateProfile = async (field: string, value: string) => {
    if (!user) return;

    try {
      const { error } = await (supabase as any)
        .from('profiles')
        .update({ [field]: value })
        .eq('id', user.id);

      if (error) throw error;
      
      setProfile((prev: any) => ({ ...prev, [field]: value }));
      toast({
        title: "Profile updated",
        description: "Your profile has been updated successfully.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update profile.",
        variant: "destructive",
      });
    }
  };

  const handleSendFriendRequest = async () => {
    if (!user || !friendSearch.trim()) return;

    setLoading(true);
    try {
      // Find user by username
      const { data: targetUser } = await (supabase as any)
        .from('profiles')
        .select('id')
        .eq('username', friendSearch.trim())
        .single();

      if (!targetUser) {
        toast({
          title: "User not found",
          description: "No user found with that username.",
          variant: "destructive",
        });
        return;
      }

      // Send friend request
      const { error } = await (supabase as any)
        .from('friendships')
        .insert({
          requester: user.id,
          addressee: targetUser.id,
          status: 'pending'
        });

      if (error) throw error;

      toast({
        title: "Friend request sent",
        description: `Friend request sent to ${friendSearch}`,
      });

      setFriendSearch("");
      setIsAddFriendOpen(false);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to send friend request.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleFriendRequestResponse = async (requestId: string, accept: boolean) => {
    if (!user) return;

    try {
      if (accept) {
        // Get the friendship details
        const { data: friendship } = await (supabase as any)
          .from('friendships')
          .select('requester, addressee')
          .eq('id', requestId)
          .single();

        if (!friendship) {
          throw new Error('Friend request not found');
        }

        // Update status to accepted
        const { error: updateError } = await (supabase as any)
          .from('friendships')
          .update({ status: 'accepted' })
          .eq('id', requestId);

        if (updateError) throw updateError;

        // Ensure canonical pair exists in friendships using the database function
        const { error: ensureError } = await (supabase as any)
          .rpc('ensure_friendship', {
            u1: friendship.requester,
            u2: friendship.addressee
          });

        if (ensureError) throw ensureError;

        toast({
          title: "Friend request accepted",
          description: "You are now friends!",
        });
      } else {
        const { error } = await (supabase as any)
          .from('friendships')
          .delete()
          .eq('id', requestId);

        if (error) throw error;

        toast({
          title: "Friend request declined",
          description: "Friend request has been declined.",
        });
      }

      // Refetch data from network
      await loadUserData();
    } catch (error) {
      console.error('Error responding to friend request:', error);
      toast({
        title: "Error",
        description: "Failed to respond to friend request.",
        variant: "destructive",
      });
    }
  };

  const handleCreateGroup = async () => {
    if (!groupName.trim()) {
      toast({
        title: "Validation error",
        description: "Please enter a group name",
        variant: "destructive",
      });
      return;
    }

    if (!user) {
      toast({
        title: "Authentication error",
        description: "You must be logged in to create a group",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      // Step 1: Create the group
      const { data: groupData, error: groupError } = await (supabase as any)
        .from('groups')
        .insert({
          name: groupName.trim(),
          owner_id: user.id
        })
        .select()
        .single();

      if (groupError) {
        console.error('Error creating group:', groupError);
        
        // Show specific error messages based on error code
        let errorMessage = "Failed to create group";
        
        if (groupError.code === '23505') {
          errorMessage = "A group with this name already exists";
        } else if (groupError.code === '23502') {
          errorMessage = "Missing required field: group name";
        } else if (groupError.message?.includes('RLS') || groupError.message?.includes('policy')) {
          errorMessage = "Permission denied: You don't have permission to create a group (RLS)";
        } else if (groupError.message) {
          errorMessage = `Database error: ${groupError.message}`;
        }
        
        toast({
          title: "Failed to create group",
          description: errorMessage,
          variant: "destructive",
        });
        return;
      }

      // Step 2: Add creator as owner in group_members
      const { error: memberError } = await (supabase as any)
        .from('group_members')
        .insert({
          group_id: groupData.id,
          user_id: user.id,
          role: 'owner'
        });

      if (memberError) {
        console.error('Error adding owner to group:', memberError);
        
        let errorMessage = "Failed to add you as group owner";
        
        if (memberError.message?.includes('RLS') || memberError.message?.includes('policy')) {
          errorMessage = "Permission denied: Failed to add owner (RLS)";
        } else if (memberError.message) {
          errorMessage = `Failed to add owner: ${memberError.message}`;
        }
        
        toast({
          title: "Group creation incomplete",
          description: errorMessage,
          variant: "destructive",
        });
        
        // Try to clean up the orphaned group
        await (supabase as any).from('groups').delete().eq('id', groupData.id);
        return;
      }

      // Success!
      toast({
        title: "Group created successfully!",
        description: `Group "${groupName}" has been created. You're the owner.`,
      });

      setGroupName("");
      setIsCreateGroupOpen(false);
      
      // Refetch groups to show the new group immediately
      await loadUserData();
    } catch (error: any) {
      console.error('Error in handleCreateGroup:', error);
      
      let errorMessage = "Failed to create group";
      
      if (error.message?.includes('Failed to fetch') || error.message?.includes('NetworkError')) {
        errorMessage = "No internet connection. Please check your network.";
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSetFavoriteGroup = async (groupId: string | null) => {
    if (!user) return;

    try {
      const { error } = await (supabase as any)
        .from('user_settings')
        .upsert({
          user_id: user.id,
          favourite_group_id: groupId
        });

      if (error) throw error;

      setFavoriteGroupId(groupId);
      toast({
        title: groupId ? "Favorite group set" : "Favorite group removed",
        description: groupId ? "This group will appear in drill leaderboards." : "No favorite group set.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update favorite group.",
        variant: "destructive",
      });
    }
  };

  if (!user) {
    return null; // Will redirect to auth
  }

  return (
    <div className="pb-20 min-h-screen bg-background">
      <div className="p-4">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-bold text-foreground">Profile</h1>
          <Button
            variant="outline"
            size="sm"
            onClick={handleSignOut}
            className="text-destructive hover:text-destructive"
          >
            <LogOut size={16} className="mr-2" />
            Sign Out
          </Button>
        </div>

        <Tabs defaultValue="profile" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="friends">Friends</TabsTrigger>
            <TabsTrigger value="groups">Groups</TabsTrigger>
            <TabsTrigger value="leaderboards">Leaderboards</TabsTrigger>
          </TabsList>
          
          <TabsContent value="profile" className="space-y-6 mt-6">
            {/* User Profile Header */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <Avatar className="h-16 w-16">
                    <AvatarFallback className="bg-primary text-primary-foreground text-lg">
                      {profile?.display_name ? profile.display_name.charAt(0).toUpperCase() : 
                       profile?.email ? profile.email.charAt(0).toUpperCase() : "?"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <div className="space-y-2">
                      <div>
                        <Label htmlFor="display-name">Display Name</Label>
                        <Input
                          id="display-name"
                          value={profile?.display_name || ""}
                          onChange={(e) => handleUpdateProfile('display_name', e.target.value)}
                          placeholder="Enter your display name"
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label htmlFor="username">Username</Label>
                        <Input
                          id="username"
                          value={profile?.username || ""}
                          onChange={(e) => handleUpdateProfile('username', e.target.value)}
                          placeholder="Enter your username"
                          className="mt-1"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="friends" className="space-y-6 mt-6">
            {/* Add Friend */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-primary flex items-center gap-2">
                    <UserPlus size={20} />
                    Add Friends
                  </CardTitle>
                  <Dialog open={isAddFriendOpen} onOpenChange={setIsAddFriendOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm">
                        <Plus size={16} className="mr-2" />
                        Add Friend
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Add Friend</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="friend-search">Username</Label>
                          <Input
                            id="friend-search"
                            value={friendSearch}
                            onChange={(e) => setFriendSearch(e.target.value)}
                            placeholder="Enter username"
                            className="mt-1"
                          />
                        </div>
                        <div className="flex gap-2">
                          <Button
                            onClick={handleSendFriendRequest}
                            disabled={loading || !friendSearch.trim()}
                            className="flex-1"
                          >
                            {loading ? "Sending..." : "Send Request"}
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => {
                              setIsAddFriendOpen(false);
                              setFriendSearch("");
                            }}
                            className="flex-1"
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
            </Card>

            {/* Incoming Friend Requests */}
            <Card>
              <CardHeader>
                <CardTitle className="text-primary flex items-center gap-2">
                  <UserPlus size={20} />
                  Incoming Requests
                </CardTitle>
              </CardHeader>
              <CardContent>
                {incomingRequests.length > 0 ? (
                  <div className="space-y-3">
                    {incomingRequests.map((request) => (
                      <div key={request.id} className="flex items-center justify-between p-3 rounded-md bg-secondary/50">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="bg-muted text-muted-foreground text-sm">
                              {(request.display_name || request.username || "?").charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium text-foreground">
                              {request.display_name || request.username || "Unknown"}
                            </p>
                            <p className="text-sm text-muted-foreground">@{request.username}</p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => handleFriendRequestResponse(request.id, true)}
                            className="bg-green-600 hover:bg-green-700"
                          >
                            <Check size={16} />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleFriendRequestResponse(request.id, false)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <X size={16} />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm text-center py-8">
                    No pending requests.
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Outgoing Friend Requests */}
            <Card>
              <CardHeader>
                <CardTitle className="text-primary flex items-center gap-2">
                  <Search size={20} />
                  Outgoing Requests
                </CardTitle>
              </CardHeader>
              <CardContent>
                {outgoingRequests.length > 0 ? (
                  <div className="space-y-3">
                    {outgoingRequests.map((request) => (
                      <div key={request.id} className="flex items-center justify-between p-3 rounded-md bg-secondary/50">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="bg-muted text-muted-foreground text-sm">
                              {(request.display_name || request.username || "?").charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium text-foreground">
                              {request.display_name || request.username || "Unknown"}
                            </p>
                            <p className="text-sm text-muted-foreground">@{request.username}</p>
                          </div>
                        </div>
                        <Badge variant="outline" className="text-xs">Pending</Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm text-center py-8">
                    No outgoing requests.
                  </p>
                )}
              </CardContent>
            </Card>

            {/* My Friends */}
            <Card>
              <CardHeader>
                <CardTitle className="text-primary flex items-center gap-2">
                  <Users size={20} />
                  My Friends ({friends.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {friends.length > 0 ? (
                  <div className="space-y-2">
                    {friends.map((friend) => (
                      <div key={friend.id} className="flex items-center gap-3 p-2 rounded-md bg-secondary/50">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="bg-muted text-muted-foreground text-sm">
                            {(friend.display_name || friend.username || "?").charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium text-foreground">
                            {friend.display_name || friend.username || "Unknown"}
                          </p>
                          <p className="text-sm text-muted-foreground">@{friend.username}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm text-center py-8">
                    No friends yet.
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="groups" className="space-y-6 mt-6">
            {/* Create Group */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-primary flex items-center gap-2">
                    <Settings size={20} />
                    My Groups
                  </CardTitle>
                  <Dialog open={isCreateGroupOpen} onOpenChange={setIsCreateGroupOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm">
                        <Plus size={16} className="mr-2" />
                        Create Group
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Create Group</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="group-name">Group Name</Label>
                          <Input
                            id="group-name"
                            value={groupName}
                            onChange={(e) => setGroupName(e.target.value)}
                            placeholder="Enter group name"
                            className="mt-1"
                          />
                        </div>
                        <div className="flex gap-2">
                          <Button
                            onClick={handleCreateGroup}
                            disabled={loading || !groupName.trim()}
                            className="flex-1"
                          >
                            {loading ? "Creating..." : "Create Group"}
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => {
                              setIsCreateGroupOpen(false);
                              setGroupName("");
                            }}
                            className="flex-1"
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent>
                {groups.length > 0 ? (
                  <div className="space-y-3">
                    {groups.map((group) => (
                      <div key={group.id} className="flex items-center justify-between p-3 rounded-md bg-secondary/50">
                        <div className="flex items-center gap-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="font-medium text-foreground">{group.name}</h4>
                              {favoriteGroupId === group.id && (
                                <Star size={16} className="text-yellow-500 fill-current" />
                              )}
                              <Badge variant="outline" className="text-xs">
                                {group.role}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {group.member_count} members
                            </p>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleSetFavoriteGroup(favoriteGroupId === group.id ? null : group.id)}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          {favoriteGroupId === group.id ? 'Unfavorite' : 'Set Favorite'}
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm text-center py-8">
                    No groups yet. Create a group to get started!
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="leaderboards" className="space-y-6 mt-6">
            <Card>
              <CardContent className="pt-6">
                <div className="text-center py-8">
                  <Trophy size={48} className="mx-auto text-muted-foreground mb-4" />
                  <h3 className="font-semibold text-foreground mb-2">Full Leaderboards</h3>
                  <p className="text-muted-foreground mb-4">
                    Complete leaderboards are shown in individual drill pages. Visit any drill to see friends and group leaderboards!
                  </p>
                  <Button onClick={() => navigate('/drills')}>
                    View Drills
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Profile;