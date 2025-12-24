import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { RoundBottomTabBar } from "@/components/RoundBottomTabBar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ThumbsUp, MessageSquare, BarChart3, ChevronDown } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface Round {
  id: string;
  course_name: string;
  tee_set: string;
  holes_played: number;
  date_played: string;
  user_id: string;
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
}

export default function RoundLeaderboard() {
  const { roundId } = useParams();
  const { toast } = useToast();
  
  const [round, setRound] = useState<Round | null>(null);
  const [courseHoles, setCourseHoles] = useState<CourseHole[]>([]);
  const [players, setPlayers] = useState<PlayerData[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedPlayerId, setExpandedPlayerId] = useState<string | null>(null);

  useEffect(() => {
    if (roundId) {
      fetchRoundData();
    }
  }, [roundId]);

  const fetchRoundData = async () => {
    try {
      // Fetch round details
      const { data: roundData, error: roundError } = await supabase
        .from("rounds")
        .select("*")
        .eq("id", roundId)
        .single();

      if (roundError) throw roundError;
      setRound(roundData);

      // Fetch course holes
      const { data: courseData, error: courseError } = await supabase
        .from("courses")
        .select("id")
        .eq("name", roundData.course_name)
        .single();

      if (courseError) throw courseError;

      const { data: holesData, error: holesError } = await supabase
        .from("course_holes")
        .select("hole_number, par, stroke_index")
        .eq("course_id", courseData.id)
        .order("hole_number");

      if (holesError) throw holesError;
      
      // Filter holes based on holes_played
      let filteredHoles = holesData;
      if (roundData.holes_played === 9) {
        filteredHoles = holesData.slice(0, 9);
      }
      
      setCourseHoles(filteredHoles);

      // Fetch players and their scores
      const { data: playersData, error: playersError } = await supabase
        .from("round_players")
        .select("id, user_id, tee_color, handicap")
        .eq("round_id", roundId);

      if (playersError) throw playersError;

      // Fetch profiles for each player
      const userIds = playersData.map(p => p.user_id);
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("id, display_name, username, handicap")
        .in("id", userIds);

      const profilesMap = new Map(profilesData?.map(p => [p.id, p]) || []);

      // Fetch all scores
      const { data: scoresData } = await supabase
        .from("holes")
        .select("hole_number, score, player_id")
        .eq("round_id", roundId);

      const scoresMap = new Map<string, Map<number, number>>();
      scoresData?.forEach((hole) => {
        if (hole.player_id) {
          if (!scoresMap.has(hole.player_id)) {
            scoresMap.set(hole.player_id, new Map());
          }
          scoresMap.get(hole.player_id)!.set(hole.hole_number, hole.score);
        }
      });

      // Combine all player data
      const playersWithScores: PlayerData[] = playersData.map(player => {
        const profile = profilesMap.get(player.user_id);
        return {
          id: player.id,
          user_id: player.user_id,
          tee_color: player.tee_color,
          handicap: player.handicap || (profile?.handicap ? parseFloat(profile.handicap) : null),
          display_name: profile?.display_name || profile?.username || "Player",
          username: profile?.username || null,
          scores: scoresMap.get(player.id) || new Map(),
        };
      });

      setPlayers(playersWithScores);
      
      // Auto-expand first player
      if (playersWithScores.length > 0) {
        setExpandedPlayerId(playersWithScores[0].id);
      }
    } catch (error: any) {
      console.error("Error fetching round data:", error);
      toast({
        title: "Error loading round",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center pb-16">
        <div className="text-muted-foreground">Loading scorecard...</div>
      </div>
    );
  }

  if (!round || courseHoles.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center pb-16">
        <div className="text-muted-foreground">Round not found</div>
      </div>
    );
  }

  const frontNine = courseHoles.slice(0, 9);
  const backNine = courseHoles.slice(9, 18);

  return (
    <div className="min-h-screen pb-24 bg-background">
      {/* Single Header */}
      <div className="bg-primary text-primary-foreground p-4">
        <div className="text-center">
          <h2 className="text-lg font-bold">{round.course_name}</h2>
          <p className="text-sm opacity-90">Stroke Play NET</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-4 space-y-4">
        {(() => {
          // Calculate positions based on score to par
          const playersWithTotals = players.map(player => {
            const totals = calculateTotals(player, courseHoles);
            const scoreToPar = totals.totalScore > 0 ? totals.totalScore - totals.totalPar : Infinity;
            return { player, scoreToPar };
          });
          
          // Sort by score to par (lower is better)
          const sorted = [...playersWithTotals].sort((a, b) => a.scoreToPar - b.scoreToPar);
          
          // Create position map
          const positionMap = new Map<string, number>();
          sorted.forEach((item, index) => {
            positionMap.set(item.player.id, index + 1);
          });

          return players.map((player) => {
            const isExpanded = expandedPlayerId === player.id;
            const frontTotals = calculateTotals(player, frontNine);
            const backTotals = calculateTotals(player, backNine);
            const overallTotals = calculateTotals(player, courseHoles);
            const position = positionMap.get(player.id) || 1;

            return (
              <Card key={player.id} className="overflow-hidden">

                {/* Player Info Bar - Clickable */}
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
                        {position}
                      </div>
                    <div>
                      <div className="text-xl font-bold">{player.display_name}</div>
                      <div className="text-sm text-muted-foreground">
                        HCP {player.handicap ? `+${player.handicap}` : "+0"}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-3xl font-bold">
                      {overallTotals.totalScore > 0 
                        ? getScoreToPar(overallTotals.totalScore, overallTotals.totalPar)
                        : "E"
                      }
                    </div>
                    <div className="text-sm text-muted-foreground">TO PAR</div>
                  </div>
                </div>
              </div>

              {/* Scorecard Table - Only shown when expanded */}
              {isExpanded && (
                <>
                  {/* Front 9 */}
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-primary/5">
                          <TableHead className="text-center font-bold text-xs px-1 py-2 sticky left-0 bg-primary/5 z-10">Hole</TableHead>
                          {frontNine.map(hole => (
                            <TableHead key={hole.hole_number} className="text-center font-bold text-xs px-2 py-2 w-[32px]">
                              {hole.hole_number}
                            </TableHead>
                          ))}
                          <TableHead className="text-center font-bold text-xs px-2 py-2 bg-primary/10 w-[36px]">Out</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        <TableRow>
                          <TableCell className="font-medium text-muted-foreground text-xs px-1 py-1.5 sticky left-0 bg-background z-10">HCP</TableCell>
                          {frontNine.map(hole => (
                            <TableCell key={hole.hole_number} className="text-center text-xs px-1 py-1.5">
                              {hole.stroke_index}
                            </TableCell>
                          ))}
                          <TableCell className="text-center bg-muted text-xs px-1 py-1.5"></TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="font-medium text-muted-foreground text-xs px-1 py-1.5 sticky left-0 bg-background z-10">Par</TableCell>
                          {frontNine.map(hole => (
                            <TableCell key={hole.hole_number} className="text-center font-semibold text-xs px-1 py-1.5">
                              {hole.par}
                            </TableCell>
                          ))}
                          <TableCell className="text-center font-bold bg-muted text-xs px-1 py-1.5">
                            {frontNine.reduce((sum, h) => sum + h.par, 0)}
                          </TableCell>
                        </TableRow>
                        <TableRow className="font-bold">
                          <TableCell className="font-bold text-xs px-1 py-1.5 sticky left-0 bg-background z-10">Score</TableCell>
                          {frontNine.map(hole => {
                            const score = player.scores.get(hole.hole_number);
                            const hasScore = player.scores.has(hole.hole_number);
                            return (
                              <TableCell 
                                key={hole.hole_number} 
                                className="text-center font-bold text-xs px-1 py-1.5"
                              >
                                {hasScore ? (score === 0 ? '-' : score) : ''}
                              </TableCell>
                            );
                          })}
                          <TableCell className="text-center font-bold bg-muted text-xs px-1 py-1.5">
                            {frontTotals.totalScore > 0 ? frontTotals.totalScore : ''}
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="font-medium text-muted-foreground text-xs px-1 py-1.5 sticky left-0 bg-background z-10">Net</TableCell>
                          {frontNine.map(hole => {
                            const score = player.scores.get(hole.hole_number);
                            const hasScore = player.scores.has(hole.hole_number);
                            return (
                              <TableCell key={hole.hole_number} className="text-center text-xs px-1 py-1.5">
                                {hasScore ? (score === 0 ? '-' : score) : ''}
                              </TableCell>
                            );
                          })}
                          <TableCell className="text-center font-bold bg-muted text-xs px-1 py-1.5">
                            {frontTotals.totalScore > 0 ? frontTotals.totalScore : ''}
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>

                  {/* Back 9 - Only show if 18 holes */}
                  {courseHoles.length === 18 && backNine.length > 0 && (
                    <div className="overflow-x-auto border-t">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-primary/5">
                            <TableHead className="text-center font-bold text-xs px-1 py-2 sticky left-0 bg-primary/5 z-10">Hole</TableHead>
                            {backNine.map(hole => (
                              <TableHead key={hole.hole_number} className="text-center font-bold text-xs px-2 py-2 w-[32px]">
                                {hole.hole_number}
                              </TableHead>
                            ))}
                            <TableHead className="text-center font-bold text-xs px-2 py-2 bg-primary/10 w-[36px]">In</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          <TableRow>
                            <TableCell className="font-medium text-muted-foreground text-xs px-1 py-1.5 sticky left-0 bg-background z-10">HCP</TableCell>
                            {backNine.map(hole => (
                              <TableCell key={hole.hole_number} className="text-center text-xs px-1 py-1.5">
                                {hole.stroke_index}
                              </TableCell>
                            ))}
                            <TableCell className="text-center bg-muted text-xs px-1 py-1.5"></TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell className="font-medium text-muted-foreground text-xs px-1 py-1.5 sticky left-0 bg-background z-10">Par</TableCell>
                            {backNine.map(hole => (
                              <TableCell key={hole.hole_number} className="text-center font-semibold text-xs px-1 py-1.5">
                                {hole.par}
                              </TableCell>
                            ))}
                            <TableCell className="text-center font-bold bg-muted text-xs px-1 py-1.5">
                              {backNine.reduce((sum, h) => sum + h.par, 0)}
                            </TableCell>
                          </TableRow>
                          <TableRow className="font-bold">
                            <TableCell className="font-bold text-xs px-1 py-1.5 sticky left-0 bg-background z-10">Score</TableCell>
                            {backNine.map(hole => {
                              const score = player.scores.get(hole.hole_number);
                              const hasScore = player.scores.has(hole.hole_number);
                              return (
                                <TableCell 
                                  key={hole.hole_number} 
                                  className="text-center font-bold text-xs px-1 py-1.5"
                                >
                                  {hasScore ? (score === 0 ? '-' : score) : ''}
                                </TableCell>
                              );
                            })}
                            <TableCell className="text-center font-bold bg-muted text-xs px-1 py-1.5">
                              {backTotals.totalScore > 0 ? backTotals.totalScore : ''}
                            </TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell className="font-medium text-muted-foreground text-xs px-1 py-1.5 sticky left-0 bg-background z-10">Net</TableCell>
                            {backNine.map(hole => {
                              const score = player.scores.get(hole.hole_number);
                              const hasScore = player.scores.has(hole.hole_number);
                              return (
                                <TableCell key={hole.hole_number} className="text-center text-xs px-1 py-1.5">
                                  {hasScore ? (score === 0 ? '-' : score) : ''}
                                </TableCell>
                              );
                            })}
                            <TableCell className="text-center font-bold bg-muted text-xs px-1 py-1.5">
                              {backTotals.totalScore > 0 ? backTotals.totalScore : ''}
                            </TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="border-t p-4">
                    <div className="flex items-center justify-around">
                      <Button variant="ghost" size="sm" className="flex-col h-auto gap-1">
                        <ThumbsUp size={20} className="text-primary" />
                        <span className="text-xs">Like</span>
                      </Button>
                      <Button variant="ghost" size="sm" className="flex-col h-auto gap-1">
                        <MessageSquare size={20} className="text-primary" />
                        <span className="text-xs">Comment to<br/>Game Feed</span>
                      </Button>
                      <Button variant="ghost" size="sm" className="flex-col h-auto gap-1">
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

      <RoundBottomTabBar roundId={roundId!} />
    </div>
  );
}
