import { useState, useEffect } from "react";
import { ScorecardScoreCell } from "@/components/ScorecardScoreCell";
import { useParams, useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { CopenhagenBottomTabBar } from "@/components/CopenhagenBottomTabBar";
import { ScorecardActions } from "@/components/ScorecardActions";
import { CopenhagenGame, CopenhagenHole } from "@/types/copenhagen";
import { normalizePoints } from "@/utils/copenhagenScoring";
import { ChevronDown } from "lucide-react";
import { useIsSpectator } from "@/hooks/useIsSpectator";
import { useToast } from "@/hooks/use-toast";
import { GameHeader } from "@/components/GameHeader";
import { GameNotFound } from "@/components/GameNotFound";
import { LeaderboardModeTabs, LeaderboardMode } from "@/components/LeaderboardModeTabs";
import { StrokePlayLeaderboardView } from "@/components/StrokePlayLeaderboardView";
import { useStrokePlayEnabled } from "@/hooks/useStrokePlayEnabled";
import { useGameAdminStatus } from "@/hooks/useGameAdminStatus";
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

export default function CopenhagenLeaderboard() {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [game, setGame] = useState<CopenhagenGame | null>(null);
  const [holes, setHoles] = useState<CopenhagenHole[]>([]);
  const [courseHoles, setCourseHoles] = useState<CourseHole[]>([]);
  const [expandedPlayer, setExpandedPlayer] = useState<number | null>(1);
  const [loading, setLoading] = useState(true);
  const [leaderboardMode, setLeaderboardMode] = useState<LeaderboardMode>('primary');
  
  // Check spectator status - for sorting leaderboard by position
  const { isSpectator, isLoading: isSpectatorLoading } = useIsSpectator('copenhagen', gameId);
  const { strokePlayEnabled } = useStrokePlayEnabled(gameId, 'copenhagen');
  const { isAdmin } = useGameAdminStatus('copenhagen', gameId);

  useEffect(() => {
    if (gameId) fetchGame();
  }, [gameId]);

  const fetchGame = async () => {
    try {
      const { data: gameData } = await supabase
        .from("copenhagen_games")
        .select("*")
        .eq("id", gameId)
        .maybeSingle();

      if (gameData) {
        setGame(gameData as CopenhagenGame);

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
      }

      const { data: holesData } = await supabase
        .from("copenhagen_holes")
        .select("*")
        .eq("game_id", gameId)
        .order("hole_number");

      if (holesData) {
        setHoles(holesData as CopenhagenHole[]);
      }
    } catch (error) {
      console.error("Error loading game:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center pb-16">
        <div className="text-muted-foreground">Loading scorecard...</div>
      </div>
    );
  }

  if (!game) {
    return (
      <GameNotFound 
        onRetry={() => fetchGame()}
        message="This game was deleted or is no longer available."
      />
    );
  }

  const normalizedPts = normalizePoints(
    game.player_1_total_points,
    game.player_2_total_points,
    game.player_3_total_points
  );

  const players = [
    { index: 1, name: game.player_1, points: normalizedPts.player1 },
    { index: 2, name: game.player_2, points: normalizedPts.player2 },
    { index: 3, name: game.player_3, points: normalizedPts.player3 },
  ];

  // Sort players by points only in spectator mode
  const sortedPlayers = isSpectator 
    ? [...players].sort((a, b) => b.points - a.points)
    : players;
  const leader = [...players].sort((a, b) => b.points - a.points)[0]?.index;

  // Create a map for quick hole data lookup
  const holesMap = new Map(holes.map(h => [h.hole_number, h]));

  const frontNine = courseHoles.filter(h => h.hole_number <= 9);
  const backNine = courseHoles.filter(h => h.hole_number > 9);

  const getPlayerPoints = (holeNumber: number, playerIndex: number) => {
    const hole = holesMap.get(holeNumber);
    if (!hole) return null;
    if (playerIndex === 1) return hole.player_1_hole_points;
    if (playerIndex === 2) return hole.player_2_hole_points;
    return hole.player_3_hole_points;
  };

  const getPlayerGrossScore = (holeNumber: number, playerIndex: number) => {
    const hole = holesMap.get(holeNumber);
    if (!hole) return null;
    if (playerIndex === 1) return hole.player_1_gross_score;
    if (playerIndex === 2) return hole.player_2_gross_score;
    return hole.player_3_gross_score;
  };

  // Calculate positions with tie handling
  const getPositionLabel = (points: number): string => {
    // Position is 1 + number of players with MORE points
    const playersAhead = sortedPlayers.filter(p => p.points > points).length;
    const position = playersAhead + 1;
    const samePointsCount = sortedPlayers.filter(p => p.points === points).length;
    if (samePointsCount > 1) {
      return `T${position}`;
    }
    return `${position}`;
  };

  const renderPlayerCard = (player: { index: number; name: string; points: number }, rank: number) => {
    const isExpanded = expandedPlayer === player.index;
    const isLeader = leader === player.index;
    const positionLabel = getPositionLabel(player.points);

    return (
      <Card key={player.index} className="overflow-hidden">
        {/* Player Info Bar - Clickable */}
        <div 
          className="bg-card border-b border-border p-4 cursor-pointer hover:bg-muted/50 transition-colors"
          onClick={() => setExpandedPlayer(isExpanded ? null : player.index)}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <ChevronDown 
                size={20} 
                className={`text-muted-foreground transition-transform ${isExpanded ? '' : '-rotate-90'}`}
              />
              <div className={`bg-muted rounded-full w-10 h-10 flex items-center justify-center text-sm font-bold ${
                isLeader ? 'bg-amber-500/20 text-amber-600' : ''
              }`}>
                {positionLabel}
              </div>
              <div>
                <div className="text-xl font-bold">{player.name}</div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold">
                {player.points}
              </div>
              <div className="text-sm text-muted-foreground">POINTS</div>
            </div>
          </div>
        </div>

        {/* Scorecard Table - Only shown when expanded */}
        {isExpanded && courseHoles.length > 0 && (
          <>
            {/* Front 9 */}
            <div className="w-full">
              <Table className="w-full table-fixed">
                <TableHeader>
                  <TableRow className="bg-primary">
                    <TableHead className="text-center font-bold text-[10px] px-0.5 py-1.5 bg-primary text-primary-foreground w-[44px]">Hole</TableHead>
                    {frontNine.map(hole => (
                      <TableHead key={hole.hole_number} className="text-center font-bold text-[10px] px-0 py-1.5 bg-primary text-primary-foreground">
                        {hole.hole_number}
                      </TableHead>
                    ))}
                    <TableHead className="text-center font-bold text-[10px] px-0 py-1.5 bg-primary text-primary-foreground">Out</TableHead>
                    <TableHead className="text-center font-bold text-[10px] px-0 py-1.5 bg-primary text-primary-foreground">
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
                  <TableRow>
                    <TableCell className="font-medium text-muted-foreground text-[10px] px-0.5 py-1 bg-background max-w-[44px] truncate">{player.name.split(' ')[0]}</TableCell>
                    {frontNine.map(hole => {
                      const score = getPlayerGrossScore(hole.hole_number, player.index);
                      return (
                        <TableCell key={hole.hole_number} className="text-center px-0 py-1">
                          {score === -1 ? <span className="text-muted-foreground text-[10px]">–</span> : score !== null && score > 0 ? (
                            <ScorecardScoreCell score={score} par={hole.par} />
                          ) : ''}
                        </TableCell>
                      );
                    })}
                    <TableCell className="text-center bg-muted text-[10px] px-0 py-1">
                      {frontNine.reduce((sum, h) => {
                        const s = getPlayerGrossScore(h.hole_number, player.index);
                        return sum + (s !== null && s > 0 ? s : 0);
                      }, 0) || ''}
                    </TableCell>
                    <TableCell className="text-center bg-muted text-[10px] px-0 py-1">
                      {backNine.length > 0 ? '' : (frontNine.reduce((sum, h) => {
                        const s = getPlayerGrossScore(h.hole_number, player.index);
                        return sum + (s !== null && s > 0 ? s : 0);
                      }, 0) || '')}
                    </TableCell>
                  </TableRow>
                  <TableRow className="font-bold">
                    <TableCell className="font-bold text-[10px] px-0.5 py-1 bg-background">Points</TableCell>
                    {frontNine.map(hole => {
                      const points = getPlayerPoints(hole.hole_number, player.index);
                      return (
                        <TableCell 
                          key={hole.hole_number} 
                          className={`text-center font-bold text-[10px] px-0 py-1 ${
                            points !== null && points >= 6 ? 'text-emerald-600' : 
                            points !== null && points >= 4 ? 'text-blue-600' : 
                            points === 0 ? 'text-red-600' : ''
                          }`}
                        >
                          {points !== null ? points : ''}
                        </TableCell>
                      );
                    })}
                    <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1">
                      {frontNine.reduce((sum, h) => sum + (getPlayerPoints(h.hole_number, player.index) || 0), 0) || ''}
                    </TableCell>
                    <TableCell className="text-center font-bold bg-primary text-primary-foreground text-[10px] px-0 py-1">
                      {backNine.length > 0 ? '' : player.points}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>

            {/* Back 9 */}
            {backNine.length > 0 && (
              <div className="w-full border-t">
                <Table className="w-full table-fixed">
                  <TableHeader>
                    <TableRow className="bg-primary">
                      <TableHead className="text-center font-bold text-[10px] px-0.5 py-1.5 bg-primary text-primary-foreground w-[44px]">Hole</TableHead>
                      {backNine.map(hole => (
                        <TableHead key={hole.hole_number} className="text-center font-bold text-[10px] px-0 py-1.5 bg-primary text-primary-foreground">
                          {hole.hole_number}
                        </TableHead>
                      ))}
                      <TableHead className="text-center font-bold text-[10px] px-0 py-1.5 bg-primary text-primary-foreground">In</TableHead>
                      <TableHead className="text-center font-bold text-[10px] px-0 py-1.5 bg-primary text-primary-foreground">Tot</TableHead>
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
                    <TableRow>
                      <TableCell className="font-medium text-muted-foreground text-[10px] px-0.5 py-1 bg-background max-w-[44px] truncate">{player.name.split(' ')[0]}</TableCell>
                      {backNine.map(hole => {
                        const score = getPlayerGrossScore(hole.hole_number, player.index);
                        return (
                          <TableCell key={hole.hole_number} className="text-center px-0 py-1">
                            {score === -1 ? <span className="text-muted-foreground text-[10px]">–</span> : score !== null && score > 0 ? (
                              <ScorecardScoreCell score={score} par={hole.par} />
                            ) : ''}
                          </TableCell>
                        );
                      })}
                      <TableCell className="text-center bg-muted text-[10px] px-0 py-1">
                        {backNine.reduce((sum, h) => {
                          const s = getPlayerGrossScore(h.hole_number, player.index);
                          return sum + (s !== null && s > 0 ? s : 0);
                        }, 0) || ''}
                      </TableCell>
                      <TableCell className="text-center bg-muted text-[10px] px-0 py-1">
                        {holes.reduce((sum, h) => {
                          const holeIdx = player.index;
                          const s = holeIdx === 1 ? h.player_1_gross_score : holeIdx === 2 ? h.player_2_gross_score : h.player_3_gross_score;
                          return sum + (s !== null && s > 0 ? s : 0);
                        }, 0) || ''}
                      </TableCell>
                    </TableRow>
                    <TableRow className="font-bold">
                      <TableCell className="font-bold text-[10px] px-0.5 py-1 bg-background">Points</TableCell>
                      {backNine.map(hole => {
                        const points = getPlayerPoints(hole.hole_number, player.index);
                        return (
                          <TableCell 
                            key={hole.hole_number} 
                            className={`text-center font-bold text-[10px] px-0 py-1 ${
                              points !== null && points >= 6 ? 'text-emerald-600' : 
                              points !== null && points >= 4 ? 'text-blue-600' : 
                              points === 0 ? 'text-red-600' : ''
                            }`}
                          >
                            {points !== null ? points : ''}
                          </TableCell>
                        );
                      })}
                      <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1">
                        {backNine.reduce((sum, h) => sum + (getPlayerPoints(h.hole_number, player.index) || 0), 0) || ''}
                      </TableCell>
                      <TableCell className="text-center font-bold bg-primary text-primary-foreground text-[10px] px-0 py-1">
                        {player.points}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            )}

            {/* Per-scorecard actions */}
            <div className="px-4 pb-3">
              <ScorecardActions
                gameId={gameId!}
                gameType="copenhagen"
                scorecardPlayerId={`player_${player.index}`}
                scorecardPlayerName={player.name}
              />
            </div>
          </>
        )}
      </Card>
    );
  };

  // Prepare stroke play players
  const strokePlayPlayers = [1, 2, 3].map(idx => {
    const playerName = idx === 1 ? game.player_1 : idx === 2 ? game.player_2 : game.player_3;
    return {
      id: `player_${idx}`,
      name: playerName,
      scores: new Map(
        holes.map(h => {
          const score = idx === 1 ? h.player_1_gross_score : idx === 2 ? h.player_2_gross_score : h.player_3_gross_score;
          return [h.hole_number, score && score > 0 ? score : 0];
        }).filter(([_, score]) => score > 0) as [number, number][]
      ),
    };
  });

  const handleFinishGame = async () => {
    try {
      const winner = sortedPlayers[0]?.name || null;
      await supabase.from("copenhagen_games").update({ is_finished: true, winner_player: winner }).eq("id", gameId);
      toast({ title: "Game finished!" });
      navigate(`/copenhagen/${gameId}/summary`);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleDeleteGame = async () => {
    try {
      await supabase.from("copenhagen_holes").delete().eq("game_id", gameId);
      await supabase.from("copenhagen_games").delete().eq("id", gameId);
      toast({ title: "Game deleted" });
      navigate("/");
    } catch (error: any) {
      toast({ title: "Error deleting game", description: error.message, variant: "destructive" });
    }
  };

  return (
    <div className="min-h-screen pb-24 bg-background">
      <GameHeader
        gameTitle={game.round_name || "Copenhagen"}
        courseName={game.course_name}
        pageTitle="Leaderboard"
        isAdmin={isAdmin}
        onFinish={handleFinishGame}
        onSaveAndExit={() => navigate('/profile')}
        onDelete={handleDeleteGame}
        gameName="Copenhagen Game"
      />

      <LeaderboardModeTabs
        primaryLabel="Copenhagen"
        activeMode={leaderboardMode}
        onModeChange={setLeaderboardMode}
        strokePlayEnabled={strokePlayEnabled}
      />

      <div className="max-w-4xl mx-auto p-4 space-y-4">
        {leaderboardMode === 'stroke_play' ? (
          <StrokePlayLeaderboardView
            players={strokePlayPlayers}
            courseHoles={courseHoles}
            isSpectator={isSpectator}
            gameId={gameId}
            gameType="copenhagen"
          />
        ) : (
          sortedPlayers.map((player, index) => renderPlayerCard(player, index))
        )}
      </div>

      {gameId && !isSpectatorLoading && <CopenhagenBottomTabBar gameId={gameId} isSpectator={isSpectator} />}
    </div>
  );
}
