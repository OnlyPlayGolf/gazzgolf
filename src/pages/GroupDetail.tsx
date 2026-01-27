import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { ArrowLeft, UserPlus, Search, Link2, Copy, RefreshCw, Trash2, Trophy, Crown, LogOut, Send, Users, Settings, MessageCircle, Calendar, History } from "lucide-react";
import { GroupDrillHistory } from "@/components/GroupDrillHistory";
import { ProfilePhoto } from "@/components/ProfilePhoto";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { FadeSlide } from "@/components/motion/FadeSlide";
import { formatDistanceToNow } from "date-fns";
import { getGroupRoleLabel } from "@/utils/groupRoleLabel";
import { getPublicAppUrl } from "@/utils/publicAppUrl";

const getDrillDisplayTitle = (title: string): string => {
  // Use normalized title for display
  return normalizeDrillTitle(title);
};

// Map level category/difficulty to display name
const getLevelCategoryDisplayName = (category: string): string => {
  const lower = category.toLowerCase();
  if (lower === "beginner") return "First Timer";
  if (lower === "intermediate") return "Beginner";
  if (lower === "professional") return "Pro";
  // Capitalize first letter for other categories (Amateur, Tour)
  return category.charAt(0).toUpperCase() + category.slice(1).toLowerCase();
};

// Define drill order for each category (matching PuttingDrills.tsx order)
const drillOrderByCategory: Record<DrillCategory, string[]> = {
  'Putting': ['Short Putt Test', 'PGA Tour 18-hole Test', 'Aggressive Putting 4-6m', "Up & Down Putts 6-10m", "Lag Putting Drill 8-20m"],
  'Short Game': ['8-Ball Circuit', '18 Up & Downs', 'Easy Chip Drill'],
  'Approach': ['Wedge Game 40-80m', 'Wedge Ladder 60-120m', 'Approach Control 130-180m', "9 Windows Shot Shape Test"],
  'Tee Shots': ['Shot Shape Master', 'Driver Control Drill'],
};

// Get unit label for drill (matching Leaderboards page)
const getDrillUnit = (drillTitle: string): string => {
  // Putts
    if (drillTitle === 'Aggressive Putting 4-6m' || drillTitle === 'PGA Tour 18-hole Test') {
    return 'putts';
  }
  // Shots
  if (drillTitle === '18 Up & Downs' || drillTitle === "Wedge Ladder 60-120m" || drillTitle === "9 Windows Shot Shape Test") {
    return 'shots';
  }
  // In a row
  if (drillTitle === 'Easy Chip Drill' || drillTitle === 'Short Putt Test') {
    return 'in a row';
  }
  // Default
  return 'points';
};

interface Member {
  user_id: string;
  role: 'owner' | 'admin' | 'member';
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
}

// Helper to determine if user is a coach (owner or admin)
const isCoachRole = (role: 'owner' | 'admin' | 'member' | null): boolean => {
  return role === 'owner' || role === 'admin';
};

// Get display role label (varies by group type)
const getDisplayRole = (
  role: 'owner' | 'admin' | 'member',
  groupType?: 'player' | 'coach' | null
): string => {
  return getGroupRoleLabel({ role, groupType });
};

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

// Normalize drill titles (map old/variant titles to canonical ones)
const normalizeDrillTitle = (title: string): string => {
  const titleMap: Record<string, string> = {
    '18-hole PGA Tour Putting Test': 'PGA Tour 18-hole Test',
    "PGA Tour 18 Holes": 'PGA Tour 18-hole Test',
    "PGA Tour 18-hole Test": 'PGA Tour 18-hole Test',
    "TW's 9 Windows Test": "9 Windows Shot Shape Test",
    "9 Windows Shot Shape Test": "9 Windows Shot Shape Test",
    "Aggressive Putting": "Aggressive Putting 4-6m",
    "Aggressive Putting 4-6m": "Aggressive Putting 4-6m",
    "Short Putt Test": "Short Putt Test",
    "Up & Down Putts 6-10m": "Up & Down Putts 6-10m",
    "Lag Putting Drill 8-20m": "Lag Putting Drill 8-20m",
    "8-Ball Circuit": "8-Ball Circuit",
    "18 Up & Downs": "18 Up & Downs",
    "Easy Chip Drill": "Easy Chip Drill",
    "Approach Control 130-180m": "Approach Control 130-180m",
    "Wedge Ladder 60-120m": "Wedge Ladder 60-120m",
    "Wedge Game 40-80m": "Wedge Game 40-80m",
    "Shot Shape Master": "Shot Shape Master",
    "Driver Control Drill": "Driver Control Drill",
  };
  return titleMap[title] || title;
};

