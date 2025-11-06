import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, UserPlus, Crown, Shield, Search, Link2, Copy, RefreshCw, Trash2, Trophy, LogOut, Send } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

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

interface GroupLevelLeaderboardEntry {
  user_id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  completed_levels: number;
  highest_level: number | null;
  category: string;
}

interface Message {
  id: string;
  sender_id: string;
  sender_name: string;
  content: string;
  created_at: string;
}

const GroupDetail = () => {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  
  const [user, setUser] = useState<any>(null);
  const [group, setGroup] = useState<any>(null);
  const [members, setMembers] = useState<Member[]>([]);
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
  const [groupLevelsLeaderboard, setGroupLevelsLeaderboard] = useState<GroupLevelLeaderboardEntry[]>([]);
  const [loadingGroupLevels, setLoadingGroupLevels] = useState(false);
  
  // Invite management state
  const [currentInvite, setCurrentInvite] = useState<any>(null);
  const [inviteExpiry, setInviteExpiry] = useState("");
  const [inviteMaxUses, setInviteMaxUses] = useState("");
  
  // Active tab state
  const [activeTab, setActiveTab] = useState("manage");
  
  // Messages state
  const [groupConversationId, setGroupConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load invite when switching to invite tab
  useEffect(() => {
    if (activeTab === 'invite') {
      loadCurrentInvite();
    }
  }, [activeTab]);

  // Load group conversation when switching to message tab
  useEffect(() => {
    if (activeTab === 'message' && groupId) {
      loadGroupConversation();
    }
  }, [activeTab, groupId]);

  // Subscribe to new messages
  useEffect(() => {
    if (groupConversationId) {
      loadMessages();
      
      const channel = supabase
        .channel(`messages-${groupConversationId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            filter: `conversation_id=eq.${groupConversationId}`
          },
          () => {
            loadMessages();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [groupConversationId]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

useEffect(() => {
  supabase.auth.getUser().then(({ data: { user } }) => {
    setUser(user);

    // Open specific tab if requested via URL
    if (searchParams.get('view') === 'members') {
      setActiveTab('manage');
    }
    
    // Open invite tab if requested via URL
    if (searchParams.get('view') === 'add') {
      setActiveTab('invite');
      loadFriendsForAdding();
      loadCurrentInvite();
    }
  });
}, [searchParams]);

  useEffect(() => {
    if (groupId && user) {
      loadGroupData();
      loadDrills();
      loadGroupLevelsLeaderboard();
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

  const loadGroupLevelsLeaderboard = async () => {
    if (!groupId || !user) return;
    setLoadingGroupLevels(true);
    try {
      const { data, error } = await supabase
        .rpc('group_level_leaderboard', { p_group_id: groupId });
      if (error) {
        console.error('Error loading group levels leaderboard:', error);
        setGroupLevelsLeaderboard([]);
      } else {
        setGroupLevelsLeaderboard(data || []);
      }
    } catch (e) {
      console.error('Error loading group levels leaderboard:', e);
      setGroupLevelsLeaderboard([]);
    } finally {
      setLoadingGroupLevels(false);
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
      setActiveTab('manage');
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

  const handleLeaveGroup = async () => {
    if (!groupId || !user || currentUserRole === 'owner') return;

    if (!confirm(`Are you sure you want to leave ${group.name}?`)) {
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('group_members')
        .delete()
        .eq('group_id', groupId)
        .eq('user_id', user.id);

      if (error) throw error;

      toast({
        title: "Left group",
        description: `You've left ${group.name}`,
      });

      navigate('/profile');
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to leave group",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadGroupConversation = async () => {
    if (!groupId) return;

    try {
      const { data, error } = await (supabase as any).rpc('ensure_group_conversation', { p_group_id: groupId });
      if (error) throw error;
      
      setGroupConversationId(data as string);
    } catch (error: any) {
      console.error('Error loading group conversation:', error);
      toast({
        title: "Error",
        description: "Failed to load group conversation",
        variant: "destructive",
      });
    }
  };

  const loadMessages = async () => {
    if (!groupConversationId) return;

    try {
      const { data, error } = await supabase
        .from('messages')
        .select('id, sender_id, content, created_at')
        .eq('conversation_id', groupConversationId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      if (!data || data.length === 0) {
        setMessages([]);
        return;
      }

      const senderIds = [...new Set(data.map((msg: any) => msg.sender_id))];
      
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, display_name, username')
        .in('id', senderIds);

      if (profilesError) {
        console.error('Error loading profiles:', profilesError);
      }

      const profilesMap = new Map(profiles?.map(p => [p.id, p]) || []);

      const formattedMessages = data.map((msg: any) => {
        const profile = profilesMap.get(msg.sender_id);
        const senderName = profile?.display_name || profile?.username || 'Unknown User';
        return {
          id: msg.id,
          sender_id: msg.sender_id,
          sender_name: senderName,
          content: msg.content,
          created_at: msg.created_at,
        };
      });

      setMessages(formattedMessages);
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  };

  const handleSendMessage = async () => {
    if (!groupConversationId || !newMessage.trim() || !user) return;

    setSendingMessage(true);
    try {
      const { error } = await supabase
        .from('messages')
        .insert({
          conversation_id: groupConversationId,
          sender_id: user.id,
          content: newMessage.trim()
        });

      if (error) throw error;

      setNewMessage("");
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to send message",
        variant: "destructive",
      });
    } finally {
      setSendingMessage(false);
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
            onClick={() => navigate(-1)}
          >
            <ArrowLeft size={20} />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-foreground">{group.name}</h1>
            <p className="text-sm text-muted-foreground">
              {members.length} {members.length === 1 ? 'member' : 'members'}
            </p>
          </div>
        </div>

        {/* Main Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="manage">Manage</TabsTrigger>
            <TabsTrigger value="invite">Invite</TabsTrigger>
            <TabsTrigger value="message">Message</TabsTrigger>
          </TabsList>

          {/* Manage Tab */}
          <TabsContent value="manage" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Members</span>
                  {canAddMembers && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        loadFriendsForAdding();
                        setActiveTab("invite");
                      }}
                    >
                      <UserPlus size={16} className="mr-2" />
                      Add
                    </Button>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {members.map((member) => (
                    <div
                      key={member.user_id}
                      className="flex items-center justify-between p-3 rounded-lg bg-secondary/30"
                    >
                      <div className="flex items-center gap-3">
                        <Avatar>
                          <AvatarImage src={member.avatar_url || undefined} />
                          <AvatarFallback>
                            {(member.display_name || member.username || 'U').charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-medium">
                            {member.display_name || member.username || 'Unknown'}
                          </div>
                          {member.username && (
                            <div className="text-sm text-muted-foreground">
                              @{member.username}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {getRoleIcon(member.role)}
                        <Badge variant={member.role === 'owner' ? 'default' : 'secondary'}>
                          {member.role}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Leave Group Section - Only for non-owners */}
            {currentUserRole !== 'owner' && (
              <Card className="border-destructive/50">
                <CardHeader>
                  <CardTitle className="text-destructive">Danger Zone</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">
                    Once you leave this group, you'll need to be re-invited to join again.
                  </p>
                  <Button 
                    variant="destructive" 
                    onClick={handleLeaveGroup}
                    disabled={loading}
                  >
                    <LogOut size={16} className="mr-2" />
                    Leave Group
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Invite Tab */}
          <TabsContent value="invite" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Invite Members</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {canAddMembers ? (
                  <>
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
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Only group owners and admins can create invite links.
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Message Tab */}
          <TabsContent value="message" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Group Chat</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col h-[500px]">
                  <div className="flex-1 overflow-y-auto space-y-3 mb-4 p-4 bg-muted/30 rounded-lg">
                    {messages.length === 0 ? (
                      <p className="text-center text-muted-foreground py-8">
                        No messages yet. Start the conversation!
                      </p>
                    ) : (
                      messages.map((msg) => {
                        const isOwnMessage = msg.sender_id === user?.id;
                        return (
                          <div key={msg.id} className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}>
                            <div
                              className={`max-w-[70%] rounded-lg p-3 ${
                                isOwnMessage
                                  ? 'bg-primary text-primary-foreground'
                                  : 'bg-secondary'
                              }`}
                            >
                              {!isOwnMessage && (
                                <p className="text-xs font-medium mb-1">{msg.sender_name}</p>
                              )}
                              <p className="text-sm">{msg.content}</p>
                              <p className={`text-xs mt-1 ${isOwnMessage ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                                {formatDistanceToNow(new Date(msg.created_at), { addSuffix: true })}
                              </p>
                            </div>
                          </div>
                        );
                      })
                    )}
                    <div ref={messagesEndRef} />
                  </div>
                  
                  <div className="flex gap-2">
                    <Input
                      placeholder="Type a message..."
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
                      disabled={sendingMessage}
                    />
                    <Button onClick={handleSendMessage} disabled={sendingMessage || !newMessage.trim()}>
                      <Send size={18} />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default GroupDetail;