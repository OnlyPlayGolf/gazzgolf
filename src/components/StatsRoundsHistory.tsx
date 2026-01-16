import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Calendar, ChevronRight } from "lucide-react";
import { format } from "date-fns";

interface StatsRound {
  id: string;
  proStatsRoundId: string;
  externalRoundId: string | null;
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

      // Fetch all pro_stats_rounds (regardless of origin)
      const { data: proStatsRounds, error: proStatsError } = await supabase
        .from("pro_stats_rounds")
        .select("id, external_round_id, course_name, holes_played, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (proStatsError) throw proStatsError;

      if (!proStatsRounds || proStatsRounds.length === 0) {
        setRounds([]);
        setLoading(false);
        return;
      }

      // Get scores and round details for each pro_stats_round
      const roundsWithScores = await Promise.all(
        proStatsRounds.map(async (proRound) => {
          // Get hole scores
          const { data: holes } = await supabase
            .from("pro_stats_holes")
            .select("score, par, hole_number")
            .eq("pro_round_id", proRound.id)
            .order("hole_number", { ascending: true });

          if (!holes || holes.length === 0) {
            return null;
          }

          const totalScore = holes.reduce((sum, h) => sum + (h.score || 0), 0);
          const totalPar = holes.reduce((sum, h) => sum + (h.par || 0), 0);

          // Try to get additional details from rounds table if external_round_id exists
          let datePlayed: string = proRound.created_at || new Date().toISOString();
          let teeSet: string | null = null;
          let roundType: string | null = null;
          let roundId = proRound.external_round_id || proRound.id;

          if (proRound.external_round_id) {
            const { data: roundData } = await supabase
              .from("rounds")
              .select("id, date_played, tee_set, round_type")
              .eq("id", proRound.external_round_id)
              .maybeSingle();

            if (roundData) {
              datePlayed = roundData.date_played || datePlayed;
              teeSet = roundData.tee_set;
              roundType = roundData.round_type;
            }
          }
          return {
            id: roundId || proRound.id,
            proStatsRoundId: proRound.id,
            externalRoundId: proRound.external_round_id,
            course_name: proRound.course_name || "Unknown Course",
            date_played: datePlayed || new Date().toISOString(),
            holes_played: proRound.holes_played || 18,
            tee_set: teeSet,
            round_type: roundType,
            total_score: totalScore,
            total_par: totalPar,
          };
        })
      );

      // Filter out nulls and sort by date
      const validRounds = roundsWithScores
        .filter((r): r is StatsRound => r !== null)
        .sort((a, b) => {
          const dateA = new Date(a.date_played).getTime();
          const dateB = new Date(b.date_played).getTime();
          return dateB - dateA;
        });

      setRounds(validRounds);
    } catch (error) {
      console.error("Error fetching stats rounds:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleRoundClick = (round: StatsRound) => {
    // Only navigate if the parent round exists
    if (round.externalRoundId) {
      navigate(`/rounds/${round.externalRoundId}/pro-summary`);
    }
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
          <div className="space-y-4">
            {(() => {
              // Group rounds by year
              const roundsByYear = rounds.reduce((acc, round) => {
                const year = new Date(round.date_played).getFullYear().toString();
                if (!acc[year]) acc[year] = [];
                acc[year].push(round);
                return acc;
              }, {} as Record<string, StatsRound[]>);

              // Sort years descending (most recent first)
              const sortedYears = Object.keys(roundsByYear).sort((a, b) => parseInt(b) - parseInt(a));

              return sortedYears.map((year) => (
                <section key={year}>
                  <h2 className="text-lg font-semibold text-foreground mb-2 px-1">{year}</h2>
                  <div className="space-y-3">
                    {roundsByYear[year].map((round) => (
                      <Card
                        key={round.id}
                        onClick={() => handleRoundClick(round)}
                        className={`bg-gradient-to-br from-primary/5 via-primary/10 to-primary/5 border border-primary/20 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/10 active:scale-[0.98] transition-all ${
                          !round.externalRoundId ? 'border-destructive/30 bg-destructive/5' : 'cursor-pointer'
                        }`}
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
                              <div className="flex items-center gap-2">
                                <h3 className="font-semibold text-foreground truncate">
                                  {round.course_name}
                                </h3>
                                {!round.externalRoundId && (
                                  <span className="px-1.5 py-0.5 rounded bg-destructive/10 text-destructive text-xs">
                                    Deleted
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-1.5 mt-1 text-sm text-muted-foreground">
                                <span>{format(new Date(round.date_played), "MMM d")}</span>
                                <span>·</span>
                                <span>{round.holes_played} holes</span>
                              </div>
                              {round.round_type && (
                                <div className="mt-1">
                                  <span className="px-1.5 py-0.5 rounded bg-primary text-primary-foreground text-primary text-xs">
                                    {roundTypeLabels[round.round_type] || round.round_type}
                                  </span>
                                </div>
                              )}
                            </div>
                            
                            {/* Right: Chevron */}
                            {round.externalRoundId && (
                              <ChevronRight size={20} className="text-muted-foreground flex-shrink-0" />
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </section>
              ));
            })()}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
