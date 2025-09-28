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
  best_score: number;
}

interface PersonalStats {
  personalBest: number | null;
  lastScore: number | null;
}

interface LeaderboardPreviewProps {
  drillId: string;
  onViewFullLeaderboard: () => void;
}

const LeaderboardPreview = ({ drillId, onViewFullLeaderboard }: LeaderboardPreviewProps) => {
  const [friendsLeaderboard, setFriendsLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [groupLeaderboard, setGroupLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [groupName, setGroupName] = useState<string>('');
  const [personalStats, setPersonalStats] = useState<PersonalStats>({ personalBest: null, lastScore: null });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLeaderboards();
  }, [drillId]);

  const loadLeaderboards = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      // Load personal stats
      const { data: userResults } = await (supabase as any)
        .from('drill_results')
        .select('total_points')
        .eq('drill_id', drillId)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (userResults && userResults.length > 0) {
        const scores = userResults.map((r: any) => r.total_points);
        setPersonalStats({
          personalBest: Math.max(...scores),
          lastScore: scores[0],
        });
      }

      // Load friends leaderboard
      const { data: friendsData } = await (supabase as any).rpc('top3_friends_for_drill', {
        p_drill: drillId,
      });

      if (friendsData) {
        setFriendsLeaderboard(friendsData);
      }

      // Load group leaderboard
      const { data: groupData } = await (supabase as any).rpc('top3_favourite_group_for_drill', {
        p_drill: drillId,
      });

      if (groupData) {
        setGroupLeaderboard(groupData);
      }

      // Get group name
      const { data: settingsData } = await (supabase as any)
        .from('user_settings')
        .select('favourite_group_id')
        .eq('user_id', user.id)
        .single();

      if (settingsData?.favourite_group_id) {
        const { data: groupInfo } = await (supabase as any)
          .from('groups')
          .select('name')
          .eq('id', settingsData.favourite_group_id)
          .single();

        if (groupInfo?.name) {
          setGroupName(groupInfo.name);
        }
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