import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Calendar, MapPin, Trophy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface Round {
  id: string;
  course_name: string;
  date_played: string;
  tee_set: string;
  holes_played: number;
  total_score?: number;
  total_par?: number;
}

const Rounds = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [rounds, setRounds] = useState<Round[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRounds();
  }, []);

  const fetchRounds = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }

      const { data: roundsData, error: roundsError } = await supabase
        .from("rounds")
        .select("*")
        .eq("user_id", user.id)
        .order("date_played", { ascending: false });

      if (roundsError) throw roundsError;

      // Fetch summaries for each round
      const roundsWithScores = await Promise.all(
        (roundsData || []).map(async (round) => {
          const { data: summaryData } = await supabase
            .from("round_summaries")
            .select("total_score, total_par")
            .eq("round_id", round.id)
            .single();

          return {
            ...round,
            total_score: summaryData?.total_score,
            total_par: summaryData?.total_par,
          };
        })
      );

      setRounds(roundsWithScores);
    } catch (error: any) {
      toast({
        title: "Error loading rounds",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getScoreDisplay = (round: Round) => {
    if (!round.total_score || !round.total_par) return "In Progress";
    const diff = round.total_score - round.total_par;
    if (diff === 0) return "E";
    return diff > 0 ? `+${diff}` : `${diff}`;
  };

  return (
    <div className="pb-20 min-h-screen bg-background">
      <div className="p-4">
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-foreground mb-2">Round Tracker</h1>
              <p className="text-muted-foreground">Log and review your rounds</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Button onClick={() => navigate("/rounds/setup")} size="lg" variant="outline">
              <Plus className="mr-2" size={20} />
              New Round
            </Button>
            <Button onClick={() => navigate("/rounds/pro-setup")} size="lg" className="border-primary">
              <Plus className="mr-2" size={20} />
              Pro Round
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-8 text-muted-foreground">Loading rounds...</div>
        ) : rounds.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-12 text-center">
              <Trophy className="mx-auto mb-4 text-muted-foreground" size={48} />
              <h3 className="text-lg font-semibold mb-2">No rounds yet</h3>
              <p className="text-muted-foreground mb-4">
                Start tracking your golf rounds and improve your game
              </p>
              <Button onClick={() => navigate("/rounds/setup")}>
                <Plus className="mr-2" size={20} />
                Start Your First Round
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {rounds.map((round) => (
              <Card
                key={round.id}
                className="cursor-pointer hover:border-primary transition-colors"
                onClick={() => navigate(`/rounds/${round.id}/summary`)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <MapPin size={16} className="text-primary" />
                        <h3 className="font-semibold text-foreground">{round.course_name}</h3>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Calendar size={14} />
                          <span>{format(new Date(round.date_played), "MMM d, yyyy")}</span>
                        </div>
                        {round.tee_set && (
                          <span className="px-2 py-0.5 bg-muted rounded text-xs">
                            {round.tee_set}
                          </span>
                        )}
                        <span>{round.holes_played} holes</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-primary">
                        {getScoreDisplay(round)}
                      </div>
                      {round.total_score && (
                        <div className="text-sm text-muted-foreground">
                          {round.total_score}
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Rounds;
