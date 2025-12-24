import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { MatchPlayBottomTabBar } from "@/components/MatchPlayBottomTabBar";
import { MatchPlayGame, MatchPlayHole } from "@/types/matchPlay";
import { formatMatchStatus } from "@/utils/matchPlayScoring";
import { ThumbsUp, MessageSquare } from "lucide-react";
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

export default function MatchPlayLeaderboard() {
  const { gameId } = useParams();
  const [game, setGame] = useState<MatchPlayGame | null>(null);
  const [holes, setHoles] = useState<MatchPlayHole[]>([]);
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
        .from("match_play_games")
        .select("*")
        .eq("id", gameId)
        .single();

      if (gameData) {
        setGame(gameData as MatchPlayGame);

        // Fetch course holes for scorecard structure
        if (gameData.course_id) {
          const { data: courseHolesData } = await supabase
            .from("course_holes")
            .select("hole_number, par, stroke_index")
            .eq("course_id", gameData.course_id)
            .order("hole_number");

          if (courseHolesData) {
            // Filter based on holes_played
            const filteredHoles = gameData.holes_played === 9 
              ? courseHolesData.slice(0, 9) 
              : courseHolesData;
            setCourseHoles(filteredHoles);
          }
        }
      }

      const { data: holesData } = await supabase
        .from("match_play_holes")
        .select("*")
        .eq("game_id", gameId)
        .order("hole_number");

      if (holesData) {
        setHoles(holesData as MatchPlayHole[]);
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
        {gameId && <MatchPlayBottomTabBar gameId={gameId} />}
      </div>
    );
  }

  if (!game) {
    return (
      <div className="min-h-screen pb-24 flex items-center justify-center">
        <div className="text-muted-foreground">Game not found</div>
        {gameId && <MatchPlayBottomTabBar gameId={gameId} />}
      </div>
    );
  }

  // Create a map for quick hole data lookup
  const holesMap = new Map(holes.map(h => [h.hole_number, h]));

  const frontNine = courseHoles.filter(h => h.hole_number <= 9);
  const backNine = courseHoles.filter(h => h.hole_number > 9);
  const totalHoles = game.holes_played;

  const getPlayerScore = (holeNumber: number, playerNum: number) => {
    const hole = holesMap.get(holeNumber);
    if (!hole) return null;
    return playerNum === 1 ? hole.player_1_gross_score : hole.player_2_gross_score;
  };

  const getHoleResult = (holeNumber: number) => {
    const hole = holesMap.get(holeNumber);
    return hole?.hole_result || 0;
  };

  const getMatchStatusAfter = (holeNumber: number) => {
    const hole = holesMap.get(holeNumber);
    return hole?.match_status_after || 0;
  };

  // Calculate running match status for display
  const getMatchStatusDisplay = (holeNumber: number) => {
    const status = getMatchStatusAfter(holeNumber);
    if (status === 0) return { text: "T", color: "bg-muted text-muted-foreground" };
    if (status > 0) {
      // Player 1 (blue) is up
      return { text: `${status}UP`, color: "bg-blue-500 text-white" };
    }
    // Player 2 (red) is up
    return { text: `${Math.abs(status)}UP`, color: "bg-destructive text-destructive-foreground" };
  };

  // Check if player won the hole (for circling their score)
  const playerWonHole = (holeNumber: number, playerNum: number) => {
    const result = getHoleResult(holeNumber);
    if (playerNum === 1) return result === 1;
    if (playerNum === 2) return result === -1;
    return false;
  };

  // Calculate front/back nine totals
  const frontNinePar = frontNine.reduce((sum, h) => sum + h.par, 0);
  const backNinePar = backNine.reduce((sum, h) => sum + h.par, 0);

  const getFrontNineTotal = (playerNum: number) => {
    return frontNine.reduce((sum, h) => sum + (getPlayerScore(h.hole_number, playerNum) || 0), 0);
  };

  const getBackNineTotal = (playerNum: number) => {
    return backNine.reduce((sum, h) => sum + (getPlayerScore(h.hole_number, playerNum) || 0), 0);
  };

  // Get final match status
  const finalMatchStatus = game.match_status;
  const getFinalStatusDisplay = () => {
    if (finalMatchStatus === 0) return { text: "T", color: "bg-muted text-muted-foreground" };
    if (finalMatchStatus > 0) {
      return { text: `${finalMatchStatus}UP`, color: "bg-primary text-primary-foreground" };
    }
    return { text: `${Math.abs(finalMatchStatus)}UP`, color: "bg-destructive text-destructive-foreground" };
  };

  const renderScoreCell = (holeNumber: number, playerNum: number) => {
    const score = getPlayerScore(holeNumber, playerNum);
    const won = playerWonHole(holeNumber, playerNum);
    
    if (score === null) return "";
    
    // Display dash for conceded holes (-1)
    const displayScore = score === -1 ? "–" : score;
    
    if (won) {
      // Player 1 wins = blue, Player 2 wins = red (destructive)
      const colorClass = playerNum === 1 ? "text-blue-500" : "text-destructive";
      return (
        <span className={`font-bold ${colorClass}`}>
          {displayScore}
        </span>
      );
    }
    return displayScore;
  };

  const renderNine = (nineHoles: CourseHole[], label: string, parTotal: number) => {
    if (nineHoles.length === 0) return null;

    return (
      <div>
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="text-left font-bold text-[10px] px-1 py-1.5 sticky left-0 bg-muted/50 z-10 w-[50px]">HOLE</TableHead>
              {nineHoles.map(hole => (
                <TableHead key={hole.hole_number} className="text-center font-bold text-[10px] px-0.5 py-1.5 w-[28px]">
                  {hole.hole_number}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {/* PAR Row */}
            <TableRow>
              <TableCell className="font-medium text-muted-foreground text-[10px] px-1 py-1 sticky left-0 bg-background z-10">PAR</TableCell>
              {nineHoles.map(hole => (
                <TableCell key={hole.hole_number} className="text-center text-[10px] px-0.5 py-1">
                  {hole.par}
                </TableCell>
              ))}
            </TableRow>

            {/* Player 1 Row */}
            <TableRow>
              <TableCell className="px-1 py-1 sticky left-0 bg-background z-10">
                <div className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0"></span>
                  <span className="font-medium text-[10px] truncate text-blue-500">{game.player_1.split(' ')[0]}</span>
                </div>
              </TableCell>
              {nineHoles.map(hole => (
                <TableCell key={hole.hole_number} className="text-center font-bold text-xs px-0.5 py-1">
                  {renderScoreCell(hole.hole_number, 1)}
                </TableCell>
              ))}
            </TableRow>

            {/* Match Status Row */}
            <TableRow className="bg-muted/30">
              <TableCell className="font-medium text-muted-foreground text-[10px] px-1 py-1 sticky left-0 bg-muted/30 z-10">Score</TableCell>
              {nineHoles.map(hole => {
                const holeData = holesMap.get(hole.hole_number);
                if (!holeData) {
                  return (
                    <TableCell key={hole.hole_number} className="text-center text-[9px] px-0.5 py-0.5">
                    </TableCell>
                  );
                }
                const status = getMatchStatusDisplay(hole.hole_number);
                return (
                  <TableCell key={hole.hole_number} className="text-center text-[9px] px-0 py-0.5">
                    <span className={`inline-flex items-center justify-center px-1 py-0.5 rounded text-[8px] font-bold ${status.color}`}>
                      {status.text}
                    </span>
                  </TableCell>
                );
              })}
            </TableRow>

            {/* Player 2 Row */}
            <TableRow>
              <TableCell className="px-1 py-1 sticky left-0 bg-background z-10">
                <div className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-destructive flex-shrink-0"></span>
                  <span className="font-medium text-[10px] truncate text-destructive">{game.player_2.split(' ')[0]}</span>
                </div>
              </TableCell>
              {nineHoles.map(hole => (
                <TableCell key={hole.hole_number} className="text-center font-bold text-xs px-0.5 py-1">
                  {renderScoreCell(hole.hole_number, 2)}
                </TableCell>
              ))}
            </TableRow>
          </TableBody>
        </Table>
      </div>
    );
  };

  return (
    <div className="min-h-screen pb-24 bg-background">
      {/* Header */}
      <div className="bg-primary text-primary-foreground p-4">
        <div className="text-center">
          <h2 className="text-lg font-bold">{game.course_name}</h2>
          <p className="text-sm opacity-90">Match Play</p>
        </div>
      </div>

      {/* Match Status Banner */}
      <div className="bg-primary/10 p-3 text-center">
        <p className="text-lg font-bold text-primary">
          {formatMatchStatus(game.match_status, game.holes_remaining, game.player_1, game.player_2)}
        </p>
        <p className="text-sm text-muted-foreground">
          {game.holes_remaining} holes remaining
        </p>
      </div>

      <div className="max-w-4xl mx-auto p-4">
        <Card className="overflow-hidden">
          {/* Front 9 */}
          {renderNine(frontNine, "Out", frontNinePar)}
          
          {/* Back 9 */}
          {backNine.length > 0 && (
            <div className="border-t">
              {renderNine(backNine, "In", backNinePar)}
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
                <span className="text-xs text-center">Comment to<br/>Game Feed</span>
              </Button>
            </div>
          </div>
        </Card>
      </div>

      {gameId && <MatchPlayBottomTabBar gameId={gameId} />}
    </div>
  );
}
