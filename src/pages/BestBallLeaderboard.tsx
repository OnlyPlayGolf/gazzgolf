import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ChevronDown } from "lucide-react";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { BestBallBottomTabBar } from "@/components/BestBallBottomTabBar";
import { LeaderboardActions } from "@/components/LeaderboardActions";
import { BestBallGame, BestBallHole, BestBallPlayer, BestBallPlayerScore, BestBallGameType } from "@/types/bestBall";
import { formatMatchStatus } from "@/utils/bestBallScoring";
import { useIsSpectator } from "@/hooks/useIsSpectator";
import { useToast } from "@/hooks/use-toast";
import { GameHeader } from "@/components/GameHeader";
import { GameNotFound } from "@/components/GameNotFound";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface CourseHole {
  hole_number: number;
  par: number;
  stroke_index: number;
}

export default function BestBallLeaderboard() {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [game, setGame] = useState<BestBallGame | null>(null);
  const [holes, setHoles] = useState<BestBallHole[]>([]);
  const [courseHoles, setCourseHoles] = useState<CourseHole[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedTeam, setExpandedTeam] = useState<'A' | 'B' | null>(null);
  const [scorecardOpen, setScorecardOpen] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  
  // Check spectator status - for sorting leaderboard by position
  const { isSpectator, isLoading: isSpectatorLoading } = useIsSpectator('best_ball', gameId);

  useEffect(() => {
    const loadUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUserId(user?.id || null);
    };
    loadUser();
  }, []);

  useEffect(() => {
    if (gameId) {
      fetchData();
    }
  }, [gameId]);

  const fetchData = async () => {
    try {
      const { data: gameData } = await supabase
        .from("best_ball_games")
        .select("*")
        .eq("id", gameId)
        .single();

      if (gameData) {
        // Safely parse player arrays with fallback to empty array
        const parsePlayerArray = (data: unknown): BestBallPlayer[] => {
          if (!data || !Array.isArray(data)) return [];
          return data.map((p: any) => ({
            odId: p?.odId || p?.id || '',
            displayName: p?.displayName || 'Unknown',
            handicap: p?.handicap,
            teeColor: p?.teeColor,
            isTemporary: p?.isTemporary || false,
          }));
        };

        const typedGame: BestBallGame = {
          ...gameData,
          game_type: (gameData.game_type as BestBallGameType) || 'match',
          team_a_players: parsePlayerArray(gameData.team_a_players),
          team_b_players: parsePlayerArray(gameData.team_b_players),
          winner_team: gameData.winner_team as 'A' | 'B' | 'TIE' | null,
        };
        setGame(typedGame);

        if (gameData.course_id) {
          const { data: courseHolesData } = await supabase
            .from("course_holes")
            .select("hole_number, par, stroke_index")
            .eq("course_id", gameData.course_id)
            .order("hole_number");

          if (courseHolesData) {
            const filteredHoles = gameData.holes_played === 9 
              ? courseHolesData.slice(0, 9) 
              : courseHolesData;
            setCourseHoles(filteredHoles);
          }
        }
      }

      const { data: holesData } = await supabase
        .from("best_ball_holes")
        .select("*")
        .eq("game_id", gameId)
        .order("hole_number");

      if (holesData) {
        const typedHoles: BestBallHole[] = holesData.map(h => ({
          ...h,
          team_a_scores: h.team_a_scores as unknown as BestBallPlayerScore[],
          team_b_scores: h.team_b_scores as unknown as BestBallPlayerScore[],
        }));
        setHoles(typedHoles);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || isSpectatorLoading) {
    return (
      <div className="min-h-screen pb-24 flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
        {gameId && !isSpectatorLoading && <BestBallBottomTabBar gameId={gameId} isSpectator={isSpectator} />}
      </div>
    );
  }

  if (!game) {
    return (
      <GameNotFound 
        onRetry={() => fetchData()}
        message="This game was deleted or is no longer available."
      />
    );
  }

  const isAdmin = currentUserId !== null && game.user_id === currentUserId;

  const handleFinishGame = async () => {
    try {
      const winner = game.team_a_total > game.team_b_total ? "A" : 
                     game.team_b_total > game.team_a_total ? "B" : "TIE";
      
      await supabase
        .from("best_ball_games")
        .update({ is_finished: true, winner_team: winner })
        .eq("id", gameId);
      
      toast({ title: "Game finished!" });
      navigate(`/best-ball/${gameId}/summary`);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleDeleteGame = async () => {
    try {
      await supabase.from("best_ball_holes").delete().eq("game_id", gameId);
      await supabase.from("best_ball_games").delete().eq("id", gameId);
      toast({ title: "Game deleted" });
      navigate("/");
    } catch (error: any) {
      toast({ title: "Error deleting game", description: error.message, variant: "destructive" });
    }
  };

  const holesMap = new Map(holes.map(h => [h.hole_number, h]));
  const frontNine = courseHoles.filter(h => h.hole_number <= 9);
  const backNine = courseHoles.filter(h => h.hole_number > 9);

  const teamAHolesWon = holes.filter(h => h.hole_result === 1).length;
  const teamBHolesWon = holes.filter(h => h.hole_result === -1).length;

  const isMatchPlay = game.game_type === 'match';
  const leader = game.match_status > 0 ? 'A' : game.match_status < 0 ? 'B' : null;
  const strokeLeader = game.team_a_total < game.team_b_total ? 'A' : game.team_a_total > game.team_b_total ? 'B' : null;

  const getTeamBestScore = (holeNumber: number, team: 'A' | 'B') => {
    const hole = holesMap.get(holeNumber);
    if (!hole) return null;
    return team === 'A' ? hole.team_a_best_gross : hole.team_b_best_gross;
  };

  const getHoleResult = (holeNumber: number) => {
    const hole = holesMap.get(holeNumber);
    return hole?.hole_result || 0;
  };

  const getPlayerScoresForHole = (holeNumber: number, team: 'A' | 'B'): BestBallPlayerScore[] => {
    const hole = holesMap.get(holeNumber);
    if (!hole) return [];
    return team === 'A' ? (hole.team_a_scores || []) : (hole.team_b_scores || []);
  };

  const getLowestScore = (scores: BestBallPlayerScore[]): number | null => {
    const validScores = scores.filter(s => s.grossScore !== null).map(s => s.grossScore as number);
    if (validScores.length === 0) return null;
    return Math.min(...validScores);
  };

  // Get the match status after a specific hole (running total)
  const getMatchStatusAfterHole = (holeNumber: number): { text: string; leadingTeam: 'A' | 'B' | null } => {
    const hole = holesMap.get(holeNumber);
    if (!hole) return { text: '', leadingTeam: null };
    const status = hole.match_status_after;
    if (status === 0) return { text: 'AS', leadingTeam: null };
    // Show "1UP", "2UP" etc. format
    const upBy = Math.abs(status);
    const leadingTeam = status > 0 ? 'A' : 'B';
    return { text: `${upBy}UP`, leadingTeam };
  };

  const renderTeamScorecard = (team: 'A' | 'B', position: number, isTied: boolean) => {
    if (courseHoles.length === 0) return null;

    const teamName = team === 'A' ? game.team_a_name : game.team_b_name;
    const teamTotal = team === 'A' ? game.team_a_total : game.team_b_total;
    // Calculate par only for holes that have been played
    const playedHoleNumbers = holes.map(h => h.hole_number);
    const parForPlayedHoles = courseHoles
      .filter(h => playedHoleNumbers.includes(h.hole_number))
      .reduce((sum, h) => sum + h.par, 0);
    const toPar = teamTotal - parForPlayedHoles;
    const toParDisplay = teamTotal === 0 ? 'E' : toPar === 0 ? 'E' : toPar > 0 ? `+${toPar}` : toPar.toString();
    const positionDisplay = isTied ? `T${position}` : position.toString();

    const frontNineTotal = frontNine.reduce((sum, h) => sum + (getTeamBestScore(h.hole_number, team) || 0), 0);
    const backNineTotal = backNine.reduce((sum, h) => sum + (getTeamBestScore(h.hole_number, team) || 0), 0);
    const frontNinePar = frontNine.reduce((sum, h) => sum + h.par, 0);
    const backNinePar = backNine.reduce((sum, h) => sum + h.par, 0);

    const isExpanded = expandedTeam === team;

    return (
      <Card className="overflow-hidden border-2">
        <Collapsible open={isExpanded} onOpenChange={(open) => setExpandedTeam(open ? team : null)}>
          <CollapsibleTrigger className="w-full">
            <div className="flex items-center p-4 hover:bg-muted/50 transition-colors">
              <ChevronDown className={`h-5 w-5 text-muted-foreground transition-transform mr-3 ${isExpanded ? 'rotate-180' : '-rotate-90'}`} />
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center font-bold text-foreground text-sm mr-4">
                {positionDisplay}
              </div>
              <div className="flex-1 text-left">
                <div className="text-xl font-bold">{teamName}</div>
                <div className="text-sm text-muted-foreground">
                  {holes.length} holes played
                </div>
              </div>
              <div className="text-right">
                <div className={`text-3xl font-bold ${toPar < 0 ? 'text-primary' : ''}`}>
                  {toParDisplay}
                </div>
                <div className="text-xs text-muted-foreground uppercase tracking-wide">
                  To Par
                </div>
              </div>
            </div>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="p-2">
              {/* Front 9 */}
              <div className="border rounded-lg overflow-hidden w-full">
                <Table className="table-fixed w-full">
                  <TableHeader>
                    <TableRow className="bg-primary/5">
                      <TableHead className="text-center font-bold text-[10px] px-0 py-1 w-[44px]">Hole</TableHead>
                      {frontNine.map(hole => (
                        <TableHead key={hole.hole_number} className="text-center font-bold text-[10px] px-0 py-1">
                          {hole.hole_number}
                        </TableHead>
                      ))}
                      <TableHead className="text-center font-bold text-[10px] px-0 py-1 bg-primary/10">Out</TableHead>
                      {backNine.length > 0 && <TableHead className="text-center font-bold text-[10px] px-0 py-1 bg-primary/10"></TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell className="font-medium text-muted-foreground text-[10px] px-0 py-1 w-[44px]">Par</TableCell>
                      {frontNine.map(hole => (
                        <TableCell key={hole.hole_number} className="text-center font-semibold text-[10px] px-0 py-1">
                          {hole.par}
                        </TableCell>
                      ))}
                      <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1">
                        {frontNinePar}
                      </TableCell>
                      {backNine.length > 0 && <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1"></TableCell>}
                    </TableRow>
                    {/* Player Score Rows */}
                    {(team === 'A' ? game.team_a_players : game.team_b_players).map((player, playerIndex) => {
                      const playerTotals = frontNine.reduce((sum, h) => {
                        const scores = getPlayerScoresForHole(h.hole_number, team);
                        const playerScore = scores.find(s => s.playerId === player.odId || s.playerName === player.displayName);
                        return sum + (playerScore?.grossScore || 0);
                      }, 0);
                      
                      return (
                        <TableRow key={player.odId || playerIndex} className="text-muted-foreground">
                          <TableCell className="text-[10px] px-0.5 py-1 w-[44px] truncate">
                            {player.displayName.split(' ')[0]}
                          </TableCell>
                          {frontNine.map(hole => {
                            const scores = getPlayerScoresForHole(hole.hole_number, team);
                            const playerScore = scores.find(s => s.playerId === player.odId || s.playerName === player.displayName);
                            const lowestScore = getLowestScore(scores);
                            const isLowest = playerScore?.grossScore !== null && playerScore?.grossScore === lowestScore;
                            
                            return (
                              <TableCell 
                                key={hole.hole_number} 
                                className={`text-center text-[10px] px-0 py-1 ${
                                  isLowest ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 font-bold' : ''
                                }`}
                              >
                                {playerScore?.grossScore || ''}
                              </TableCell>
                            );
                          })}
                          <TableCell className="text-center text-[10px] px-0 py-1 bg-muted">
                            {playerTotals || ''}
                          </TableCell>
                          {backNine.length > 0 && <TableCell className="text-center text-[10px] px-0 py-1 bg-muted"></TableCell>}
                        </TableRow>
                      );
                    })}
                    <TableRow className="font-bold">
                      <TableCell className="font-bold text-[10px] px-0 py-1 w-[44px]">Score</TableCell>
                      {frontNine.map(hole => {
                        const score = getTeamBestScore(hole.hole_number, team);
                        return (
                          <TableCell 
                            key={hole.hole_number} 
                            className="text-center font-bold text-[10px] px-0 py-1"
                          >
                            {score || ''}
                          </TableCell>
                        );
                      })}
                      <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1">
                        {frontNineTotal || ''}
                      </TableCell>
                      {backNine.length > 0 && <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1"></TableCell>}
                    </TableRow>
                  </TableBody>
                </Table>
              </div>

              {/* Back 9 */}
              {backNine.length > 0 && (
                <div className="border rounded-lg overflow-hidden w-full mt-2">
                  <Table className="table-fixed w-full">
                    <TableHeader>
                      <TableRow className="bg-primary/5">
                        <TableHead className="text-center font-bold text-[10px] px-0 py-1 w-[44px]">Hole</TableHead>
                        {backNine.map(hole => (
                          <TableHead key={hole.hole_number} className="text-center font-bold text-[10px] px-0 py-1">
                            {hole.hole_number}
                          </TableHead>
                        ))}
                        <TableHead className="text-center font-bold text-[10px] px-0 py-1 bg-primary/10">In</TableHead>
                        <TableHead className="text-center font-bold text-[10px] px-0 py-1 bg-primary/10">Tot</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow>
                        <TableCell className="font-medium text-muted-foreground text-[10px] px-0 py-1 w-[44px]">Par</TableCell>
                        {backNine.map(hole => (
                          <TableCell key={hole.hole_number} className="text-center font-semibold text-[10px] px-0 py-1">
                            {hole.par}
                          </TableCell>
                        ))}
                        <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1">
                          {backNinePar}
                        </TableCell>
                        <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1">
                          {frontNinePar + backNinePar}
                        </TableCell>
                      </TableRow>
                      {/* Player Score Rows */}
                      {(team === 'A' ? game.team_a_players : game.team_b_players).map((player, playerIndex) => {
                        const frontPlayerTotals = frontNine.reduce((sum, h) => {
                          const scores = getPlayerScoresForHole(h.hole_number, team);
                          const playerScore = scores.find(s => s.playerId === player.odId || s.playerName === player.displayName);
                          return sum + (playerScore?.grossScore || 0);
                        }, 0);
                        const backPlayerTotals = backNine.reduce((sum, h) => {
                          const scores = getPlayerScoresForHole(h.hole_number, team);
                          const playerScore = scores.find(s => s.playerId === player.odId || s.playerName === player.displayName);
                          return sum + (playerScore?.grossScore || 0);
                        }, 0);
                        
                        return (
                          <TableRow key={player.odId || playerIndex} className="text-muted-foreground">
                            <TableCell className="text-[10px] px-0.5 py-1 w-[44px] truncate">
                              {player.displayName.split(' ')[0]}
                            </TableCell>
                            {backNine.map(hole => {
                              const scores = getPlayerScoresForHole(hole.hole_number, team);
                              const playerScore = scores.find(s => s.playerId === player.odId || s.playerName === player.displayName);
                              const lowestScore = getLowestScore(scores);
                              const isLowest = playerScore?.grossScore !== null && playerScore?.grossScore === lowestScore;
                              
                              return (
                                <TableCell 
                                  key={hole.hole_number} 
                                  className={`text-center text-[10px] px-0 py-1 ${
                                    isLowest ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 font-bold' : ''
                                  }`}
                                >
                                  {playerScore?.grossScore || ''}
                                </TableCell>
                              );
                            })}
                            <TableCell className="text-center text-[10px] px-0 py-1 bg-muted">
                              {backPlayerTotals || ''}
                            </TableCell>
                            <TableCell className="text-center text-[10px] px-0 py-1 bg-muted">
                              {(frontPlayerTotals + backPlayerTotals) || ''}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                      <TableRow className="font-bold">
                        <TableCell className="font-bold text-[10px] px-0 py-1 w-[44px]">Score</TableCell>
                        {backNine.map(hole => {
                          const score = getTeamBestScore(hole.hole_number, team);
                          return (
                            <TableCell 
                              key={hole.hole_number} 
                              className="text-center font-bold text-[10px] px-0 py-1"
                            >
                              {score || ''}
                            </TableCell>
                          );
                        })}
                        <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1">
                          {backNineTotal || ''}
                        </TableCell>
                        <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1">
                          {(frontNineTotal + backNineTotal) || ''}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>
      </Card>
    );
  };


  const getMatchScoreDisplay = () => {
    const totalHoles = game.holes_played;
    const holesPlayed = holes.length;
    const holesRemaining = totalHoles - holesPlayed;
    
    if (game.match_status === 0) {
      return { teamAScore: null, teamBScore: null, isAllSquare: true };
    }
    
    const upBy = Math.abs(game.match_status);
    const leadingTeam = game.match_status > 0 ? 'A' : 'B';
    
    // Calculate "holes to go" style score (e.g., 3½ means 3 up with remainder)
    const teamAScore = leadingTeam === 'A' ? `${upBy}` : null;
    const teamBScore = leadingTeam === 'B' ? `${upBy}` : null;
    
    return { teamAScore, teamBScore, isAllSquare: false, leadingTeam };
  };

  const renderCombinedScorecard = () => {
    if (courseHoles.length === 0) return null;

    const matchScore = getMatchScoreDisplay();
    
    // Calculate totals for each team
    const teamAFrontTotal = frontNine.reduce((sum, h) => sum + (getTeamBestScore(h.hole_number, 'A') || 0), 0);
    const teamBFrontTotal = frontNine.reduce((sum, h) => sum + (getTeamBestScore(h.hole_number, 'B') || 0), 0);
    const teamABackTotal = backNine.reduce((sum, h) => sum + (getTeamBestScore(h.hole_number, 'A') || 0), 0);
    const teamBBackTotal = backNine.reduce((sum, h) => sum + (getTeamBestScore(h.hole_number, 'B') || 0), 0);
    const frontNinePar = frontNine.reduce((sum, h) => sum + h.par, 0);
    const backNinePar = backNine.reduce((sum, h) => sum + h.par, 0);
    
    // Get score color based on par comparison
    const getScoreColor = (score: number | null, par: number) => {
      if (score === null) return '';
      if (score < par) return 'text-red-600 font-bold'; // birdie or better
      if (score > par) return 'text-foreground'; // bogey or worse
      return 'text-foreground'; // par
    };

    return (
      <Card className="overflow-hidden">
        <Collapsible open={scorecardOpen} onOpenChange={setScorecardOpen}>
          <CollapsibleTrigger className="w-full">
            <div className="flex items-center p-3 hover:bg-muted/50 transition-colors">
              <ChevronDown className={`h-5 w-5 text-muted-foreground transition-transform mr-2 ${scorecardOpen ? 'rotate-180' : '-rotate-90'}`} />
              
              {/* Team A Name and Players */}
              <div className="flex-1 text-left">
                <div className="text-sm font-semibold text-blue-600 dark:text-blue-400 truncate">
                  {game.team_a_name}
                </div>
                <div className="text-xs text-muted-foreground truncate">
                  {game.team_a_players.map(p => p.displayName.split(' ')[0]).join(' & ')}
                </div>
              </div>
              
              {/* Score Display in Middle with Arrow */}
              <div className="flex items-center justify-center mx-4">
                {matchScore.isAllSquare ? (
                  <div className="px-6 py-2 bg-muted rounded-md">
                    <span className="text-sm font-bold text-muted-foreground">AS</span>
                  </div>
                ) : (
                  <div className="flex items-center">
                    {/* Arrow pointing left + Score (Team A leading) */}
                    {matchScore.leadingTeam === 'A' && (
                      <>
                        <div 
                          className="w-0 h-0 border-t-[14px] border-t-transparent border-b-[14px] border-b-transparent border-r-[10px] border-r-blue-600"
                        />
                        <div className="px-5 py-2 bg-blue-600 text-white flex items-center justify-center">
                          <span className="text-sm font-bold">
                            {matchScore.teamAScore || Math.abs(game.match_status)} UP
                          </span>
                        </div>
                      </>
                    )}
                    {/* Score + Arrow pointing right (Team B leading) */}
                    {matchScore.leadingTeam === 'B' && (
                      <>
                        <div className="px-5 py-2 bg-red-600 text-white flex items-center justify-center">
                          <span className="text-sm font-bold">
                            {matchScore.teamBScore || Math.abs(game.match_status)} UP
                          </span>
                        </div>
                        <div 
                          className="w-0 h-0 border-t-[14px] border-t-transparent border-b-[14px] border-b-transparent border-l-[10px] border-l-red-600"
                        />
                      </>
                    )}
                  </div>
                )}
              </div>
              
              {/* Team B Name and Players */}
              <div className="flex-1 text-right">
                <div className="text-sm font-semibold text-red-600 dark:text-red-400 truncate">
                  {game.team_b_name}
                </div>
                <div className="text-xs text-muted-foreground truncate">
                  {game.team_b_players.map(p => p.displayName.split(' ')[0]).join(' & ')}
                </div>
              </div>
            </div>
          </CollapsibleTrigger>
          <CollapsibleContent>
            {/* Front 9 - Match Play Style */}
            <div className="border rounded-lg overflow-hidden mx-2 mb-2">
              <Table className="table-fixed w-full">
                <TableHeader>
                  <TableRow className="bg-primary/5">
                    <TableHead className="text-center font-bold text-[10px] px-0 py-1 w-[44px]">Hole</TableHead>
                    {frontNine.map(hole => (
                      <TableHead key={hole.hole_number} className="text-center font-bold text-[10px] px-0 py-1">
                        {hole.hole_number}
                      </TableHead>
                    ))}
                    <TableHead className="text-center font-bold text-[10px] px-0 py-1 bg-primary/10">Out</TableHead>
                    {backNine.length > 0 && <TableHead className="text-center font-bold text-[10px] px-0 py-1 bg-primary/10"></TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {/* Par Row */}
                  <TableRow>
                    <TableCell className="font-medium text-muted-foreground text-[10px] px-0 py-1 w-[44px]">Par</TableCell>
                    {frontNine.map(hole => (
                      <TableCell key={hole.hole_number} className="text-center font-semibold text-[10px] px-0 py-1">
                        {hole.par}
                      </TableCell>
                    ))}
                    <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1">
                      {frontNinePar}
                    </TableCell>
                    {backNine.length > 0 && <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1"></TableCell>}
                  </TableRow>
                  
                  {/* Team A Players */}
                  {game.team_a_players.map((player, playerIndex) => {
                    const playerFrontTotal = frontNine.reduce((sum, h) => {
                      const scores = getPlayerScoresForHole(h.hole_number, 'A');
                      const playerScore = scores.find(s => s.playerId === player.odId || s.playerName === player.displayName);
                      return sum + (playerScore?.grossScore || 0);
                    }, 0);
                    
                    return (
                      <TableRow key={player.odId || playerIndex}>
                        <TableCell className="font-medium text-blue-600 text-[10px] px-0.5 py-1 w-[44px] truncate">
                          {player.displayName.split(' ')[0]}
                        </TableCell>
                        {frontNine.map(hole => {
                          const scores = getPlayerScoresForHole(hole.hole_number, 'A');
                          const playerScore = scores.find(s => s.playerId === player.odId || s.playerName === player.displayName);
                          const score = playerScore?.grossScore;
                          return (
                            <TableCell 
                              key={hole.hole_number} 
                              className={`text-center text-[10px] px-0 py-1 ${getScoreColor(score || null, hole.par)}`}
                            >
                              {score || ''}
                            </TableCell>
                          );
                        })}
                        <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1">
                          {playerFrontTotal || ''}
                        </TableCell>
                        {backNine.length > 0 && <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1"></TableCell>}
                      </TableRow>
                    );
                  })}
                  
                  {/* Match Status Row */}
                  <TableRow className="bg-muted/30">
                    <TableCell className="font-bold text-[10px] px-0 py-1 w-[44px]">Score</TableCell>
                    {frontNine.map(hole => {
                      const { text, leadingTeam } = getMatchStatusAfterHole(hole.hole_number);
                      return (
                        <TableCell 
                          key={hole.hole_number} 
                          className={`text-center font-bold text-[10px] px-0 py-1 ${
                            leadingTeam === 'A' ? 'bg-blue-500 text-white' :
                            leadingTeam === 'B' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300' : ''
                          }`}
                        >
                          {text}
                        </TableCell>
                      );
                    })}
                    <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1"></TableCell>
                    {backNine.length > 0 && <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1"></TableCell>}
                  </TableRow>
                  
                  {/* Team B Players */}
                  {game.team_b_players.map((player, playerIndex) => {
                    const playerFrontTotal = frontNine.reduce((sum, h) => {
                      const scores = getPlayerScoresForHole(h.hole_number, 'B');
                      const playerScore = scores.find(s => s.playerId === player.odId || s.playerName === player.displayName);
                      return sum + (playerScore?.grossScore || 0);
                    }, 0);
                    
                    return (
                      <TableRow key={player.odId || playerIndex}>
                        <TableCell className="font-medium text-red-600 text-[10px] px-0.5 py-1 w-[44px] truncate">
                          {player.displayName.split(' ')[0]}
                        </TableCell>
                        {frontNine.map(hole => {
                          const scores = getPlayerScoresForHole(hole.hole_number, 'B');
                          const playerScore = scores.find(s => s.playerId === player.odId || s.playerName === player.displayName);
                          const score = playerScore?.grossScore;
                          return (
                            <TableCell 
                              key={hole.hole_number} 
                              className={`text-center text-[10px] px-0 py-1 ${getScoreColor(score || null, hole.par)}`}
                            >
                              {score || ''}
                            </TableCell>
                          );
                        })}
                        <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1">
                          {playerFrontTotal || ''}
                        </TableCell>
                        {backNine.length > 0 && <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1"></TableCell>}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Back 9 */}
            {backNine.length > 0 && (
              <div className="border rounded-lg overflow-hidden mx-2 mb-2">
                <Table className="table-fixed w-full">
                  <TableHeader>
                    <TableRow className="bg-primary/5">
                      <TableHead className="text-center font-bold text-[10px] px-0 py-1 w-[44px]">Hole</TableHead>
                      {backNine.map(hole => (
                        <TableHead key={hole.hole_number} className="text-center font-bold text-[10px] px-0 py-1">
                          {hole.hole_number}
                        </TableHead>
                      ))}
                      <TableHead className="text-center font-bold text-[10px] px-0 py-1 bg-primary/10">In</TableHead>
                      <TableHead className="text-center font-bold text-[10px] px-0 py-1 bg-primary/10">Tot</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {/* Par Row */}
                    <TableRow>
                      <TableCell className="font-medium text-muted-foreground text-[10px] px-0 py-1 w-[44px]">Par</TableCell>
                      {backNine.map(hole => (
                        <TableCell key={hole.hole_number} className="text-center font-semibold text-[10px] px-0 py-1">
                          {hole.par}
                        </TableCell>
                      ))}
                      <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1">
                        {backNinePar}
                      </TableCell>
                      <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1">
                        {frontNinePar + backNinePar}
                      </TableCell>
                    </TableRow>
                    
                    {/* Team A Players */}
                    {game.team_a_players.map((player, playerIndex) => {
                      const playerFrontTotal = frontNine.reduce((sum, h) => {
                        const scores = getPlayerScoresForHole(h.hole_number, 'A');
                        const playerScore = scores.find(s => s.playerId === player.odId || s.playerName === player.displayName);
                        return sum + (playerScore?.grossScore || 0);
                      }, 0);
                      const playerBackTotal = backNine.reduce((sum, h) => {
                        const scores = getPlayerScoresForHole(h.hole_number, 'A');
                        const playerScore = scores.find(s => s.playerId === player.odId || s.playerName === player.displayName);
                        return sum + (playerScore?.grossScore || 0);
                      }, 0);
                      
                      return (
                        <TableRow key={player.odId || playerIndex}>
                          <TableCell className="font-medium text-blue-600 text-[10px] px-0.5 py-1 w-[44px] truncate">
                            {player.displayName.split(' ')[0]}
                          </TableCell>
                          {backNine.map(hole => {
                            const scores = getPlayerScoresForHole(hole.hole_number, 'A');
                            const playerScore = scores.find(s => s.playerId === player.odId || s.playerName === player.displayName);
                            const score = playerScore?.grossScore;
                            return (
                              <TableCell 
                                key={hole.hole_number} 
                                className={`text-center text-[10px] px-0 py-1 ${getScoreColor(score || null, hole.par)}`}
                              >
                                {score || ''}
                              </TableCell>
                            );
                          })}
                          <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1">
                            {playerBackTotal || ''}
                          </TableCell>
                          <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1">
                            {(playerFrontTotal + playerBackTotal) || ''}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    
                    {/* Match Status Row */}
                    <TableRow className="bg-muted/30">
                      <TableCell className="font-bold text-[10px] px-0 py-1 w-[44px]">Score</TableCell>
                      {backNine.map(hole => {
                        const { text, leadingTeam } = getMatchStatusAfterHole(hole.hole_number);
                        return (
                          <TableCell 
                            key={hole.hole_number} 
                            className={`text-center font-bold text-[10px] px-0 py-1 ${
                              leadingTeam === 'A' ? 'bg-blue-500 text-white' :
                              leadingTeam === 'B' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300' : ''
                            }`}
                          >
                            {text}
                          </TableCell>
                        );
                      })}
                      <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1"></TableCell>
                      <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1"></TableCell>
                    </TableRow>
                    
                    {/* Team B Players */}
                    {game.team_b_players.map((player, playerIndex) => {
                      const playerFrontTotal = frontNine.reduce((sum, h) => {
                        const scores = getPlayerScoresForHole(h.hole_number, 'B');
                        const playerScore = scores.find(s => s.playerId === player.odId || s.playerName === player.displayName);
                        return sum + (playerScore?.grossScore || 0);
                      }, 0);
                      const playerBackTotal = backNine.reduce((sum, h) => {
                        const scores = getPlayerScoresForHole(h.hole_number, 'B');
                        const playerScore = scores.find(s => s.playerId === player.odId || s.playerName === player.displayName);
                        return sum + (playerScore?.grossScore || 0);
                      }, 0);
                      
                      return (
                        <TableRow key={player.odId || playerIndex}>
                          <TableCell className="font-medium text-red-600 text-[10px] px-0.5 py-1 w-[44px] truncate">
                            {player.displayName.split(' ')[0]}
                          </TableCell>
                          {backNine.map(hole => {
                            const scores = getPlayerScoresForHole(hole.hole_number, 'B');
                            const playerScore = scores.find(s => s.playerId === player.odId || s.playerName === player.displayName);
                            const score = playerScore?.grossScore;
                            return (
                              <TableCell 
                                key={hole.hole_number} 
                                className={`text-center text-[10px] px-0 py-1 ${getScoreColor(score || null, hole.par)}`}
                              >
                                {score || ''}
                              </TableCell>
                            );
                          })}
                          <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1">
                            {playerBackTotal || ''}
                          </TableCell>
                          <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1">
                            {(playerFrontTotal + playerBackTotal) || ''}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CollapsibleContent>
        </Collapsible>
      </Card>
    );
  };

  return (
    <div className="min-h-screen pb-24 bg-background">
      <GameHeader
        gameTitle={game.round_name || 'Best Ball'}
        courseName={game.course_name}
        pageTitle="Leaderboard"
        isAdmin={isAdmin}
        onFinish={handleFinishGame}
        onSaveAndExit={() => navigate('/profile')}
        onDelete={handleDeleteGame}
        gameName="Best Ball Game"
      />

      <div className="max-w-4xl mx-auto px-4 space-y-4">
        {isMatchPlay ? (
          // For match play, render combined scorecard (side-by-side format with arrow indicating leader)
          renderCombinedScorecard()
        ) : (
          <>
            {(() => {
              const isTied = game.team_a_total === game.team_b_total;
              // In spectator mode, sort by leaderboard position (lower score = higher position)
              // When not spectator, keep fixed order (Team A first)
              if (isSpectator) {
                // Sort by total score - lower is better
                if (game.team_a_total <= game.team_b_total) {
                  return (
                    <>
                      {renderTeamScorecard('A', 1, isTied)}
                      {renderTeamScorecard('B', isTied ? 1 : 2, isTied)}
                    </>
                  );
                } else {
                  return (
                    <>
                      {renderTeamScorecard('B', 1, isTied)}
                      {renderTeamScorecard('A', isTied ? 1 : 2, isTied)}
                    </>
                  );
                }
              } else {
                // Not spectator - keep fixed order (Team A first, then Team B)
                return (
                  <>
                    {renderTeamScorecard('A', game.team_a_total <= game.team_b_total ? 1 : 2, isTied)}
                    {renderTeamScorecard('B', game.team_b_total <= game.team_a_total ? 1 : (isTied ? 1 : 2), isTied)}
                  </>
                );
              }
            })()}
          </>
        )}

        {/* Like and Comment Actions */}
        <LeaderboardActions 
          gameId={gameId} 
          gameType="best_ball" 
          feedPath={`/best-ball/${gameId}/feed`}
          scorecardPlayerName={game.round_name || "Best Ball Game"}
        />
      </div>

      {gameId && !isSpectatorLoading && <BestBallBottomTabBar gameId={gameId} isSpectator={isSpectator} />}
    </div>
  );
}
