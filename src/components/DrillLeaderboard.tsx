import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Trophy, Users, Crown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { User as SupabaseUser } from '@supabase/supabase-js';

interface LeaderboardEntry {
  user_id: string;
  display_name: string | null;
  username: string | null;
  best_score: number;
}

interface DrillLeaderboardProps {
  drillId: string;
  drillName: string;
}

const DrillLeaderboard: React.FC<DrillLeaderboardProps> = ({
  drillId,
  drillName
}) => {
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [friendsLeaderboard, setFriendsLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [groupLeaderboard, setGroupLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [groupName, setGroupName] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
      if (user) {
        loadLeaderboards(user.id);
      } else {
        setLoading(false);
      }
    });
  }, [drillId]);

  const loadLeaderboards = async (userId: string) => {
    setLoading(true);
    try {
      // Load friends leaderboard
      const { data: friendsData, error: friendsError } = await (supabase as any)
        .rpc('top3_friends_for_drill', { p_drill: drillId });

      if (friendsError) {
        console.error('Error loading friends leaderboard:', friendsError);
      } else {
        setFriendsLeaderboard(friendsData || []);
      }

      // Load favorite group leaderboard
      const { data: groupData, error: groupError } = await (supabase as any)
        .rpc('top3_favourite_group_for_drill', { p_drill: drillId });

      if (groupError) {
        console.error('Error loading group leaderboard:', groupError);
      } else {
        setGroupLeaderboard(groupData || []);
      }

      // Get group name - simplified for now
      const { data: settingsData } = await (supabase as any)
        .from('user_settings')
        .select('favourite_group_id, groups(name)')
        .eq('user_id', userId)
        .single();

      if (settingsData?.groups?.name) {
        setGroupName(settingsData.groups.name);
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
      {/* Friends Leaderboard */}
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

      {/* Group Leaderboard */}
      {groupName && (
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