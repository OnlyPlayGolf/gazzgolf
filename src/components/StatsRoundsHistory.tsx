import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Calendar, MapPin, Hash, ChevronRight } from "lucide-react";
import { format } from "date-fns";

interface StatsRound {
  id: string;
  course_name: string;
  date_played: string;
  holes_played: number;
  tee_set: string | null;
  round_type: string | null;
  total_score?: number;
  total_par?: number;
}

const roundTypeLabels: Record<string, string> = {
  fun_practice: "Fun/Practice",
  qualifying: "Qualifying",
  tournament: "Tournament",
};

export const StatsRoundsHistory = () => {
  const navigate = useNavigate();
  const [rounds, setRounds] = useState<StatsRound[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStatsRounds();
  }, []);

  const fetchStatsRounds = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch rounds created from pro_stats (Add Statistics feature)
      const { data: roundsData, error } = await supabase
        .from("rounds")
        .select("id, course_name, date_played, holes_played, tee_set, round_type")
        .eq("user_id", user.id)
        .eq("origin", "pro_stats")
        .order("date_played", { ascending: false })
        .order("created_at", { ascending: false });

      if (error) throw error;

      if (!roundsData || roundsData.length === 0) {
        setRounds([]);
        setLoading(false);
        return;
      }

      // Get scores for each round from pro_stats_holes
      const roundsWithScores = await Promise.all(
        roundsData.map(async (round) => {
          // Get pro_stats_round linked to this round
          const { data: proRound } = await supabase
            .from("pro_stats_rounds")
            .select("id")
            .eq("external_round_id", round.id)
            .maybeSingle();

          if (!proRound) {
            return { ...round, total_score: undefined, total_par: undefined };
          }

          // Get hole scores
          const { data: holes } = await supabase
            .from("pro_stats_holes")
            .select("score, par")
            .eq("pro_round_id", proRound.id);

          if (!holes || holes.length === 0) {
            return { ...round, total_score: undefined, total_par: undefined };
          }

          const totalScore = holes.reduce((sum, h) => sum + (h.score || 0), 0);
          const totalPar = holes.reduce((sum, h) => sum + (h.par || 0), 0);

          return { ...round, total_score: totalScore, total_par: totalPar };
        })
      );

      setRounds(roundsWithScores);
    } catch (error) {
      console.error("Error fetching stats rounds:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleRoundClick = (roundId: string) => {
    navigate(`/rounds/${roundId}/pro-summary`);
  };

  const formatScoreDisplay = (round: StatsRound) => {
    if (round.total_score === undefined) return "No scores";
    const diff = round.total_score - (round.total_par || 0);
    const diffStr = diff === 0 ? "E" : diff > 0 ? `+${diff}` : `${diff}`;
    return `${round.total_score} (${diffStr})`;
  };

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            Stats Rounds
          </CardTitle>
        </CardHeader>
        <CardContent className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-primary" />
          Stats Rounds
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          {rounds.length} {rounds.length === 1 ? "round" : "rounds"} recorded
        </p>
      </CardHeader>
      <CardContent>
        {rounds.length === 0 ? (
          <div className="text-center py-6">
            <p className="text-muted-foreground text-sm">No stats rounds yet</p>
            <p className="text-muted-foreground text-xs mt-1">
              Start tracking strokes gained to see your rounds here
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {rounds.map((round) => (
              <div
                key={round.id}
                onClick={() => handleRoundClick(round.id)}
                className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 cursor-pointer transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="font-medium text-sm truncate">
                      {round.course_name}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>{format(new Date(round.date_played), "MMM d, yyyy")}</span>
                    <span className="flex items-center gap-1">
                      <Hash className="h-3 w-3" />
                      {round.holes_played} holes
                    </span>
                    {round.round_type && (
                      <span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary text-xs">
                        {roundTypeLabels[round.round_type] || round.round_type}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold">
                    {formatScoreDisplay(round)}
                  </span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
