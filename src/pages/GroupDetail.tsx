import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, UserPlus, Crown, Shield, Search, Link2, Copy, RefreshCw, Trash2, Trophy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface Member {
  user_id: string;
  role: 'owner' | 'admin' | 'member';
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
}

interface Friend {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
}

interface Drill {
  id: string;
  title: string;
  lower_is_better: boolean;
}

interface LeaderboardEntry {
  user_id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  best_score: number;
}

const GroupDetail = () => {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [user, setUser] = useState<any>(null);
  const [group, setGroup] = useState<any>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [isAddMembersOpen, setIsAddMembersOpen] = useState(false);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [searchResults, setSearchResults] = useState<Friend[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [currentUserRole, setCurrentUserRole] = useState<'owner' | 'admin' | 'member' | null>(null);
  
  // Leaderboard state
  const [drills, setDrills] = useState<Drill[]>([]);
  const [selectedDrill, setSelectedDrill] = useState<string | null>(null);
  const [drillLeaderboard, setDrillLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);
  
  // Invite management state
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [currentInvite, setCurrentInvite] = useState<any>(null);
  const [inviteExpiry, setInviteExpiry] = useState("");
  const [inviteMaxUses, setInviteMaxUses] = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
    });
  }, []);

  useEffect(() => {
    if (groupId && user) {
      loadGroupData();
      loadDrills();
    }
  }, [groupId, user]);

  // Realtime subscription for members
  useEffect(() => {
    if (!groupId) return;

    const channel = supabase
      .channel(`group-members-${groupId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'group_members',
          filter: `group_id=eq.${groupId}`
        },
        () => {
          loadMembers();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [groupId]);

  const loadGroupData = async () => {
    if (!groupId || !user) return;

    try {
      // Load group info
      const { data: groupData } = await supabase
        .from('groups')
        .select('*')
        .eq('id', groupId)
        .single();

      setGroup(groupData);

      // Load members
      await loadMembers();
    } catch (error) {
      console.error('Error loading group:', error);
    }
  };

  const loadMembers = async () => {
    if (!groupId || !user) return;

    const { data: membersData } = await supabase
      .from('group_members')
      .select(`
        user_id,
        role,
        profiles!inner(username, display_name, avatar_url)
      `)
      .eq('group_id', groupId);

    const membersList = membersData?.map((m: any) => ({
      user_id: m.user_id,
      role: m.role,
      username: m.profiles.username,
      display_name: m.profiles.display_name,
      avatar_url: m.profiles.avatar_url
    })) || [];

    setMembers(membersList);

    // Set current user's role
    const myMembership = membersList.find(m => m.user_id === user.id);
    setCurrentUserRole(myMembership?.role || null);
  };

  const loadDrills = async () => {
    const { data } = await supabase
      .from('drills')
      .select('id, title, lower_is_better')
      .order('title');

    if (data && data.length > 0) {
      setDrills(data);
      setSelectedDrill(data[0].title);
      loadDrillLeaderboard(data[0].title, data[0].lower_is_better);
    }
  };

  const loadDrillLeaderboard = async (drillTitle: string, lowerIsBetter: boolean) => {
    if (!groupId) return;

    setLoadingLeaderboard(true);
    try {
      // Get drill ID
      const { data: drillData } = await supabase
        .rpc('get_or_create_drill_by_title', { p_title: drillTitle });

      if (!drillData) {
        setDrillLeaderboard([]);
        setLoadingLeaderboard(false);
        return;
      }

      // Get all group members
      const { data: groupMembers } = await supabase
        .from('group_members')
        .select('user_id')
        .eq('group_id', groupId);

      if (!groupMembers || groupMembers.length === 0) {
        setDrillLeaderboard([]);
        setLoadingLeaderboard(false);
        return;
      }

      const memberIds = groupMembers.map(m => m.user_id);

      // Get best scores for all group members
      const { data: memberScores } = await supabase
        .from('drill_results')
        .select('user_id, total_points')
        .eq('drill_id', drillData)
        .in('user_id', memberIds);

      // Calculate best score for each member
      const memberBestScores = new Map<string, number>();
      if (memberScores) {
        memberScores.forEach((score: any) => {
          const currentBest = memberBestScores.get(score.user_id);
          if (currentBest === undefined) {
            memberBestScores.set(score.user_id, score.total_points);
          } else {
            memberBestScores.set(
              score.user_id,
              lowerIsBetter 
                ? Math.min(currentBest, score.total_points)
                : Math.max(currentBest, score.total_points)
            );
          }
        });
      }

      // Get profiles for members with scores
      const memberIdsWithScores = Array.from(memberBestScores.keys());
      if (memberIdsWithScores.length === 0) {
        setDrillLeaderboard([]);
        setLoadingLeaderboard(false);
        return;
      }

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, display_name, username, avatar_url')
        .in('id', memberIdsWithScores);

      // Build and sort leaderboard
      let leaderboard: LeaderboardEntry[] = [];
      if (profiles) {
        leaderboard = profiles.map((profile: any) => ({
          user_id: profile.id,
          display_name: profile.display_name,
          username: profile.username,
          avatar_url: profile.avatar_url,
          best_score: memberBestScores.get(profile.id)!
        }));

        leaderboard.sort((a, b) => {
          if (lowerIsBetter) {
            return a.best_score - b.best_score;
          } else {
            return b.best_score - a.best_score;
          }
        });
      }

      setDrillLeaderboard(leaderboard);
    } catch (error) {
      console.error('Error loading drill leaderboard:', error);
      setDrillLeaderboard([]);
    } finally {
      setLoadingLeaderboard(false);
    }
  };

  const loadFriendsForAdding = async () => {
    if (!user) return;

    // Get friends from friendships
    const { data: friendsPairs } = await supabase
      .from('friends_pairs')
      .select('a, b')
      .or(`a.eq.${user.id},b.eq.${user.id}`);

    const friendIds = friendsPairs?.map(pair => 
      pair.a === user.id ? pair.b : pair.a
    ) || [];

    if (friendIds.length === 0) {
      setFriends([]);
      return;
    }

    // Get profiles for friends
    const { data: profilesData } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url')
      .in('id', friendIds);

    // Filter out users already in the group
    const memberIds = new Set(members.map(m => m.user_id));
    const availableFriends = profilesData?.filter(p => !memberIds.has(p.id)) || [];

    setFriends(availableFriends);
  };

  const handleSearchUsers = async (query: string) => {
    setSearchQuery(query);
    
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    const { data } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url')
      .ilike('username', `%${query}%`)
      .limit(20);

    // Filter out users already in the group
    const memberIds = new Set(members.map(m => m.user_id));
    const available = data?.filter(p => !memberIds.has(p.id) && p.id !== user?.id) || [];

    setSearchResults(available);
  };

  const handleToggleUser = (userId: string) => {
    const newSelected = new Set(selectedUsers);
    if (newSelected.has(userId)) {
      newSelected.delete(userId);
    } else {
      newSelected.add(userId);
    }
    setSelectedUsers(newSelected);
  };

  const handleAddMembers = async () => {
    if (selectedUsers.size === 0 || !groupId) return;

    setLoading(true);
    try {
      const inserts = Array.from(selectedUsers).map(userId => ({
        group_id: groupId,
        user_id: userId,
        role: 'member' as 'member'
      }));

      const { error } = await supabase
        .from('group_members')
        .insert(inserts);

      if (error) {
        if (error.code === '23505') {
          toast({
            title: "Some users already in group",
            description: "One or more selected users are already members.",
            variant: "destructive",
          });
        } else if (error.message?.includes('RLS') || error.message?.includes('policy')) {
          toast({
            title: "Permission denied",
            description: "You don't have permission to add members.",
            variant: "destructive",
          });
        } else {
          toast({
            title: "Error",
            description: error.message || "Failed to add members",
            variant: "destructive",
          });
        }
        return;
      }

      toast({
        title: "Members added",
        description: `Successfully added ${selectedUsers.size} member(s)`,
      });

      setSelectedUsers(new Set());
      setIsAddMembersOpen(false);
      await loadMembers();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to add members",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Invite management functions
  const generateInviteCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let code = '';
    for (let i = 0; i < 12; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  };

  const loadCurrentInvite = async () => {
    if (!groupId) return;

    const { data } = await supabase
      .from('group_invites')
      .select('*')
      .eq('group_id', groupId)
      .eq('revoked', false)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    setCurrentInvite(data);
  };

  const handleCreateInvite = async () => {
    if (!groupId || !user) return;

    setLoading(true);
    try {
      const code = generateInviteCode();
      const inviteData: any = {
        group_id: groupId,
        code,
        created_by: user.id,
      };

      if (inviteExpiry) {
        inviteData.expires_at = new Date(inviteExpiry).toISOString();
      }

      if (inviteMaxUses && parseInt(inviteMaxUses) > 0) {
        inviteData.max_uses = parseInt(inviteMaxUses);
      }

      const { data, error } = await supabase
        .from('group_invites')
        .insert(inviteData)
        .select()
        .single();

      if (error) throw error;

      setCurrentInvite(data);
      toast({
        title: "Invite created",
        description: "Share the link to invite members",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to create invite",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCopyInviteLink = () => {
    if (!currentInvite) return;
    
    const inviteUrl = `${window.location.origin}/invite/${currentInvite.code}`;
    navigator.clipboard.writeText(inviteUrl);
    
    toast({
      title: "Link copied",
      description: "Invite link copied to clipboard",
    });
  };

  const handleRegenerateInvite = async () => {
    if (!groupId || !user) return;

    setLoading(true);
    try {
      // Revoke old invite
      if (currentInvite) {
        await supabase
          .from('group_invites')
          .update({ revoked: true })
          .eq('id', currentInvite.id);
      }

      // Create new invite
      const code = generateInviteCode();
      const inviteData: any = {
        group_id: groupId,
        code,
        created_by: user.id,
      };

      if (inviteExpiry) {
        inviteData.expires_at = new Date(inviteExpiry).toISOString();
      }

      if (inviteMaxUses && parseInt(inviteMaxUses) > 0) {
        inviteData.max_uses = parseInt(inviteMaxUses);
      }

      const { data, error } = await supabase
        .from('group_invites')
        .insert(inviteData)
        .select()
        .single();

      if (error) throw error;

      setCurrentInvite(data);
      toast({
        title: "Invite regenerated",
        description: "Old invite link is now invalid",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to regenerate invite",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRevokeInvite = async () => {
    if (!currentInvite) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('group_invites')
        .update({ revoked: true })
        .eq('id', currentInvite.id);

      if (error) throw error;

      setCurrentInvite(null);
      toast({
        title: "Invite revoked",
        description: "This invite link can no longer be used",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to revoke invite",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const canAddMembers = currentUserRole === 'owner' || currentUserRole === 'admin';

  const getRoleIcon = (role: string) => {
    if (role === 'owner') return <Crown size={16} className="text-yellow-500" />;
    if (role === 'admin') return <Shield size={16} className="text-blue-500" />;
    return null;
  };

  if (!group) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="pb-20 min-h-screen bg-background">
      <div className="p-4">
        <div className="flex items-center gap-4 mb-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/profile')}
          >
            <ArrowLeft size={20} />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-foreground">{group.name}</h1>
            <p className="text-sm text-muted-foreground">{members.length} members</p>
          </div>
        </div>

        <Tabs defaultValue="members" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="members">Members</TabsTrigger>
            <TabsTrigger value="leaderboard">Leaderboard</TabsTrigger>
          </TabsList>

          <TabsContent value="members" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Group Members</CardTitle>
                  {canAddMembers && (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          loadCurrentInvite();
                          setIsInviteOpen(true);
                        }}
                      >
                        <Link2 size={16} className="mr-2" />
                        Invite Link
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => {
                          loadFriendsForAdding();
                          loadCurrentInvite();
                          setIsAddMembersOpen(true);
                        }}
                      >
                        <UserPlus size={16} className="mr-2" />
                        Add Members
                      </Button>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {members.map((member) => (
                  <div key={member.user_id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-12 w-12">
                        {member.avatar_url ? (
                          <img src={member.avatar_url} alt={member.display_name || member.username || 'User'} className="object-cover" />
                        ) : (
                          <AvatarFallback className="text-lg">
                            {(member.display_name || member.username || 'U')[0].toUpperCase()}
                          </AvatarFallback>
                        )}
                      </Avatar>
                      <div>
                        <div className="font-medium text-foreground flex items-center gap-2">
                          {member.display_name || member.username || 'Unknown'}
                          {getRoleIcon(member.role)}
                        </div>
                        {member.username && member.display_name && (
                          <div className="text-sm text-muted-foreground">@{member.username}</div>
                        )}
                      </div>
                    </div>
                    <Badge variant={member.role === 'owner' ? 'default' : 'secondary'} className="capitalize">
                      {member.role === 'owner' ? 'admin' : member.role}
                    </Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="leaderboard" className="space-y-4">
            <div className="space-y-4">
              {/* Drill Selector */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Select Drill</CardTitle>
                </CardHeader>
                <CardContent>
                  <select
                    className="w-full p-2 rounded-md border border-border bg-background text-foreground"
                    value={selectedDrill || ''}
                    onChange={(e) => {
                      const drill = drills.find(d => d.title === e.target.value);
                      if (drill) {
                        setSelectedDrill(drill.title);
                        loadDrillLeaderboard(drill.title, drill.lower_is_better);
                      }
                    }}
                  >
                    {drills.map((drill) => (
                      <option key={drill.id} value={drill.title}>
                        {drill.title}
                      </option>
                    ))}
                  </select>
                </CardContent>
              </Card>

              {/* Leaderboard */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-primary">
                    <Trophy size={18} />
                    {selectedDrill} Leaderboard
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {loadingLeaderboard ? (
                    <div className="text-center py-8">
                      <p className="text-muted-foreground">Loading leaderboard...</p>
                    </div>
                  ) : drillLeaderboard.length > 0 ? (
                    <div className="space-y-3">
                      {drillLeaderboard.map((entry, index) => (
                        <div 
                          key={entry.user_id} 
                          className={cn(
                            "flex items-center justify-between p-3 rounded-md",
                            entry.user_id === user?.id ? "bg-primary/10 border border-primary/20" : "bg-secondary/30"
                          )}
                        >
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              "flex items-center justify-center w-8 h-8 rounded-full font-bold",
                              index === 0 ? "bg-yellow-500/20 text-yellow-500" :
                              index === 1 ? "bg-gray-400/20 text-gray-400" :
                              index === 2 ? "bg-orange-500/20 text-orange-500" :
                              "bg-primary/20 text-primary"
                            )}>
                              {index === 0 ? (
                                <Crown size={16} className="text-yellow-500" />
                              ) : (
                                `#${index + 1}`
                              )}
                            </div>
                            <Avatar className="h-8 w-8">
                              {entry.avatar_url && <AvatarImage src={entry.avatar_url} alt={entry.display_name || entry.username || "User"} />}
                              <AvatarFallback className="bg-primary/20 text-primary">
                                {(entry.display_name || entry.username || "?").charAt(0).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <span className={cn(
                              "font-medium",
                              entry.user_id === user?.id && "font-bold text-primary"
                            )}>
                              {entry.display_name || entry.username || "Unknown"}
                              {entry.user_id === user?.id && " (You)"}
                            </span>
                          </div>
                          <Badge variant="outline" className={cn(
                            entry.user_id === user?.id && "border-primary text-primary"
                          )}>
                            {entry.best_score}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-center py-8">
                      No members have played this drill yet.
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={isAddMembersOpen} onOpenChange={setIsAddMembersOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Members</DialogTitle>
          </DialogHeader>

          <Tabs defaultValue="friends" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="friends">Friends</TabsTrigger>
              <TabsTrigger value="search">Search</TabsTrigger>
              <TabsTrigger value="invite">Invite Link</TabsTrigger>
            </TabsList>

            <TabsContent value="friends" className="space-y-4">
              {friends.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  No friends available to add
                </div>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {friends.map((friend) => (
                    <div key={friend.id} className="flex items-center gap-3 p-2 rounded hover:bg-accent">
                      <Checkbox
                        checked={selectedUsers.has(friend.id)}
                        onCheckedChange={() => handleToggleUser(friend.id)}
                      />
                      <Avatar className="h-8 w-8">
                        <AvatarFallback>
                          {(friend.display_name || friend.username || 'U')[0].toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <div className="text-sm font-medium">
                          {friend.display_name || friend.username || 'Unknown'}
                        </div>
                        {friend.username && friend.display_name && (
                          <div className="text-xs text-muted-foreground">@{friend.username}</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="search" className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by username..."
                  value={searchQuery}
                  onChange={(e) => handleSearchUsers(e.target.value)}
                  className="pl-9"
                />
              </div>

              <div className="space-y-2 max-h-96 overflow-y-auto">
                {searchQuery && searchResults.length === 0 ? (
                  <div className="text-center text-muted-foreground py-8">
                    No users found
                  </div>
                ) : (
                  searchResults.map((user) => (
                    <div key={user.id} className="flex items-center gap-3 p-2 rounded hover:bg-accent">
                      <Checkbox
                        checked={selectedUsers.has(user.id)}
                        onCheckedChange={() => handleToggleUser(user.id)}
                      />
                      <Avatar className="h-8 w-8">
                        <AvatarFallback>
                          {(user.display_name || user.username || 'U')[0].toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <div className="text-sm font-medium">
                          {user.display_name || user.username || 'Unknown'}
                        </div>
                        {user.username && user.display_name && (
                          <div className="text-xs text-muted-foreground">@{user.username}</div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </TabsContent>

            <TabsContent value="invite" className="space-y-4">
              <div className="text-center py-4">
                <p className="text-sm text-muted-foreground mb-4">
                  Share this link to invite people to the group
                </p>
                {currentInvite ? (
                  <>
                    <div className="flex gap-2">
                      <Input
                        value={`${window.location.origin}/invite/${currentInvite.code}`}
                        readOnly
                        className="text-sm"
                      />
                      <Button size="sm" onClick={handleCopyInviteLink}>
                        <Copy size={16} />
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      Uses: {currentInvite.uses_count}{currentInvite.max_uses ? ` / ${currentInvite.max_uses}` : ' / Unlimited'}
                    </p>
                  </>
                ) : (
                  <Button onClick={handleCreateInvite} disabled={loading}>
                    {loading ? "Creating..." : "Create Invite Link"}
                  </Button>
                )}
              </div>
            </TabsContent>
          </Tabs>

          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setIsAddMembersOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleAddMembers}
              disabled={selectedUsers.size === 0 || loading}
            >
              Add {selectedUsers.size > 0 && `(${selectedUsers.size})`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Invite Management Dialog */}
      <Dialog open={isInviteOpen} onOpenChange={setIsInviteOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Invite Link</DialogTitle>
          </DialogHeader>

          {currentInvite ? (
            <div className="space-y-4">
              <div>
                <Label className="text-sm text-muted-foreground">Current Invite Link</Label>
                <div className="flex gap-2 mt-2">
                  <Input
                    value={`${window.location.origin}/invite/${currentInvite.code}`}
                    readOnly
                    className="flex-1 text-sm"
                  />
                  <Button size="sm" onClick={handleCopyInviteLink}>
                    <Copy size={16} />
                  </Button>
                </div>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Uses:</span>
                  <span>{currentInvite.uses_count}{currentInvite.max_uses ? ` / ${currentInvite.max_uses}` : ' / Unlimited'}</span>
                </div>
                {currentInvite.expires_at && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Expires:</span>
                    <span>{new Date(currentInvite.expires_at).toLocaleDateString()}</span>
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={handleRegenerateInvite}
                  disabled={loading}
                  className="flex-1"
                >
                  <RefreshCw size={16} className="mr-2" />
                  Regenerate
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleRevokeInvite}
                  disabled={loading}
                  className="flex-1"
                >
                  <Trash2 size={16} className="mr-2" />
                  Revoke
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Create a shareable invite link for this group.
              </p>

              <div>
                <Label htmlFor="expiry">Expiration (optional)</Label>
                <Input
                  id="expiry"
                  type="datetime-local"
                  value={inviteExpiry}
                  onChange={(e) => setInviteExpiry(e.target.value)}
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="max-uses">Max Uses (optional)</Label>
                <Input
                  id="max-uses"
                  type="number"
                  min="1"
                  placeholder="Unlimited"
                  value={inviteMaxUses}
                  onChange={(e) => setInviteMaxUses(e.target.value)}
                  className="mt-1"
                />
              </div>

              <Button
                onClick={handleCreateInvite}
                disabled={loading}
                className="w-full"
              >
                {loading ? "Creating..." : "Create Invite Link"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default GroupDetail;