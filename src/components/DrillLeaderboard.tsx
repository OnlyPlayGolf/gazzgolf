import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Trophy, Users, Crown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { User as SupabaseUser } from '@supabase/supabase-js';
import { cn } from "@/lib/utils";

interface LeaderboardEntry {
  user_id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  best_score: number;
  rank?: number;
}

interface DrillLeaderboardProps {
  drillId: string;
  drillName: string;
  refreshTrigger?: number;
}

const DrillLeaderboard: React.FC<DrillLeaderboardProps> = ({
  drillId,
  drillName,
  refreshTrigger
}) => {
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [globalLeaderboard, setGlobalLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [friendsLeaderboard, setFriendsLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [groupLeaderboards, setGroupLeaderboards] = useState<Array<{ groupId: string; groupName: string; leaderboard: LeaderboardEntry[] }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
      loadLeaderboards(user?.id);
    });
  }, [drillName, refreshTrigger]);

  const loadLeaderboards = async (userId?: string) => {
    setLoading(true);
    try {
      // Get drill UUID and info
      const { data: drillUuid } = await (supabase as any)
        .rpc('get_or_create_drill_by_title', { p_title: drillName });

      if (!drillUuid) {
        setLoading(false);
        return;
      }

      // Get drill info to check if lower is better
      const { data: drillInfo } = await (supabase as any)
        .from('drills')
        .select('lower_is_better')
        .eq('id', drillUuid)
        .single();

      const lowerIsBetter = drillInfo?.lower_is_better || false;

      // Load global leaderboard
      const { data: globalData, error: globalError } = await (supabase as any)
        .rpc('global_leaderboard_for_drill', { p_drill_title: drillName });

      if (globalError) {
        console.error('Error loading global leaderboard:', globalError);
      } else {
        setGlobalLeaderboard(globalData || []);
      }

      if (!userId) {
        setLoading(false);
        return;
      }

      // Get current user's best score
      const { data: userResults } = await (supabase as any)
        .from('drill_results')
        .select('total_points')
        .eq('drill_id', drillUuid)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      let userBestScore = null;
      if (userResults && userResults.length > 0) {
        const scores = userResults.map((r: any) => r.total_points);
        userBestScore = lowerIsBetter ? Math.min(...scores) : Math.max(...scores);
      }

      // Get current user's profile
      const { data: currentUserProfile } = await (supabase as any)
        .from('profiles')
        .select('display_name, username, avatar_url')
        .eq('id', userId)
        .single();

      // Load friends leaderboard
      const { data: friendsData, error: friendsError } = await (supabase as any)
        .rpc('friends_leaderboard_for_drill_by_title', { p_drill_title: drillName });

      if (friendsError) {
        console.error('Error loading friends leaderboard:', friendsError);
      }

      // Combine friends with current user if user has a score
      let combinedFriendsLeaderboard = [...(friendsData || [])];
      if (userBestScore !== null && currentUserProfile) {
        // Check if user is not already in the friends leaderboard
        if (!combinedFriendsLeaderboard.some(entry => entry.user_id === userId)) {
          combinedFriendsLeaderboard.push({
            user_id: userId,
            display_name: currentUserProfile.display_name,
            username: currentUserProfile.username,
            avatar_url: currentUserProfile.avatar_url,
            best_score: userBestScore
          });
        }
      }

      // Sort combined friends leaderboard
      combinedFriendsLeaderboard.sort((a, b) => {
        if (lowerIsBetter) {
          return a.best_score - b.best_score;
        } else {
          return b.best_score - a.best_score;
        }
      });

      setFriendsLeaderboard(combinedFriendsLeaderboard);

      // Get user's favorite groups (max 3)
      const { data: settingsData } = await (supabase as any)
        .from('user_settings')
        .select('favourite_group_ids')
        .eq('user_id', userId)
        .maybeSingle();

      const favGroupIds = settingsData?.favourite_group_ids as string[] | null | undefined;

      // Load leaderboards for all favorite groups
      const groupLeaderboardsData = [];
      if (favGroupIds && favGroupIds.length > 0) {
        for (const groupId of favGroupIds) {
          // Get group info
          const { data: groupInfo } = await (supabase as any)
            .from('groups')
            .select('name')
            .eq('id', groupId)
            .single();

          if (!groupInfo) continue;

          // Get all members of this group
          const { data: groupMembers } = await (supabase as any)
            .from('group_members')
            .select('user_id')
            .eq('group_id', groupId);

          if (!groupMembers || groupMembers.length === 0) continue;

          const memberIds = groupMembers.map((m: any) => m.user_id);

          // Get best scores for all group members for this drill
          const { data: memberScores } = await (supabase as any)
            .from('drill_results')
            .select('user_id, total_points')
            .eq('drill_id', drillUuid)
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

          // Add current user if they have a score
          if (userBestScore !== null && memberIds.includes(userId)) {
            memberBestScores.set(userId, userBestScore);
          }

          // Get profiles for all members with scores
          const memberIdsWithScores = Array.from(memberBestScores.keys());
          if (memberIdsWithScores.length === 0) continue;

          const { data: profiles } = await (supabase as any)
            .from('profiles')
            .select('id, display_name, username, avatar_url')
            .in('id', memberIdsWithScores);

          // Build leaderboard
          let groupLeaderboard: LeaderboardEntry[] = [];
          if (profiles) {
            groupLeaderboard = profiles.map((profile: any) => ({
              user_id: profile.id,
              display_name: profile.display_name,
              username: profile.username,
              avatar_url: profile.avatar_url,
              best_score: memberBestScores.get(profile.id)!
            }));
          }

          // Sort leaderboard
          groupLeaderboard.sort((a, b) => {
            if (lowerIsBetter) {
              return a.best_score - b.best_score;
            } else {
              return b.best_score - a.best_score;
            }
          });

          groupLeaderboardsData.push({
            groupId,
            groupName: groupInfo.name,
            leaderboard: groupLeaderboard
          });
        }
      }

      setGroupLeaderboards(groupLeaderboardsData);


    } catch (error) {
      console.error('Error loading leaderboards:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="space-y-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <Trophy size={48} className="mx-auto text-muted-foreground mb-4" />
              <h3 className="font-semibold text-foreground mb-2">Sign In to View Leaderboards</h3>
              <p className="text-muted-foreground">
                Sign in to see how you compare with friends and groups!
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <p className="text-muted-foreground">Loading leaderboards...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Friends Leaderboard */}
      {user && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-primary">
              <Users size={18} />
              Friends Leaderboard
            </CardTitle>
          </CardHeader>
          <CardContent>
            {friendsLeaderboard.length > 0 ? (
              <div className="space-y-3">
                {friendsLeaderboard.map((entry, index) => (
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
                No friends have played this drill yet. Add some friends to compete!
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Group Leaderboards */}
      {user && groupLeaderboards.map(({ groupId, groupName, leaderboard }) => (
        <Card key={groupId}>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-primary">
              <Trophy size={18} />
              {groupName} Leaderboard
            </CardTitle>
          </CardHeader>
          <CardContent>
            {leaderboard.length > 0 ? (
              <div className="space-y-3">
                {leaderboard.map((entry, index) => (
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
                No group members have played this drill yet.
              </p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default DrillLeaderboard;