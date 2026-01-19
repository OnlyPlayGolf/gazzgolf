import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { WolfBottomTabBar } from "@/components/WolfBottomTabBar";
import { ScorecardActions } from "@/components/ScorecardActions";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { WolfGame, WolfHole } from "@/types/wolf";
import { ChevronDown } from "lucide-react";
import { useIsSpectator } from "@/hooks/useIsSpectator";
import { useGameAdminStatus } from "@/hooks/useGameAdminStatus";
import { useToast } from "@/hooks/use-toast";
import { GameHeader } from "@/components/GameHeader";
import { GameNotFound } from "@/components/GameNotFound";
import { LeaderboardModeTabs, LeaderboardMode } from "@/components/LeaderboardModeTabs";
import { StrokePlayLeaderboardView, StrokePlayPlayer } from "@/components/StrokePlayLeaderboardView";
import { useStrokePlayEnabled } from "@/hooks/useStrokePlayEnabled";
import { ScorecardScoreCell } from "@/components/ScorecardScoreCell";
import { WolfCompletionModal } from "@/components/WolfCompletionModal";
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

export default function WolfLeaderboard() {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [game, setGame] = useState<WolfGame | null>(null);
  const [holes, setHoles] = useState<WolfHole[]>([]);
  const [courseHoles, setCourseHoles] = useState<CourseHole[]>([]);
  const [expandedPlayerId, setExpandedPlayerId] = useState<number | null>(1);
  const [loading, setLoading] = useState(true);
  const [leaderboardMode, setLeaderboardMode] = useState<LeaderboardMode>('primary');
  const [showCompletionDialog, setShowCompletionDialog] = useState(false);
  
  // Check spectator status for leaderboard sorting
  const { isSpectator, isLoading: isSpectatorLoading } = useIsSpectator('wolf', gameId);
  const { isAdmin } = useGameAdminStatus('wolf', gameId);
  const { strokePlayEnabled } = useStrokePlayEnabled(gameId, 'wolf');

  useEffect(() => {
    if (gameId) fetchGameData();
  }, [gameId]);

  // Refetch data when page comes back into focus (e.g., returning from GameSettingsDetail)
  useEffect(() => {
    const handleFocus = () => {
      if (gameId) {
        fetchGameData();
      }
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [gameId]);

  const fetchGameData = async () => {
    try {
      const { data: gameData } = await supabase
        .from("wolf_games" as any)
        .select("*")
        .eq("id", gameId)
        .maybeSingle();
      
      if (gameData) {
        const typedGameData = gameData as unknown as WolfGame;
        setGame(typedGameData);

        // Fetch course holes for scorecard structure
        if (typedGameData.course_id) {
          const { data: courseHolesData } = await supabase
            .from("course_holes")
            .select("hole_number, par, stroke_index")
            .eq("course_id", typedGameData.course_id)
            .order("hole_number");

          if (courseHolesData) {
            const filteredHoles = typedGameData.holes_played === 9 
              ? courseHolesData.slice(0, 9) 
              : courseHolesData;
            setCourseHoles(filteredHoles);
          }
        }
      }

      const { data: holesData } = await supabase
        .from("wolf_holes" as any)
        .select("*")
        .eq("game_id", gameId)
        .order("hole_number");

      if (holesData) {
        setHoles(holesData as unknown as WolfHole[]);
      }
    } finally {
      setLoading(false);
    }
  };

  const getPlayerCount = () => {
    if (!game) return 3;
    let count = 3;
    if (game.player_4) count = 4;
    if (game.player_5) count = 5;
    return count;
  };

  const getPlayerName = (playerNum: number) => {
    if (!game) return '';
    switch (playerNum) {
      case 1: return game.player_1;
      case 2: return game.player_2;
      case 3: return game.player_3;
      case 4: return game.player_4 || '';
      case 5: return game.player_5 || '';
      default: return '';
    }
  };

  const getPlayerPoints = (playerNum: number) => {
    if (!game) return 0;
    switch (playerNum) {
      case 1: return game.player_1_points;
      case 2: return game.player_2_points;
      case 3: return game.player_3_points;
      case 4: return game.player_4_points;
      case 5: return game.player_5_points;
      default: return 0;
    }
  };

  // Create a map for quick hole data lookup
  const holesMap = new Map(holes.map(h => [h.hole_number, h]));

  const getHolePoints = (holeNumber: number, playerNum: number) => {
    const hole = holesMap.get(holeNumber);
    if (!hole) return null;
    switch (playerNum) {
      case 1: return hole.player_1_hole_points;
      case 2: return hole.player_2_hole_points;
      case 3: return hole.player_3_hole_points;
      case 4: return hole.player_4_hole_points;
      case 5: return hole.player_5_hole_points;
      default: return 0;
    }
  };

  const getHoleScore = (holeNumber: number, playerNum: number) => {
    const hole = holesMap.get(holeNumber);
    if (!hole) return null;
    switch (playerNum) {
      case 1: return hole.player_1_score;
      case 2: return hole.player_2_score;
      case 3: return hole.player_3_score;
      case 4: return hole.player_4_score;
      case 5: return hole.player_5_score;
      default: return null;
    }
  };

  const playerCount = getPlayerCount();
  
  // Build players array - always sorted for position calculation
  const sortedPlayersForRanking = game ? Array.from({ length: playerCount }, (_, i) => ({
    num: i + 1,
    name: getPlayerName(i + 1),
    points: getPlayerPoints(i + 1),
  })).sort((a, b) => b.points - a.points) : [];
  
  // For display: only sort by position in spectator mode, otherwise keep original order
  const players = isSpectator 
    ? sortedPlayersForRanking 
    : (game ? Array.from({ length: playerCount }, (_, i) => ({
        num: i + 1,
        name: getPlayerName(i + 1),
        points: getPlayerPoints(i + 1),
      })) : []);

  // Calculate positions with tie handling - always use sorted list for position calculation
  const getPlayerPosition = (player: { num: number; name: string; points: number }): string => {
    const playersWithSamePoints = sortedPlayersForRanking.filter(p => p.points === player.points);
    const isTied = playersWithSamePoints.length > 1;
    const position = sortedPlayersForRanking.findIndex(p => p.points === player.points) + 1;
    return isTied ? `T${position}` : `${position}`;
  };

  const frontNine = courseHoles.filter(h => h.hole_number <= 9);
  const backNine = courseHoles.filter(h => h.hole_number > 9);

  const handleFinishGame = () => {
    setShowCompletionDialog(true);
  };

  const handleDeleteGame = async () => {
    if (!gameId) return;
    await supabase.from("wolf_holes").delete().eq("game_id", gameId);
    await supabase.from("wolf_games").delete().eq("id", gameId);
    toast({ title: "Game deleted" });
    navigate("/");
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
        onRetry={() => fetchGameData()}
        message="This game was deleted or is no longer available."
      />
    );
  }

  const renderPlayerCard = (player: { num: number; name: string; points: number }) => {
    const isExpanded = expandedPlayerId === player.num;
    const position = getPlayerPosition(player);
    const isLeader = position === "1" || position === "T1";

    return (
      <Card key={player.num} className="overflow-hidden">
        {/* Player Info Bar - Clickable */}
        <div 
          className="bg-card border-b border-border p-4 cursor-pointer hover:bg-muted/50 transition-colors"
          onClick={() => setExpandedPlayerId(isExpanded ? null : player.num)}
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
                {position}
              </div>
              <div>
                <div className="text-xl font-bold">{player.name}</div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold">
                {player.points}
              </div>
              <div className="text-sm text-muted-foreground">
                POINTS
              </div>
            </div>
          </div>
          
          {/* Per-scorecard actions */}
          <div className="px-4 pb-3">
            <ScorecardActions
              gameId={gameId!}
              gameType="wolf"
              scorecardPlayerId={`player_${player.num}`}
              scorecardPlayerName={player.name}
            />
          </div>
        </div>

        {/* Scorecard Table - Only shown when expanded */}
        {isExpanded && courseHoles.length > 0 && (
          <>
            {/* Front 9 */}
            <div className="border rounded-lg overflow-hidden w-full">
              <Table className="table-fixed w-full">
                <TableHeader>
                  <TableRow className="bg-primary">
                    <TableHead className="text-center font-bold text-[10px] px-0 py-1 w-[44px] bg-primary text-primary-foreground">Hole</TableHead>
                    {frontNine.map(hole => (
                      <TableHead key={hole.hole_number} className="text-center font-bold text-[10px] px-0 py-1 bg-primary text-primary-foreground">
                        {hole.hole_number}
                      </TableHead>
                    ))}
                    <TableHead className="text-center font-bold text-[10px] px-0 py-1 bg-primary text-primary-foreground">Out</TableHead>
                    {backNine.length > 0 && <TableHead className="text-center font-bold text-[10px] px-0 py-1 bg-primary text-primary-foreground"></TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-medium text-muted-foreground text-[10px] px-0 py-1 w-[44px]">HCP</TableCell>
                    {frontNine.map(hole => (
                      <TableCell key={hole.hole_number} className="text-center text-[10px] px-0 py-1">
                        {hole.stroke_index}
                      </TableCell>
                    ))}
                    <TableCell className="text-center bg-muted text-[10px] px-0 py-1"></TableCell>
                    {backNine.length > 0 && <TableCell className="text-center bg-muted text-[10px] px-0 py-1"></TableCell>}
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium text-muted-foreground text-[10px] px-0 py-1 w-[44px]">Par</TableCell>
                    {frontNine.map(hole => (
                      <TableCell key={hole.hole_number} className="text-center font-semibold text-[10px] px-0 py-1">
                        {hole.par}
                      </TableCell>
                    ))}
                    <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1">
                      {frontNine.reduce((sum, h) => sum + h.par, 0)}
                    </TableCell>
                    {backNine.length > 0 && <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1"></TableCell>}
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium text-muted-foreground text-[10px] px-0 py-1 w-[44px] max-w-[44px] truncate">{player.name.split(' ')[0]}</TableCell>
                    {frontNine.map(hole => {
                      const rawScore = getHoleScore(hole.hole_number, player.num);
                      const score = rawScore === -1 ? null : rawScore;
                      return (
                        <TableCell 
                          key={hole.hole_number} 
                          className="text-center px-0 py-1"
                        >
                          {score !== null ? (
                            <ScorecardScoreCell score={score} par={hole.par} />
                          ) : ''}
                        </TableCell>
                      );
                    })}
                    <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1">
                      {(() => {
                        const total = frontNine.reduce((sum, h) => {
                          const s = getHoleScore(h.hole_number, player.num);
                          if (s === null || s === -1) return sum;
                          return sum + s;
                        }, 0);

                        const hasAnyEntered = frontNine.some(h => {
                          const s = getHoleScore(h.hole_number, player.num);
                          return s !== null && s !== undefined;
                        });

                        if (!hasAnyEntered) return '';
                        return total > 0 ? total : '-';
                      })()}
                    </TableCell>
                    {backNine.length > 0 && <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1"></TableCell>}
                  </TableRow>
                  <TableRow className="font-bold">
                    <TableCell className="font-bold text-[10px] px-0 py-1 w-[44px]">Points</TableCell>
                    {frontNine.map(hole => {
                      const points = getHolePoints(hole.hole_number, player.num);
                      return (
                        <TableCell 
                          key={hole.hole_number} 
                          className={`text-center font-bold text-[10px] px-0 py-1 ${
                            points !== null && points > 0 ? 'text-green-600' : 
                            points !== null && points < 0 ? 'text-red-600' : ''
                          }`}
                        >
                          {points !== null ? (points > 0 ? `+${points}` : points) : ''}
                        </TableCell>
                      );
                    })}
                    <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1">
                      {frontNine.reduce((sum, h) => sum + (getHolePoints(h.hole_number, player.num) || 0), 0) || ''}
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
                    <TableRow className="bg-primary">
                      <TableHead className="text-center font-bold text-[10px] px-0 py-1 w-[44px] bg-primary text-primary-foreground">Hole</TableHead>
                      {backNine.map(hole => (
                        <TableHead key={hole.hole_number} className="text-center font-bold text-[10px] px-0 py-1 bg-primary text-primary-foreground">
                          {hole.hole_number}
                        </TableHead>
                      ))}
                      <TableHead className="text-center font-bold text-[10px] px-0 py-1 bg-primary text-primary-foreground">In</TableHead>
                      <TableHead className="text-center font-bold text-[10px] px-0 py-1 bg-primary text-primary-foreground">Tot</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell className="font-medium text-muted-foreground text-[10px] px-0 py-1 w-[44px]">HCP</TableCell>
                      {backNine.map(hole => (
                        <TableCell key={hole.hole_number} className="text-center text-[10px] px-0 py-1">
                          {hole.stroke_index}
                        </TableCell>
                      ))}
                      <TableCell className="text-center bg-muted text-[10px] px-0 py-1"></TableCell>
                      <TableCell className="text-center bg-muted text-[10px] px-0 py-1"></TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium text-muted-foreground text-[10px] px-0 py-1 w-[44px]">Par</TableCell>
                      {backNine.map(hole => (
                        <TableCell key={hole.hole_number} className="text-center font-semibold text-[10px] px-0 py-1">
                          {hole.par}
                        </TableCell>
                      ))}
                      <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1">
                        {backNine.reduce((sum, h) => sum + h.par, 0)}
                      </TableCell>
                      <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1">
                        {frontNine.reduce((sum, h) => sum + h.par, 0) + backNine.reduce((sum, h) => sum + h.par, 0)}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium text-muted-foreground text-[10px] px-0 py-1 w-[44px] max-w-[44px] truncate">{player.name.split(' ')[0]}</TableCell>
                      {backNine.map(hole => {
                        const rawScore = getHoleScore(hole.hole_number, player.num);
                        const score = rawScore === -1 ? null : rawScore;
                        return (
                          <TableCell 
                            key={hole.hole_number} 
                            className="text-center px-0 py-1"
                          >
                            {score !== null ? (
                              <ScorecardScoreCell score={score} par={hole.par} />
                            ) : ''}
                          </TableCell>
                        );
                      })}
                      <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1">
                        {(() => {
                          const total = backNine.reduce((sum, h) => {
                            const s = getHoleScore(h.hole_number, player.num);
                            if (s === null || s === -1) return sum;
                            return sum + s;
                          }, 0);

                          const hasAnyEntered = backNine.some(h => {
                            const s = getHoleScore(h.hole_number, player.num);
                            return s !== null && s !== undefined;
                          });

                          if (!hasAnyEntered) return '';
                          return total > 0 ? total : '-';
                        })()}
                      </TableCell>
                      <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1">
                        {(() => {
                          const frontTotal = frontNine.reduce((sum, h) => {
                            const s = getHoleScore(h.hole_number, player.num);
                            if (s === null || s === -1) return sum;
                            return sum + s;
                          }, 0);
                          const backTotal = backNine.reduce((sum, h) => {
                            const s = getHoleScore(h.hole_number, player.num);
                            if (s === null || s === -1) return sum;
                            return sum + s;
                          }, 0);
                          const total = frontTotal + backTotal;
                          return total > 0 ? total : '-';
                        })()}
                      </TableCell>
                    </TableRow>
                    <TableRow className="font-bold">
                      <TableCell className="font-bold text-[10px] px-0 py-1 w-[44px]">Points</TableCell>
                      {backNine.map(hole => {
                        const points = getHolePoints(hole.hole_number, player.num);
                        return (
                          <TableCell 
                            key={hole.hole_number} 
                            className={`text-center font-bold text-[10px] px-0 py-1 ${
                              points !== null && points > 0 ? 'text-green-600' : 
                              points !== null && points < 0 ? 'text-red-600' : ''
                            }`}
                          >
                            {points !== null ? (points > 0 ? `+${points}` : points) : ''}
                          </TableCell>
                        );
                      })}
                      <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1">
                        {backNine.reduce((sum, h) => sum + (getHolePoints(h.hole_number, player.num) || 0), 0) || ''}
                      </TableCell>
                      <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1">
                        {(frontNine.reduce((sum, h) => sum + (getHolePoints(h.hole_number, player.num) || 0), 0) + 
                          backNine.reduce((sum, h) => sum + (getHolePoints(h.hole_number, player.num) || 0), 0)) || ''}
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
  };

  // Build stroke play players from wolf data
  const strokePlayPlayers: StrokePlayPlayer[] = game ? Array.from({ length: playerCount }, (_, i) => {
    const playerNum = i + 1;
    const scoresMap = new Map<number, number>();
    holes.forEach(hole => {
      const score = getHoleScore(hole.hole_number, playerNum);
      if (score !== null && score !== -1) {
        scoresMap.set(hole.hole_number, score);
      }
    });
    return {
      id: `player_${playerNum}`,
      name: getPlayerName(playerNum),
      scores: scoresMap,
    };
  }) : [];

  return (
    <div className="min-h-screen pb-24 bg-background">
      <GameHeader
        gameTitle={game.round_name || "Wolf"}
        courseName={game.course_name}
        pageTitle="Leaderboard"
        isAdmin={isAdmin}
        onFinish={handleFinishGame}
        onSaveAndExit={() => navigate('/profile')}
        onDelete={handleDeleteGame}
        gameName="Wolf Game"
      />

      <LeaderboardModeTabs
        primaryLabel="Wolf"
        activeMode={leaderboardMode}
        onModeChange={setLeaderboardMode}
        strokePlayEnabled={strokePlayEnabled}
      />

      <div className="max-w-4xl mx-auto p-4 space-y-4">
        {leaderboardMode === 'primary' ? (
          <>
            {players.map((player) => renderPlayerCard(player))}
          </>
        ) : (
          <StrokePlayLeaderboardView
            players={strokePlayPlayers}
            courseHoles={courseHoles}
            isSpectator={isSpectator}
            gameId={gameId}
            gameType="wolf"
          />
        )}
      </div>

      {gameId && !isSpectatorLoading && <WolfBottomTabBar gameId={gameId} isSpectator={isSpectator} />}

      {game && (
        <WolfCompletionModal
          open={showCompletionDialog}
          onOpenChange={setShowCompletionDialog}
          game={game}
          holes={holes}
          courseHoles={courseHoles}
        />
      )}
    </div>
  );
}
