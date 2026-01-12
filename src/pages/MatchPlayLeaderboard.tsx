import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { MatchPlayBottomTabBar } from "@/components/MatchPlayBottomTabBar";
import { LeaderboardActions } from "@/components/LeaderboardActions";
import { MatchPlayGame, MatchPlayHole } from "@/types/matchPlay";
import { formatMatchStatus } from "@/utils/matchPlayScoring";
import { Swords } from "lucide-react";
import { useIsSpectator } from "@/hooks/useIsSpectator";
import { GameHeader } from "@/components/GameHeader";
import { GameNotFound } from "@/components/GameNotFound";
import { LeaderboardModeTabs, LeaderboardMode } from "@/components/LeaderboardModeTabs";
import { StrokePlayLeaderboardView } from "@/components/StrokePlayLeaderboardView";
import { useStrokePlayEnabled } from "@/hooks/useStrokePlayEnabled";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface CourseHole {
  hole_number: number;
  par: number;
  stroke_index: number;
}

interface GameWithHoles {
  game: MatchPlayGame;
  holes: MatchPlayHole[];
  courseHoles: CourseHole[];
}

export default function MatchPlayLeaderboard() {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const { isSpectator, isLoading: isSpectatorLoading } = useIsSpectator('match_play', gameId);
  const { strokePlayEnabled } = useStrokePlayEnabled(gameId, 'match_play');
  const [currentGame, setCurrentGame] = useState<MatchPlayGame | null>(null);
  const [allGamesWithHoles, setAllGamesWithHoles] = useState<GameWithHoles[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedGameIndex, setSelectedGameIndex] = useState(0);
  const [leaderboardMode, setLeaderboardMode] = useState<LeaderboardMode>('primary');

  useEffect(() => {
    if (gameId) {
      fetchData();
    }
  }, [gameId]);

  const fetchData = async () => {
    try {
      // First fetch the current game
      const { data: gameData } = await supabase
        .from("match_play_games")
        .select("*")
        .eq("id", gameId)
        .maybeSingle();

      if (!gameData) {
        setLoading(false);
        return;
      }

      setCurrentGame(gameData as MatchPlayGame);

      // If this game is part of an event, fetch all games in that event
      let games: MatchPlayGame[] = [gameData as MatchPlayGame];
      
      if (gameData.event_id) {
        const { data: eventGames } = await supabase
          .from("match_play_games")
          .select("*")
          .eq("event_id", gameData.event_id)
          .order("created_at");
        
        if (eventGames && eventGames.length > 0) {
          games = eventGames as MatchPlayGame[];
          // Find the index of the current game
          const currentIndex = games.findIndex(g => g.id === gameId);
          if (currentIndex >= 0) {
            setSelectedGameIndex(currentIndex);
          }
        }
      }

      // Fetch holes and course holes for all games
      const gamesWithHoles: GameWithHoles[] = [];
      
      for (const game of games) {
        // Fetch course holes
        let courseHoles: CourseHole[] = [];
        if (game.course_id) {
          const { data: courseHolesData } = await supabase
            .from("course_holes")
            .select("hole_number, par, stroke_index")
            .eq("course_id", game.course_id)
            .order("hole_number");

          if (courseHolesData) {
            courseHoles = game.holes_played === 9 
              ? courseHolesData.slice(0, 9) 
              : courseHolesData;
          }
        }

        // Fetch holes
        const { data: holesData } = await supabase
          .from("match_play_holes")
          .select("*")
          .eq("game_id", game.id)
          .order("hole_number");

        gamesWithHoles.push({
          game,
          holes: (holesData || []) as MatchPlayHole[],
          courseHoles,
        });
      }

      setAllGamesWithHoles(gamesWithHoles);
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

  if (!currentGame || allGamesWithHoles.length === 0) {
    return (
      <GameNotFound 
        onRetry={() => fetchData()}
        message="This game was deleted or is no longer available."
      />
    );
  }

  // Render a single match scorecard
  const renderMatchCard = (gameWithHoles: GameWithHoles, matchIndex: number) => {
    const { game, holes, courseHoles } = gameWithHoles;
    
    // Create a map for quick hole data lookup
    const holesMap = new Map(holes.map(h => [h.hole_number, h]));

    const frontNine = courseHoles.filter(h => h.hole_number <= 9);
    const backNine = courseHoles.filter(h => h.hole_number > 9);

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
      if (status === 0) return { text: "AS", color: "bg-muted text-muted-foreground" };
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

    const renderNine = (nineHoles: CourseHole[], isBackNine: boolean = false) => {
      if (nineHoles.length === 0) return null;

      const hasBackNine = backNine.length > 0;
      const nineLabel = isBackNine ? 'In' : 'Out';

      return (
        <div className="w-full">
          <Table className="w-full table-fixed">
            <TableHeader>
              <TableRow className="bg-primary/5">
                <TableHead className="text-center font-bold text-[10px] px-0.5 py-1.5 bg-primary/5 w-[44px]">Hole</TableHead>
                {nineHoles.map(hole => (
                  <TableHead key={hole.hole_number} className="text-center font-bold text-[10px] px-0 py-1.5">
                    {hole.hole_number}
                  </TableHead>
                ))}
                <TableHead className="text-center font-bold text-[10px] px-0 py-1.5 bg-primary/10">{nineLabel}</TableHead>
                <TableHead className="text-center font-bold text-[10px] px-0 py-1.5 bg-primary/10">
                  {isBackNine ? 'Tot' : (hasBackNine ? '' : 'Tot')}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell className="font-medium text-muted-foreground text-[10px] px-0.5 py-1 bg-background">Par</TableCell>
                {nineHoles.map(hole => (
                  <TableCell key={hole.hole_number} className="text-center font-semibold text-[10px] px-0 py-1">
                    {hole.par}
                  </TableCell>
                ))}
                <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1">
                  {nineHoles.reduce((sum, h) => sum + h.par, 0)}
                </TableCell>
                <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1">
                  {isBackNine ? courseHoles.reduce((sum, h) => sum + h.par, 0) : (hasBackNine ? '' : nineHoles.reduce((sum, h) => sum + h.par, 0))}
                </TableCell>
              </TableRow>

              <TableRow>
                <TableCell className="font-bold text-[10px] px-0.5 py-1 bg-background max-w-[44px] truncate text-blue-500">
                  {game.player_1.split(' ')[0]}
                </TableCell>
                {nineHoles.map(hole => (
                  <TableCell key={hole.hole_number} className="text-center font-bold text-[10px] px-0 py-1">
                    {renderScoreCell(hole.hole_number, 1)}
                  </TableCell>
                ))}
                <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1">
                  {nineHoles.reduce((sum, h) => sum + (getPlayerScore(h.hole_number, 1) || 0), 0) || ''}
                </TableCell>
                <TableCell className="text-center font-bold bg-primary/10 text-[10px] px-0 py-1">
                  {isBackNine || !hasBackNine ? (holes.reduce((sum, h) => sum + (h.player_1_gross_score || 0), 0) || '') : ''}
                </TableCell>
              </TableRow>

              <TableRow className="bg-muted/30">
                <TableCell className="font-medium text-muted-foreground text-[10px] px-0.5 py-1 bg-muted/30">Score</TableCell>
                {nineHoles.map(hole => {
                  const holeData = holesMap.get(hole.hole_number);
                  if (!holeData) {
                    return (
                      <TableCell key={hole.hole_number} className="text-center text-[10px] px-0 py-1">
                      </TableCell>
                    );
                  }
                  const status = getMatchStatusDisplay(hole.hole_number);
                  return (
                    <TableCell key={hole.hole_number} className="text-center text-[10px] px-0 py-1">
                      <span className={`inline-flex items-center justify-center px-0.5 py-0 rounded text-[8px] font-bold ${status.color}`}>
                        {status.text}
                      </span>
                    </TableCell>
                  );
                })}
                <TableCell className="text-center bg-muted text-[10px] px-0 py-1"></TableCell>
                <TableCell className="text-center bg-primary/10 text-[10px] px-0 py-1"></TableCell>
              </TableRow>

              <TableRow>
                <TableCell className="font-bold text-[10px] px-0.5 py-1 bg-background max-w-[44px] truncate text-destructive">
                  {game.player_2.split(' ')[0]}
                </TableCell>
                {nineHoles.map(hole => (
                  <TableCell key={hole.hole_number} className="text-center font-bold text-[10px] px-0 py-1">
                    {renderScoreCell(hole.hole_number, 2)}
                  </TableCell>
                ))}
                <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1">
                  {nineHoles.reduce((sum, h) => sum + (getPlayerScore(h.hole_number, 2) || 0), 0) || ''}
                </TableCell>
                <TableCell className="text-center font-bold bg-primary/10 text-[10px] px-0 py-1">
                  {isBackNine || !hasBackNine ? (holes.reduce((sum, h) => sum + (h.player_2_gross_score || 0), 0) || '') : ''}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      );
    };

    return (
      <Card key={game.id} className="overflow-hidden">
        {/* Match Header */}
        {allGamesWithHoles.length > 1 && (
          <div className="bg-muted/50 px-4 py-2 border-b flex items-center gap-2">
            <Swords size={16} className="text-primary" />
            <span className="font-medium">Match {matchIndex + 1}</span>
          </div>
        )}
        
        {/* Match Status */}
        <div className="p-3 text-center border-b">
          <p className="text-lg font-bold text-primary">
            {formatMatchStatus(game.match_status, game.holes_remaining, game.player_1, game.player_2)}
          </p>
          <p className="text-sm text-muted-foreground">
            {game.holes_remaining} holes remaining
          </p>
        </div>

        {/* Scorecard */}
        <div className="border rounded-lg overflow-hidden w-full m-0">
          {renderNine(frontNine, false)}
          
          {backNine.length > 0 && (
            <div className="border-t">
              {renderNine(backNine, true)}
            </div>
          )}
        </div>

        {/* Like and Comment Actions */}
        <LeaderboardActions 
          gameId={game.id} 
          gameType="match_play" 
          feedPath={`/match-play/${game.id}/feed`}
          scorecardPlayerName={game.round_name || `${game.player_1} vs ${game.player_2}`}
        />
      </Card>
    );
  };

  // Prepare stroke play players from all games
  const strokePlayPlayers = allGamesWithHoles.flatMap(({ game, holes }) => [
    {
      id: `${game.id}_p1`,
      name: game.player_1,
      scores: new Map(
        holes.map(h => [h.hole_number, h.player_1_gross_score || 0]).filter(([_, s]) => s > 0) as [number, number][]
      ),
    },
    {
      id: `${game.id}_p2`,
      name: game.player_2,
      scores: new Map(
        holes.map(h => [h.hole_number, h.player_2_gross_score || 0]).filter(([_, s]) => s > 0) as [number, number][]
      ),
    },
  ]);

  // Use course holes from the first game for stroke play view
  const strokePlayCourseHoles = allGamesWithHoles[0]?.courseHoles || [];

  return (
    <div className="min-h-screen pb-24 bg-background">
      <GameHeader
        gameTitle={currentGame.round_name || "Match Play"}
        courseName={currentGame.course_name}
        pageTitle="Leaderboard"
      />

      <LeaderboardModeTabs
        primaryLabel="Match Play"
        activeMode={leaderboardMode}
        onModeChange={setLeaderboardMode}
        strokePlayEnabled={strokePlayEnabled}
      />

      <div className="max-w-4xl mx-auto p-4 space-y-4">
        {leaderboardMode === 'stroke_play' ? (
          <StrokePlayLeaderboardView
            players={strokePlayPlayers}
            courseHoles={strokePlayCourseHoles}
            isSpectator={isSpectator}
          />
        ) : (
          <>
            {/* If multiple matches, show tabs or all matches */}
            {allGamesWithHoles.length > 1 ? (
              <Tabs value={selectedGameIndex.toString()} onValueChange={(v) => setSelectedGameIndex(parseInt(v))}>
                <TabsList className="w-full justify-start overflow-x-auto">
                  {allGamesWithHoles.map((_, index) => (
                    <TabsTrigger key={index} value={index.toString()} className="flex-shrink-0">
                      Match {index + 1}
                    </TabsTrigger>
                  ))}
                  <TabsTrigger value="all" className="flex-shrink-0">
                    All Matches
                  </TabsTrigger>
                </TabsList>
                
                {allGamesWithHoles.map((gameWithHoles, index) => (
                  <TabsContent key={index} value={index.toString()}>
                    {renderMatchCard(gameWithHoles, index)}
                  </TabsContent>
                ))}
                
                <TabsContent value="all" className="space-y-4">
                  {allGamesWithHoles.map((gameWithHoles, index) => 
                    renderMatchCard(gameWithHoles, index)
                  )}
                </TabsContent>
              </Tabs>
            ) : (
              renderMatchCard(allGamesWithHoles[0], 0)
            )}
          </>
        )}
      </div>

      {gameId && !isSpectatorLoading && <MatchPlayBottomTabBar gameId={gameId} isSpectator={isSpectator} />}
    </div>
  );
}
