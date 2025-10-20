import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, Trophy, Star, Target } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User as SupabaseUser } from '@supabase/supabase-js';
import { syncLocalLevelsToDB } from "@/utils/levelsManager";

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

const Leaderboards = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [favoriteGroupIds, setFavoriteGroupIds] = useState<string[]>([]);
  const [friendsLevelLeaderboard, setFriendsLevelLeaderboard] = useState<LevelLeaderboardEntry[]>([]);
  const [groupsLevelLeaderboard, setGroupsLevelLeaderboard] = useState<LevelLeaderboardEntry[]>([]);
  const [drills, setDrills] = useState<Drill[]>([]);
  const [selectedDrill, setSelectedDrill] = useState<string>("");
  const [drillLeaderboardType, setDrillLeaderboardType] = useState<'friends' | 'groups'>('friends');
  const [friendsDrillLeaderboard, setFriendsDrillLeaderboard] = useState<DrillLeaderboardEntry[]>([]);
  const [groupsDrillLeaderboard, setGroupsDrillLeaderboard] = useState<DrillLeaderboardEntry[]>([]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setUser(session?.user ?? null);
        
        if (!session?.user) {
          navigate('/auth');
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      
      if (!session?.user) {
        navigate('/auth');
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  useEffect(() => {
    if (user) {
      loadFavoriteGroups();
      loadLevelLeaderboards();
      loadDrills();
    }
  }, [user]);

  useEffect(() => {
    if (selectedDrill && user) {
      loadDrillLeaderboards();
    }
  }, [selectedDrill, drillLeaderboardType, user]);

  const loadFavoriteGroups = async () => {
    if (!user) return;

    try {
      const { data: settingsData } = await supabase
        .from('user_settings')
        .select('favourite_group_ids')
        .eq('user_id', user.id)
        .maybeSingle();

      if (settingsData?.favourite_group_ids) {
        setFavoriteGroupIds(settingsData.favourite_group_ids);
      }
    } catch (error) {
      console.error('Error loading favorite groups:', error);
    }
  };

  const loadLevelLeaderboards = async () => {
    if (!user) return;

    try {
      await syncLocalLevelsToDB();

      const { data: friendsData, error: friendsError } = await supabase
        .rpc('friends_level_leaderboard');
      
      if (friendsError) {
        console.error('Error loading friends level leaderboard:', friendsError);
      } else {
        setFriendsLevelLeaderboard(friendsData || []);
      }

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
      const { data: friendsData, error: friendsError } = await supabase
        .rpc('friends_leaderboard_for_drill_by_title', { p_drill_title: selectedDrill });

      if (friendsError) {
        console.error('Error loading friends drill leaderboard:', friendsError);
        setFriendsDrillLeaderboard([]);
      } else {
        setFriendsDrillLeaderboard(friendsData || []);
      }

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

  if (!user) {
    return null;
  }

  return (
    <div className="pb-20 min-h-screen bg-background">
      <div className="p-4">
        <h1 className="text-xl font-bold text-foreground mb-6">Leaderboards</h1>

        <div className="space-y-6">
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
        </div>
      </div>
    </div>
  );
};

export default Leaderboards;