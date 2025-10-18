import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Users, Trophy, Settings, Crown, Star, Plus, LogOut, Target, MessageCircle } from "lucide-react";
import { ProfileMessages } from "@/components/ProfileMessages";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { User as SupabaseUser, Session } from '@supabase/supabase-js';
import { syncLocalLevelsToDB } from "@/utils/levelsManager";

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

interface LevelLeaderboardEntry {
  user_id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  completed_levels: number;
  current_level: string | null;
  current_difficulty: string | null;
}

interface Drill {
  id: string;
  title: string;
  short_desc: string | null;
  lower_is_better: boolean;
}

interface DrillLeaderboardEntry {
  user_id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  best_score: number;
}

const Profile = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'profile');
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [favoriteGroupIds, setFavoriteGroupIds] = useState<string[]>([]);
  const [friendsLevelLeaderboard, setFriendsLevelLeaderboard] = useState<LevelLeaderboardEntry[]>([]);
  const [groupsLevelLeaderboard, setGroupsLevelLeaderboard] = useState<LevelLeaderboardEntry[]>([]);
  const [drills, setDrills] = useState<Drill[]>([]);
  const [selectedDrill, setSelectedDrill] = useState<string>("");
  const [drillLeaderboardType, setDrillLeaderboardType] = useState<'friends' | 'groups'>('friends');
  const [friendsDrillLeaderboard, setFriendsDrillLeaderboard] = useState<DrillLeaderboardEntry[]>([]);
  const [groupsDrillLeaderboard, setGroupsDrillLeaderboard] = useState<DrillLeaderboardEntry[]>([]);
  
  // Dialog states
  const [isCreateGroupOpen, setIsCreateGroupOpen] = useState(false);
  const [groupName, setGroupName] = useState("");
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
      loadLevelLeaderboards();
      loadDrills();
    }
  }, [user]);

  useEffect(() => {
    if (selectedDrill && user) {
      loadDrillLeaderboards();
    }
  }, [selectedDrill, drillLeaderboardType, user]);

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

    } catch (error) {
      console.error('Error loading user data:', error);
    }
  };

  const loadLevelLeaderboards = async () => {
    if (!user) return;

  try {
      // Ensure local progress is synced to DB so the leaderboard reflects it
      await syncLocalLevelsToDB();

      // Load friends level leaderboard
      const { data: friendsData, error: friendsError } = await supabase
        .rpc('friends_level_leaderboard');
      
      if (friendsError) {
        console.error('Error loading friends level leaderboard:', friendsError);
      } else {
        setFriendsLevelLeaderboard(friendsData || []);
      }

      // Load groups level leaderboard
      const { data: groupsData, error: groupsError } = await supabase
        .rpc('favourite_groups_level_leaderboard');
      
      if (groupsError) {
        console.error('Error loading groups level leaderboard:', groupsError);
      } else {
        setGroupsLevelLeaderboard(groupsData || []);
      }
    } catch (error) {
      console.error('Error loading level leaderboards:', error);
    }
  };

  const loadDrills = async () => {
    try {
      const { data, error } = await supabase
        .from('drills')
        .select('id, title, short_desc, lower_is_better')
        .order('title');

      if (error) {
        console.error('Error loading drills:', error);
      } else {
        setDrills(data || []);
        if (data && data.length > 0) {
          setSelectedDrill(data[0].title);
        }
      }
    } catch (error) {
      console.error('Error loading drills:', error);
    }
  };

  const loadDrillLeaderboards = async () => {
    if (!selectedDrill || !user) return;

    try {
      // Load friends drill leaderboard
      const { data: friendsData, error: friendsError } = await supabase
        .rpc('friends_leaderboard_for_drill_by_title', { p_drill_title: selectedDrill });

      if (friendsError) {
        console.error('Error loading friends drill leaderboard:', friendsError);
        setFriendsDrillLeaderboard([]);
      } else {
        setFriendsDrillLeaderboard(friendsData || []);
      }

      // Load groups drill leaderboard
      const { data: groupsData, error: groupsError } = await supabase
        .rpc('favourite_group_leaderboard_for_drill_by_title', { p_drill_title: selectedDrill });

      if (groupsError) {
        console.error('Error loading groups drill leaderboard:', groupsError);
        setGroupsDrillLeaderboard([]);
      } else {
        setGroupsDrillLeaderboard(groupsData || []);
      }
    } catch (error) {
      console.error('Error loading drill leaderboards:', error);
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

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!user || !event.target.files || event.target.files.length === 0) return;

    const file = event.target.files[0];
    const fileExt = file.name.split('.').pop();
    const filePath = `${user.id}/avatar.${fileExt}`;

    setUploadingAvatar(true);
    try {
      // Delete old avatar if exists
      if (profile?.avatar_url) {
        const oldPath = profile.avatar_url.split('/').slice(-2).join('/');
        await supabase.storage.from('avatars').remove([oldPath]);
      }

      // Upload new avatar
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);

      // Update profile with new avatar URL
      await handleUpdateProfile('avatar_url', data.publicUrl);

      toast({
        title: "Avatar updated",
        description: "Your profile picture has been updated.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to upload avatar.",
        variant: "destructive",
      });
    } finally {
      setUploadingAvatar(false);
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

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="groups">Groups</TabsTrigger>
            <TabsTrigger value="messages">
              <MessageCircle size={16} className="mr-1" />
              Messages
            </TabsTrigger>
            <TabsTrigger value="leaderboards">Leaderboards</TabsTrigger>
          </TabsList>
          
          <TabsContent value="profile" className="space-y-6 mt-6">
            {/* User Profile Header */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <Avatar className="h-16 w-16">
                      {profile?.avatar_url ? (
                        <img src={profile.avatar_url} alt="Profile" className="object-cover" />
                      ) : (
                        <AvatarFallback className="bg-primary text-primary-foreground text-lg">
                          {profile?.display_name ? profile.display_name.charAt(0).toUpperCase() : 
                           profile?.email ? profile.email.charAt(0).toUpperCase() : "?"}
                        </AvatarFallback>
                      )}
                    </Avatar>
                    <label htmlFor="avatar-upload" className="absolute bottom-0 right-0 p-1 bg-primary rounded-full cursor-pointer hover:bg-primary/90">
                      <input
                        id="avatar-upload"
                        type="file"
                        accept="image/*"
                        onChange={handleAvatarUpload}
                        disabled={uploadingAvatar}
                        className="hidden"
                      />
                      <Plus size={12} className="text-primary-foreground" />
                    </label>
                  </div>
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
                      <div>
                        <Label htmlFor="country">Country</Label>
                        <Input
                          id="country"
                          value={profile?.country || ""}
                          onChange={(e) => handleUpdateProfile('country', e.target.value)}
                          placeholder="Enter your country"
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label htmlFor="handicap">Handicap</Label>
                        <Input
                          id="handicap"
                          value={profile?.handicap || ""}
                          onChange={(e) => handleUpdateProfile('handicap', e.target.value)}
                          placeholder="e.g. +10 to 54"
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label htmlFor="home-club">Home Club</Label>
                        <Input
                          id="home-club"
                          value={profile?.home_club || ""}
                          onChange={(e) => handleUpdateProfile('home_club', e.target.value)}
                          placeholder="Enter your golf club"
                          className="mt-1"
                        />
                      </div>
                    </div>
                  </div>
                </div>
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
                      <div 
                        key={group.id} 
                        className="flex items-center justify-between p-3 rounded-md bg-secondary/50 hover:bg-secondary cursor-pointer transition-colors"
                        onClick={() => navigate(`/group/${group.id}`)}
                      >
                        <div className="flex items-center gap-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="font-medium text-foreground">{group.name}</h4>
                              {favoriteGroupIds.includes(group.id) && (
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
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleFavoriteGroup(group.id);
                          }}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          {favoriteGroupIds.includes(group.id) ? (
                            <>
                              <Star size={16} className="mr-1 fill-current text-yellow-500" />
                              Unfavorite
                            </>
                          ) : (
                            <>
                              <Star size={16} className="mr-1" />
                              Favorite ({favoriteGroupIds.length}/3)
                            </>
                          )}
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
            {/* Level Leaderboards */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Trophy size={20} />
                  Level Progress Leaderboards
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Friends Level Leaderboard */}
                <div>
                  <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                    <Users size={16} />
                    Friends
                  </h3>
                  {friendsLevelLeaderboard.length > 0 ? (
                    <div className="space-y-2">
                      {friendsLevelLeaderboard.map((entry, index) => {
                        const isCurrentUser = entry.user_id === user?.id;
                        return (
                          <div 
                            key={entry.user_id} 
                            className={`flex items-center justify-between p-3 rounded-md ${isCurrentUser ? 'bg-primary/10 border border-primary/20' : 'bg-secondary/50'}`}
                          >
                            <div className="flex items-center gap-3">
                              <Badge variant="outline" className="w-8 text-center">
                                {index + 1}
                              </Badge>
                              <Avatar className="h-8 w-8">
                                {entry.avatar_url ? (
                                  <img src={entry.avatar_url} alt={entry.username || 'User'} className="object-cover" />
                                ) : (
                                  <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                                    {entry.display_name?.charAt(0) || entry.username?.charAt(0) || '?'}
                                  </AvatarFallback>
                                )}
                              </Avatar>
                              <div>
                                <p className="font-medium text-foreground text-sm">
                                  {entry.display_name || entry.username || 'Unknown'}
                                  {isCurrentUser && ' (You)'}
                                </p>
                                {entry.current_level && (
                                  <p className="text-xs text-muted-foreground">
                                    Current: {entry.current_level}
                                  </p>
                                )}
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="font-semibold text-foreground">
                                {entry.completed_levels} level{entry.completed_levels !== 1 ? 's' : ''}
                              </p>
                              <p className="text-xs text-muted-foreground">completed</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-sm text-center py-4">
                      Complete levels to see your progress!
                    </p>
                  )}
                </div>

                {/* Groups Level Leaderboard */}
                <div>
                  <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                    <Star size={16} />
                    Favorite Groups
                  </h3>
                  {groupsLevelLeaderboard.length > 0 ? (
                    <div className="space-y-2">
                      {groupsLevelLeaderboard.map((entry, index) => {
                        const isCurrentUser = entry.user_id === user?.id;
                        return (
                          <div 
                            key={entry.user_id} 
                            className={`flex items-center justify-between p-3 rounded-md ${isCurrentUser ? 'bg-primary/10 border border-primary/20' : 'bg-secondary/50'}`}
                          >
                            <div className="flex items-center gap-3">
                              <Badge variant="outline" className="w-8 text-center">
                                {index + 1}
                              </Badge>
                              <Avatar className="h-8 w-8">
                                {entry.avatar_url ? (
                                  <img src={entry.avatar_url} alt={entry.username || 'User'} className="object-cover" />
                                ) : (
                                  <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                                    {entry.display_name?.charAt(0) || entry.username?.charAt(0) || '?'}
                                  </AvatarFallback>
                                )}
                              </Avatar>
                              <div>
                                <p className="font-medium text-foreground text-sm">
                                  {entry.display_name || entry.username || 'Unknown'}
                                  {isCurrentUser && ' (You)'}
                                </p>
                                {entry.current_level && (
                                  <p className="text-xs text-muted-foreground">
                                    Current: {entry.current_level}
                                  </p>
                                )}
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="font-semibold text-foreground">
                                {entry.completed_levels} level{entry.completed_levels !== 1 ? 's' : ''}
                              </p>
                              <p className="text-xs text-muted-foreground">completed</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-sm text-center py-4">
                      {favoriteGroupIds.length === 0 
                        ? 'Add favorite groups to see leaderboards' 
                        : 'Complete levels to see your progress!'}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Drill Leaderboards */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target size={20} />
                  Drill Leaderboards
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                 {/* Drill Selector */}
                <div className="space-y-2">
                  <Label>Select Drill</Label>
                  <Select value={selectedDrill} onValueChange={setSelectedDrill}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a drill..." />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from(new Map(drills.map(drill => [drill.title, drill])).values()).map((drill) => (
                        <SelectItem key={drill.id} value={drill.title}>
                          {drill.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Leaderboard Type Tabs */}
                {selectedDrill && (
                  <Tabs value={drillLeaderboardType} onValueChange={(v) => setDrillLeaderboardType(v as 'friends' | 'groups')}>
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="friends">
                        <Users size={16} className="mr-2" />
                        Friends
                      </TabsTrigger>
                      <TabsTrigger value="groups">
                        <Star size={16} className="mr-2" />
                        Groups
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent value="friends" className="mt-4">
                      {friendsDrillLeaderboard.length > 0 ? (
                        <div className="space-y-2">
                          {friendsDrillLeaderboard.map((entry, index) => {
                            const isCurrentUser = entry.user_id === user?.id;
                            return (
                              <div 
                                key={entry.user_id} 
                                className={`flex items-center justify-between p-3 rounded-md ${isCurrentUser ? 'bg-primary/10 border border-primary/20' : 'bg-secondary/50'}`}
                              >
                                <div className="flex items-center gap-3">
                                  <Badge variant="outline" className="w-8 text-center">
                                    {index + 1}
                                  </Badge>
                                  <Avatar className="h-8 w-8">
                                    {entry.avatar_url ? (
                                      <img src={entry.avatar_url} alt={entry.username || 'User'} className="object-cover" />
                                    ) : (
                                      <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                                        {entry.display_name?.charAt(0) || entry.username?.charAt(0) || '?'}
                                      </AvatarFallback>
                                    )}
                                  </Avatar>
                                  <div>
                                    <p className="font-medium text-foreground text-sm">
                                      {entry.display_name || entry.username || 'Unknown'}
                                      {isCurrentUser && ' (You)'}
                                    </p>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <p className="font-semibold text-foreground">
                                    {entry.best_score}
                                  </p>
                                  <p className="text-xs text-muted-foreground">points</p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-muted-foreground text-sm text-center py-4">
                          Complete this drill to see your score!
                        </p>
                      )}
                    </TabsContent>

                    <TabsContent value="groups" className="mt-4">
                      {groupsDrillLeaderboard.length > 0 ? (
                        <div className="space-y-2">
                          {groupsDrillLeaderboard.map((entry, index) => {
                            const isCurrentUser = entry.user_id === user?.id;
                            return (
                              <div 
                                key={entry.user_id} 
                                className={`flex items-center justify-between p-3 rounded-md ${isCurrentUser ? 'bg-primary/10 border border-primary/20' : 'bg-secondary/50'}`}
                              >
                                <div className="flex items-center gap-3">
                                  <Badge variant="outline" className="w-8 text-center">
                                    {index + 1}
                                  </Badge>
                                  <Avatar className="h-8 w-8">
                                    {entry.avatar_url ? (
                                      <img src={entry.avatar_url} alt={entry.username || 'User'} className="object-cover" />
                                    ) : (
                                      <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                                        {entry.display_name?.charAt(0) || entry.username?.charAt(0) || '?'}
                                      </AvatarFallback>
                                    )}
                                  </Avatar>
                                  <div>
                                    <p className="font-medium text-foreground text-sm">
                                      {entry.display_name || entry.username || 'Unknown'}
                                      {isCurrentUser && ' (You)'}
                                    </p>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <p className="font-semibold text-foreground">
                                    {entry.best_score}
                                  </p>
                                  <p className="text-xs text-muted-foreground">points</p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-muted-foreground text-sm text-center py-4">
                          {favoriteGroupIds.length === 0 
                            ? 'Add favorite groups to see leaderboards' 
                            : 'Complete this drill to see your score!'}
                        </p>
                      )}
                    </TabsContent>
                  </Tabs>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="messages" className="mt-6">
            <ProfileMessages />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Profile;