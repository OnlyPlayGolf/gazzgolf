import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
 wille
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { Star, Plus, MessageCircle, Users, Calendar, Menu, ChevronRight, Mail, User as UserIcon, Settings as SettingsIcon, Info } from "lucide-react";

import { Star, Plus, MessageCircle, Crown, UserPlus, Users, Calendar, Menu, ChevronRight, Mail, User as UserIcon, Settings as SettingsIcon, Info, Loader2 } from "lucide-react";
 main
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { User as SupabaseUser, Session } from '@supabase/supabase-js';
import { TopNavBar } from "@/components/TopNavBar";
 wille
import { getGroupRoleLabel } from "@/utils/groupRoleLabel";

import { NotificationsSheet } from "@/components/NotificationsSheet";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { searchProfilesTypeahead } from "@/utils/profileSearch";
 main

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
  created_at?: string;
  image_url?: string;
  group_type?: 'player' | 'coach' | null;
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
  const descriptionTextareaRef = useRef<HTMLTextAreaElement>(null);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<{ id: string; display_name: string | null; username: string | null; avatar_url?: string | null }[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const debouncedSearchTerm = useDebouncedValue(searchTerm.trim(), 300);
  const searchRequestIdRef = useRef(0);
  const [loading, setLoading] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

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

  // Reset textarea height when dialog closes or description is cleared
  useEffect(() => {
    if (!isCreateGroupOpen || !groupDescription) {
      const textarea = descriptionTextareaRef.current;
      if (textarea) {
        textarea.style.height = 'auto';
      }
    }
  }, [isCreateGroupOpen, groupDescription]);

  // Search users (typeahead) for adding group members
  useEffect(() => {
    if (!user) return;

    if (debouncedSearchTerm.length < 2) {
      searchRequestIdRef.current += 1; // invalidate in-flight requests
      setSearchLoading(false);
      setSearchResults([]);
      return;
    }

    let cancelled = false;
    const requestId = ++searchRequestIdRef.current;

    const run = async () => {
      setSearchLoading(true);
      try {
 wille
        // Global user search (includes non-friends) via RPC (safe across profiles RLS)
        const { data, error } = await supabase
          .rpc('search_profiles', { q: searchTerm.trim(), max_results: 20 });

        if (error) {
          console.error('Error searching users:', error);
          setSearchResults([]);
        } else {
          // Normalize shape to what the UI expects
          const normalized = (data || [])
            .filter((u: any) => u?.id && u.id !== user.id)
            .map((u: any) => ({
              id: u.id as string,
              display_name: (u.display_name ?? null) as string | null,
              username: (u.username ?? null) as string | null,
            }));
          setSearchResults(normalized);
        }

        const rows = await searchProfilesTypeahead(supabase as any, debouncedSearchTerm, { limit: 20 });
        if (cancelled || requestId !== searchRequestIdRef.current) return;
        setSearchResults(rows);
 main
      } catch (error) {
        if (cancelled || requestId !== searchRequestIdRef.current) return;
        console.error('Error searching users:', error);
        setSearchResults([]);
      } finally {
        if (cancelled || requestId !== searchRequestIdRef.current) return;
        setSearchLoading(false);
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [debouncedSearchTerm, user]);

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
      // NOTE: `groups.group_type` may not exist yet in the remote DB if migrations haven't been applied.
      // We attempt to select it, and gracefully fall back to a select without it.
      let groupsData: any[] | null = null;
      let groupsError: any = null;

      ({ data: groupsData, error: groupsError } = await (supabase as any)
        .from('group_members')
        .select(`
          groups(id, name, owner_id, created_at, description, image_url, group_type),
          role
        `)
        .eq('user_id', user.id));

      if (groupsError) {
        ({ data: groupsData, error: groupsError } = await (supabase as any)
          .from('group_members')
          .select(`
            groups(id, name, owner_id, created_at, description, image_url),
            role
          `)
          .eq('user_id', user.id));
      }

      if (groupsError) {
        throw groupsError;
      }

 wille
      // Get member counts for each group
      const groupsList = await Promise.all(
        (groupsData || []).map(async (g: any) => {
          const { count } = await (supabase as any)
            .from('group_members')
            .select('*', { count: 'exact', head: true })
            .eq('group_id', g.groups.id);

          // Derive group_type for backward compatibility if DB column doesn't exist / isn't selected.
          let derivedGroupType: 'player' | 'coach' | null = g.groups.group_type ?? null;
          if (!derivedGroupType) {
            const { count: adminCount } = await (supabase as any)
              .from('group_members')
              .select('*', { count: 'exact', head: true })
              .eq('group_id', g.groups.id)
              .eq('role', 'admin');
            derivedGroupType = (adminCount || 0) > 0 ? 'coach' : 'player';
          }

          return {
            id: g.groups.id,
            name: g.groups.name,
            owner_id: g.groups.owner_id,
            role: g.role,
            member_count: count || 0,
            created_at: g.groups.created_at,
            description: g.groups.description,
            image_url: g.groups.image_url,
            group_type: derivedGroupType,
          };
        })
      );

      // Batch member counts for all groups (avoid N+1)
      const groupRows = (groupsData || []).filter((g: any) => g?.groups?.id);
      const groupIds = groupRows.map((g: any) => g.groups.id);
      const memberCountMap = new Map<string, number>();

      if (groupIds.length > 0) {
        const { data: allMembers, error: membersError } = await (supabase as any)
          .from("group_members")
          .select("group_id")
          .in("group_id", groupIds);

        if (membersError) {
          console.error("Error loading group member counts:", membersError);
        } else {
          (allMembers || []).forEach((m: any) => {
            if (!m?.group_id) return;
            memberCountMap.set(m.group_id, (memberCountMap.get(m.group_id) || 0) + 1);
          });
        }
      }

      const groupsList = groupRows.map((g: any) => ({
        id: g.groups.id,
        name: g.groups.name,
        owner_id: g.groups.owner_id,
        role: g.role,
        member_count: memberCountMap.get(g.groups.id) || 0,
        created_at: g.groups.created_at,
        description: g.groups.description,
        image_url: g.groups.image_url,
      }));
main

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
      // Step 1: Upload group image if provided
      let imageUrl: string | null = null;
      if (groupImage) {
        const fileExt = groupImage.name.split('.').pop();
        const fileName = `${user.id}/${Date.now()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('group-images')
          .upload(fileName, groupImage);
        
        if (uploadError) {
          console.error('Error uploading group image:', uploadError);
          // Continue without image - don't fail the whole group creation
        } else {
          const { data: { publicUrl } } = supabase.storage
            .from('group-images')
            .getPublicUrl(fileName);
          imageUrl = publicUrl;
        }
      }

      // Step 2: Create the group
      // NOTE: `groups.group_type` may not exist yet in the remote DB if migrations haven't been applied.
      // Try inserting with group_type, and fall back to an insert without it.
      let groupData: any = null;
      let groupError: any = null;

      ({ data: groupData, error: groupError } = await (supabase as any)
        .from('groups')
        .insert({
          name: groupName.trim(),
          owner_id: user.id,
          image_url: imageUrl,
          group_type: groupType === "Coach" ? "coach" : "player",
        })
        .select()
        .single());

      if (groupError && String(groupError.message || '').toLowerCase().includes('group_type')) {
        ({ data: groupData, error: groupError } = await (supabase as any)
          .from('groups')
          .insert({
            name: groupName.trim(),
            owner_id: user.id,
            image_url: imageUrl,
            // Backward compatibility when group_type column doesn't exist yet
            is_coach_group: groupType === "Coach",
          })
          .select()
          .single());
      }

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

      // Step 3: Add creator as owner in group_members
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

      // Step 4: Add selected members to the group
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

  // Sort groups to show favorites first
  const sortedGroups = useMemo(() => {
    return [...groups].sort((a, b) => {
      const aIsFavorite = favoriteGroupIds.includes(a.id);
      const bIsFavorite = favoriteGroupIds.includes(b.id);
      
      if (aIsFavorite && !bIsFavorite) return -1;
      if (!aIsFavorite && bIsFavorite) return 1;
      return 0;
    });
  }, [groups, favoriteGroupIds]);

  if (!user) {
    return null; // Will redirect to auth
  }

  return (
    <div className="pb-20 min-h-screen bg-background">
      <TopNavBar hideNotifications />
      <div className="p-4 pt-20">
        <div className="flex items-center justify-between mb-2 gap-3">
          <h1 className="text-2xl font-bold text-foreground">My Groups</h1>
        </div>

        <div className="flex items-center justify-between gap-3 mb-6">
          <p className="text-muted-foreground text-sm">
            Connect and compete with your golf friends
          </p>
          <Button
            size="sm"
            className="shrink-0 px-3 gap-3"
            onClick={() => setIsCreateGroupOpen(true)}
          >
            <Plus size={16} />
            Create Group
          </Button>
        </div>

        <Dialog open={isCreateGroupOpen} onOpenChange={setIsCreateGroupOpen}>
                    <DialogContent className="sm:max-w-md max-h-[90vh] flex flex-col" hideCloseButton>
                      <DialogHeader className="flex-shrink-0">
                        <DialogTitle className="text-xl font-semibold text-center">Create New Group</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 py-2 overflow-y-auto flex-1 min-h-0">
                        {/* Group Type Toggle */}
                        <div className="flex gap-2">
                          <div className="relative flex-1">
                            <Button
                              type="button"
                              variant={groupType === "Player" ? "default" : "outline"}
                              className="w-full pr-10"
                              onClick={() => setGroupType("Player")}
                            >
                              Player
                            </Button>
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <Info className="h-4 w-4" />
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent
                                side="bottom"
                                align="end"
                                sideOffset={8}
                                className="relative z-[200] w-80 p-3"
                              >
                                <PopoverPrimitive.Arrow className="fill-popover" width={14} height={7} />
                                <div className="space-y-1.5">
                                  <p className="font-semibold text-foreground">Player group</p>
                                  <p className="text-sm text-muted-foreground">
                                    All players can manage the group. All player profiles and results are shown in the group.
                                  </p>
                                </div>
                              </PopoverContent>
                            </Popover>
                          </div>

                          <div className="relative flex-1">
                            <Button
                              type="button"
                              variant={groupType === "Coach" ? "default" : "outline"}
                              className="w-full pr-10"
                              onClick={() => setGroupType("Coach")}
                            >
                              Coach
                            </Button>
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <Info className="h-4 w-4" />
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent
                                side="bottom"
                                align="end"
                                sideOffset={8}
                                className="relative z-[200] w-80 p-3"
                              >
                                <PopoverPrimitive.Arrow className="fill-popover" width={14} height={7} />
                                <div className="space-y-1.5">
                                  <p className="font-semibold text-foreground">Coach group</p>
                                  <p className="text-sm text-muted-foreground">
                                    Only the coach can manage the group. Coach’s profile and results are hidden by default and can be shown or edited later.
                                  </p>
                                </div>
                              </PopoverContent>
                            </Popover>
                          </div>
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
                            {searchTerm.trim().length > 0 && (
                              <div className="border border-border rounded-lg max-h-[200px] overflow-y-auto">
                                {searchTerm.trim().length < 2 ? (
                                  <p className="text-sm text-muted-foreground p-3 text-center">
                                    Type 2+ characters to search
                                  </p>
                                ) : searchLoading ? (
                                  <div className="flex items-center justify-center p-3 text-sm text-muted-foreground">
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    Searching...
                                  </div>
                                ) : searchResults.length > 0 ? (
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

                        {/* Description */}
                        <div>
                          <Label htmlFor="group-description" className="text-foreground">
                            Description
                          </Label>
                          <Textarea
                            ref={descriptionTextareaRef}
                            id="group-description"
                            value={groupDescription}
                            onChange={(e) => {
                              setGroupDescription(e.target.value);
                              // Auto-resize textarea
                              const textarea = descriptionTextareaRef.current;
                              if (textarea) {
                                textarea.style.height = 'auto';
                                textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
                              }
                            }}
                            placeholder="Optional group description"
                            className="mt-1.5 min-h-[2.5rem] resize-none overflow-hidden"
                            rows={1}
                          />
                        </div>

                        {/* Group Image Upload */}
                        <div>
                          <Label className="text-foreground">Group Image</Label>
                          <div 
                            className="mt-1.5 border-2 border-dashed border-muted-foreground/30 rounded-lg p-4 flex flex-col items-center justify-center cursor-pointer hover:border-primary/50 transition-colors"
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

                      </div>
                      {/* Action Buttons - Sticky at bottom */}
                      <div className="flex flex-col gap-2 pt-4 border-t flex-shrink-0">
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
                    </DialogContent>
                  </Dialog>

        {/* Groups List */}
        <div className="space-y-4">
          {sortedGroups.length > 0 ? (
            sortedGroups.map((group) => (
              <Card 
                key={group.id} 
                className="border-border cursor-pointer hover:border-primary/50 hover:shadow-md transition-all"
                onClick={() => navigate(`/group/${group.id}`)}
              >
                <CardContent className="p-4">
                  <div className="flex gap-4 items-center">
                    {/* Group Avatar */}
                    <div className="flex-shrink-0">
                      {group.image_url ? (
                        <img 
                          src={group.image_url} 
                          alt={group.name}
                          className="w-16 h-16 rounded-full object-cover border-2 border-primary/10"
                        />
                      ) : (
                        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center border-2 border-primary/10">
                          <span className="text-xl font-bold text-primary">
                            {getGroupInitials(group.name)}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Group Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-foreground text-lg">{group.name}</h3>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        <p className="text-sm text-muted-foreground">
                          {group.member_count} {group.member_count === 1 ? 'member' : 'members'}
                        </p>
                        <Badge variant="outline" className="text-xs">
                          {getGroupRoleLabel({ role: group.role, groupType: group.group_type })}
                        </Badge>
                      </div>

                      {group.description && (
                        <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                          {group.description}
                        </p>
                      )}
                      
                      {group.created_at && (
                        <div className="flex items-center gap-1.5 mt-2">
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

                    {/* Favorite Star */}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleFavoriteGroup(group.id);
                      }}
                      className="flex-shrink-0"
                    >
                      <Star 
                        size={20} 
                        className={favoriteGroupIds.includes(group.id) ? "fill-current text-yellow-500" : "text-muted-foreground"} 
                      />
                    </Button>
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