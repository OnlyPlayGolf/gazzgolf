import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { RoundBottomTabBar } from "@/components/RoundBottomTabBar";
import { SkinsBottomTabBar } from "@/components/SkinsBottomTabBar";
import { useIsSpectator } from "@/hooks/useIsSpectator";
import { getSpectatorReturnPath } from "@/utils/unifiedRoundsLoader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ThumbsUp, MessageSquare, BarChart3, ChevronDown, RotateCcw, ArrowLeft } from "lucide-react";
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
  origin: string | null;
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

export default function RoundLeaderboard() {
  const { roundId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isSpectator, isLoading: isSpectatorLoading } = useIsSpectator('round', roundId);
  
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

      // Fetch players (including guests via is_guest flag)
      const { data: playersData, error: playersError } = await supabase
        .from("round_players")
        .select("id, user_id, tee_color, handicap, is_guest, guest_name")
        .eq("round_id", roundId);

      if (playersError) throw playersError;

      // Separate registered players and guests
      const registeredPlayerData = playersData?.filter(p => !p.is_guest && p.user_id) || [];
      const guestPlayerData = playersData?.filter(p => p.is_guest) || [];

      // Fetch profiles for registered players
      const userIds = registeredPlayerData.map(p => p.user_id!);
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("id, display_name, username, handicap")
        .in("id", userIds);

      const profilesMap = new Map(profilesData?.map(p => [p.id, p]) || []);

      // Fetch all scores and mulligans
      const { data: scoresData } = await supabase
        .from("holes")
        .select("hole_number, score, player_id, mulligan")
        .eq("round_id", roundId);

      const scoresMap = new Map<string, Map<number, number>>();
      const mulligansMap = new Map<string, Set<number>>();
      
      scoresData?.forEach((hole) => {
        if (hole.player_id) {
          // Scores
          if (!scoresMap.has(hole.player_id)) {
            scoresMap.set(hole.player_id, new Map());
          }
          scoresMap.get(hole.player_id)!.set(hole.hole_number, hole.score);
          
          // Mulligans
          if (hole.mulligan) {
            if (!mulligansMap.has(hole.player_id)) {
              mulligansMap.set(hole.player_id, new Set());
            }
            mulligansMap.get(hole.player_id)!.add(hole.hole_number);
          }
        }
      });

      // Combine registered player data
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

      // Add guest players from database
      guestPlayerData.forEach(g => {
        playersWithScores.push({
          id: g.id,
          user_id: g.id, // Use round_player id for consistency
          tee_color: g.tee_color,
          handicap: g.handicap,
          display_name: g.guest_name || "Guest",
          username: null,
          scores: scoresMap.get(g.id) || new Map(),
          mulligans: mulligansMap.get(g.id) || new Set(),
        });
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
    // If player has any conceded hole (dash), show "-"
    if (hasPlayerConcededAnyHole(player)) return "-";
    
    const totals = calculateTotals(player, courseHoles);
    if (totals.totalScore > 0) {
      return getScoreToPar(totals.totalScore, totals.totalPar);
    }
    return "E";
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
        <div className="relative flex items-center justify-center">
          {isSpectator && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute left-0 text-primary-foreground hover:bg-primary-foreground/20"
              onClick={() => navigate(getSpectatorReturnPath(roundId || ''))}
            >
              <ArrowLeft size={20} />
            </Button>
          )}
          <div className="text-center">
            <h2 className="text-lg font-bold">{round.course_name}</h2>
            <p className="text-sm opacity-90">Stroke Play NET</p>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-4 space-y-4">
        {(() => {
          // Calculate positions based on score to par
          const playersWithTotals = players.map(player => {
            const totals = calculateTotals(player, courseHoles);
            const hasConceded = hasPlayerConcededAnyHole(player);
            // Players with conceded holes go to the bottom (Infinity)
            const scoreToPar = hasConceded ? Infinity : (totals.totalScore > 0 ? totals.totalScore - totals.totalPar : Infinity);
            return { player, scoreToPar, hasConceded };
          });
          
          // Sort by score to par (lower is better), conceded players go last
          const sorted = [...playersWithTotals].sort((a, b) => a.scoreToPar - b.scoreToPar);
          
          // Helper for position with ties
          const getPositionLabel = (scoreToPar: number, hasConceded: boolean): string => {
            // Players with conceded holes show "-" instead of position
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
                        {positionLabel}
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
                      {getPlayerScoreToParDisplay(player)}
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
                            const hasMulligan = player.mulligans.has(hole.hole_number);
                            return (
                              <TableCell 
                                key={hole.hole_number} 
                                className="text-center font-bold text-xs px-1 py-1.5"
                              >
                                <div className="flex items-center justify-center gap-0.5">
                                  {hasScore ? (score === -1 ? '–' : (score === 0 ? '-' : score)) : ''}
                                  {hasMulligan && <RotateCcw size={10} className="text-amber-500" />}
                                </div>
                              </TableCell>
                            );
                          })}
                          <TableCell className="text-center font-bold bg-muted text-xs px-1 py-1.5">
                            {hasConceded ? '-' : (frontTotals.totalScore > 0 ? frontTotals.totalScore : '')}
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="font-medium text-muted-foreground text-xs px-1 py-1.5 sticky left-0 bg-background z-10">Net</TableCell>
                          {frontNine.map(hole => {
                            const score = player.scores.get(hole.hole_number);
                            const hasScore = player.scores.has(hole.hole_number);
                            return (
                              <TableCell key={hole.hole_number} className="text-center text-xs px-1 py-1.5">
                                {hasScore ? (score === -1 ? '–' : (score === 0 ? '-' : score)) : ''}
                              </TableCell>
                            );
                          })}
                          <TableCell className="text-center font-bold bg-muted text-xs px-1 py-1.5">
                            {hasConceded ? '-' : (frontTotals.totalScore > 0 ? frontTotals.totalScore : '')}
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
                              const hasMulligan = player.mulligans.has(hole.hole_number);
                              return (
                                <TableCell 
                                  key={hole.hole_number} 
                                  className="text-center font-bold text-xs px-1 py-1.5"
                                >
                                  <div className="flex items-center justify-center gap-0.5">
                                    {hasScore ? (score === -1 ? '–' : (score === 0 ? '-' : score)) : ''}
                                    {hasMulligan && <RotateCcw size={10} className="text-amber-500" />}
                                  </div>
                                </TableCell>
                              );
                            })}
                            <TableCell className="text-center font-bold bg-muted text-xs px-1 py-1.5">
                              {hasConceded ? '-' : (backTotals.totalScore > 0 ? backTotals.totalScore : '')}
                            </TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell className="font-medium text-muted-foreground text-xs px-1 py-1.5 sticky left-0 bg-background z-10">Net</TableCell>
                            {backNine.map(hole => {
                              const score = player.scores.get(hole.hole_number);
                              const hasScore = player.scores.has(hole.hole_number);
                              return (
                              <TableCell key={hole.hole_number} className="text-center text-xs px-1 py-1.5">
                                {hasScore ? (score === -1 ? '–' : (score === 0 ? '-' : score)) : ''}
                              </TableCell>
                              );
                            })}
                            <TableCell className="text-center font-bold bg-muted text-xs px-1 py-1.5">
                              {hasConceded ? '-' : (backTotals.totalScore > 0 ? backTotals.totalScore : '')}
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

      {!isSpectatorLoading && (
        round?.origin === "skins" ? (
          <SkinsBottomTabBar roundId={roundId!} isSpectator={isSpectator} />
        ) : (
          <RoundBottomTabBar roundId={roundId!} isSpectator={isSpectator} />
        )
      )}
    </div>
  );
}
