import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, UserPlus, Crown, Shield, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

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

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
    });
  }, []);

  useEffect(() => {
    if (groupId && user) {
      loadGroupData();
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
          <h1 className="text-xl font-bold text-foreground">{group.name}</h1>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Members ({members.length})</CardTitle>
              {canAddMembers && (
                <Button
                  size="sm"
                  onClick={() => {
                    loadFriendsForAdding();
                    setIsAddMembersOpen(true);
                  }}
                >
                  <UserPlus size={16} className="mr-2" />
                  Add Members
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {members.map((member) => (
              <div key={member.user_id} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Avatar>
                    <AvatarFallback>
                      {(member.display_name || member.username || 'U')[0].toUpperCase()}
                    </AvatarFallback>
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
                <Badge variant={member.role === 'owner' ? 'default' : 'secondary'}>
                  {member.role}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Dialog open={isAddMembersOpen} onOpenChange={setIsAddMembersOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Members</DialogTitle>
          </DialogHeader>

          <Tabs defaultValue="friends" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="friends">Friends</TabsTrigger>
              <TabsTrigger value="search">Search</TabsTrigger>
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
    </div>
  );
};

export default GroupDetail;