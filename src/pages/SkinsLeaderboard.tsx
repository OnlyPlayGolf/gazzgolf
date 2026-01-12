import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Trophy, ChevronDown, RotateCcw } from "lucide-react";
import { SkinsBottomTabBar } from "@/components/SkinsBottomTabBar";
import { LeaderboardActions } from "@/components/LeaderboardActions";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useIsSpectator } from "@/hooks/useIsSpectator";

interface RoundPlayer {
  id: string;
  user_id: string;
  tee_color: string | null;
  handicap: number | null;
  profiles: {
    display_name: string | null;
    username: string | null;
  } | null;
}

interface CourseHole {
  hole_number: number;
  par: number;
  stroke_index: number;
}

interface SkinResult {
  holeNumber: number;
  winnerId: string | null;
  skinsWon: number;
  isCarryover: boolean;
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

export default function SimpleSkinsLeaderboard() {
  const { roundId } = useParams();
  const navigate = useNavigate();
  const [players, setPlayers] = useState<RoundPlayer[]>([]);
  const [scores, setScores] = useState<Map<string, Map<number, number>>>(new Map());
  const [courseHoles, setCourseHoles] = useState<CourseHole[]>([]);
  const [loading, setLoading] = useState(true);
  const [skinResults, setSkinResults] = useState<SkinResult[]>([]);
  const [courseName, setCourseName] = useState("");
  const [strokePlayPlayers, setStrokePlayPlayers] = useState<PlayerData[]>([]);
  const [expandedPlayerId, setExpandedPlayerId] = useState<string | null>(null);
  
  // Check spectator status for leaderboard sorting
  const { isSpectator } = useIsSpectator('round', roundId);

  useEffect(() => {
    fetchData();
  }, [roundId]);

  useEffect(() => {
    if (players.length > 0 && courseHoles.length > 0) {
      calculateSkinResults();
    }
  }, [scores, courseHoles, players]);

  const fetchData = async () => {
    try {
      const { data: roundData } = await supabase
        .from("rounds")
        .select("*")
        .eq("id", roundId)
        .single();

      if (!roundData) return;
      setCourseName(roundData.course_name);

      const { data: playersData } = await supabase
        .from("round_players")
        .select("id, user_id, tee_color, handicap")
        .eq("round_id", roundId);

      if (playersData && playersData.length > 0) {
        const userIds = playersData.map(p => p.user_id);
        const { data: profilesData } = await supabase
          .from("profiles")
          .select("id, display_name, username, handicap")
          .in("id", userIds);
        
        const profilesMap = new Map(profilesData?.map(p => [p.id, p]) || []);
        const playersWithProfiles = playersData.map(player => ({
          ...player,
          profiles: profilesMap.get(player.user_id) || null
        }));
        setPlayers(playersWithProfiles);

        // Prepare stroke play players
        const strokePlayers: PlayerData[] = playersData.map(player => {
          const profile = profilesMap.get(player.user_id);
          return {
            id: player.id,
            user_id: player.user_id,
            tee_color: player.tee_color,
            handicap: player.handicap || (profile?.handicap ? parseFloat(profile.handicap) : null),
            display_name: profile?.display_name || profile?.username || "Player",
            username: profile?.username || null,
            scores: new Map(),
            mulligans: new Set(),
          };
        });
        setStrokePlayPlayers(strokePlayers);
      }

      const { data: courseData } = await supabase
        .from("courses")
        .select("id")
        .eq("name", roundData.course_name)
        .maybeSingle();

      let holesArray: CourseHole[] = [];
      if (courseData) {
        const { data: holesData } = await supabase
          .from("course_holes")
          .select("hole_number, par, stroke_index")
          .eq("course_id", courseData.id)
          .order("hole_number");
        
        if (holesData) {
          holesArray = holesData.slice(0, roundData.holes_played);
        }
      }
      
      if (holesArray.length === 0) {
        const defaultPar = [4, 4, 3, 5, 4, 4, 3, 4, 5];
        holesArray = Array.from({ length: roundData.holes_played }, (_, i) => ({
          hole_number: i + 1,
          par: i < 9 ? defaultPar[i] : defaultPar[i % 9],
          stroke_index: i + 1,
        }));
      }
      setCourseHoles(holesArray);

      const { data: existingHoles } = await supabase
        .from("holes")
        .select("hole_number, score, player_id, mulligan")
        .eq("round_id", roundId);

      if (existingHoles) {
        const scoresMap = new Map<string, Map<number, number>>();
        const mulligansMap = new Map<string, Set<number>>();
        
        existingHoles.forEach((hole) => {
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
        setScores(scoresMap);

        // Update stroke play players with scores and mulligans
        setStrokePlayPlayers(prev => prev.map(player => ({
          ...player,
          scores: scoresMap.get(player.id) || new Map(),
          mulligans: mulligansMap.get(player.id) || new Set(),
        })));
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  const calculateSkinResults = () => {
    const results: SkinResult[] = [];
    let carryover = 0;
    
    for (const hole of courseHoles) {
      const holeScores: { playerId: string; score: number }[] = [];
      
      for (const player of players) {
        const playerScoreMap = scores.get(player.id);
        const score = playerScoreMap?.get(hole.hole_number);
        if (score && score > 0) {
          holeScores.push({
            playerId: player.id,
            score
          });
        }
      }
      
      if (holeScores.length < players.length || players.length === 0) {
        results.push({
          holeNumber: hole.hole_number,
          winnerId: null,
          skinsWon: 0,
          isCarryover: false
        });
        continue;
      }
      
      const lowestScore = Math.min(...holeScores.map(s => s.score));
      const playersWithLowest = holeScores.filter(s => s.score === lowestScore);
      
      if (playersWithLowest.length === 1) {
        results.push({
          holeNumber: hole.hole_number,
          winnerId: playersWithLowest[0].playerId,
          skinsWon: 1 + carryover,
          isCarryover: false
        });
        carryover = 0;
      } else {
        results.push({
          holeNumber: hole.hole_number,
          winnerId: null,
          skinsWon: 0,
          isCarryover: true
        });
        carryover += 1;
      }
    }
    
    setSkinResults(results);
  };

  const getPlayerName = (player: RoundPlayer) => {
    return player.profiles?.display_name || player.profiles?.username || "Player";
  };

  const getPlayerSkinCount = (playerId: string): number => {
    return skinResults
      .filter(r => r.winnerId === playerId)
      .reduce((sum, r) => sum + r.skinsWon, 0);
  };

  const getPlayerTotalScore = (playerId: string): number => {
    const playerScores = scores.get(playerId);
    if (!playerScores) return 0;
    let total = 0;
    playerScores.forEach(score => { total += score; });
    return total;
  };

  const calculateTotals = (player: PlayerData, holes: CourseHole[]) => {
    let totalScore = 0;
    let totalPar = 0;

    holes.forEach(hole => {
      const score = player.scores.get(hole.hole_number);
      if (score && score > 0) {
        totalScore += score;
        totalPar += hole.par;
      }
    });

    return { totalScore, totalPar };
  };

  const getScoreToPar = (score: number, par: number) => {
    const diff = score - par;
    if (diff === 0) return "E";
    if (diff > 0) return `+${diff}`;
    return diff.toString();
  };

  if (loading) return <div className="p-4">Loading...</div>;

  // Always sort for position calculation
  const sortedPlayersForRanking = [...players].sort((a, b) => 
    getPlayerSkinCount(b.id) - getPlayerSkinCount(a.id)
  );
  
  // For display: only sort by position in spectator mode
  const sortedPlayers = isSpectator 
    ? sortedPlayersForRanking 
    : players;

  // Helper for skins position with ties - always use sorted list
  const getSkinsPositionLabel = (playerId: string): string => {
    const skinCount = getPlayerSkinCount(playerId);
    const playersAhead = sortedPlayersForRanking.filter(p => getPlayerSkinCount(p.id) > skinCount).length;
    const position = playersAhead + 1;
    const sameSkinsCount = sortedPlayersForRanking.filter(p => getPlayerSkinCount(p.id) === skinCount).length;
    if (sameSkinsCount > 1) {
      return `T${position}`;
    }
    return `${position}`;
  };

  const frontNine = courseHoles.slice(0, 9);
  const backNine = courseHoles.slice(9, 18);

  // Always sort stroke play players for position calculation
  const sortedStrokePlayPlayersForRanking = [...strokePlayPlayers].sort((a, b) => {
    const aTotals = calculateTotals(a, courseHoles);
    const bTotals = calculateTotals(b, courseHoles);
    const aScoreToPar = aTotals.totalScore > 0 ? aTotals.totalScore - aTotals.totalPar : Infinity;
    const bScoreToPar = bTotals.totalScore > 0 ? bTotals.totalScore - bTotals.totalPar : Infinity;
    return aScoreToPar - bScoreToPar;
  });
  
  // For display: only sort by position in spectator mode
  const sortedStrokePlayPlayers = isSpectator 
    ? sortedStrokePlayPlayersForRanking 
    : strokePlayPlayers;

  // Helper for stroke play position with ties - always use sorted list
  const getStrokePlayPositionLabel = (playerId: string): string => {
    const player = strokePlayPlayers.find(p => p.id === playerId);
    if (!player) return "1";
    const playerTotals = calculateTotals(player, courseHoles);
    const playerScoreToPar = playerTotals.totalScore > 0 ? playerTotals.totalScore - playerTotals.totalPar : Infinity;
    
    const playersAhead = sortedStrokePlayPlayersForRanking.filter(p => {
      const totals = calculateTotals(p, courseHoles);
      const scoreToPar = totals.totalScore > 0 ? totals.totalScore - totals.totalPar : Infinity;
      return scoreToPar < playerScoreToPar;
    }).length;
    const position = playersAhead + 1;
    
    const sameToPar = sortedStrokePlayPlayersForRanking.filter(p => {
      const totals = calculateTotals(p, courseHoles);
      const scoreToPar = totals.totalScore > 0 ? totals.totalScore - totals.totalPar : Infinity;
      return scoreToPar === playerScoreToPar;
    }).length;
    
    if (sameToPar > 1) {
      return `T${position}`;
    }
    return `${position}`;
  };

  return (
    <div className="pb-24 min-h-screen bg-background">
      <div className="p-4 space-y-4 max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold">Leaderboard</h1>

        <Tabs defaultValue="skins" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="skins">Skins</TabsTrigger>
            <TabsTrigger value="strokeplay">Stroke Play</TabsTrigger>
          </TabsList>

          <TabsContent value="skins" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-amber-600" />
                  Skins
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {sortedPlayers.map((player) => {
                  const skinCount = getPlayerSkinCount(player.id);
                  const positionLabel = getSkinsPositionLabel(player.id);
                  const isLeader = positionLabel === "1" || positionLabel === "T1";
                  
                  return (
                    <div 
                      key={player.id}
                      className={`flex items-center justify-between p-3 rounded-lg ${
                        isLeader && skinCount > 0 ? 'bg-amber-100 dark:bg-amber-900/30' : 'bg-muted/50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className={`text-lg font-bold ${isLeader && skinCount > 0 ? 'text-amber-600' : 'text-muted-foreground'}`}>
                          {positionLabel}
                        </span>
                        <div>
                          <p className="font-medium">{getPlayerName(player)}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="flex items-center gap-1 text-amber-600">
                          <Trophy size={16} />
                          <span className="text-xl font-bold">{skinCount}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">skin{skinCount !== 1 ? 's' : ''}</p>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="strokeplay" className="mt-4 space-y-4">
            <div className="bg-primary text-primary-foreground p-4 rounded-lg">
              <div className="text-center">
                <h2 className="text-lg font-bold">{courseName}</h2>
                <p className="text-sm opacity-90">Stroke Play</p>
              </div>
            </div>

            {sortedStrokePlayPlayers.map((player) => {
              const isExpanded = expandedPlayerId === player.id;
              const frontTotals = calculateTotals(player, frontNine);
              const backTotals = calculateTotals(player, backNine);
              const overallTotals = calculateTotals(player, courseHoles);
              const positionLabel = getStrokePlayPositionLabel(player.id);

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
                            HCP +{player.handicap ? Math.abs(Number(player.handicap)) : 0}
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
                                  <TableCell key={hole.hole_number} className="text-center font-bold text-xs px-1 py-1.5">
                                    <div className="flex items-center justify-center gap-0.5">
                                      {hasScore ? (score === -1 ? '–' : (score === 0 ? '-' : score)) : ''}
                                      {hasMulligan && <RotateCcw size={10} className="text-amber-500" />}
                                    </div>
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

                      {/* Back 9 */}
                      {courseHoles.length > 9 && backNine.length > 0 && (
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
                                    <TableCell key={hole.hole_number} className="text-center font-bold text-xs px-1 py-1.5">
                                      <div className="flex items-center justify-center gap-0.5">
                                        {hasScore ? (score === -1 ? '–' : (score === 0 ? '-' : score)) : ''}
                                        {hasMulligan && <RotateCcw size={10} className="text-amber-500" />}
                                      </div>
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
                    </>
                  )}
                </Card>
              );
            })}
          </TabsContent>
        </Tabs>

        {/* Like and Comment Actions */}
        <LeaderboardActions 
          gameId={roundId!} 
          gameType="skins" 
          feedPath={`/skins/${roundId}/feed`}
          scorecardPlayerName="Skins Game"
        />
      </div>

      {roundId && <SkinsBottomTabBar roundId={roundId} />}
    </div>
  );
}