const getDrillCategory = (drillTitle: string): DrillCategory | null => {
  // Normalize the title first
  const normalizedTitle = normalizeDrillTitle(drillTitle);
  
  // Explicit mapping of drill titles to categories
  const categoryMap: Record<string, DrillCategory> = {
    'Aggressive Putting 4-6m': 'Putting',
    'PGA Tour 18-hole Test': 'Putting',
    '18-hole PGA Tour Putting Test': 'Putting', // Legacy title
    'Short Putt Test': 'Putting',
    "Up & Down Putts 6-10m": 'Putting',
    "Lag Putting Drill 8-20m": 'Putting',
    '8-Ball Circuit': 'Short Game',
    '18 Up & Downs': 'Short Game',
    'Easy Chip Drill': 'Short Game',
    'Approach Control 130-180m': 'Approach',
    "9 Windows Shot Shape Test": 'Approach',
    "Wedge Ladder 60-120m": 'Approach',
    'Wedge Game 40-80m': 'Approach',
    'Shot Shape Master': 'Tee Shots',
    'Driver Control Drill': 'Tee Shots',
  };
  
  return categoryMap[normalizedTitle] || categoryMap[drillTitle] || null;
};

const getScoreUnit = (drillName: string): string => {
  const drillUnits: { [key: string]: string } = {
    "Short Putt Test": "putts in a row",
    "PGA Tour 18-hole Test": "putts",
    "Up & Down Putts 6-10m": "points",
    "Aggressive Putting 4-6m": "putts",
    "8-Ball Circuit": "points",
    "Approach Control 130-180m": "points",
    "Shot Shape Master": "points",
    "Wedges 40–80 m — Distance Control": "points",
    "Wedge Game 40-80m": "points",
    "Wedge Ladder 60-120m": "shots",
    "Easy Chip Drill": "in a row",
    "18 Up & Downs": "shots",
    "9 Windows Shot Shape Test": "shots",
    "Lag Putting Drill 8-20m": "points",
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
  const [memberToRemove, setMemberToRemove] = useState<Member | null>(null);
  const [memberToPromote, setMemberToPromote] = useState<Member | null>(null);
  const [memberToDemote, setMemberToDemote] = useState<Member | null>(null);
  const [openRolePopover, setOpenRolePopover] = useState<string | null>(null);
  const [showDeleteGroupDialog, setShowDeleteGroupDialog] = useState(false);
  const [deletingGroup, setDeletingGroup] = useState(false);
  
  // Manage group state
  const [editGroupName, setEditGroupName] = useState("");
  const [editGroupDescription, setEditGroupDescription] = useState("");
  const [editGroupImage, setEditGroupImage] = useState<File | null>(null);
  const [editShowCoachProfileResults, setEditShowCoachProfileResults] = useState(false);
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
      // Deduplicate by normalized title to remove duplicates like "PGA Tour 18 Holes" vs "PGA Tour 18-hole Test"
      const drillsByNormalizedTitle = new Map<string, Drill>();
      
      // First pass: collect all drills by normalized title
      data.forEach(drill => {
        const normalizedTitle = normalizeDrillTitle(drill.title);
        if (!drillsByNormalizedTitle.has(normalizedTitle)) {
          drillsByNormalizedTitle.set(normalizedTitle, drill);
        }
      });
      
      // Second pass: prefer canonical titles (titles that match their normalized form)
      data.forEach(drill => {
        const normalizedTitle = normalizeDrillTitle(drill.title);
        const existing = drillsByNormalizedTitle.get(normalizedTitle);
        // If the current drill's title matches the normalized title exactly, prefer it
        if (existing && drill.title === normalizedTitle && existing.title !== normalizedTitle) {
          drillsByNormalizedTitle.set(normalizedTitle, drill);
        }
      });
      
      const uniqueDrills = Array.from(drillsByNormalizedTitle.values());
      setDrills(uniqueDrills);
      setSelectedDrill(uniqueDrills[0].title);
      loadDrillLeaderboard(uniqueDrills[0].title, uniqueDrills[0].lower_is_better);
    }
  };

  const loadDrillLeaderboard = async (
    drillTitle: string,
    lowerIsBetter: boolean,
    showCoachResultsOverride?: boolean
  ) => {
    if (!groupId || !group) return;

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
        .select('user_id, role')
        .eq('group_id', groupId);

      if (!groupMembers || groupMembers.length === 0) {
        setDrillLeaderboard([]);
        setLoadingLeaderboard(false);
        return;
      }

      const showCoachResults =
        showCoachResultsOverride ?? (effectiveGroupType === 'coach' && !!group?.show_coach_profile_results);

      // For coach groups, exclude coaches from leaderboards.
      // For player groups, include all members (including owner).
      const leaderboardMembers = (effectiveGroupType === 'player' || showCoachResults)
        ? groupMembers
        : groupMembers.filter(m => m.role === 'member');
      const memberIds = leaderboardMembers.map(m => m.user_id);

      // Get best scores for all group members, only including drills completed after group creation
      const groupCreatedAt = group.created_at;
      const { data: memberScores } = await supabase
        .from('drill_results')
        .select('user_id, total_points')
        .eq('drill_id', drillData)
        .in('user_id', memberIds)
        .gte('created_at', groupCreatedAt);

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

  const loadGroupLevelsLeaderboard = async (showCoachResultsOverride?: boolean) => {
    if (!groupId || !user || !group) return;
    setLoadingGroupLevels(true);
    try {
      const { data, error } = await supabase
        .rpc('group_level_leaderboard', { p_group_id: groupId });
      if (error) {
        console.error('Error loading group levels leaderboard:', error);
        setGroupLevelsLeaderboard([]);
      } else {
        const showCoachResults =
          showCoachResultsOverride ?? (effectiveGroupType === 'coach' && !!group?.show_coach_profile_results);
        if (effectiveGroupType === 'player' || showCoachResults) {
          // Player groups: include everyone
          // Coach groups: include coaches when enabled
          setGroupLevelsLeaderboard(data || []);
        } else {
          // Coach groups: filter out coaches (owner/admin) when toggle is OFF
          const coachIds = new Set(
            (members || [])
              .filter(m => m.role === 'owner' || m.role === 'admin')
              .map(m => m.user_id)
          );
          
          const filteredData = (data || []).filter(
            (entry: GroupLevelLeaderboardEntry) => !coachIds.has(entry.user_id)
          );
          
          setGroupLevelsLeaderboard(filteredData);
        }
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

    // Global user search (includes non-friends) via RPC (safe across profiles RLS)
    const { data, error } = await supabase
      .rpc('search_profiles', { q: query.trim(), max_results: 20 });

    if (error) {
      console.error('Error searching users:', error);
      setSearchResults([]);
      return;
    }

    // Filter out users already in the group
    const memberIds = new Set(members.map(m => m.user_id));
    const available = (data || []).filter((p: any) =>
      p?.id && !memberIds.has(p.id) && p.id !== user?.id
    );

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
    
    const inviteUrl = `${getPublicAppUrl()}/invite/${currentInvite.code}`;
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
        title: "Invite link revoked",
        description: "This invite link can no longer be used",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to revoke link",
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

  // group_type might not exist yet if DB migrations haven't been applied.
  // Fall back to the same heuristic as our backfill: any admin => coach, otherwise player.
  const effectiveGroupType: 'player' | 'coach' = (group?.group_type === 'player' || group?.group_type === 'coach')
    ? group.group_type
    : (group?.is_coach_group ? 'coach' : (members.some(m => m.role === 'admin') ? 'coach' : 'player'));
  const isPlayerGroup = effectiveGroupType === 'player';
  const isCoachGroup = effectiveGroupType === 'coach';
  const isGroupMember = currentUserRole !== null;

  // (Re)load level leaderboard once group + members are ready, and when coach visibility changes
  useEffect(() => {
    if (!groupId || !user || !group) return;
    if (members.length === 0) return;
    loadGroupLevelsLeaderboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId, user, group?.id, group?.group_type, group?.is_coach_group, group?.show_coach_profile_results, members]);

  // Player groups: any member can manage/add/invite. Only owner can remove others.
  // Coach groups: preserve existing coach-role gating.
  const canAddMembers = isPlayerGroup ? isGroupMember : isCoachRole(currentUserRole);
  const canManageGroup = isPlayerGroup ? isGroupMember : isCoachRole(currentUserRole);
  const canRemoveMembers = isPlayerGroup ? currentUserRole === 'owner' : isCoachRole(currentUserRole);
  const canChangeRoles = isPlayerGroup ? false : currentUserRole === 'owner';

  const handleRemoveMember = async (member: Member) => {
    if (!groupId || !canRemoveMembers) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('group_members')
        .delete()
        .eq('group_id', groupId)
        .eq('user_id', member.user_id);

      if (error) throw error;

      toast({
        title: "Member removed",
        description: `${member.display_name || member.username || 'Member'} has been removed from the group`,
      });

      setMemberToRemove(null);
      await loadMembers();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to remove member",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePromoteMember = async (member: Member) => {
    if (!groupId || !canChangeRoles) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('group_members')
        .update({ role: 'admin' })
        .eq('group_id', groupId)
        .eq('user_id', member.user_id);

      if (error) throw error;

      toast({
        title: "Member promoted",
        description: `${member.display_name || member.username || 'Member'} is now a Coach`,
      });

      setMemberToPromote(null);
      await loadMembers();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to promote member",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDemoteMember = async (member: Member) => {
    if (!groupId || currentUserRole !== 'owner') return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('group_members')
        .update({ role: 'member' })
        .eq('group_id', groupId)
        .eq('user_id', member.user_id);

      if (error) throw error;

      toast({
        title: "Member demoted",
        description: `${member.display_name || member.username || 'Member'} is now a Player`,
      });

      setMemberToDemote(null);
      await loadMembers();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to demote member",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteGroup = async () => {
    if (!groupId || !canManageGroup) return;

    setDeletingGroup(true);
    try {
      // Delete group members first (cascade should handle this, but be explicit)
      await supabase
        .from('group_members')
        .delete()
        .eq('group_id', groupId);

      // Delete group invites
      await supabase
        .from('group_invites')
        .delete()
        .eq('group_id', groupId);

      // Delete the group
      const { error } = await supabase
        .from('groups')
        .delete()
        .eq('id', groupId);

      if (error) throw error;

      toast({
        title: "Group deleted",
        description: "The group has been permanently deleted",
      });

      navigate('/profile');
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete group",
        variant: "destructive",
      });
    } finally {
      setDeletingGroup(false);
      setShowDeleteGroupDialog(false);
    }
  };

  // Populate edit fields when manage dialog opens
  useEffect(() => {
    if (showManageDialog && group) {
      setEditGroupName(group.name || "");
      setEditGroupDescription(group.description || "");
      setEditGroupImage(null);
      setEditShowCoachProfileResults(!!group.show_coach_profile_results);
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
      const updatePayload: any = {
        name: editGroupName.trim(),
        description: editGroupDescription.trim() || null,
      };
      // Coach groups only: persist flag controlling coach results visibility
      if (isCoachGroup) {
        updatePayload.show_coach_profile_results = editShowCoachProfileResults;
      }

      let updateError: any = null;
      let updatedGroup: any = null;
      ({ data: updatedGroup, error: updateError } = await (supabase as any)
        .from('groups')
        .update(updatePayload)
        .eq('id', groupId)
        .select('*')
        .maybeSingle());

      // Backward compatibility if column not yet deployed
      if (updateError && isCoachGroup && updateError.message?.includes('show_coach_profile_results')) {
        ({ error: updateError } = await (supabase as any)
          .from('groups')
          .update({
            name: editGroupName.trim(),
            description: editGroupDescription.trim() || null,
          })
          .eq('id', groupId));
      }

      if (updateError) throw updateError;

      // Handle group image upload if provided
      if (editGroupImage && user) {
        const fileExt = editGroupImage.name.split('.').pop();
        const fileName = `${user.id}/${Date.now()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('group-images')
          .upload(fileName, editGroupImage);
        
        if (uploadError) {
          console.error('Error uploading group image:', uploadError);
          // Continue without failing - image upload is optional
        } else {
          const { data: { publicUrl } } = supabase.storage
            .from('group-images')
            .getPublicUrl(fileName);
          
          // Update the group with the new image URL
          await supabase
            .from('groups')
            .update({ image_url: publicUrl })
            .eq('id', groupId);
        }
      }

      toast({
        title: "Success",
        description: "Group updated successfully",
      });

      setShowManageDialog(false);
      // Update local group state immediately if we got it back
      if (updatedGroup) {
        setGroup(updatedGroup);
      }
      await loadGroupData(); // Reload group data (includes show_coach_profile_results)

      // Refresh leaderboards immediately so coach visibility toggles apply without needing a full page reload
      const showCoachResultsAfterSave = isCoachGroup && editShowCoachProfileResults;
      await loadGroupLevelsLeaderboard(showCoachResultsAfterSave);
      const drillTitle = selectedDrill || drills[0]?.title || null;
      if (drillTitle) {
        const drill = drills.find(d => d.title === drillTitle);
        if (drill) {
          await loadDrillLeaderboard(drill.title, drill.lower_is_better, showCoachResultsAfterSave);
        }
      }
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
        <Card className="relative">
          {currentUserRole !== 'owner' && (
            <Button
              variant="ghost"
              size="icon"
              onClick={handleLeaveGroup}
              disabled={loading}
              className="absolute top-5 right-4 text-red-500 hover:bg-red-500/10 hover:text-red-600 z-10"
              title="Leave Group"
            >
              <LogOut size={20} />
            </Button>
          )}
          <CardContent className="pt-6 space-y-4">
            {/* Group Header */}
            <div className="flex items-start gap-4">
              <Avatar className="h-20 w-20">
                {group.image_url && <AvatarImage src={group.image_url} alt={group.name} />}
                <AvatarFallback className="text-2xl font-bold">
                  {group.name.substring(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h1 className="text-2xl font-bold text-foreground">{group.name}</h1>
                </div>
                <p className="text-sm text-muted-foreground">
                  {members.length} {members.length === 1 ? 'member' : 'members'}
                </p>
                {group.created_at && (
                  <div className="flex items-center gap-1.5 mt-1">
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
              
              {canAddMembers && (
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
                  Invite Players
                </Button>
              )}
              
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
              
              {canManageGroup && (
                <Button
                  variant="outline"
                  className="w-full justify-start gap-3"
                  onClick={() => setShowManageDialog(true)}
                >
                  <Settings size={20} />
                  Manage
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
              <TabsList className="grid w-full grid-cols-4 mb-4">
                <TabsTrigger value="levels">Levels</TabsTrigger>
                <TabsTrigger value="drills">Drills PB</TabsTrigger>
                <TabsTrigger value="history">History</TabsTrigger>
                <TabsTrigger value="play">Play</TabsTrigger>
              </TabsList>

              {/* Drills Tab */}
              <TabsContent value="drills" className="space-y-4">
                <FadeSlide>
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
                            // Only add if not already added (avoid duplicates)
                            if (!drillsByCategory.get(category)!.some(d => d.id === drill.id)) {
                              drillsByCategory.get(category)!.push(drill);
                            }
                          }
                        });
                        
                        // Render grouped options
                        return categories.map(category => {
                          const categoryDrills = drillsByCategory.get(category);
                          if (!categoryDrills || categoryDrills.length === 0) return null;
                          
                          // Sort drills to match the order in drillOrderByCategory
                          const order = drillOrderByCategory[category] || [];
                          const sortedDrills = [...categoryDrills].sort((a, b) => {
                            const normalizedA = normalizeDrillTitle(a.title);
                            const normalizedB = normalizeDrillTitle(b.title);
                            const indexA = order.indexOf(normalizedA) !== -1 ? order.indexOf(normalizedA) : order.indexOf(a.title);
                            const indexB = order.indexOf(normalizedB) !== -1 ? order.indexOf(normalizedB) : order.indexOf(b.title);
                            // If drill not in order array, put it at the end
                            if (indexA === -1 && indexB === -1) return 0;
                            if (indexA === -1) return 1;
                            if (indexB === -1) return -1;
                            return indexA - indexB;
                          });
                          
                          return (
                            <optgroup key={category} label={category}>
                              {sortedDrills.map(drill => {
                                const displayTitle = normalizeDrillTitle(drill.title);
                                return (
                                  <option key={drill.id} value={drill.title}>
                                    {getDrillDisplayTitle(displayTitle)}
                                  </option>
                                );
                              })}
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
                            className="flex items-center justify-between p-3 rounded-md bg-secondary/50"
                          >
                            <div className="flex items-center gap-3">
                              <Badge variant="outline" className="w-8 text-center">
                                {index + 1}
                              </Badge>
                              <ProfilePhoto
                                src={entry.avatar_url}
                                alt={entry.display_name || entry.username || "User"}
                                fallback={entry.display_name || entry.username || "?"}
                                size="sm"
                              />
                              <div>
                                <p className="font-medium text-foreground text-sm">
                                  {entry.display_name || entry.username || 'Unknown'}
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="font-semibold text-foreground">
                                {entry.best_score}
                              </p>
                              <p className="text-xs text-muted-foreground">{getDrillUnit(selectedDrill || '')}</p>
                            </div>
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
                </FadeSlide>
              </TabsContent>

              {/* Levels Tab */}
              <TabsContent value="levels" className="space-y-4">
                <FadeSlide>
                  {loadingGroupLevels ? (
                    <p className="text-center text-muted-foreground py-8">Loading...</p>
                  ) : groupLevelsLeaderboard.length > 0 ? (
                    <div className="space-y-2">
                      {groupLevelsLeaderboard.map((entry, index) => (
                        <div
                          key={entry.user_id}
                          className="flex items-center justify-between p-3 rounded-md bg-secondary/50"
                        >
                          <div className="flex items-center gap-3">
                            <Badge variant="outline" className="w-8 text-center">
                              {index + 1}
                            </Badge>
                            <ProfilePhoto
                              src={entry.avatar_url}
                              alt={entry.display_name || entry.username || "User"}
                              fallback={entry.display_name || entry.username || "?"}
                              size="sm"
                            />
                            <div>
                              <p className="font-medium text-foreground text-sm">
                                {entry.display_name || entry.username || 'Unknown'}
                              </p>
                              {entry.highest_level && (
                                <p className="text-xs text-muted-foreground">
                                  Level {entry.highest_level} • {getLevelCategoryDisplayName(entry.category)}
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
                      ))}
                    </div>
                  ) : (
                    <p className="text-center text-muted-foreground py-8">
                      No level progress yet
                    </p>
                  )}
                </FadeSlide>
              </TabsContent>

              {/* History Tab */}
              <TabsContent value="history">
                {groupId && (
                  <GroupDrillHistory
                    groupId={groupId}
                    groupCreatedAt={group?.created_at}
                    includeCoaches={effectiveGroupType === 'coach' && !!group?.show_coach_profile_results}
                  />
                )}
              </TabsContent>

              {/* Play Tab */}
              <TabsContent value="play">
                <FadeSlide>
                  <p className="text-center text-muted-foreground py-8">
                    Play leaderboard coming soon
                  </p>
                </FadeSlide>
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
                <Avatar 
                  className="cursor-pointer hover:opacity-80 transition-opacity"
                  onClick={() => navigate(`/user/${member.user_id}`)}
                >
                  <AvatarImage src={member.avatar_url || undefined} />
                  <AvatarFallback>
                    {(member.display_name || member.username || 'U').charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <div 
                    className="font-medium cursor-pointer hover:underline"
                    onClick={() => navigate(`/user/${member.user_id}`)}
                  >
                    {member.display_name || member.username || 'Unknown'}
                  </div>
                  {member.username && (
                    <div className="text-sm text-muted-foreground">
                      @{member.username}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {/* Role badge - clickable dropdown for coach groups when owner can change roles */}
                  {isCoachGroup && canChangeRoles && member.role !== 'owner' ? (
                    <Popover 
                      open={openRolePopover === member.user_id} 
                      onOpenChange={(open) => setOpenRolePopover(open ? member.user_id : null)}
                    >
                      <PopoverTrigger asChild>
                        <button type="button" className="focus:outline-none">
                          <Badge 
                            variant={isCoachRole(member.role) ? 'default' : 'secondary'}
                            className="cursor-pointer hover:opacity-80"
                          >
                            {getDisplayRole(member.role, effectiveGroupType)}
                          </Badge>
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-32 p-1 z-[101]" align="end">
                        <div className="flex flex-col gap-1">
                          <Button
                            variant={isCoachRole(member.role) ? 'secondary' : 'ghost'}
                            size="sm"
                            className="justify-start"
                            onClick={() => {
                              if (!isCoachRole(member.role)) {
                                handlePromoteMember(member);
                              }
                              setOpenRolePopover(null);
                            }}
                          >
                            Coach
                          </Button>
                          <Button
                            variant={!isCoachRole(member.role) ? 'secondary' : 'ghost'}
                            size="sm"
                            className="justify-start"
                            onClick={() => {
                              if (isCoachRole(member.role)) {
                                handleDemoteMember(member);
                              }
                              setOpenRolePopover(null);
                            }}
                          >
                            Player
                          </Button>
                        </div>
                      </PopoverContent>
                    </Popover>
                  ) : (
                    <Badge variant={isCoachRole(member.role) ? 'default' : 'secondary'}>
                      {getDisplayRole(member.role, effectiveGroupType)}
                    </Badge>
                  )}
                  {/* Remove member button - only show to coaches, not for owner */}
                  {canRemoveMembers && member.role !== 'owner' && member.user_id !== user?.id && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        setMemberToRemove(member);
                      }}
                      title="Remove member"
                    >
                      <Trash2 size={16} />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirm Remove Member Dialog */}
      <Dialog open={!!memberToRemove} onOpenChange={(open) => !open && setMemberToRemove(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Remove Member</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground">
            Are you sure you want to remove <span className="font-medium text-foreground">{memberToRemove?.display_name || memberToRemove?.username || 'this member'}</span> from the group?
          </p>
          <div className="flex gap-2 pt-4">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setMemberToRemove(null)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              className="flex-1"
              onClick={() => memberToRemove && handleRemoveMember(memberToRemove)}
              disabled={loading}
            >
              {loading ? "Removing..." : "Remove"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirm Promote Member Dialog */}
      <Dialog open={!!memberToPromote} onOpenChange={(open) => !open && setMemberToPromote(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Promote to Coach</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground">
            Are you sure you want to promote <span className="font-medium text-foreground">{memberToPromote?.display_name || memberToPromote?.username || 'this member'}</span> to Coach? They will be able to manage the group, add members, and remove members.
          </p>
          <div className="flex gap-2 pt-4">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setMemberToPromote(null)}
            >
              Cancel
            </Button>
            <Button
              className="flex-1"
              onClick={() => memberToPromote && handlePromoteMember(memberToPromote)}
              disabled={loading}
            >
              {loading ? "Promoting..." : "Promote"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirm Demote Member Dialog */}
      <Dialog open={!!memberToDemote} onOpenChange={(open) => !open && setMemberToDemote(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Demote to Player</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground">
            Are you sure you want to demote <span className="font-medium text-foreground">{memberToDemote?.display_name || memberToDemote?.username || 'this member'}</span> to Player? They will no longer be able to manage the group.
          </p>
          <div className="flex gap-2 pt-4">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setMemberToDemote(null)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              className="flex-1"
              onClick={() => memberToDemote && handleDemoteMember(memberToDemote)}
              disabled={loading}
            >
              {loading ? "Demoting..." : "Demote"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Invite Dialog */}
      <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Invite Players</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
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

            {/* Invite Link */}
            {canAddMembers && (
              <div className="space-y-3">
                <h3 className="font-medium">Invite Link</h3>
                {currentInvite ? (
                  <div className="space-y-3">
                    <div className="flex gap-2">
                      <Input
                        value={`${getPublicAppUrl()}/invite/${currentInvite.code}`}
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
                        Revoke Link
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
                onChange={(e) => {
                  setEditGroupDescription(e.target.value);
                  // Auto-resize textarea
                  const textarea = e.target;
                  textarea.style.height = 'auto';
                  textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
                }}
                placeholder="Optional group description"
                className="mt-1.5 min-h-[2.5rem] resize-none overflow-hidden"
                rows={1}
              />
            </div>

            {/* Coach group setting */}
            {isCoachGroup && (
              <div className="border border-border rounded-lg p-3 bg-secondary/10">
                <div className="flex items-center justify-between gap-4">
                  <Label className="text-foreground">
                    Show coach’s profile & results
                  </Label>
                  <Switch
                    checked={editShowCoachProfileResults}
                    onCheckedChange={setEditShowCoachProfileResults}
                  />
                </div>
              </div>
            )}

            {/* Group Image Upload */}
            <div>
              <Label className="text-foreground">Group Image</Label>
              <div 
                className="mt-1.5 border-2 border-dashed border-muted-foreground/30 rounded-lg p-4 flex flex-col items-center justify-center cursor-pointer hover:border-primary/50 transition-colors"
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
                    <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center mb-2">
                      <svg
                        className="w-5 h-5 text-muted-foreground"
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

            {/* Delete Group - owner only, at bottom of Manage */}
            {currentUserRole === 'owner' && (
              <div className="flex flex-col gap-2 pt-4 mt-4 border-t border-border">
                <Button
                  type="button"
                  variant="destructive"
                  className="w-full justify-start gap-3"
                  onClick={() => {
                    setShowManageDialog(false);
                    setShowDeleteGroupDialog(true);
                  }}
                >
                  <Trash2 size={20} />
                  Delete Group
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Group Confirmation Dialog */}
      <Dialog open={showDeleteGroupDialog} onOpenChange={setShowDeleteGroupDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold text-destructive">Delete Group</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-muted-foreground">
              This action cannot be undone. This will permanently delete the group <span className="font-semibold text-foreground">"{group?.name}"</span> and remove all members.
            </p>
            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setShowDeleteGroupDialog(false)}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                className="flex-1"
                onClick={handleDeleteGroup}
                disabled={deletingGroup}
              >
                {deletingGroup ? "Deleting..." : "Delete Group"}
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