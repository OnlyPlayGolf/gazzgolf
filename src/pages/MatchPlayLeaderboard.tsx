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
      return { text: `${status}UP`, color: "bg-primary text-primary-foreground" };
    }
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
      return (
        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full border-2 border-current">
          {displayScore}
        </span>
      );
    }
    return displayScore;
  };

  const renderNine = (nineHoles: CourseHole[], label: string, parTotal: number) => {
    if (nineHoles.length === 0) return null;

    const lastHoleInNine = nineHoles[nineHoles.length - 1].hole_number;
    const nineStatus = getMatchStatusDisplay(lastHoleInNine);

    return (
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="text-left font-bold text-xs px-2 py-2 sticky left-0 bg-muted/50 z-10 min-w-[80px]">HOLE</TableHead>
              {nineHoles.map(hole => (
                <TableHead key={hole.hole_number} className="text-center font-bold text-xs px-1 py-2 w-[36px]">
                  <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full ${
                    hole.hole_number <= 5 ? 'bg-muted-foreground text-muted' : 
                    hole.hole_number <= 7 ? 'bg-destructive text-destructive-foreground' : 
                    'bg-muted-foreground text-muted'
                  }`}>
                    {hole.hole_number}
                  </span>
                </TableHead>
              ))}
              <TableHead className="text-center font-bold text-xs px-2 py-2 bg-foreground text-background w-[40px]">
                {totalHoles}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {/* PAR Row */}
            <TableRow>
              <TableCell className="font-medium text-muted-foreground text-xs px-2 py-2 sticky left-0 bg-background z-10">PAR</TableCell>
              {nineHoles.map(hole => (
                <TableCell key={hole.hole_number} className="text-center text-xs px-1 py-2">
                  {hole.par}
                </TableCell>
              ))}
              <TableCell className="text-center font-bold text-xs px-1 py-2 bg-muted">
                {parTotal}
              </TableCell>
            </TableRow>

            {/* Player 1 Row */}
            <TableRow>
              <TableCell className="px-2 py-2 sticky left-0 bg-background z-10">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-destructive"></span>
                  <span className="font-medium text-sm truncate max-w-[60px]">{game.player_1.split(' ')[0]}</span>
                </div>
              </TableCell>
              {nineHoles.map(hole => (
                <TableCell key={hole.hole_number} className="text-center font-bold text-sm px-1 py-2">
                  {renderScoreCell(hole.hole_number, 1)}
                </TableCell>
              ))}
              <TableCell className="text-center font-bold text-sm px-1 py-2 bg-muted">
                <span className="inline-flex items-center justify-center w-7 h-7 rounded-full border-2 border-muted-foreground">
                  {label === "Out" ? getFrontNineTotal(1) || '' : getBackNineTotal(1) || ''}
                </span>
              </TableCell>
            </TableRow>

            {/* Match Status Row */}
            <TableRow className="bg-muted/30">
              <TableCell className="font-medium text-muted-foreground text-xs px-2 py-2 sticky left-0 bg-muted/30 z-10">Score</TableCell>
              {nineHoles.map(hole => {
                const holeData = holesMap.get(hole.hole_number);
                if (!holeData) {
                  return (
                    <TableCell key={hole.hole_number} className="text-center text-xs px-1 py-1">
                      T
                    </TableCell>
                  );
                }
                const status = getMatchStatusDisplay(hole.hole_number);
                return (
                  <TableCell key={hole.hole_number} className="text-center text-xs px-0.5 py-1">
                    <span className={`inline-flex items-center justify-center px-1.5 py-0.5 rounded text-[10px] font-bold ${status.color}`}>
                      {status.text}
                    </span>
                  </TableCell>
                );
              })}
              <TableCell className="text-center text-xs px-1 py-1 bg-muted">
                <span className={`inline-flex items-center justify-center px-2 py-1 rounded text-xs font-bold ${getFinalStatusDisplay().color}`}>
                  {getFinalStatusDisplay().text}
                </span>
              </TableCell>
            </TableRow>

            {/* Player 2 Row */}
            <TableRow>
              <TableCell className="px-2 py-2 sticky left-0 bg-background z-10">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-primary"></span>
                  <span className="font-medium text-sm truncate max-w-[60px]">{game.player_2.split(' ')[0]}</span>
                </div>
              </TableCell>
              {nineHoles.map(hole => (
                <TableCell key={hole.hole_number} className="text-center font-bold text-sm px-1 py-2">
                  {renderScoreCell(hole.hole_number, 2)}
                </TableCell>
              ))}
              <TableCell className="text-center font-bold text-sm px-1 py-2 bg-muted">
                {label === "Out" ? getFrontNineTotal(2) || '' : getBackNineTotal(2) || ''}
              </TableCell>
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
