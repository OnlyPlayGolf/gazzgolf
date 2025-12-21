import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { BestBallBottomTabBar } from "@/components/BestBallBottomTabBar";
import { BestBallGame, BestBallHole, BestBallPlayer, BestBallPlayerScore, BestBallGameType } from "@/types/bestBall";
import { formatMatchStatus } from "@/utils/bestBallScoring";
import { ChevronDown } from "lucide-react";
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
  const [expandedTeam, setExpandedTeam] = useState<'A' | 'B' | null>('A');
  const [loading, setLoading] = useState(true);

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
        const typedGame: BestBallGame = {
          ...gameData,
          game_type: (gameData.game_type as BestBallGameType) || 'match',
          team_a_players: gameData.team_a_players as unknown as BestBallPlayer[],
          team_b_players: gameData.team_b_players as unknown as BestBallPlayer[],
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

  const renderTeamCard = (team: 'A' | 'B') => {
    const teamName = team === 'A' ? game.team_a_name : game.team_b_name;
    const teamTotal = team === 'A' ? game.team_a_total : game.team_b_total;
    const holesWon = team === 'A' ? teamAHolesWon : teamBHolesWon;
    const isExpanded = expandedTeam === team;
    const isLeading = isMatchPlay ? leader === team : strokeLeader === team;

    return (
      <Card key={team} className="overflow-hidden">
        <div 
          className="bg-card border-b border-border p-4 cursor-pointer hover:bg-muted/50 transition-colors"
          onClick={() => setExpandedTeam(isExpanded ? null : team)}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <ChevronDown 
                size={20} 
                className={`text-muted-foreground transition-transform ${isExpanded ? '' : '-rotate-90'}`}
              />
              <div className={`w-3 h-3 rounded-full ${team === 'A' ? 'bg-blue-500' : 'bg-red-500'}`} />
              <div>
                <div className="text-xl font-bold">{teamName}</div>
                <div className="text-sm text-muted-foreground">
                  {holes.length} holes played
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className={`text-3xl font-bold ${isLeading ? 'text-primary' : ''}`}>
                {isMatchPlay ? holesWon : teamTotal}
              </div>
              <div className="text-sm text-muted-foreground">
                {isMatchPlay ? 'HOLES WON' : 'TOTAL'}
              </div>
            </div>
          </div>
        </div>

        {isExpanded && courseHoles.length > 0 && (
          <>
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
                  <TableRow className="font-bold">
                    <TableCell className="font-bold text-xs px-1 py-1.5 sticky left-0 bg-background z-10">Best</TableCell>
                    {frontNine.map(hole => {
                      const score = getTeamBestScore(hole.hole_number, team);
                      const result = getHoleResult(hole.hole_number);
                      const won = (team === 'A' && result === 1) || (team === 'B' && result === -1);
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
                      {frontNine.reduce((sum, h) => sum + (getTeamBestScore(h.hole_number, team) || 0), 0) || ''}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>

            {backNine.length > 0 && (
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
                      <TableCell className="font-bold text-xs px-1 py-1.5 sticky left-0 bg-background z-10">Best</TableCell>
                      {backNine.map(hole => {
                        const score = getTeamBestScore(hole.hole_number, team);
                        const result = getHoleResult(hole.hole_number);
                        const won = (team === 'A' && result === 1) || (team === 'B' && result === -1);
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
                        {backNine.reduce((sum, h) => sum + (getTeamBestScore(h.hole_number, team) || 0), 0) || ''}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            )}

            <div className="border-t bg-muted/30 p-4">
              <div className="flex items-center justify-around text-center">
                {isMatchPlay && (
                  <div>
                    <div className="text-sm text-muted-foreground">Holes Won</div>
                    <div className="text-2xl font-bold">{holesWon}</div>
                  </div>
                )}
                <div>
                  <div className="text-sm text-muted-foreground">Total</div>
                  <div className="text-2xl font-bold">{teamTotal}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Thru</div>
                  <div className="text-2xl font-bold">{holes.length}</div>
                </div>
              </div>
            </div>
          </>
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

      <div className="bg-primary/10 p-3 text-center">
        <p className="text-lg font-bold text-primary">
          {isMatchPlay 
            ? formatMatchStatus(game.match_status, game.holes_remaining, game.team_a_name, game.team_b_name)
            : `${game.team_a_name}: ${game.team_a_total} | ${game.team_b_name}: ${game.team_b_total}`
          }
        </p>
        <p className="text-sm text-muted-foreground">
          {game.holes_remaining} holes remaining
        </p>
      </div>

      <div className="max-w-4xl mx-auto p-4 space-y-4">
        {renderTeamCard('A')}
        {renderTeamCard('B')}
      </div>

      {gameId && <BestBallBottomTabBar gameId={gameId} />}
    </div>
  );
}
