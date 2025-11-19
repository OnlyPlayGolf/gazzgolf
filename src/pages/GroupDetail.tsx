import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, UserPlus, Crown, Shield, Search, Link2, Copy, RefreshCw, Trash2, Trophy, LogOut, Send, Users, Settings, MessageCircle, Calendar } from "lucide-react";
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

type DrillCategory = 'Putting' | 'Short Game' | 'Approach' | 'Tee Shots';

const getDrillCategory = (drillTitle: string): DrillCategory | null => {
  // Explicit mapping of drill titles to categories
  const categoryMap: Record<string, DrillCategory> = {
    'Aggressive Putting': 'Putting',
    'PGA Tour 18 Holes': 'Putting',
    'Short Putting Test': 'Putting',
    "Up & Down Putting Drill": 'Putting',
    "Jason Day's Lag Drill": 'Putting',
    '8-Ball Drill': 'Short Game',
    '18 Up & Downs': 'Short Game',
    'Approach Control': 'Approach',
    "TW's 9 Windows Test": 'Approach',
    'Shot Shape Master': 'Tee Shots',
    'Driver Control Drill': 'Tee Shots',
  };
  
  // Return null for drills not in the map (like Wedges drills)
  return categoryMap[drillTitle] || null;
};

const getScoreUnit = (drillName: string): string => {
  const drillUnits: { [key: string]: string } = {
    "Short Putting Test": "putts in a row",
    "PGA Tour 18 Holes": "putts",
    "Up & Down Putting Drill": "points",
    "Aggressive Putting": "putts",
    "8-Ball Drill": "points",
    "Approach Control": "points",
    "Shot Shape Master": "points",
    "Wedges 40–80 m — Distance Control": "points",
    "Wedge Point Game": "points",
    "Åberg's Wedge Ladder": "shots",
  };
  return drillUnits[drillName] || "points";
};

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
  
  // Dialog states
  const [showMembersDialog, setShowMembersDialog] = useState(false);
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [showManageDialog, setShowManageDialog] = useState(false);
  const [showMessageDialog, setShowMessageDialog] = useState(false);
  
  // Manage group state
  const [editGroupName, setEditGroupName] = useState("");
  const [editGroupDescription, setEditGroupDescription] = useState("");
  const [editGroupImage, setEditGroupImage] = useState<File | null>(null);
  const [updatingGroup, setUpdatingGroup] = useState(false);
  
  // Leaderboard tab state
  const [leaderboardTab, setLeaderboardTab] = useState("levels");
  
  // Messages state
  const [groupConversationId, setGroupConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load invite when opening invite dialog
  useEffect(() => {
    if (showInviteDialog) {
      loadCurrentInvite();
      loadFriendsForAdding();
    }
  }, [showInviteDialog]);

  // Load group conversation when opening message dialog
  useEffect(() => {
    if (showMessageDialog && groupId) {
      loadGroupConversation();
    }
  }, [showMessageDialog, groupId]);

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

    // Open specific dialog if requested via URL
    if (searchParams.get('view') === 'members') {
      setShowMembersDialog(true);
    }
    
    // Open invite dialog if requested via URL
    if (searchParams.get('view') === 'add') {
      setShowInviteDialog(true);
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
      // Deduplicate drills by title (keep first occurrence)
      const uniqueDrills = Array.from(
        new Map(data.map(drill => [drill.title, drill])).values()
      );
      
      setDrills(uniqueDrills);
      setSelectedDrill(uniqueDrills[0].title);
      loadDrillLeaderboard(uniqueDrills[0].title, uniqueDrills[0].lower_is_better);
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
      setShowInviteDialog(false);
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

  // Populate edit fields when manage dialog opens
  useEffect(() => {
    if (showManageDialog && group) {
      setEditGroupName(group.name || "");
      setEditGroupDescription(group.description || "");
      setEditGroupImage(null);
    }
  }, [showManageDialog, group]);

  const handleUpdateGroup = async () => {
    if (!editGroupName.trim() || !groupId) {
      toast({
        title: "Error",
        description: "Group name is required",
        variant: "destructive",
      });
      return;
    }

    setUpdatingGroup(true);
    try {
      // Update group name and description
      const { error: updateError } = await supabase
        .from('groups')
        .update({
          name: editGroupName.trim(),
          description: editGroupDescription.trim() || null
        })
        .eq('id', groupId);

      if (updateError) throw updateError;

      // Handle group image upload if provided
      if (editGroupImage) {
        // TODO: Implement image upload when storage is set up
        console.log('Group image upload not yet implemented');
      }

      toast({
        title: "Success",
        description: "Group updated successfully",
      });

      setShowManageDialog(false);
      loadGroupData(); // Reload group data
    } catch (error: any) {
      console.error('Error updating group:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to update group",
        variant: "destructive",
      });
    } finally {
      setUpdatingGroup(false);
    }
  };

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
      <div className="p-4 space-y-6">
        {/* Header */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(-1)}
          className="gap-2"
        >
          <ArrowLeft size={20} />
          Back to Groups
        </Button>

        {/* Group Info Card */}
        <Card>
          <CardContent className="pt-6 space-y-4">
            {/* Group Header */}
            <div className="flex items-start gap-4">
              <Avatar className="h-20 w-20">
                <AvatarFallback className="text-2xl font-bold">
                  {group.name.substring(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h1 className="text-2xl font-bold text-foreground">{group.name}</h1>
                  {currentUserRole === 'owner' && <Crown size={20} className="text-yellow-500" />}
                </div>
                <p className="text-sm text-muted-foreground">
                  {members.length} {members.length === 1 ? 'member' : 'members'}
                </p>
                {group.created_at && (
                  <div className="flex items-center gap-1.5 mt-1">
                    <Calendar size={14} className="text-muted-foreground" />
                    <p className="text-xs text-muted-foreground">
                      Created {new Date(group.created_at).toLocaleDateString('en-US', { 
                        month: 'short', 
                        day: 'numeric', 
                        year: 'numeric' 
                      })}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Description */}
            {group.description && (
              <p className="text-muted-foreground">{group.description}</p>
            )}

            {/* Action Buttons */}
            <div className="space-y-3">
              <Button
                variant="outline"
                className="w-full justify-start gap-3"
                onClick={() => setShowMembersDialog(true)}
              >
                <Users size={20} />
                Members
              </Button>
              
              <Button
                variant="outline"
                className="w-full justify-start gap-3"
                onClick={() => {
                  loadFriendsForAdding();
                  loadCurrentInvite();
                  setShowInviteDialog(true);
                }}
              >
                <UserPlus size={20} />
                Invite Friends
              </Button>
              
              <Button
                variant="outline"
                className="w-full justify-start gap-3"
                onClick={() => {
                  loadGroupConversation();
                  setShowMessageDialog(true);
                }}
              >
                <MessageCircle size={20} />
                Message
              </Button>
              
              <Button
                variant="outline"
                className="w-full justify-start gap-3"
                onClick={() => setShowManageDialog(true)}
              >
                <Settings size={20} />
                Manage
              </Button>
              
              {currentUserRole !== 'owner' && (
                <Button
                  variant="destructive"
                  className="w-full justify-start gap-3"
                  onClick={handleLeaveGroup}
                  disabled={loading}
                >
                  <LogOut size={20} />
                  Leave Group
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Leaderboard Section */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <Trophy size={20} />
              Leaderboard
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs value={leaderboardTab} onValueChange={setLeaderboardTab}>
              <TabsList className="grid w-full grid-cols-3 mb-4">
                <TabsTrigger value="levels">Levels</TabsTrigger>
                <TabsTrigger value="drills">Drills</TabsTrigger>
                <TabsTrigger value="play">Play</TabsTrigger>
              </TabsList>

              {/* Drills Tab */}
              <TabsContent value="drills" className="space-y-4">
                {drills.length > 0 && (
                  <div className="space-y-3">
                    <select
                      value={selectedDrill || ''}
                      onChange={(e) => {
                        const drill = drills.find(d => d.title === e.target.value);
                        if (drill) {
                          setSelectedDrill(drill.title);
                          loadDrillLeaderboard(drill.title, drill.lower_is_better);
                        }
                      }}
                      className="w-full p-2 rounded-md border bg-background text-foreground"
                    >
                      {(() => {
                        const categories: DrillCategory[] = ['Putting', 'Short Game', 'Approach', 'Tee Shots'];
                        const drillsByCategory = new Map<DrillCategory, Drill[]>();
                        
                        // Group drills by category (exclude drills not in any category)
                        drills.forEach(drill => {
                          const category = getDrillCategory(drill.title);
                          if (category) {
                            if (!drillsByCategory.has(category)) {
                              drillsByCategory.set(category, []);
                            }
                            drillsByCategory.get(category)!.push(drill);
                          }
                        });
                        
                        // Render grouped options
                        return categories.map(category => {
                          const categoryDrills = drillsByCategory.get(category);
                          if (!categoryDrills || categoryDrills.length === 0) return null;
                          
                          return (
                            <optgroup key={category} label={category}>
                              {categoryDrills.map(drill => (
                                <option key={drill.id} value={drill.title}>
                                  {drill.title}
                                </option>
                              ))}
                            </optgroup>
                          );
                        });
                      })()}
                    </select>

                    {loadingLeaderboard ? (
                      <p className="text-center text-muted-foreground py-8">Loading...</p>
                    ) : drillLeaderboard.length > 0 ? (
                      <div className="space-y-2">
                        {drillLeaderboard.map((entry, index) => (
                          <div
                            key={entry.user_id}
                            className="flex items-center gap-2 p-3 rounded-lg bg-secondary/30"
                          >
                            <div className="font-bold text-sm text-muted-foreground w-8">
                              #{index + 1}
                            </div>
                            <Avatar>
                              <AvatarImage src={entry.avatar_url || undefined} />
                              <AvatarFallback>
                                {(entry.display_name || entry.username || 'U').charAt(0).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1">
                              <div className="font-medium">
                                {entry.display_name || entry.username || 'Unknown'}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {entry.best_score} {getScoreUnit(selectedDrill || '')}
                              </div>
                            </div>
                            {index === 0 && <Crown size={20} className="text-yellow-500" />}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-center text-muted-foreground py-8">
                        No scores yet for this drill
                      </p>
                    )}
                  </div>
                )}
              </TabsContent>

              {/* Levels Tab */}
              <TabsContent value="levels" className="space-y-4">
                {loadingGroupLevels ? (
                  <p className="text-center text-muted-foreground py-8">Loading...</p>
                ) : groupLevelsLeaderboard.length > 0 ? (
                  <div className="space-y-2">
                     {groupLevelsLeaderboard.map((entry, index) => (
                      <div
                        key={entry.user_id}
                        className="flex items-center gap-2 p-3 rounded-lg bg-secondary/30"
                      >
                        <div className="font-bold text-sm text-muted-foreground w-8">
                          #{index + 1}
                        </div>
                        <Avatar>
                          <AvatarImage src={entry.avatar_url || undefined} />
                          <AvatarFallback>
                            {(entry.display_name || entry.username || 'U').charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <div className="font-medium">
                            {entry.display_name || entry.username || 'Unknown'}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {entry.completed_levels} levels completed • Highest: Level {entry.highest_level || 0}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground py-8">
                    No level progress yet
                  </p>
                )}
              </TabsContent>

              {/* Play Tab */}
              <TabsContent value="play">
                <p className="text-center text-muted-foreground py-8">
                  Play leaderboard coming soon
                </p>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      {/* Members Dialog */}
      <Dialog open={showMembersDialog} onOpenChange={setShowMembersDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Members</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 max-h-[60vh] overflow-y-auto">
            {members.map((member) => (
              <div
                key={member.user_id}
                className="flex items-center gap-3 p-3 rounded-lg bg-secondary/30"
              >
                <Avatar>
                  <AvatarImage src={member.avatar_url || undefined} />
                  <AvatarFallback>
                    {(member.display_name || member.username || 'U').charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <div className="font-medium">
                    {member.display_name || member.username || 'Unknown'}
                  </div>
                  {member.username && (
                    <div className="text-sm text-muted-foreground">
                      @{member.username}
                    </div>
                  )}
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
        </DialogContent>
      </Dialog>

      {/* Invite Dialog */}
      <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Invite Friends</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Add Friends Directly */}
            {canAddMembers && friends.length > 0 && (
              <div className="space-y-3">
                <h3 className="font-medium">Your Friends</h3>
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
            {canAddMembers && (
              <div className="space-y-3">
                <h3 className="font-medium">Search Users</h3>
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
            )}

            {/* Invite Link */}
            {canAddMembers && (
              <div className="space-y-3">
                <h3 className="font-medium">Invite Link</h3>
                {currentInvite ? (
                  <div className="space-y-3">
                    <div className="flex gap-2">
                      <Input
                        value={`${window.location.origin}/invite/${currentInvite.code}`}
                        readOnly
                        className="flex-1 text-sm"
                      />
                      <Button size="sm" onClick={handleCopyInviteLink}>
                        <Copy size={16} />
                      </Button>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        onClick={handleRegenerateInvite}
                        disabled={loading}
                        className="flex-1"
                        size="sm"
                      >
                        <RefreshCw size={16} className="mr-2" />
                        Regenerate
                      </Button>
                      <Button
                        variant="destructive"
                        onClick={handleRevokeInvite}
                        disabled={loading}
                        className="flex-1"
                        size="sm"
                      >
                        <Trash2 size={16} className="mr-2" />
                        Revoke
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    onClick={handleCreateInvite}
                    disabled={loading}
                    className="w-full"
                  >
                    {loading ? "Creating..." : "Create Invite Link"}
                  </Button>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Manage Dialog */}
      <Dialog open={showManageDialog} onOpenChange={setShowManageDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold text-center">Manage Group</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Group Name */}
            <div>
              <Label htmlFor="edit-group-name" className="text-foreground">
                Group Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="edit-group-name"
                value={editGroupName}
                onChange={(e) => setEditGroupName(e.target.value)}
                placeholder="Enter group name"
                className="mt-1.5"
              />
            </div>

            {/* Description */}
            <div>
              <Label htmlFor="edit-group-description" className="text-foreground">
                Description
              </Label>
              <Textarea
                id="edit-group-description"
                value={editGroupDescription}
                onChange={(e) => setEditGroupDescription(e.target.value)}
                placeholder="Optional group description"
                className="mt-1.5 min-h-[100px] resize-none"
              />
            </div>

            {/* Group Image Upload */}
            <div>
              <Label className="text-foreground">Group Image</Label>
              <div 
                className="mt-1.5 border-2 border-dashed border-muted-foreground/30 rounded-lg p-8 flex flex-col items-center justify-center cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => document.getElementById('edit-group-image-input')?.click()}
              >
                <input
                  id="edit-group-image-input"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) setEditGroupImage(file);
                  }}
                />
                {editGroupImage ? (
                  <div className="text-center">
                    <p className="text-sm text-foreground font-medium">{editGroupImage.name}</p>
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

            {/* Action Buttons */}
            <div className="flex flex-col gap-2 pt-2">
              <Button
                onClick={handleUpdateGroup}
                disabled={updatingGroup || !editGroupName.trim()}
                className="w-full bg-foreground text-background hover:bg-foreground/90"
              >
                {updatingGroup ? "Updating..." : "Update Group"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setShowManageDialog(false);
                  setEditGroupName("");
                  setEditGroupDescription("");
                  setEditGroupImage(null);
                }}
                className="w-full"
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Message Dialog */}
      <Dialog open={showMessageDialog} onOpenChange={setShowMessageDialog}>
        <DialogContent className="max-w-md">
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
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default GroupDetail;