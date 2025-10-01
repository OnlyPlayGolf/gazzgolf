import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Trophy, Users, Crown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { User as SupabaseUser } from '@supabase/supabase-js';
import { cn } from "@/lib/utils";

interface LeaderboardEntry {
  user_id: string;
  display_name: string | null;
  username: string | null;
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
  const [groupLeaderboard, setGroupLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [groupName, setGroupName] = useState<string>("");
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

      // Load friends leaderboard
      const { data: friendsData, error: friendsError } = await (supabase as any)
        .rpc('top3_friends_for_drill_by_title', { p_drill_title: drillName });

      if (friendsError) {
        console.error('Error loading friends leaderboard:', friendsError);
      } else {
        setFriendsLeaderboard(friendsData || []);
      }

      // Load favorite group leaderboard
      const { data: groupData, error: groupError } = await (supabase as any)
        .rpc('top3_favourite_group_for_drill_by_title', { p_drill_title: drillName });

      if (groupError) {
        console.error('Error loading group leaderboard:', groupError);
      } else {
        setGroupLeaderboard(groupData || []);
      }

      // Get group name
      const { data: settingsData } = await (supabase as any)
        .from('user_settings')
        .select('favourite_group_id')
        .eq('user_id', userId)
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
      {/* Global Leaderboard */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-primary">
            <Trophy size={18} />
            Global Leaderboard
          </CardTitle>
        </CardHeader>
        <CardContent>
          {globalLeaderboard.length > 0 ? (
            <div className="space-y-2">
              {globalLeaderboard.map((entry) => (
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
                      entry.rank === 1 ? "bg-yellow-500/20 text-yellow-500" :
                      entry.rank === 2 ? "bg-gray-400/20 text-gray-400" :
                      entry.rank === 3 ? "bg-orange-500/20 text-orange-500" :
                      "bg-primary/20 text-primary"
                    )}>
                      #{entry.rank}
                    </div>
                    <Avatar className="h-8 w-8">
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
              No one has played this drill yet. Be the first!
            </p>
          )}
        </CardContent>
      </Card>

      {/* Friends Leaderboard */}
      {user && friendsLeaderboard.length > 0 && (
        <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-primary">
            <Users size={18} />
            Friends Top 3
          </CardTitle>
        </CardHeader>
        <CardContent>
          {friendsLeaderboard.length > 0 ? (
            <div className="space-y-3">
              {friendsLeaderboard.slice(0, 3).map((entry, index) => (
                <div key={entry.user_id} className="flex items-center justify-between p-3 rounded-md bg-secondary/30">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/20">
                      {index === 0 ? (
                        <Crown size={16} className="text-yellow-500" />
                      ) : (
                        <Trophy size={16} className={index === 1 ? "text-gray-400" : "text-orange-500"} />
                      )}
                    </div>
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="bg-primary/20 text-primary">
                        {(entry.display_name || entry.username || "?").charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="font-medium text-foreground">
                      {entry.display_name || entry.username || "Unknown"}
                    </span>
                  </div>
                  <Badge variant="outline">{entry.best_score}</Badge>
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

      {/* Group Leaderboard */}
      {user && groupName && groupLeaderboard.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-primary">
              <Trophy size={20} />
              {groupName} Top 3
            </CardTitle>
          </CardHeader>
          <CardContent>
            {groupLeaderboard.length > 0 ? (
              <div className="space-y-3">
                {groupLeaderboard.slice(0, 3).map((entry, index) => (
                  <div key={entry.user_id} className="flex items-center justify-between p-3 rounded-md bg-secondary/30">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/20">
                        {index === 0 ? (
                          <Crown size={16} className="text-yellow-500" />
                        ) : (
                          <Trophy size={16} className={index === 1 ? "text-gray-400" : "text-orange-500"} />
                        )}
                      </div>
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="bg-primary/20 text-primary">
                          {(entry.display_name || entry.username || "?").charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-medium text-foreground">
                        {entry.display_name || entry.username || "Unknown"}
                      </span>
                    </div>
                    <Badge variant="outline">{entry.best_score}</Badge>
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
      )}
    </div>
  );
};

export default DrillLeaderboard;