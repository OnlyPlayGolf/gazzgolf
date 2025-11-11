import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, Calendar, MapPin, Edit } from "lucide-react";
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
  fir_percentage: number;
  gir_percentage: number;
  updown_percentage: number;
  total_putts: number;
  three_putts: number;
  total_penalties: number;
}

const RoundSummary = () => {
  const { roundId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [roundOrigin, setRoundOrigin] = useState<string | null>(null);

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

      // Also fetch the round's origin, with fallback to pro_stats mapping
      const { data: roundData } = await supabase
        .from('rounds')
        .select('origin')
        .eq('id', roundId)
        .maybeSingle();

      let origin = roundData?.origin || null;

      // If there's a pro_stats_rounds mapping, treat it as pro_stats
      const { data: proLink } = await supabase
        .from('pro_stats_rounds')
        .select('id')
        .eq('external_round_id', roundId)
        .maybeSingle();

      if (proLink?.id) origin = 'pro_stats';
      setRoundOrigin(origin);
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

  const StatCard = ({ title, value, subtitle, progress }: any) => (
    <Card>
      <CardContent className="pt-6">
        <div className="space-y-2">
          <div className="text-sm text-muted-foreground">{title}</div>
          <div className="text-3xl font-bold">{value}</div>
          {subtitle && <div className="text-sm text-muted-foreground">{subtitle}</div>}
          {progress !== undefined && (
            <Progress value={progress} className="h-2" />
          )}
        </div>
      </CardContent>
    </Card>
  );

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
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate(`/rounds/${roundId}/${roundOrigin === 'pro_stats' ? 'pro-track' : 'stats'}`)}
              >
                <Edit size={16} />
              </Button>
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

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3">
          <StatCard
            title="FIR %"
            value={`${Math.round(summary.fir_percentage || 0)}%`}
            progress={summary.fir_percentage || 0}
          />
          <StatCard
            title="GIR %"
            value={`${Math.round(summary.gir_percentage || 0)}%`}
            progress={summary.gir_percentage || 0}
          />
          <StatCard
            title="Up & Down"
            value={`${Math.round(summary.updown_percentage || 0)}%`}
            progress={summary.updown_percentage || 0}
          />
          <StatCard
            title="Total Putts"
            value={summary.total_putts || 0}
            subtitle={`${(summary.total_putts / summary.holes_played).toFixed(1)} per hole`}
          />
          <StatCard
            title="3-Putts"
            value={summary.three_putts || 0}
          />
          <StatCard
            title="Penalties"
            value={summary.total_penalties || 0}
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

export default RoundSummary;
