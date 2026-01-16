import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ThumbsUp, MessageSquare, BarChart3, ChevronDown, RotateCcw, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { RoundCompletionModal } from "@/components/RoundCompletionModal";
import { RoundBottomTabBar } from "@/components/RoundBottomTabBar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

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

interface CourseHole {
  hole_number: number;
  par: number;
  stroke_index: number;
}

interface PlayerData {
  id: string;
  user_id: string;
  tee_color: string | null;
  handicap: number | null;
  display_name: string;
  username: string | null;
  scores: Map<number, number>;
  mulligans: Set<number>;
}

const RoundSummary = () => {
  const { roundId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [roundName, setRoundName] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [showCompletionModal, setShowCompletionModal] = useState(true);
  const [courseHoles, setCourseHoles] = useState<CourseHole[]>([]);
  const [holeScores, setHoleScores] = useState<Map<number, number>>(new Map());
  const [players, setPlayers] = useState<PlayerData[]>([]);
  const [expandedPlayerId, setExpandedPlayerId] = useState<string | null>(null);
  const [courseName, setCourseName] = useState<string>("");

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

      const { data: roundData } = await supabase
        .from('rounds')
        .select('origin, round_name, course_name, user_id, holes_played')
        .eq('id', roundId)
        .maybeSingle();

      setRoundName(roundData?.round_name || data.course_name);
      setCourseName(roundData?.course_name || data.course_name);

      // Fetch course holes for scorecard
      if (roundData?.course_name) {
        const { data: courseData } = await supabase
          .from("courses")
          .select("id")
          .eq("name", roundData.course_name)
          .single();

        if (courseData) {
          const { data: holesData } = await supabase
            .from("course_holes")
            .select("hole_number, par, stroke_index")
            .eq("course_id", courseData.id)
            .order("hole_number");

          if (holesData) {
            const filteredHoles = data.holes_played === 9 
              ? holesData.slice(0, 9) 
              : holesData;
            setCourseHoles(filteredHoles);
          }
        }
      }

      // Fetch all players
      const { data: playersData } = await supabase
        .from("round_players")
        .select("id, user_id, tee_color, handicap, is_guest, guest_name")
        .eq("round_id", roundId);

      if (playersData) {
        const registeredPlayerData = playersData.filter(p => !p.is_guest && p.user_id) || [];
        const guestPlayerData = playersData.filter(p => p.is_guest) || [];

        const userIds = registeredPlayerData.map(p => p.user_id!);
        const { data: profilesData } = await supabase
          .from("profiles")
          .select("id, display_name, username, handicap")
          .in("id", userIds);

        const profilesMap = new Map(profilesData?.map(p => [p.id, p]) || []);

        const { data: scoresData } = await supabase
          .from("holes")
          .select("hole_number, score, player_id, mulligan")
          .eq("round_id", roundId);

        const scoresMap = new Map<string, Map<number, number>>();
        const mulligansMap = new Map<string, Set<number>>();
        
        scoresData?.forEach((hole) => {
          if (hole.player_id) {
            if (!scoresMap.has(hole.player_id)) {
              scoresMap.set(hole.player_id, new Map());
            }
            scoresMap.get(hole.player_id)!.set(hole.hole_number, hole.score);
            
            if (hole.mulligan) {
              if (!mulligansMap.has(hole.player_id)) {
                mulligansMap.set(hole.player_id, new Set());
              }
              mulligansMap.get(hole.player_id)!.add(hole.hole_number);
            }
          }
        });

        const playersWithScores: PlayerData[] = registeredPlayerData.map(player => {
          const profile = profilesMap.get(player.user_id!);
          return {
            id: player.id,
            user_id: player.user_id!,
            tee_color: player.tee_color,
            handicap: player.handicap || (profile?.handicap ? parseFloat(profile.handicap) : null),
            display_name: profile?.display_name || profile?.username || "Player",
            username: profile?.username || null,
            scores: scoresMap.get(player.id) || new Map(),
            mulligans: mulligansMap.get(player.id) || new Set(),
          };
        });

        guestPlayerData.forEach(g => {
          playersWithScores.push({
            id: g.id,
            user_id: g.id,
            tee_color: g.tee_color,
            handicap: g.handicap,
            display_name: g.guest_name || "Guest",
            username: null,
            scores: scoresMap.get(g.id) || new Map(),
            mulligans: mulligansMap.get(g.id) || new Set(),
          });
        });

        setPlayers(playersWithScores);

        // Set current user's scores for modal
        if (roundData?.user_id) {
          const currentPlayer = playersWithScores.find(p => p.user_id === roundData.user_id);
          if (currentPlayer) {
            setHoleScores(currentPlayer.scores);
          }
        }

        if (playersWithScores.length > 0) {
          setExpandedPlayerId(playersWithScores[0].id);
        }
      }
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

  const hasPlayerConcededAnyHole = (player: PlayerData): boolean => {
    for (const score of player.scores.values()) {
      if (score === -1) return true;
    }
    return false;
  };

  const calculateTotals = (player: PlayerData, holes: CourseHole[]) => {
    let totalScore = 0;
    let totalPar = 0;
    let holesCompleted = 0;

    holes.forEach(hole => {
      const score = player.scores.get(hole.hole_number);
      if (score && score > 0) {
        totalScore += score;
        totalPar += hole.par;
        holesCompleted++;
      }
    });

    return { totalScore, totalPar, holesCompleted };
  };

  const getScoreToPar = (score: number, par: number) => {
    const diff = score - par;
    if (diff === 0) return "E";
    if (diff > 0) return `+${diff}`;
    return diff.toString();
  };

  const getPlayerScoreToParDisplay = (player: PlayerData) => {
    if (hasPlayerConcededAnyHole(player)) return "-";
    
    const totals = calculateTotals(player, courseHoles);
    if (totals.totalScore > 0) {
      return getScoreToPar(totals.totalScore, totals.totalPar);
    }
    return "E";
  };

  if (loading) return <div className="p-4">Loading...</div>;
  if (!summary) return <div className="p-4">No data found</div>;

  const frontNine = courseHoles.slice(0, 9);
  const backNine = courseHoles.slice(9, 18);

  return (
    <div className="min-h-screen pb-24 bg-background">
      {/* Header - Spectator style (read-only) */}
      <div className="bg-primary text-primary-foreground p-4">
        <div className="relative flex items-center justify-center">
          <Button
            variant="ghost"
            size="icon"
            className="absolute left-0 text-primary-foreground hover:bg-primary-foreground/20"
            onClick={() => navigate("/rounds")}
          >
            <ArrowLeft size={20} />
          </Button>
          <div className="text-center">
            <h2 className="text-lg font-bold">{courseName}</h2>
            <p className="text-sm opacity-90">Stroke Play NET</p>
          </div>
        </div>
      </div>

      {/* Leaderboard content - Spectator mode (read-only) */}
      <div className="max-w-4xl mx-auto p-4 space-y-4">
        {(() => {
          const playersWithTotals = players.map(player => {
            const totals = calculateTotals(player, courseHoles);
            const hasConceded = hasPlayerConcededAnyHole(player);
            const scoreToPar = hasConceded ? Infinity : (totals.totalScore > 0 ? totals.totalScore - totals.totalPar : Infinity);
            return { player, scoreToPar, hasConceded };
          });
          
          const sorted = [...playersWithTotals].sort((a, b) => a.scoreToPar - b.scoreToPar);
          
          const getPositionLabel = (scoreToPar: number, hasConceded: boolean): string => {
            if (hasConceded) return "-";
            
            const playersAhead = sorted.filter(p => p.scoreToPar < scoreToPar).length;
            const position = playersAhead + 1;
            const sameScoreCount = sorted.filter(p => p.scoreToPar === scoreToPar && !p.hasConceded).length;
            if (sameScoreCount > 1) {
              return `T${position}`;
            }
            return `${position}`;
          };

          return sorted.map(({ player, scoreToPar, hasConceded }) => {
            const isExpanded = expandedPlayerId === player.id;
            const frontTotals = calculateTotals(player, frontNine);
            const backTotals = calculateTotals(player, backNine);
            const overallTotals = calculateTotals(player, courseHoles);
            const positionLabel = getPositionLabel(scoreToPar, hasConceded);

            return (
              <Card key={player.id} className="overflow-hidden">
                <div 
                  className="bg-card border-b border-border p-4 cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => setExpandedPlayerId(isExpanded ? null : player.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <ChevronDown 
                        size={20} 
                        className={`text-muted-foreground transition-transform ${isExpanded ? '' : '-rotate-90'}`}
                      />
                      <div className="bg-muted rounded-full w-10 h-10 flex items-center justify-center text-sm font-bold">
                        {positionLabel}
                      </div>
                      <div>
                        <div className="text-xl font-bold">{player.display_name}</div>
                        <div className="text-sm text-muted-foreground">
                          HCP {Number(player.handicap) === 0 ? '0' : `+${player.handicap ? Math.abs(Number(player.handicap)) : 0}`}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-3xl font-bold">
                        {getPlayerScoreToParDisplay(player)}
                      </div>
                      <div className="text-sm text-muted-foreground">TO PAR</div>
                    </div>
                  </div>
                </div>

                {isExpanded && (
                  <>
                    {/* Front 9 */}
                    <div className="w-full">
                      <Table className="w-full table-fixed">
                        <TableHeader>
                          <TableRow className="bg-primary">
                            <TableHead className="text-center font-bold text-[10px] px-0.5 py-1.5 bg-primary text-primary-foreground w-[44px]">Hole</TableHead>
                            {frontNine.map(hole => (
                              <TableHead key={hole.hole_number} className="text-center font-bold text-[10px] px-0 py-1.5 bg-primary text-primary-foreground">
                                {hole.hole_number}
                              </TableHead>
                            ))}
                            <TableHead className="text-center font-bold text-[10px] px-0 py-1.5 bg-primary text-primary-foreground">Out</TableHead>
                            <TableHead className="text-center font-bold text-[10px] px-0 py-1.5 bg-primary text-primary-foreground">
                              {backNine.length > 0 ? '' : 'Tot'}
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          <TableRow>
                            <TableCell className="font-medium text-muted-foreground text-[10px] px-0.5 py-1 bg-background">HCP</TableCell>
                            {frontNine.map(hole => (
                              <TableCell key={hole.hole_number} className="text-center text-[10px] px-0 py-1">
                                {hole.stroke_index}
                              </TableCell>
                            ))}
                            <TableCell className="text-center bg-muted text-[10px] px-0 py-1"></TableCell>
                            <TableCell className="text-center bg-muted text-[10px] px-0 py-1"></TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell className="font-medium text-muted-foreground text-[10px] px-0.5 py-1 bg-background">Par</TableCell>
                            {frontNine.map(hole => (
                              <TableCell key={hole.hole_number} className="text-center font-semibold text-[10px] px-0 py-1">
                                {hole.par}
                              </TableCell>
                            ))}
                            <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1">
                              {frontNine.reduce((sum, h) => sum + h.par, 0)}
                            </TableCell>
                            <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1">
                              {backNine.length > 0 ? '' : frontNine.reduce((sum, h) => sum + h.par, 0)}
                            </TableCell>
                          </TableRow>
                          <TableRow className="font-bold">
                            <TableCell className="font-bold text-[10px] px-0.5 py-1 bg-background max-w-[44px] truncate">{player.display_name.split(' ')[0]}</TableCell>
                            {frontNine.map(hole => {
                              const score = player.scores.get(hole.hole_number);
                              const hasScore = player.scores.has(hole.hole_number);
                              const hasMulligan = player.mulligans.has(hole.hole_number);
                              return (
                                <TableCell 
                                  key={hole.hole_number} 
                                  className="text-center font-bold text-[10px] px-0 py-1"
                                >
                                  <div className="flex items-center justify-center gap-0.5">
                                    {hasScore ? (score === -1 ? '–' : (score === 0 ? '-' : score)) : ''}
                                    {hasMulligan && <RotateCcw size={8} className="text-amber-500" />}
                                  </div>
                                </TableCell>
                              );
                            })}
                            <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1">
                              {hasConceded ? '-' : (frontTotals.totalScore > 0 ? frontTotals.totalScore : '')}
                            </TableCell>
                            <TableCell className="text-center font-bold bg-primary text-primary-foreground text-[10px] px-0 py-1">
                              {backNine.length > 0 ? '' : (hasConceded ? '-' : (overallTotals.totalScore > 0 ? overallTotals.totalScore : ''))}
                            </TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell className="font-medium text-muted-foreground text-[10px] px-0.5 py-1 bg-background">Net</TableCell>
                            {frontNine.map(hole => {
                              const score = player.scores.get(hole.hole_number);
                              const hasScore = player.scores.has(hole.hole_number);
                              return (
                                <TableCell key={hole.hole_number} className="text-center text-[10px] px-0 py-1">
                                  {hasScore ? (score === -1 ? '–' : (score === 0 ? '-' : score)) : ''}
                                </TableCell>
                              );
                            })}
                            <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1">
                              {hasConceded ? '-' : (frontTotals.totalScore > 0 ? frontTotals.totalScore : '')}
                            </TableCell>
                            <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1">
                              {backNine.length > 0 ? '' : (hasConceded ? '-' : (overallTotals.totalScore > 0 ? overallTotals.totalScore : ''))}
                            </TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </div>

                    {/* Back 9 */}
                    {courseHoles.length === 18 && backNine.length > 0 && (
                      <div className="w-full border-t">
                        <Table className="w-full table-fixed">
                          <TableHeader>
                            <TableRow className="bg-primary">
                              <TableHead className="text-center font-bold text-[10px] px-0.5 py-1.5 bg-primary text-primary-foreground w-[44px]">Hole</TableHead>
                              {backNine.map(hole => (
                                <TableHead key={hole.hole_number} className="text-center font-bold text-[10px] px-0 py-1.5 bg-primary text-primary-foreground">
                                  {hole.hole_number}
                                </TableHead>
                              ))}
                              <TableHead className="text-center font-bold text-[10px] px-0 py-1.5 bg-primary text-primary-foreground">In</TableHead>
                              <TableHead className="text-center font-bold text-[10px] px-0 py-1.5 bg-primary text-primary-foreground">Tot</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            <TableRow>
                              <TableCell className="font-medium text-muted-foreground text-[10px] px-0.5 py-1 bg-background">HCP</TableCell>
                              {backNine.map(hole => (
                                <TableCell key={hole.hole_number} className="text-center text-[10px] px-0 py-1">
                                  {hole.stroke_index}
                                </TableCell>
                              ))}
                              <TableCell className="text-center bg-muted text-[10px] px-0 py-1"></TableCell>
                              <TableCell className="text-center bg-muted text-[10px] px-0 py-1"></TableCell>
                            </TableRow>
                            <TableRow>
                              <TableCell className="font-medium text-muted-foreground text-[10px] px-0.5 py-1 bg-background">Par</TableCell>
                              {backNine.map(hole => (
                                <TableCell key={hole.hole_number} className="text-center font-semibold text-[10px] px-0 py-1">
                                  {hole.par}
                                </TableCell>
                              ))}
                              <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1">
                                {backNine.reduce((sum, h) => sum + h.par, 0)}
                              </TableCell>
                              <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1">
                                {courseHoles.reduce((sum, h) => sum + h.par, 0)}
                              </TableCell>
                            </TableRow>
                            <TableRow className="font-bold">
                              <TableCell className="font-bold text-[10px] px-0.5 py-1 bg-background max-w-[44px] truncate">{player.display_name.split(' ')[0]}</TableCell>
                              {backNine.map(hole => {
                                const score = player.scores.get(hole.hole_number);
                                const hasScore = player.scores.has(hole.hole_number);
                                const hasMulligan = player.mulligans.has(hole.hole_number);
                                return (
                                  <TableCell 
                                    key={hole.hole_number} 
                                    className="text-center font-bold text-[10px] px-0 py-1"
                                  >
                                    <div className="flex items-center justify-center gap-0.5">
                                      {hasScore ? (score === -1 ? '–' : (score === 0 ? '-' : score)) : ''}
                                      {hasMulligan && <RotateCcw size={8} className="text-amber-500" />}
                                    </div>
                                  </TableCell>
                                );
                              })}
                              <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1">
                                {hasConceded ? '-' : (backTotals.totalScore > 0 ? backTotals.totalScore : '')}
                              </TableCell>
                              <TableCell className="text-center font-bold bg-primary text-primary-foreground text-[10px] px-0 py-1">
                                {hasConceded ? '-' : (overallTotals.totalScore > 0 ? overallTotals.totalScore : '')}
                              </TableCell>
                            </TableRow>
                            <TableRow>
                              <TableCell className="font-medium text-muted-foreground text-[10px] px-0.5 py-1 bg-background">Net</TableCell>
                              {backNine.map(hole => {
                                const score = player.scores.get(hole.hole_number);
                                const hasScore = player.scores.has(hole.hole_number);
                                return (
                                  <TableCell key={hole.hole_number} className="text-center text-[10px] px-0 py-1">
                                    {hasScore ? (score === -1 ? '–' : (score === 0 ? '-' : score)) : ''}
                                  </TableCell>
                                );
                              })}
                              <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1">
                                {hasConceded ? '-' : (backTotals.totalScore > 0 ? backTotals.totalScore : '')}
                              </TableCell>
                              <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1">
                                {hasConceded ? '-' : (overallTotals.totalScore > 0 ? overallTotals.totalScore : '')}
                              </TableCell>
                            </TableRow>
                          </TableBody>
                        </Table>
                      </div>
                    )}

                    {/* Action Buttons - Disabled in spectator mode */}
                    <div className="border-t p-4">
                      <div className="flex items-center justify-around opacity-50">
                        <Button variant="ghost" size="sm" className="flex-col h-auto gap-1 pointer-events-none">
                          <ThumbsUp size={20} className="text-primary" />
                          <span className="text-xs">Like</span>
                        </Button>
                        <Button variant="ghost" size="sm" className="flex-col h-auto gap-1 pointer-events-none">
                          <MessageSquare size={20} className="text-primary" />
                          <span className="text-xs">Comment to<br/>Game Feed</span>
                        </Button>
                        <Button variant="ghost" size="sm" className="flex-col h-auto gap-1 pointer-events-none">
                          <BarChart3 size={20} className="text-primary" />
                          <span className="text-xs">Statistics</span>
                        </Button>
                      </div>
                    </div>
                  </>
                )}
              </Card>
            );
          });
        })()}
      </div>

      <RoundBottomTabBar roundId={roundId!} isSpectator={true} />

      {/* Completion Modal */}
      <RoundCompletionModal
        open={showCompletionModal}
        onOpenChange={setShowCompletionModal}
        courseName={summary.course_name}
        datePlayed={summary.date_played}
        holesPlayed={summary.holes_played}
        totalScore={summary.total_score}
        scoreVsPar={summary.score_vs_par}
        totalPar={summary.total_par}
        courseHoles={courseHoles}
        holeScores={holeScores}
        roundId={roundId}
        roundName={roundName}
        onContinue={() => navigate("/rounds")}
      />
    </div>
  );
};

export default RoundSummary;
