import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { ChevronDown } from "lucide-react";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { BestBallBottomTabBar } from "@/components/BestBallBottomTabBar";
import { BestBallGame, BestBallHole, BestBallPlayer, BestBallPlayerScore, BestBallGameType } from "@/types/bestBall";
import { formatMatchStatus } from "@/utils/bestBallScoring";
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
  const [game, setGame] = useState<BestBallGame | null>(null);
  const [holes, setHoles] = useState<BestBallHole[]>([]);
  const [courseHoles, setCourseHoles] = useState<CourseHole[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedTeam, setExpandedTeam] = useState<'A' | 'B' | null>(null);

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

  if (loading) {
    return (
      <div className="min-h-screen pb-24 flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
        {gameId && <BestBallBottomTabBar gameId={gameId} />}
      </div>
    );
  }

  if (!game) {
    return (
      <div className="min-h-screen pb-24 flex items-center justify-center">
        <div className="text-muted-foreground">Game not found</div>
        {gameId && <BestBallBottomTabBar gameId={gameId} />}
      </div>
    );
  }

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

  const renderTeamScorecard = (team: 'A' | 'B', position: number, isTied: boolean) => {
    if (courseHoles.length === 0) return null;

    const teamName = team === 'A' ? game.team_a_name : game.team_b_name;
    const teamTotal = team === 'A' ? game.team_a_total : game.team_b_total;
    const totalPar = courseHoles.reduce((sum, h) => sum + h.par, 0);
    const toPar = teamTotal - totalPar;
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
            <div className="border-t">
              {/* Front 9 */}
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-primary/5">
                      <TableHead className="text-center font-bold text-xs px-1 py-2 sticky left-0 bg-primary/5 z-10 w-[40px]">Hole</TableHead>
                      {frontNine.map(hole => (
                        <TableHead key={hole.hole_number} className="text-center font-bold text-xs px-2 py-2 w-[28px]">
                          {hole.hole_number}
                        </TableHead>
                      ))}
                      <TableHead className="text-center font-bold text-xs px-2 py-2 bg-primary/10 w-[36px]">Out</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell className="font-medium text-muted-foreground text-xs px-1 py-1.5 sticky left-0 bg-background z-10">Par</TableCell>
                      {frontNine.map(hole => (
                        <TableCell key={hole.hole_number} className="text-center font-semibold text-xs px-1 py-1.5">
                          {hole.par}
                        </TableCell>
                      ))}
                      <TableCell className="text-center font-bold bg-muted text-xs px-1 py-1.5">
                        {frontNinePar}
                      </TableCell>
                    </TableRow>
                    <TableRow className="font-bold">
                      <TableCell className="font-bold text-xs px-1 py-1.5 sticky left-0 bg-background z-10">Score</TableCell>
                      {frontNine.map(hole => {
                        const score = getTeamBestScore(hole.hole_number, team);
                        const par = hole.par;
                        const isUnderPar = score && score < par;
                        const isOverPar = score && score > par;
                        return (
                          <TableCell 
                            key={hole.hole_number} 
                            className={`text-center font-bold text-xs px-1 py-1.5 ${
                              isUnderPar ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400' : 
                              isOverPar ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' : ''
                            }`}
                          >
                            {score || ''}
                          </TableCell>
                        );
                      })}
                      <TableCell className="text-center font-bold bg-muted text-xs px-1 py-1.5">
                        {frontNineTotal || ''}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>

              {/* Back 9 */}
              {backNine.length > 0 && (
                <div className="border-t">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-primary/5">
                        <TableHead className="text-center font-bold text-xs px-1 py-2 sticky left-0 bg-primary/5 z-10 w-[40px]">Hole</TableHead>
                        {backNine.map(hole => (
                          <TableHead key={hole.hole_number} className="text-center font-bold text-xs px-2 py-2 w-[28px]">
                            {hole.hole_number}
                          </TableHead>
                        ))}
                        <TableHead className="text-center font-bold text-xs px-2 py-2 bg-primary/10 w-[36px]">In</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow>
                        <TableCell className="font-medium text-muted-foreground text-xs px-1 py-1.5 sticky left-0 bg-background z-10">Par</TableCell>
                        {backNine.map(hole => (
                          <TableCell key={hole.hole_number} className="text-center font-semibold text-xs px-1 py-1.5">
                            {hole.par}
                          </TableCell>
                        ))}
                        <TableCell className="text-center font-bold bg-muted text-xs px-1 py-1.5">
                          {backNinePar}
                        </TableCell>
                      </TableRow>
                      <TableRow className="font-bold">
                        <TableCell className="font-bold text-xs px-1 py-1.5 sticky left-0 bg-background z-10">Score</TableCell>
                        {backNine.map(hole => {
                          const score = getTeamBestScore(hole.hole_number, team);
                          const par = hole.par;
                          const isUnderPar = score && score < par;
                          const isOverPar = score && score > par;
                          return (
                            <TableCell 
                              key={hole.hole_number} 
                              className={`text-center font-bold text-xs px-1 py-1.5 ${
                                isUnderPar ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400' : 
                                isOverPar ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' : ''
                              }`}
                            >
                              {score || ''}
                            </TableCell>
                          );
                        })}
                        <TableCell className="text-center font-bold bg-muted text-xs px-1 py-1.5">
                          {backNineTotal || ''}
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

  const renderCombinedScorecard = () => {
    if (courseHoles.length === 0) return null;

    return (
      <Card className="overflow-hidden">
        <div className="bg-card border-b border-border p-4">
          <div className="flex items-center justify-between">
            <div className="text-xl font-bold">Scorecard</div>
            <div className="text-sm text-muted-foreground">
              {holes.length} holes played
            </div>
          </div>
        </div>

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
              {/* Team A Row */}
              <TableRow className="font-bold">
                <TableCell className="font-bold text-xs px-1 py-1.5 sticky left-0 bg-background z-10">
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-blue-500" />
                    <span className="truncate max-w-[60px]">{game.team_a_name}</span>
                  </div>
                </TableCell>
                {frontNine.map(hole => {
                  const score = getTeamBestScore(hole.hole_number, 'A');
                  const result = getHoleResult(hole.hole_number);
                  const won = result === 1;
                  return (
                    <TableCell 
                      key={hole.hole_number} 
                      className={`text-center font-bold text-xs px-1 py-1.5 ${
                        won ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' : ''
                      }`}
                    >
                      {score || ''}
                    </TableCell>
                  );
                })}
                <TableCell className="text-center font-bold bg-muted text-xs px-1 py-1.5">
                  {frontNine.reduce((sum, h) => sum + (getTeamBestScore(h.hole_number, 'A') || 0), 0) || ''}
                </TableCell>
              </TableRow>
              {/* Team B Row */}
              <TableRow className="font-bold">
                <TableCell className="font-bold text-xs px-1 py-1.5 sticky left-0 bg-background z-10">
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-red-500" />
                    <span className="truncate max-w-[60px]">{game.team_b_name}</span>
                  </div>
                </TableCell>
                {frontNine.map(hole => {
                  const score = getTeamBestScore(hole.hole_number, 'B');
                  const result = getHoleResult(hole.hole_number);
                  const won = result === -1;
                  return (
                    <TableCell 
                      key={hole.hole_number} 
                      className={`text-center font-bold text-xs px-1 py-1.5 ${
                        won ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' : ''
                      }`}
                    >
                      {score || ''}
                    </TableCell>
                  );
                })}
                <TableCell className="text-center font-bold bg-muted text-xs px-1 py-1.5">
                  {frontNine.reduce((sum, h) => sum + (getTeamBestScore(h.hole_number, 'B') || 0), 0) || ''}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>

        {/* Back 9 */}
        {backNine.length > 0 && (
          <div className="border-t">
            <Table>
              <TableHeader>
                <TableRow className="bg-primary/5">
                  <TableHead className="text-center font-bold text-xs px-1 py-2 sticky left-0 bg-primary/5 z-10">Hole</TableHead>
                  {backNine.map(hole => (
                    <TableHead key={hole.hole_number} className="text-center font-bold text-xs px-2 py-2 w-[28px]">
                      {hole.hole_number}
                    </TableHead>
                  ))}
                  <TableHead className="text-center font-bold text-xs px-2 py-2 bg-primary/10 w-[36px]">In</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
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
                {/* Team A Row */}
                <TableRow className="font-bold">
                  <TableCell className="font-bold text-xs px-1 py-1.5 sticky left-0 bg-background z-10">
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 rounded-full bg-blue-500" />
                      <span className="truncate max-w-[60px]">{game.team_a_name}</span>
                    </div>
                  </TableCell>
                  {backNine.map(hole => {
                    const score = getTeamBestScore(hole.hole_number, 'A');
                    const result = getHoleResult(hole.hole_number);
                    const won = result === 1;
                    return (
                      <TableCell 
                        key={hole.hole_number} 
                        className={`text-center font-bold text-xs px-1 py-1.5 ${
                          won ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' : ''
                        }`}
                      >
                        {score || ''}
                      </TableCell>
                    );
                  })}
                  <TableCell className="text-center font-bold bg-muted text-xs px-1 py-1.5">
                    {backNine.reduce((sum, h) => sum + (getTeamBestScore(h.hole_number, 'A') || 0), 0) || ''}
                  </TableCell>
                </TableRow>
                {/* Team B Row */}
                <TableRow className="font-bold">
                  <TableCell className="font-bold text-xs px-1 py-1.5 sticky left-0 bg-background z-10">
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 rounded-full bg-red-500" />
                      <span className="truncate max-w-[60px]">{game.team_b_name}</span>
                    </div>
                  </TableCell>
                  {backNine.map(hole => {
                    const score = getTeamBestScore(hole.hole_number, 'B');
                    const result = getHoleResult(hole.hole_number);
                    const won = result === -1;
                    return (
                      <TableCell 
                        key={hole.hole_number} 
                        className={`text-center font-bold text-xs px-1 py-1.5 ${
                          won ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' : ''
                        }`}
                      >
                        {score || ''}
                      </TableCell>
                    );
                  })}
                  <TableCell className="text-center font-bold bg-muted text-xs px-1 py-1.5">
                    {backNine.reduce((sum, h) => sum + (getTeamBestScore(h.hole_number, 'B') || 0), 0) || ''}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        )}
      </Card>
    );
  };

  return (
    <div className="min-h-screen pb-24 bg-background">
      <div className="bg-primary text-primary-foreground p-4">
        <div className="text-center">
          <h2 className="text-lg font-bold">{game.course_name}</h2>
          <p className="text-sm opacity-90">Best Ball {isMatchPlay ? 'Match Play' : 'Stroke Play'}</p>
        </div>
      </div>

      {isMatchPlay && (
        <div className="bg-primary/10 p-3 text-center">
          <p className="text-lg font-bold text-primary">
            {formatMatchStatus(game.match_status, game.holes_remaining, game.team_a_name, game.team_b_name)}
          </p>
          <p className="text-sm text-muted-foreground">
            {game.holes_remaining} holes remaining
          </p>
        </div>
      )}

      <div className="max-w-4xl mx-auto p-4 space-y-4">
        {isMatchPlay ? (
          renderCombinedScorecard()
        ) : (
          <>
            {(() => {
              const isTied = game.team_a_total === game.team_b_total;
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
            })()}
          </>
        )}
      </div>

      {gameId && <BestBallBottomTabBar gameId={gameId} />}
    </div>
  );
}
