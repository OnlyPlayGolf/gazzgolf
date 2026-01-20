import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Target, Trophy, Calendar, TrendingUp, Info, BarChart3, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FadeSlide } from "@/components/motion/FadeSlide";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { TopNavBar } from "@/components/TopNavBar";
import { formatDistanceToNow } from "date-fns";

interface DrillResultData {
  id: string;
  drill_id: string;
  user_id: string;
  total_points: number;
  attempts_json: any;
  created_at: string;
  drill?: {
    title: string;
    short_desc: string | null;
    long_desc: string | null;
    lower_is_better: boolean | null;
  };
  profile?: {
    display_name: string | null;
    username: string | null;
    avatar_url: string | null;
  };
}

interface HistoryEntry {
  id: string;
  total_points: number;
  created_at: string;
}

export default function DrillResultDetail() {
  const { resultId } = useParams<{ resultId: string }>();
  const navigate = useNavigate();
  const [result, setResult] = useState<DrillResultData | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [personalBest, setPersonalBest] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUserId(user?.id || null);

      if (!resultId) {
        setLoading(false);
        return;
      }

      try {
        // Fetch the drill result
        const { data: resultData, error: resultError } = await supabase
          .from("drill_results")
          .select("*")
          .eq("id", resultId)
          .single();

        if (resultError) throw resultError;

        // Fetch drill info
        const { data: drillData } = await supabase
          .from("drills")
          .select("title, short_desc, long_desc, lower_is_better")
          .eq("id", resultData.drill_id)
          .single();

        // Fetch user profile
        const { data: profileData } = await supabase
          .from("profiles")
          .select("display_name, username, avatar_url")
          .eq("id", resultData.user_id)
          .single();

        setResult({
          ...resultData,
          drill: drillData || undefined,
          profile: profileData || undefined
        });

        // Fetch user's history for this drill (last 10 attempts)
        const { data: historyData } = await supabase
          .from("drill_results")
          .select("id, total_points, created_at")
          .eq("drill_id", resultData.drill_id)
          .eq("user_id", resultData.user_id)
          .order("created_at", { ascending: false })
          .limit(10);

        if (historyData) {
          setHistory(historyData);
          
          // Calculate personal best
          const lowerIsBetter = drillData?.lower_is_better ?? false;
          const best = historyData.reduce((best, h) => {
            if (best === null) return h.total_points;
            return lowerIsBetter 
              ? Math.min(best, h.total_points)
              : Math.max(best, h.total_points);
          }, null as number | null);
          setPersonalBest(best);
        }

      } catch (error) {
        console.error("Error fetching drill result:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [resultId]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const isPersonalBest = result && personalBest !== null && result.total_points === personalBest;
  const lowerIsBetter = result?.drill?.lower_is_better ?? false;

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <TopNavBar />
        <div className="flex items-center justify-center pt-32">
          <div className="text-muted-foreground">Loading result...</div>
        </div>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="min-h-screen bg-background">
        <TopNavBar />
        <div className="flex flex-col items-center justify-center pt-32 gap-4">
          <div className="text-muted-foreground">Result not found</div>
          <Button onClick={() => navigate(-1)}>Go Back</Button>
        </div>
      </div>
    );
  }

  const playerName = result.profile?.display_name || result.profile?.username || "Player";
  const drillTitle = result.drill?.title || "Drill";

  return (
    <div className="min-h-screen bg-background pb-20">
      <TopNavBar />
      
      {/* Header */}
      <div className="bg-card border-b border-border pt-16">
        <div className="p-4 max-w-2xl mx-auto">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(-1)}
            className="mb-3 -ml-2"
          >
            <ArrowLeft size={20} className="mr-1" />
            Back
          </Button>
          
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold mb-1">{drillTitle}</h1>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Target size={14} />
                  Drill Result
                </span>
                <span className="flex items-center gap-1">
                  <Calendar size={14} />
                  {formatDate(result.created_at)}
                </span>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                by {playerName}
              </p>
            </div>
            {isPersonalBest && (
              <Badge className="bg-amber-500 text-white">
                <Trophy size={12} className="mr-1" />
                Personal Best
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-2xl mx-auto p-4">
        <Tabs defaultValue="results" className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-4">
            <TabsTrigger value="results">Results</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
            <TabsTrigger value="info">Info</TabsTrigger>
          </TabsList>

          {/* Results Tab */}
          <TabsContent value="results" className="space-y-4">
            <FadeSlide>
            {/* Score Card */}
            <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
              <CardContent className="p-6 text-center">
                <div className="text-5xl font-bold text-primary mb-2">
                  {result.total_points}
                </div>
                <div className="text-muted-foreground">points</div>
                {isPersonalBest && (
                  <div className="flex items-center justify-center gap-1 mt-3 text-amber-600">
                    <Trophy size={16} />
                    <span className="text-sm font-semibold">Personal Best!</span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Attempts Breakdown */}
            {result.attempts_json && Array.isArray(result.attempts_json) && result.attempts_json.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <BarChart3 size={18} />
                    Attempt Breakdown
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {result.attempts_json.map((attempt: any, index: number) => (
                    <div 
                      key={index}
                      className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <span className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-medium">
                          {index + 1}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          {attempt.distance && `${attempt.distance}m`}
                          {attempt.description && attempt.description}
                        </span>
                      </div>
                      <span className={`font-bold ${
                        attempt.points > 0 ? 'text-primary' : 
                        attempt.points < 0 ? 'text-destructive' : 
                        'text-muted-foreground'
                      }`}>
                        {attempt.points > 0 ? '+' : ''}{attempt.points ?? attempt.score ?? 0}
                      </span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Summary Stats */}
            <Card>
              <CardContent className="p-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs font-medium text-muted-foreground uppercase">Date</div>
                    <div className="font-medium">{formatDate(result.created_at)}</div>
                  </div>
                  <div>
                    <div className="text-xs font-medium text-muted-foreground uppercase">Time</div>
                    <div className="font-medium">
                      {new Date(result.created_at).toLocaleTimeString('en-US', {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </div>
                  </div>
                  {personalBest !== null && (
                    <>
                      <div>
                        <div className="text-xs font-medium text-muted-foreground uppercase">Personal Best</div>
                        <div className="font-medium text-primary">{personalBest} pts</div>
                      </div>
                      <div>
                        <div className="text-xs font-medium text-muted-foreground uppercase">vs Best</div>
                        <div className={`font-medium ${
                          result.total_points === personalBest ? 'text-amber-600' :
                          (lowerIsBetter ? result.total_points < personalBest : result.total_points > personalBest) 
                            ? 'text-green-600' : 'text-muted-foreground'
                        }`}>
                          {result.total_points === personalBest ? 'PB!' : 
                            `${result.total_points - personalBest > 0 ? '+' : ''}${result.total_points - personalBest} pts`
                          }
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
            </FadeSlide>
          </TabsContent>

          {/* History Tab */}
          <TabsContent value="history" className="space-y-4">
            <FadeSlide>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Clock size={18} />
                  Recent Attempts
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {history.length > 0 ? (
                  history.map((h, index) => {
                    const isCurrent = h.id === result.id;
                    const isPB = h.total_points === personalBest;
                    return (
                      <div 
                        key={h.id}
                        className={`flex items-center justify-between p-3 rounded-lg transition-colors ${
                          isCurrent ? 'bg-primary text-primary-foreground border border-primary/20' : 'bg-muted/50'
                        }`}
                        onClick={() => !isCurrent && navigate(`/drill-result/${h.id}`)}
                      >
                        <div className="flex items-center gap-3">
                          <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                            isPB ? 'bg-amber-500 text-white' : 'bg-muted'
                          }`}>
                            {isPB ? <Trophy size={14} /> : index + 1}
                          </span>
                          <div>
                            <span className="text-sm font-medium">
                              {formatDistanceToNow(new Date(h.created_at), { addSuffix: true })}
                            </span>
                            {isCurrent && (
                              <Badge variant="secondary" className="ml-2 text-xs">Current</Badge>
                            )}
                          </div>
                        </div>
                        <span className={`font-bold ${
                          isPB ? 'text-amber-600' : 'text-foreground'
                        }`}>
                          {h.total_points} pts
                        </span>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-muted-foreground text-center py-4">No history available</p>
                )}
              </CardContent>
            </Card>

            {/* Progress Summary */}
            {history.length > 1 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <TrendingUp size={18} />
                    Progress
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <div className="text-2xl font-bold text-primary">{history.length}</div>
                      <div className="text-xs text-muted-foreground">Attempts</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-amber-600">{personalBest}</div>
                      <div className="text-xs text-muted-foreground">Best Score</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-muted-foreground">
                        {Math.round(history.reduce((sum, h) => sum + h.total_points, 0) / history.length)}
                      </div>
                      <div className="text-xs text-muted-foreground">Average</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
            </FadeSlide>
          </TabsContent>

          {/* Info Tab */}
          <TabsContent value="info" className="space-y-4">
            <FadeSlide>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Info size={18} />
                  About This Drill
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h3 className="font-semibold mb-2">{drillTitle}</h3>
                  {result.drill?.short_desc && (
                    <p className="text-sm text-muted-foreground mb-3">
                      {result.drill.short_desc}
                    </p>
                  )}
                  {result.drill?.long_desc && (
                    <p className="text-sm text-muted-foreground">
                      {result.drill.long_desc}
                    </p>
                  )}
                </div>

                <div className="border-t border-border pt-4">
                  <h4 className="font-semibold mb-2">Scoring</h4>
                  <p className="text-sm text-muted-foreground">
                    {lowerIsBetter 
                      ? "Lower scores are better. Aim for the lowest point total."
                      : "Higher scores are better. Aim for the highest point total."
                    }
                  </p>
                </div>
              </CardContent>
            </Card>
            </FadeSlide>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}