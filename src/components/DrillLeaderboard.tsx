import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProfilePhoto } from "@/components/ProfilePhoto";
import { Badge } from "@/components/ui/badge";
import { Trophy, Users } from "lucide-react";
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

const getScoreUnit = (drillName: string): string => {
  const drillUnits: { [key: string]: string } = {
    "Short Putting Test": "putts in a row",
    "PGA Tour 18 Holes": "putts",
    "Up & Down Putting Drill": "points",
    "Aggressive Putting": "putts",
    "8-Ball Drill": "points",
    "Approach Control": "points",
    "Shot Shape Master": "points",
    "Wedges 40–80 m — Distance Control": "points",
    "Wedge Point Game": "points",
    "Åberg's Wedge Ladder": "shots",
    "TW's 9 Windows Test": "shots",
    "Driver Control Drill": "points",
    "Easy Chip Drill": "in a row",
  };
  return drillUnits[drillName] || "points";
};

const DrillLeaderboard: React.FC<DrillLeaderboardProps> = ({
  drillId,
  drillName,
  refreshTrigger
}) => {
  const navigate = useNavigate();
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [globalLeaderboard, setGlobalLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [friendsLeaderboard, setFriendsLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const handleProfileClick = (userId: string) => {
    navigate(`/user/${userId}`);
  };

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
                      "bg-secondary/30"
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
                        {index + 1}
                      </div>
                      <ProfilePhoto
                        src={entry.avatar_url}
                        alt={entry.display_name || entry.username || "User"}
                        fallback={entry.display_name || entry.username || "?"}
                        size="sm"
                        onClick={() => handleProfileClick(entry.user_id)}
                      />
                      <span 
                        className={cn(
                          "font-medium cursor-pointer hover:underline",
                          entry.user_id === user?.id && "font-bold"
                        )}
                        onClick={() => handleProfileClick(entry.user_id)}
                      >
                        {entry.display_name || entry.username || "Unknown"}
                      </span>
                    </div>
                    <Badge variant="outline">
                      {entry.best_score} {getScoreUnit(drillName)}
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
    </div>
  );
};

export default DrillLeaderboard;