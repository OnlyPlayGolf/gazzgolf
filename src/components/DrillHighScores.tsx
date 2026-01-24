import { useState, useEffect } from "react";
import { Trophy, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface DrillHighScoresProps {
  drillName: string;
}

const getScoreUnit = (drillName: string): string => {
  const drillUnits: { [key: string]: string } = {
    "Short Putt Test": "in a row",
    "PGA Tour 18-hole Test": "putts",
    "Up & Down Putts 6-10m": "pts",
    "Aggressive Putting 4-6m": "putts",
    "8-Ball Circuit": "pts",
    "Approach Control 130-180m": "pts",
    "Shot Shape Master": "pts",
    "Wedge Game 40-80m": "pts",
    "Wedge Ladder 60-120m": "shots",
    "9 Windows Shot Shape Test": "shots",
    "Driver Control Drill": "pts",
    "Easy Chip Drill": "in a row",
    "Lag Putting Drill 8-20m": "pts",
    "18 Up & Downs": "shots",
  };
  return drillUnits[drillName] || "pts";
};

export const DrillHighScores = ({ drillName }: DrillHighScoresProps) => {
  const [personalBest, setPersonalBest] = useState<number | null>(null);
  const [friendsBest, setFriendsBest] = useState<{ name: string; score: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [lowerIsBetter, setLowerIsBetter] = useState(false);

  useEffect(() => {
    loadHighScores();
  }, [drillName]);

  const loadHighScores = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

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

      const isLowerBetter = drillInfo?.lower_is_better || false;
      setLowerIsBetter(isLowerBetter);

      // Get user's best score
      const { data: userResults } = await (supabase as any)
        .from('drill_results')
        .select('total_points')
        .eq('drill_id', drillUuid)
        .eq('user_id', user.id);

      if (userResults && userResults.length > 0) {
        const scores = userResults.map((r: any) => r.total_points);
        const best = isLowerBetter ? Math.min(...scores) : Math.max(...scores);
        setPersonalBest(best);
      }

      // Get friends leaderboard (top 1)
      const { data: friendsData } = await (supabase as any)
        .rpc('friends_leaderboard_for_drill_by_title', { p_drill_title: drillName });

      if (friendsData && friendsData.length > 0) {
        const topFriend = friendsData[0];
        setFriendsBest({
          name: topFriend.display_name || topFriend.username || "Friend",
          score: topFriend.best_score
        });
      }
    } catch (error) {
      console.error('Error loading high scores:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return null;
  }

  const scoreUnit = getScoreUnit(drillName);

  return (
    <div className="flex gap-3 mb-4">
      {personalBest !== null && (
        <div className="flex items-center gap-2 px-3 py-2 bg-secondary/50 rounded-lg flex-1">
          <Trophy size={16} className="text-muted-foreground" />
          <div className="text-sm">
            <span className="text-muted-foreground">Your best: </span>
            <span className="font-semibold text-foreground">{personalBest} {scoreUnit}</span>
          </div>
        </div>
      )}
      {friendsBest && (
        <div className="flex items-center gap-2 px-3 py-2 bg-secondary/50 rounded-lg flex-1">
          <Users size={16} className="text-muted-foreground" />
          <div className="text-sm truncate">
            <span className="text-muted-foreground">{friendsBest.name}: </span>
            <span className="font-semibold text-foreground">{friendsBest.score} {scoreUnit}</span>
          </div>
        </div>
      )}
    </div>
  );
};
