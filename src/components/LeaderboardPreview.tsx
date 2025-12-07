import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Trophy, Users, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface LeaderboardEntry {
  user_id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  best_score: number;
}

interface PersonalStats {
  personalBest: number | null;
  lastScore: number | null;
}

interface LeaderboardPreviewProps {
  drillId: string;
  drillTitle: string;
  onViewFullLeaderboard: () => void;
  refreshTrigger?: number;
}

const LeaderboardPreview = ({ drillId, drillTitle, onViewFullLeaderboard, refreshTrigger }: LeaderboardPreviewProps) => {
  const navigate = useNavigate();
  const [friendsLeaderboard, setFriendsLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [groupLeaderboards, setGroupLeaderboards] = useState<Array<{ groupId: string; groupName: string; leaderboard: LeaderboardEntry[] }>>([]);
  const [personalStats, setPersonalStats] = useState<PersonalStats>({ personalBest: null, lastScore: null });
  const [loading, setLoading] = useState(true);

  const handleProfileClick = (userId: string) => {
    navigate(`/user/${userId}`);
  };

  useEffect(() => {
    loadLeaderboards();
  }, [drillTitle, refreshTrigger]);

  const loadLeaderboards = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      // Ensure drill exists and get its UUID by title
      const { data: drillId } = await (supabase as any)
        .rpc('get_or_create_drill_by_title', { p_title: drillTitle });

      if (!drillId) {
        setLoading(false);
        return;
      }

      // Get drill info to check if lower is better
      const { data: drillInfo } = await (supabase as any)
        .from('drills')
        .select('lower_is_better')
        .eq('id', drillId)
        .single();

      const lowerIsBetter = drillInfo?.lower_is_better || false;

      // Load personal stats
      const { data: userResults } = await (supabase as any)
        .from('drill_results')
        .select('total_points')
        .eq('drill_id', drillId)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      let userBestScore = null;
      if (userResults && userResults.length > 0) {
        const scores = userResults.map((r: any) => r.total_points);
        userBestScore = lowerIsBetter ? Math.min(...scores) : Math.max(...scores);
        setPersonalStats({
          personalBest: userBestScore,
          lastScore: scores[0],
        });
      }

      // Load friends leaderboard
      const { data: friendsData } = await (supabase as any).rpc('friends_leaderboard_for_drill_by_title', {
        p_drill_title: drillTitle,
      });

      // Get current user's profile
      const { data: currentUserProfile } = await (supabase as any)
        .from('profiles')
        .select('display_name, username, avatar_url')
        .eq('id', user.id)
        .single();

      // Combine friends with current user if user has a score
      let combinedLeaderboard = [...(friendsData || [])];
      if (userBestScore !== null && currentUserProfile) {
        combinedLeaderboard.push({
          user_id: user.id,
          display_name: currentUserProfile.display_name,
          username: currentUserProfile.username,
          avatar_url: currentUserProfile.avatar_url,
          best_score: userBestScore
        });
      }

      // Sort combined leaderboard
      combinedLeaderboard.sort((a, b) => {
        if (lowerIsBetter) {
          return a.best_score - b.best_score; // Ascending for lower is better
        } else {
          return b.best_score - a.best_score; // Descending for higher is better
        }
      });

      setFriendsLeaderboard(combinedLeaderboard);

      // Get user's favorite groups (max 3)
      const { data: settingsData } = await (supabase as any)
        .from('user_settings')
        .select('favourite_group_ids')
        .eq('user_id', user.id)
        .maybeSingle();

      let favGroupIds = settingsData?.favourite_group_ids as string[] | null | undefined;

      // If no favorites set, auto-select up to 3 groups
      if (!favGroupIds || favGroupIds.length === 0) {
        const { data: myGroups } = await (supabase as any)
          .from('group_members')
          .select('group_id')
          .eq('user_id', user.id)
          .limit(3);

        if (myGroups && myGroups.length > 0) {
          favGroupIds = myGroups.map((g: any) => g.group_id);
          await (supabase as any)
            .from('user_settings')
            .upsert({ user_id: user.id, favourite_group_ids: favGroupIds }, { onConflict: 'user_id' });
        }
      }

      // Load top 3 leaderboards for all favorite groups
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
            .eq('drill_id', drillId)
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
          if (userBestScore !== null && memberIds.includes(user.id)) {
            memberBestScores.set(user.id, userBestScore);
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
            leaderboard: groupLeaderboard.slice(0, 3) // Top 3 only for preview
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

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8">
          <p className="text-center text-muted-foreground">Loading leaderboard...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Personal Stats */}
      {(personalStats.personalBest !== null || personalStats.lastScore !== null) && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Trophy className="text-primary" size={16} />
              Your Stats
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex justify-between text-sm">
              {personalStats.personalBest !== null && (
                <div>
                  <p className="text-muted-foreground">Personal Best</p>
                  <p className="font-semibold text-foreground">{personalStats.personalBest}</p>
                </div>
              )}
              {personalStats.lastScore !== null && (
                <div>
                  <p className="text-muted-foreground">Last Score</p>
                  <p className="font-semibold text-foreground">{personalStats.lastScore}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Friends Leaderboard */}
      {friendsLeaderboard.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="text-primary" size={16} />
              Top 3 Friends
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {friendsLeaderboard.slice(0, 3).map((entry, index) => (
                <div key={entry.user_id} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
                      {index + 1}
                    </div>
                    <Avatar 
                      className="w-6 h-6 cursor-pointer hover:opacity-80 transition-opacity"
                      onClick={() => handleProfileClick(entry.user_id)}
                    >
                      {entry.avatar_url && <AvatarImage src={entry.avatar_url} alt={entry.display_name || entry.username || "User"} />}
                      <AvatarFallback className="text-xs">
                        {(entry.display_name || entry.username || 'U').charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span 
                      className="text-sm font-medium cursor-pointer hover:underline"
                      onClick={() => handleProfileClick(entry.user_id)}
                    >
                      {entry.display_name || entry.username || 'Unknown'}
                    </span>
                  </div>
                  <span className="text-sm font-semibold">{entry.best_score}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Group Leaderboards */}
      {groupLeaderboards.map(({ groupId, groupName, leaderboard }) => (
        <Card key={groupId}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="text-primary" size={16} />
              Top 3 {groupName}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {leaderboard.map((entry, index) => (
                <div key={entry.user_id} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
                      {index + 1}
                    </div>
                    <Avatar 
                      className="w-6 h-6 cursor-pointer hover:opacity-80 transition-opacity"
                      onClick={() => handleProfileClick(entry.user_id)}
                    >
                      {entry.avatar_url && <AvatarImage src={entry.avatar_url} alt={entry.display_name || entry.username || "User"} />}
                      <AvatarFallback className="text-xs">
                        {(entry.display_name || entry.username || 'U').charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span 
                      className="text-sm font-medium cursor-pointer hover:underline"
                      onClick={() => handleProfileClick(entry.user_id)}
                    >
                      {entry.display_name || entry.username || 'Unknown'}
                    </span>
                  </div>
                  <span className="text-sm font-semibold">{entry.best_score}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}

      {/* See Full Leaderboard Button */}
      <Button 
        variant="outline" 
        className="w-full" 
        onClick={onViewFullLeaderboard}
      >
        See full leaderboard
        <ArrowRight className="ml-2" size={16} />
      </Button>
    </div>
  );
};

export default LeaderboardPreview;