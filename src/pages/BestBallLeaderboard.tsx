import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { BestBallBottomTabBar } from "@/components/BestBallBottomTabBar";
import { BestBallGame, BestBallHole, BestBallPlayer, BestBallPlayerScore, BestBallGameType } from "@/types/bestBall";
import { formatMatchStatus } from "@/utils/bestBallScoring";

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
              </TableRow>
            </TableBody>
          </Table>
        </div>

        {/* Back 9 */}
        {backNine.length > 0 && (
          <div className="border-t">
            <Table className="table-fixed w-full">
              <TableHeader>
                <TableRow className="bg-primary/5">
                  <TableHead className="text-center font-bold text-[10px] px-0.5 py-1.5 w-[40px] bg-primary/5">Hole</TableHead>
                  {backNine.map(hole => (
                    <TableHead key={hole.hole_number} className="text-center font-bold text-[10px] px-0 py-1.5 w-[24px]">
                      {hole.hole_number}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="font-medium text-muted-foreground text-[10px] px-0.5 py-1 bg-background">Par</TableCell>
                  {backNine.map(hole => (
                    <TableCell key={hole.hole_number} className="text-center font-semibold text-[10px] px-0 py-1">
                      {hole.par}
                    </TableCell>
                  ))}
                </TableRow>
                {/* Team A Row */}
                <TableRow className="font-bold">
                  <TableCell className="font-bold text-[10px] px-0.5 py-1 bg-background">
                    <div className="flex items-center gap-0.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0" />
                      <span className="truncate">{game.team_a_name}</span>
                    </div>
                  </TableCell>
                  {backNine.map(hole => {
                    const score = getTeamBestScore(hole.hole_number, 'A');
                    const result = getHoleResult(hole.hole_number);
                    const won = result === 1;
                    return (
                      <TableCell 
                        key={hole.hole_number} 
                        className={`text-center font-bold text-[10px] px-0 py-1 ${
                          won ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' : ''
                        }`}
                      >
                        {score || ''}
                      </TableCell>
                    );
                  })}
                </TableRow>
                {/* Team B Row */}
                <TableRow className="font-bold">
                  <TableCell className="font-bold text-[10px] px-0.5 py-1 bg-background">
                    <div className="flex items-center gap-0.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" />
                      <span className="truncate">{game.team_b_name}</span>
                    </div>
                  </TableCell>
                  {backNine.map(hole => {
                    const score = getTeamBestScore(hole.hole_number, 'B');
                    const result = getHoleResult(hole.hole_number);
                    const won = result === -1;
                    return (
                      <TableCell 
                        key={hole.hole_number} 
                        className={`text-center font-bold text-[10px] px-0 py-1 ${
                          won ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' : ''
                        }`}
                      >
                        {score || ''}
                      </TableCell>
                    );
                  })}
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
        {renderCombinedScorecard()}
      </div>

      {gameId && <BestBallBottomTabBar gameId={gameId} />}
    </div>
  );
}
