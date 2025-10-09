import { useState, useEffect } from "react";
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
  const [friendsLeaderboard, setFriendsLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [groupLeaderboard, setGroupLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [groupName, setGroupName] = useState<string>('');
  const [personalStats, setPersonalStats] = useState<PersonalStats>({ personalBest: null, lastScore: null });
  const [loading, setLoading] = useState(true);

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

      // Ensure favourite group is set; if missing, pick first membership and persist
      const { data: settingsData } = await (supabase as any)
        .from('user_settings')
        .select('favourite_group_id')
        .eq('user_id', user.id)
        .maybeSingle();

      let favGroupId = settingsData?.favourite_group_id as string | null | undefined;

      if (!favGroupId) {
        const { data: myGroups } = await (supabase as any)
          .from('group_members')
          .select('group_id')
          .eq('user_id', user.id);

        if (myGroups && myGroups.length > 0) {
          favGroupId = myGroups[0].group_id;
          await (supabase as any)
            .from('user_settings')
            .upsert({ user_id: user.id, favourite_group_id: favGroupId }, { onConflict: 'user_id' });
        }
      }

      if (favGroupId) {
        const { data: groupInfo } = await (supabase as any)
          .from('groups')
          .select('name')
          .eq('id', favGroupId)
          .single();
        if (groupInfo?.name) setGroupName(groupInfo.name);

        // Load group leaderboard
        const { data: groupData } = await (supabase as any).rpc('favourite_group_leaderboard_for_drill_by_title', {
          p_drill_title: drillTitle,
        });

        // Combine group with current user if user has a score
        let combinedGroupLeaderboard = [...(groupData || [])];
        if (userBestScore !== null && currentUserProfile) {
          if (!combinedGroupLeaderboard.some(entry => entry.user_id === user.id)) {
            combinedGroupLeaderboard.push({
              user_id: user.id,
              display_name: currentUserProfile.display_name,
              username: currentUserProfile.username,
              avatar_url: currentUserProfile.avatar_url,
              best_score: userBestScore
            });
          }
        }

        // Sort combined group leaderboard
        combinedGroupLeaderboard.sort((a, b) => {
          if (lowerIsBetter) {
            return a.best_score - b.best_score;
          } else {
            return b.best_score - a.best_score;
          }
        });

        setGroupLeaderboard(combinedGroupLeaderboard);
      } else {
        setGroupLeaderboard([]);
        setGroupName('');
      }
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
                    <Avatar className="w-6 h-6">
                      {entry.avatar_url && <AvatarImage src={entry.avatar_url} alt={entry.display_name || entry.username || "User"} />}
                      <AvatarFallback className="text-xs">
                        {(entry.display_name || entry.username || 'U').charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-medium">
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

      {/* Group Leaderboard */}
      {groupLeaderboard.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="text-primary" size={16} />
              Top 3 {groupName || 'Group'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {groupLeaderboard.slice(0, 3).map((entry, index) => (
                <div key={entry.user_id} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
                      {index + 1}
                    </div>
                    <Avatar className="w-6 h-6">
                      {entry.avatar_url && <AvatarImage src={entry.avatar_url} alt={entry.display_name || entry.username || "User"} />}
                      <AvatarFallback className="text-xs">
                        {(entry.display_name || entry.username || 'U').charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-medium">
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