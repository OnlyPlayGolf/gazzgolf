import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, Calendar, MapPin } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface Summary {
  round_id: string;
  course_name: string;
  date_played: string;
  tee_set: string;
  holes_played: number;
  total_score: number;
  total_par: number;
  score_vs_par: number;
}

const ProRoundSummary = () => {
  const { roundId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSummary();
  }, [roundId]);

  const fetchSummary = async () => {
    try {
      const { data, error } = await supabase
        .from("round_summaries")
        .select("*")
        .eq("round_id", roundId)
        .single();

      if (error) throw error;
      setSummary(data);
    } catch (error: any) {
      toast({
        title: "Error loading summary",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="p-4">Loading...</div>;
  if (!summary) return <div className="p-4">No data found</div>;

  const getScoreColor = (diff: number) => {
    if (diff <= 0) return "text-green-500";
    if (diff <= 5) return "text-yellow-500";
    return "text-red-500";
  };

  const StatCard = ({ title, value, subtitle, color }: any) => (
    <Card>
      <CardContent className="pt-6">
        <div className="space-y-2">
          <div className="text-sm text-muted-foreground">{title}</div>
          <div className={`text-3xl font-bold ${color || ""}`}>{value}</div>
          {subtitle && <div className="text-sm text-muted-foreground">{subtitle}</div>}
        </div>
      </CardContent>
    </Card>
  );

  // Mock strokes gained data (would come from stored shot data)
  const sgData = {
    offTheTee: 0.5,
    approach: -0.3,
    shortGame: 0.2,
    putting: -0.1,
    total: 0.3,
  };

  return (
    <div className="pb-20 min-h-screen bg-background">
      <div className="p-4 space-y-4">
        <Button variant="ghost" onClick={() => navigate("/rounds")}>
          <ArrowLeft className="mr-2" size={20} />
          Back to Rounds
        </Button>

        {/* Header */}
        <Card className="bg-primary/10 border-primary">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <MapPin size={18} className="text-primary" />
                  <CardTitle>{summary.course_name}</CardTitle>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar size={14} />
                  <span>{format(new Date(summary.date_played), "MMMM d, yyyy")}</span>
                  {summary.tee_set && (
                    <>
                      <span>•</span>
                      <span>{summary.tee_set} Tees</span>
                    </>
                  )}
                  <span>•</span>
                  <span>{summary.holes_played} holes</span>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-muted-foreground mb-1">Score</div>
                <div className="text-4xl font-bold">{summary.total_score}</div>
              </div>
              <div className="text-right">
                <div className="text-sm text-muted-foreground mb-1">vs Par</div>
                <div className={`text-4xl font-bold ${getScoreColor(summary.score_vs_par)}`}>
                  {summary.score_vs_par === 0 ? "E" : 
                   summary.score_vs_par > 0 ? `+${summary.score_vs_par}` : 
                   summary.score_vs_par}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Strokes Gained Summary */}
        <Card className="border-primary">
          <CardHeader>
            <CardTitle>Strokes Gained Analysis</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <StatCard
              title="Total Strokes Gained"
              value={sgData.total >= 0 ? `+${sgData.total.toFixed(1)}` : sgData.total.toFixed(1)}
              color={sgData.total >= 0 ? "text-green-500" : "text-red-500"}
            />
          </CardContent>
        </Card>

        {/* SG Breakdown */}
        <div className="grid grid-cols-2 gap-3">
          <StatCard
            title="Off the Tee"
            value={sgData.offTheTee >= 0 ? `+${sgData.offTheTee.toFixed(1)}` : sgData.offTheTee.toFixed(1)}
            color={sgData.offTheTee >= 0 ? "text-green-500" : "text-red-500"}
          />
          <StatCard
            title="Approach"
            value={sgData.approach >= 0 ? `+${sgData.approach.toFixed(1)}` : sgData.approach.toFixed(1)}
            color={sgData.approach >= 0 ? "text-green-500" : "text-red-500"}
          />
          <StatCard
            title="Short Game"
            value={sgData.shortGame >= 0 ? `+${sgData.shortGame.toFixed(1)}` : sgData.shortGame.toFixed(1)}
            color={sgData.shortGame >= 0 ? "text-green-500" : "text-red-500"}
          />
          <StatCard
            title="Putting"
            value={sgData.putting >= 0 ? `+${sgData.putting.toFixed(1)}` : sgData.putting.toFixed(1)}
            color={sgData.putting >= 0 ? "text-green-500" : "text-red-500"}
          />
        </div>

        <Button 
          onClick={() => navigate("/rounds")} 
          className="w-full" 
          size="lg"
        >
          Done
        </Button>
      </div>
    </div>
  );
};

export default ProRoundSummary;
