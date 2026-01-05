import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Calendar, ChevronRight } from "lucide-react";
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

  const formatScore = (round: StatsRound) => {
    if (round.total_score === undefined) return "—";
    const diff = round.total_score - (round.total_par || 0);
    if (diff === 0) return "E";
    return diff > 0 ? `+${diff}` : `${diff}`;
  };

  const getScoreColor = (round: StatsRound) => {
    if (round.total_score === undefined) return "text-muted-foreground";
    const diff = round.total_score - (round.total_par || 0);
    return diff <= 0 ? "text-emerald-600" : "text-foreground";
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
          <div className="space-y-3">
            {rounds.map((round) => (
              <Card
                key={round.id}
                onClick={() => handleRoundClick(round.id)}
                className="cursor-pointer bg-gradient-to-br from-primary/5 via-primary/10 to-primary/5 border border-primary/20 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/10 active:scale-[0.98] transition-all"
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    {/* Left: Score */}
                    <div className="flex-shrink-0 w-14 text-center">
                      <div className={`text-2xl font-bold ${getScoreColor(round)}`}>
                        {formatScore(round)}
                      </div>
                    </div>
                    
                    {/* Middle: Details */}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-foreground truncate">
                        {round.course_name}
                      </h3>
                      <div className="flex items-center gap-1.5 mt-1 text-sm text-muted-foreground">
                        <span>{format(new Date(round.date_played), "MMM d, yyyy")}</span>
                        <span>·</span>
                        <span>{round.holes_played} holes</span>
                      </div>
                      {round.round_type && (
                        <div className="mt-1">
                          <span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary text-xs">
                            {roundTypeLabels[round.round_type] || round.round_type}
                          </span>
                        </div>
                      )}
                    </div>
                    
                    {/* Right: Chevron */}
                    <ChevronRight size={20} className="text-muted-foreground flex-shrink-0" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
