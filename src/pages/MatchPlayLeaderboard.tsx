import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { MatchPlayBottomTabBar } from "@/components/MatchPlayBottomTabBar";
import { MatchPlayGame, MatchPlayHole } from "@/types/matchPlay";
import { formatMatchStatus } from "@/utils/matchPlayScoring";
import { ThumbsUp, MessageSquare, BarChart3 } from "lucide-react";
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

interface GameWithHoles {
  game: MatchPlayGame;
  holes: MatchPlayHole[];
}

export default function MatchPlayLeaderboard() {
  const { gameId } = useParams();
  const [currentGame, setCurrentGame] = useState<MatchPlayGame | null>(null);
  const [allGames, setAllGames] = useState<GameWithHoles[]>([]);
  const [courseHoles, setCourseHoles] = useState<CourseHole[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (gameId) {
      fetchData();
    }
  }, [gameId]);

  const fetchData = async () => {
    try {
      // Fetch current game
      const { data: gameData } = await supabase
        .from("match_play_games")
        .select("*")
        .eq("id", gameId)
        .single();

      if (!gameData) {
        setLoading(false);
        return;
      }

      setCurrentGame(gameData as MatchPlayGame);

      // Fetch course holes for scorecard structure
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

      // Fetch all games in the same event
      let gamesToFetch: MatchPlayGame[] = [gameData as MatchPlayGame];
      
      if (gameData.event_id) {
        const { data: eventGames } = await supabase
          .from("match_play_games")
          .select("*")
          .eq("event_id", gameData.event_id)
          .order("created_at");

        if (eventGames && eventGames.length > 0) {
          gamesToFetch = eventGames as MatchPlayGame[];
        }
      }

      // Fetch holes for all games
      const gameIds = gamesToFetch.map(g => g.id);
      const { data: allHolesData } = await supabase
        .from("match_play_holes")
        .select("*")
        .in("game_id", gameIds)
        .order("hole_number");

      const holesMap = new Map<string, MatchPlayHole[]>();
      (allHolesData || []).forEach((hole) => {
        const existing = holesMap.get(hole.game_id) || [];
        existing.push(hole as MatchPlayHole);
        holesMap.set(hole.game_id, existing);
      });

      const gamesWithHoles: GameWithHoles[] = gamesToFetch.map(game => ({
        game,
        holes: holesMap.get(game.id) || [],
      }));

      setAllGames(gamesWithHoles);
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

  if (!currentGame) {
    return (
      <div className="min-h-screen pb-24 flex items-center justify-center">
        <div className="text-muted-foreground">Game not found</div>
        {gameId && <MatchPlayBottomTabBar gameId={gameId} />}
      </div>
    );
  }

  const frontNine = courseHoles.filter(h => h.hole_number <= 9);
  const backNine = courseHoles.filter(h => h.hole_number > 9);

  const renderGameScorecard = (gameWithHoles: GameWithHoles, index: number) => {
    const { game, holes } = gameWithHoles;
    const holesMap = new Map(holes.map(h => [h.hole_number, h]));

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

    const getMatchStatusDisplay = (holeNumber: number) => {
      const status = getMatchStatusAfter(holeNumber);
      if (status === 0) return { text: "T", color: "bg-muted text-muted-foreground" };
      if (status > 0) {
        return { text: `${status}UP`, color: "bg-blue-500 text-white" };
      }
      return { text: `${Math.abs(status)}UP`, color: "bg-destructive text-destructive-foreground" };
    };

    const playerWonHole = (holeNumber: number, playerNum: number) => {
      const result = getHoleResult(holeNumber);
      if (playerNum === 1) return result === 1;
      if (playerNum === 2) return result === -1;
      return false;
    };

    const renderScoreCell = (holeNumber: number, playerNum: number) => {
      const score = getPlayerScore(holeNumber, playerNum);
      const won = playerWonHole(holeNumber, playerNum);
      
      if (score === null) return "";
      const displayScore = score === -1 ? "–" : score;
      
      if (won) {
        const colorClass = playerNum === 1 ? "text-blue-500" : "text-destructive";
        return (
          <span className={`font-bold ${colorClass}`}>
            {displayScore}
          </span>
        );
      }
      return displayScore;
    };

    const renderNine = (nineHoles: CourseHole[]) => {
      if (nineHoles.length === 0) return null;

      return (
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
            <TableRow>
              <TableCell className="font-medium text-muted-foreground text-[10px] px-1 py-1 sticky left-0 bg-background z-10">PAR</TableCell>
              {nineHoles.map(hole => (
                <TableCell key={hole.hole_number} className="text-center text-[10px] px-0.5 py-1">
                  {hole.par}
                </TableCell>
              ))}
            </TableRow>

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
      );
    };

    return (
      <Card key={game.id} className="overflow-hidden">
        {/* Group Header */}
        <div className="bg-primary/10 p-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm">
              {allGames.length > 1 ? `Group ${String.fromCharCode(65 + index)}` : "Match"}
            </h3>
            <span className="text-sm font-bold text-primary">
              {formatMatchStatus(game.match_status, game.holes_remaining, game.player_1, game.player_2)}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {game.player_1} vs {game.player_2}
          </p>
        </div>

        {/* Scorecard */}
        {renderNine(frontNine)}
        
        {backNine.length > 0 && (
          <div className="border-t">
            {renderNine(backNine)}
          </div>
        )}
      </Card>
    );
  };

  return (
    <div className="min-h-screen pb-24 bg-background">
      {/* Header */}
      <div className="bg-primary text-primary-foreground p-4">
        <div className="text-center">
          <h2 className="text-lg font-bold">{currentGame.course_name}</h2>
          <p className="text-sm opacity-90">
            Match Play {allGames.length > 1 ? `(${allGames.length} Groups)` : ""}
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-4 space-y-4">
        {/* All Games Scorecards */}
        {allGames.map((gameWithHoles, index) => renderGameScorecard(gameWithHoles, index))}

        {/* Action Buttons */}
        <Card className="p-4">
          <div className="flex items-center justify-around">
            <Button variant="ghost" size="sm" className="flex-col h-auto gap-1">
              <ThumbsUp size={20} className="text-primary" />
              <span className="text-xs">Like</span>
            </Button>
            <Button variant="ghost" size="sm" className="flex-col h-auto gap-1">
              <MessageSquare size={20} className="text-primary" />
              <span className="text-xs text-center">Comment to<br/>Game Feed</span>
            </Button>
            <Button variant="ghost" size="sm" className="flex-col h-auto gap-1">
              <BarChart3 size={20} className="text-primary" />
              <span className="text-xs">Statistics</span>
            </Button>
          </div>
        </Card>
      </div>

      {gameId && <MatchPlayBottomTabBar gameId={gameId} />}
    </div>
  );
}