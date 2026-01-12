import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { RoundBottomTabBar } from "@/components/RoundBottomTabBar";
import { SkinsBottomTabBar } from "@/components/SkinsBottomTabBar";
import { LeaderboardActions } from "@/components/LeaderboardActions";
import { useIsSpectator } from "@/hooks/useIsSpectator";
import { useRoundNavigation } from "@/hooks/useRoundNavigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronDown, RotateCcw, ArrowLeft } from "lucide-react";
import { GameHeader } from "@/components/GameHeader";
import { GameNotFound } from "@/components/GameNotFound";
import { useGameAdminStatus } from "@/hooks/useGameAdminStatus";
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
  round_name: string | null;
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
  const { isAdmin } = useGameAdminStatus('round', roundId);
  // Use standardized navigation hook for back button behavior
  const { handleBack } = useRoundNavigation({
    gameId: roundId || '',
    mode: 'round',
  });
  
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
        .maybeSingle();

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
      <GameNotFound 
        onRetry={() => fetchRoundData()}
        message="This round was deleted or is no longer available."
      />
    );
  }

  const frontNine = courseHoles.slice(0, 9);
  const backNine = courseHoles.slice(9, 18);

  const handleFinishGame = async () => {
    try {
      toast({ title: "Round finished!" });
      navigate(`/round/${roundId}/summary`);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleDeleteGame = async () => {
    try {
      await supabase.from("holes").delete().eq("round_id", roundId);
      await supabase.from("round_players").delete().eq("round_id", roundId);
      await supabase.from("rounds").delete().eq("id", roundId);
      toast({ title: "Round deleted" });
      navigate("/");
    } catch (error: any) {
      toast({ title: "Error deleting round", description: error.message, variant: "destructive" });
    }
  };

  return (
    <div className="min-h-screen pb-24 bg-background">
      <GameHeader
        gameTitle={round.round_name || "Stroke Play"}
        courseName={round.course_name}
        pageTitle="Leaderboard"
        isAdmin={isAdmin}
        onFinish={handleFinishGame}
        onSaveAndExit={() => navigate('/profile')}
        onDelete={handleDeleteGame}
        gameName="Round"
      />

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
          // This sorted array is always used for position calculation
          const sortedForRanking = [...playersWithTotals].sort((a, b) => a.scoreToPar - b.scoreToPar);
          
          // Display order: sorted in spectator mode, original order otherwise
          const displayOrder = isSpectator ? sortedForRanking : playersWithTotals;
          
          // Helper for position with ties (always use sortedForRanking for correct positions)
          const getPositionLabel = (scoreToPar: number, hasConceded: boolean): string => {
            // Players with conceded holes show "-" instead of position
            if (hasConceded) return "-";
            
            const playersAhead = sortedForRanking.filter(p => p.scoreToPar < scoreToPar).length;
            const position = playersAhead + 1;
            const sameScoreCount = sortedForRanking.filter(p => p.scoreToPar === scoreToPar && !p.hasConceded).length;
            if (sameScoreCount > 1) {
              return `T${position}`;
            }
            return `${position}`;
          };

          return displayOrder.map(({ player, scoreToPar, hasConceded }) => {
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
                        HCP +{player.handicap ? Math.abs(Number(player.handicap)) : 0}
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
                  <div className="w-full">
                    <Table className="w-full table-fixed">
                      <TableHeader>
                        <TableRow className="bg-primary/5">
                          <TableHead className="text-center font-bold text-[10px] px-0.5 py-1.5 bg-primary/5 w-[44px]">Hole</TableHead>
                          {frontNine.map(hole => (
                            <TableHead key={hole.hole_number} className="text-center font-bold text-[10px] px-0 py-1.5">
                              {hole.hole_number}
                            </TableHead>
                          ))}
                          <TableHead className="text-center font-bold text-[10px] px-0 py-1.5 bg-primary/10">Out</TableHead>
                          <TableHead className="text-center font-bold text-[10px] px-0 py-1.5 bg-primary/10">
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
                          <TableCell className="font-bold text-[10px] px-0.5 py-1 bg-background">Score</TableCell>
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
                          <TableCell className="text-center font-bold bg-primary/10 text-[10px] px-0 py-1">
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

                  {/* Back 9 - Only show if 18 holes */}
                  {courseHoles.length === 18 && backNine.length > 0 && (
                    <div className="w-full border-t">
                      <Table className="w-full table-fixed">
                        <TableHeader>
                          <TableRow className="bg-primary/5">
                            <TableHead className="text-center font-bold text-[10px] px-0.5 py-1.5 bg-primary/5 w-[44px]">Hole</TableHead>
                            {backNine.map(hole => (
                              <TableHead key={hole.hole_number} className="text-center font-bold text-[10px] px-0 py-1.5">
                                {hole.hole_number}
                              </TableHead>
                            ))}
                            <TableHead className="text-center font-bold text-[10px] px-0 py-1.5 bg-primary/10">In</TableHead>
                            <TableHead className="text-center font-bold text-[10px] px-0 py-1.5 bg-primary/10">Tot</TableHead>
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
                            <TableCell className="font-bold text-[10px] px-0.5 py-1 bg-background">Score</TableCell>
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
                            <TableCell className="text-center font-bold bg-primary/10 text-[10px] px-0 py-1">
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

                  {/* Like and Comment Actions */}
                  <LeaderboardActions 
                    gameId={roundId!} 
                    gameType={round?.origin === "skins" ? "skins" : "round"} 
                    feedPath={`/rounds/${roundId}/feed`}
                    scorecardPlayerId={player.id}
                    scorecardPlayerName={player.display_name}
                  />
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
