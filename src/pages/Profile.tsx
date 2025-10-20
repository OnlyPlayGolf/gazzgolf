import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Star, Plus, MessageCircle, Crown, UserPlus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { User as SupabaseUser, Session } from '@supabase/supabase-js';
import { AddFriendDialog } from "@/components/AddFriendDialog";
import { NotificationsSheet } from "@/components/NotificationsSheet";
import { MessagesSheet } from "@/components/MessagesSheet";

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
  description?: string;
}

const Profile = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [favoriteGroupIds, setFavoriteGroupIds] = useState<string[]>([]);
  
  // Dialog states
  const [isCreateGroupOpen, setIsCreateGroupOpen] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [groupDescription, setGroupDescription] = useState("");
  const [groupType, setGroupType] = useState<"Player" | "Coach">("Player");
  const [groupImage, setGroupImage] = useState<File | null>(null);
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<{ id: string; display_name: string | null; username: string | null; }[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

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

  // Search users when search term changes
  useEffect(() => {
    const searchUsers = async () => {
      if (!searchTerm.trim() || !user) {
        setSearchResults([]);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, display_name, username')
          .neq('id', user.id) // Exclude current user
          .or(`display_name.ilike.%${searchTerm}%,username.ilike.%${searchTerm}%`)
          .limit(20);

        if (error) {
          console.error('Error searching users:', error);
          setSearchResults([]);
        } else {
          setSearchResults(data || []);
        }
      } catch (error) {
        console.error('Error in searchUsers:', error);
        setSearchResults([]);
      }
    };

    const timeoutId = setTimeout(searchUsers, 300); // Debounce search
    return () => clearTimeout(timeoutId);
  }, [searchTerm, user]);

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
      // Load groups with member counts
      const { data: groupsData } = await (supabase as any)
        .from('group_members')
        .select(`
          groups(id, name, owner_id),
          role
        `)
        .eq('user_id', user.id);

      // Get member counts for each group
      const groupsList = await Promise.all(
        (groupsData || []).map(async (g: any) => {
          const { count } = await (supabase as any)
            .from('group_members')
            .select('*', { count: 'exact', head: true })
            .eq('group_id', g.groups.id);

          return {
            id: g.groups.id,
            name: g.groups.name,
            owner_id: g.groups.owner_id,
            role: g.role,
            member_count: count || 0
          };
        })
      );

      setGroups(groupsList);

      // Load favorite groups
      const { data: settingsData } = await (supabase as any)
        .from('user_settings')
        .select('favourite_group_ids')
        .eq('user_id', user.id)
        .maybeSingle();

      if (settingsData?.favourite_group_ids) {
        setFavoriteGroupIds(settingsData.favourite_group_ids);
      }

      // Load friends for member selection
      const { data: friendshipsData } = await (supabase as any)
        .from('friendships')
        .select(`
          *,
          requester_profile:profiles!friendships_requester_fkey(id, display_name, username),
          addressee_profile:profiles!friendships_addressee_fkey(id, display_name, username)
        `)
        .or(`requester.eq.${user.id},addressee.eq.${user.id}`)
        .eq('status', 'accepted');

      const acceptedFriends = (friendshipsData || []).map((f: any) => {
        const isRequester = f.requester === user.id;
        const friendProfile = isRequester ? f.addressee_profile : f.requester_profile;
        return {
          id: friendProfile.id,
          display_name: friendProfile.display_name,
          username: friendProfile.username,
          status: 'accepted' as const,
          is_requester: isRequester
        };
      });

      setFriends(acceptedFriends);

    } catch (error) {
      console.error('Error loading user data:', error);
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

      // Step 3: Add selected members to the group
      if (selectedMembers.length > 0) {
        const memberInserts = selectedMembers.map(memberId => ({
          group_id: groupData.id,
          user_id: memberId,
          role: 'member'
        }));

        const { error: membersError } = await (supabase as any)
          .from('group_members')
          .insert(memberInserts);

        if (membersError) {
          console.error('Error adding members:', membersError);
          toast({
            title: "Members not added",
            description: "Group created but some members couldn't be added.",
            variant: "destructive",
          });
        }
      }

      // Success!
      toast({
        title: "Group created successfully!",
        description: `Group "${groupName}" has been created. You're the owner.`,
      });

      setGroupName("");
      setGroupDescription("");
      setGroupType("Player");
      setGroupImage(null);
      setSelectedMembers([]);
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

  const handleToggleFavoriteGroup = async (groupId: string) => {
    if (!user) return;

    try {
      let newFavorites: string[];
      
      if (favoriteGroupIds.includes(groupId)) {
        // Remove from favorites
        newFavorites = favoriteGroupIds.filter(id => id !== groupId);
      } else {
        // Add to favorites (max 3)
        if (favoriteGroupIds.length >= 3) {
          toast({
            title: "Maximum favorites reached",
            description: "You can only favorite up to 3 groups. Remove one to add another.",
            variant: "destructive",
          });
          return;
        }
        newFavorites = [...favoriteGroupIds, groupId];
      }

      const { error } = await (supabase as any)
        .from('user_settings')
        .upsert({
          user_id: user.id,
          favourite_group_ids: newFavorites
        }, { onConflict: 'user_id' });

      if (error) throw error;

      setFavoriteGroupIds(newFavorites);
      toast({
        title: newFavorites.includes(groupId) ? "Group favorited" : "Group unfavorited",
        description: newFavorites.includes(groupId) 
          ? "This group will appear in drill leaderboards." 
          : "This group has been removed from favorites.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update favorite groups.",
        variant: "destructive",
      });
    }
  };

  const handleMessageGroup = async (groupId: string) => {
    try {
      // Use the database function to ensure the conversation exists
      const { data: conversationId, error } = await supabase
        .rpc('ensure_group_conversation', { p_group_id: groupId });

      if (error) {
        console.error('Error getting group conversation:', error);
        toast({
          title: "Error",
          description: "Failed to open group conversation.",
          variant: "destructive",
        });
        return;
      }

      // Navigate to messages page with the conversation ID
      navigate(`/messages?conversation=${conversationId}`);
    } catch (error) {
      console.error('Error handling group message:', error);
      toast({
        title: "Error",
        description: "Failed to open group messages.",
        variant: "destructive",
      });
    }
  };

  const handleLeaveGroup = async (groupId: string, groupName: string) => {
    if (!user) return;

    const confirmed = window.confirm(`Are you sure you want to leave "${groupName}"?`);
    if (!confirmed) return;

    try {
      const { error } = await supabase
        .from('group_members')
        .delete()
        .eq('group_id', groupId)
        .eq('user_id', user.id);

      if (error) throw error;

      toast({
        title: "Left group",
        description: `You have left ${groupName}`,
      });

      loadUserData();
    } catch (error) {
      console.error('Error leaving group:', error);
      toast({
        title: "Error",
        description: "Failed to leave group.",
        variant: "destructive",
      });
    }
  };

  const getGroupInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  if (!user) {
    return null; // Will redirect to auth
  }

  return (
    <div className="pb-20 min-h-screen bg-background">
      <div className="p-4">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-2xl font-bold text-foreground">My Groups</h1>
          <div className="flex items-center gap-2">
            <AddFriendDialog />
            <MessagesSheet />
            <NotificationsSheet />
          </div>
        </div>

        <p className="text-muted-foreground text-sm mb-6">
          Connect and compete with your golf friends
        </p>

        {/* Action buttons */}
        <div className="flex gap-3 mb-6">
          <Button 
            variant="outline" 
            className="flex-1"
            onClick={() => navigate('/accept-invite')}
          >
            <UserPlus size={16} className="mr-2" />
            Check Invitations
          </Button>
          <Dialog open={isCreateGroupOpen} onOpenChange={setIsCreateGroupOpen}>
            <DialogTrigger asChild>
              <Button className="flex-1">
                <Plus size={16} className="mr-2" />
                Create Group
              </Button>
            </DialogTrigger>
                    <DialogContent className="sm:max-w-md">
                      <DialogHeader>
                        <DialogTitle className="text-xl font-semibold text-center">Create New Group</DialogTitle>
                        <DialogDescription className="text-center text-muted-foreground">
                          Create a group to compete and connect with your golf friends.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        {/* Group Type Toggle */}
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            variant={groupType === "Player" ? "default" : "outline"}
                            className="flex-1"
                            onClick={() => setGroupType("Player")}
                          >
                            Player
                          </Button>
                          <Button
                            type="button"
                            variant={groupType === "Coach" ? "default" : "outline"}
                            className="flex-1"
                            onClick={() => setGroupType("Coach")}
                          >
                            Coach
                          </Button>
                        </div>

                        {/* Group Name */}
                        <div>
                          <Label htmlFor="group-name" className="text-foreground">
                            Group Name <span className="text-destructive">*</span>
                          </Label>
                          <Input
                            id="group-name"
                            value={groupName}
                            onChange={(e) => setGroupName(e.target.value)}
                            placeholder="Enter group name"
                            className="mt-1.5"
                          />
                        </div>

                        {/* Description */}
                        <div>
                          <Label htmlFor="group-description" className="text-foreground">
                            Description
                          </Label>
                          <Textarea
                            id="group-description"
                            value={groupDescription}
                            onChange={(e) => setGroupDescription(e.target.value)}
                            placeholder="Optional group description"
                            className="mt-1.5 min-h-[100px] resize-none"
                          />
                        </div>

                        {/* Group Image Upload */}
                        <div>
                          <Label className="text-foreground">Group Image</Label>
                          <div 
                            className="mt-1.5 border-2 border-dashed border-muted-foreground/30 rounded-lg p-8 flex flex-col items-center justify-center cursor-pointer hover:border-primary/50 transition-colors"
                            onClick={() => document.getElementById('group-image-input')?.click()}
                          >
                            <input
                              id="group-image-input"
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) setGroupImage(file);
                              }}
                            />
                            {groupImage ? (
                              <div className="text-center">
                                <p className="text-sm text-foreground font-medium">{groupImage.name}</p>
                                <p className="text-xs text-muted-foreground mt-1">Click to change</p>
                              </div>
                            ) : (
                              <>
                                <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
                                  <svg
                                    className="w-6 h-6 text-muted-foreground"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                                    />
                                  </svg>
                                </div>
                                <p className="text-sm text-muted-foreground">Upload group image</p>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Add Members */}
                        <div>
                          <Label className="text-foreground">
                            Add Members ({selectedMembers.length} selected)
                          </Label>
                          <div className="mt-1.5 space-y-2">
                            <Input
                              placeholder="Search by name or username..."
                              value={searchTerm}
                              onChange={(e) => setSearchTerm(e.target.value)}
                              className="w-full"
                            />
                            {searchTerm && (
                              <div className="border border-border rounded-lg max-h-[200px] overflow-y-auto">
                                {searchResults.length > 0 ? (
                                  searchResults.map((user) => (
                                    <label
                                      key={user.id}
                                      className="flex items-center gap-3 p-3 hover:bg-secondary/50 cursor-pointer transition-colors border-b border-border last:border-b-0"
                                    >
                                      <input
                                        type="checkbox"
                                        checked={selectedMembers.includes(user.id)}
                                        onChange={(e) => {
                                          if (e.target.checked) {
                                            setSelectedMembers([...selectedMembers, user.id]);
                                          } else {
                                            setSelectedMembers(selectedMembers.filter(id => id !== user.id));
                                          }
                                        }}
                                        className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
                                      />
                                      <div className="flex-1">
                                        <p className="text-sm text-foreground font-medium">
                                          {user.display_name || user.username || 'Unknown'}
                                        </p>
                                        {user.display_name && user.username && (
                                          <p className="text-xs text-muted-foreground">@{user.username}</p>
                                        )}
                                      </div>
                                    </label>
                                  ))
                                ) : (
                                  <p className="text-sm text-muted-foreground p-3 text-center">
                                    No users found
                                  </p>
                                )}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex flex-col gap-2 pt-2">
                          <Button
                            onClick={handleCreateGroup}
                            disabled={loading || !groupName.trim()}
                            className="w-full bg-foreground text-background hover:bg-foreground/90"
                          >
                            {loading ? "Creating..." : "Create Group"}
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            onClick={() => {
                              setIsCreateGroupOpen(false);
                              setGroupName("");
                              setGroupDescription("");
                              setGroupType("Player");
                              setGroupImage(null);
                              setSelectedMembers([]);
                              setSearchTerm("");
                              setSearchResults([]);
                            }}
                            className="w-full"
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
        </div>

        {/* Groups List */}
        <div className="space-y-4">
          {groups.length > 0 ? (
            groups.map((group) => (
              <Card key={group.id} className="border-border">
                <CardContent className="p-4">
                  <div className="flex gap-4">
                    {/* Group Avatar */}
                    <div className="flex-shrink-0">
                      <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                        <span className="text-lg font-bold text-foreground">
                          {getGroupInitials(group.name)}
                        </span>
                      </div>
                    </div>

                    {/* Group Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-foreground">{group.name}</h3>
                          {(group.role === 'owner' || group.role === 'admin') && (
                            <Crown size={16} className="text-yellow-500 fill-current" />
                          )}
                        </div>
                        {(group.role === 'owner' || group.role === 'admin') && (
                          <Badge variant="secondary" className="text-xs">
                            admin
                          </Badge>
                        )}
                      </div>

                      <p className="text-sm text-muted-foreground mb-3">
                        {group.member_count} {group.member_count === 1 ? 'member' : 'members'}
                      </p>

                      {group.description && (
                        <p className="text-sm text-muted-foreground mb-3">
                          {group.description}
                        </p>
                      )}

                      {/* Action Buttons */}
                      <div className="flex gap-2">
                        <Button
                          variant="default"
                          size="sm"
                          className="flex-1"
                          onClick={() => navigate(`/group/${group.id}`)}
                        >
                          View Leaderboard
                        </Button>
                        {group.role !== 'owner' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleLeaveGroup(group.id, group.name)}
                          >
                            Leave
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleToggleFavoriteGroup(group.id)}
                        >
                          <Star 
                            size={16} 
                            className={favoriteGroupIds.includes(group.id) ? "fill-current text-yellow-500" : ""} 
                          />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleMessageGroup(group.id)}
                        >
                          <MessageCircle size={16} />
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <Card className="border-border">
              <CardContent className="p-8">
                <p className="text-muted-foreground text-sm text-center">
                  No groups yet. Create a group to get started!
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default Profile;