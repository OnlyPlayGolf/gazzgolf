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
import { ArrowLeft, UserPlus, Crown, Shield, Search, Link2, Copy, RefreshCw, Trash2, Trophy, LogOut, Send, Star, Calendar } from "lucide-react";
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
      loadFriendsForAdding();
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
      .or(`username.ilike.%${query}%,display_name.ilike.%${query}%`)
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
      <div className="p-4 space-y-4">
        {/* Header */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(-1)}
          className="mb-4"
        >
          <ArrowLeft size={20} className="mr-2" />
          Back to Groups
        </Button>

        {/* Group Info Card */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <Avatar className="h-20 w-20">
                <AvatarFallback className="text-2xl">
                  {group.name.substring(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h1 className="text-2xl font-bold text-foreground">{group.name}</h1>
                  <Crown size={24} className="text-yellow-500" />
                </div>
                <p className="text-muted-foreground mb-2">
                  {members.length} {members.length === 1 ? 'member' : 'members'}
                </p>
                {group.description && (
                  <p className="text-foreground mb-4">{group.description}</p>
                )}
                
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
                  <Calendar size={16} />
                  <span>Created {new Date(group.created_at).toLocaleDateString()}</span>
                </div>

                {currentUserRole && (
                  <Badge className="mb-4">{currentUserRole}</Badge>
                )}

                <div className="flex gap-3">
                  <Button 
                    className="flex-1"
                    onClick={() => navigate(`/leaderboards?group=${groupId}`)}
                  >
                    View Leaderboard
                  </Button>
                  
                  {currentUserRole !== 'owner' && (
                    <Button
                      variant="outline"
                      onClick={handleLeaveGroup}
                      disabled={loading}
                    >
                      Leave
                    </Button>
                  )}
                </div>
              </div>

              <Button
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:text-yellow-500"
              >
                <Star size={24} />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="space-y-3">
          {canAddMembers && (
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => setActiveTab("invite")}
            >
              <UserPlus size={20} className="mr-3" />
              Invite Friends
            </Button>
          )}
          
          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={() => setActiveTab("manage")}
          >
            <Shield size={20} className="mr-3" />
            Manage
          </Button>
          
          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={() => setActiveTab("message")}
          >
            <Send size={20} className="mr-3" />
            Message
          </Button>
        </div>

        {/* Leaderboard Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy size={24} />
              Leaderboard
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingGroupLevels ? (
              <p className="text-center text-muted-foreground py-4">Loading...</p>
            ) : groupLevelsLeaderboard.length > 0 ? (
              <div className="space-y-3">
                {groupLevelsLeaderboard.slice(0, 5).map((entry, index) => (
                  <div
                    key={entry.user_id}
                    className="flex items-center gap-3 p-3 rounded-lg bg-secondary/30"
                  >
                    <div className="text-2xl font-bold text-muted-foreground w-8">
                      #{index + 1}
                    </div>
                    <Avatar>
                      <AvatarImage src={entry.avatar_url || undefined} />
                      <AvatarFallback>
                        {(entry.display_name || entry.username || 'U').substring(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="font-medium">
                        {entry.display_name || entry.username || 'Unknown'}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        HCP: {entry.highest_level || 0}
                      </div>
                    </div>
                    <Badge>Level {entry.highest_level || 0}</Badge>
                    {entry.user_id === group.owner_id && (
                      <Crown size={20} className="text-yellow-500" />
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-4">
                No leaderboard data yet
              </p>
            )}
          </CardContent>
        </Card>

        {/* Hidden Tabs for Modals */}
        <Dialog open={activeTab === 'manage' || activeTab === 'invite' || activeTab === 'message'} onOpenChange={() => setActiveTab("")}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            {activeTab === 'manage' && (
              <div className="space-y-4">
                <DialogHeader>
                  <DialogTitle>Manage Members</DialogTitle>
                </DialogHeader>
                
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
              </div>
            )}

            {activeTab === 'invite' && (
              <div className="space-y-4">
                <DialogHeader>
                  <DialogTitle>Invite to Group</DialogTitle>
                </DialogHeader>

                {canAddMembers && (
                  <>
                    {/* Add Friends */}
                    {friends.length > 0 && (
                      <div className="space-y-3">
                        <h3 className="font-semibold">Add Friends</h3>
                        <div className="space-y-2 max-h-[200px] overflow-y-auto">
                          {friends.map((friend) => (
                            <div
                              key={friend.id}
                              className="flex items-center gap-3 p-3 rounded-lg bg-secondary/30 hover:bg-secondary/50 cursor-pointer"
                              onClick={() => handleToggleUser(friend.id)}
                            >
                              <Checkbox
                                checked={selectedUsers.has(friend.id)}
                                onCheckedChange={() => handleToggleUser(friend.id)}
                                onClick={(e) => e.stopPropagation()}
                              />
                              <Avatar>
                                <AvatarImage src={friend.avatar_url || undefined} />
                                <AvatarFallback>
                                  {(friend.display_name || friend.username || 'U').charAt(0).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex-1">
                                <div className="font-medium">
                                  {friend.display_name || friend.username || 'Unknown'}
                                </div>
                                {friend.username && (
                                  <div className="text-sm text-muted-foreground">
                                    @{friend.username}
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                        <Button
                          onClick={handleAddMembers}
                          disabled={loading || selectedUsers.size === 0}
                          className="w-full"
                        >
                          {loading ? "Adding..." : `Add ${selectedUsers.size > 0 ? `${selectedUsers.size} ` : ''}Friend${selectedUsers.size !== 1 ? 's' : ''}`}
                        </Button>
                      </div>
                    )}

                    {/* Search Users */}
                    <div className="space-y-3">
                      <h3 className="font-semibold">Search Users</h3>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" size={18} />
                        <Input
                          placeholder="Search by name or username..."
                          value={searchQuery}
                          onChange={(e) => handleSearchUsers(e.target.value)}
                          className="pl-10"
                        />
                      </div>

                      {searchQuery && (
                        <div className="space-y-2 max-h-[200px] overflow-y-auto">
                          {searchResults.length > 0 ? (
                            <>
                              {searchResults.map((user) => (
                                <div
                                  key={user.id}
                                  className="flex items-center gap-3 p-3 rounded-lg bg-secondary/30 hover:bg-secondary/50 cursor-pointer"
                                  onClick={() => handleToggleUser(user.id)}
                                >
                                  <Checkbox
                                    checked={selectedUsers.has(user.id)}
                                    onCheckedChange={() => handleToggleUser(user.id)}
                                    onClick={(e) => e.stopPropagation()}
                                  />
                                  <Avatar>
                                    <AvatarImage src={user.avatar_url || undefined} />
                                    <AvatarFallback>
                                      {(user.display_name || user.username || 'U').charAt(0).toUpperCase()}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div className="flex-1">
                                    <div className="font-medium">
                                      {user.display_name || user.username || 'Unknown'}
                                    </div>
                                    {user.username && (
                                      <div className="text-sm text-muted-foreground">
                                        @{user.username}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ))}
                              <Button
                                onClick={handleAddMembers}
                                disabled={loading || selectedUsers.size === 0}
                                className="w-full"
                              >
                                {loading ? "Adding..." : `Add ${selectedUsers.size > 0 ? `${selectedUsers.size} ` : ''}User${selectedUsers.size !== 1 ? 's' : ''}`}
                              </Button>
                            </>
                          ) : (
                            <p className="text-sm text-muted-foreground text-center py-4">
                              No users found matching "{searchQuery}"
                            </p>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Invite Link */}
                    <div className="space-y-3">
                      <h3 className="font-semibold">Invite Link</h3>
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
                              <span>{currentInvite.uses_count}</span>
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

                          <Button
                            onClick={handleCreateInvite}
                            disabled={loading}
                            className="w-full"
                          >
                            {loading ? "Creating..." : "Create Invite Link"}
                          </Button>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}

            {activeTab === 'message' && (
              <div className="space-y-4">
                <DialogHeader>
                  <DialogTitle>Group Chat</DialogTitle>
                </DialogHeader>
                
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
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default GroupDetail;