import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { ChevronDown, RotateCcw } from "lucide-react";
import { SkinsBottomTabBar } from "@/components/SkinsBottomTabBar";
import { ScorecardActions } from "@/components/ScorecardActions";
import { GameHeader } from "@/components/GameHeader";
import { GameNotFound } from "@/components/GameNotFound";
import { LeaderboardModeTabs, LeaderboardMode } from "@/components/LeaderboardModeTabs";
import { StrokePlayLeaderboardView, StrokePlayPlayer } from "@/components/StrokePlayLeaderboardView";
import { ScorecardScoreCell } from "@/components/ScorecardScoreCell";
import { useIsSpectator } from "@/hooks/useIsSpectator";
import { useStrokePlayEnabled } from "@/hooks/useStrokePlayEnabled";
import { useGameAdminStatus } from "@/hooks/useGameAdminStatus";
import { useToast } from "@/hooks/use-toast";
import { SkinsCompletionModal } from "@/components/SkinsCompletionModal";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface SkinsGame {
  id: string;
  course_id: string | null;
  course_name: string;
  round_name: string | null;
  players: any[];
  holes_played: number;
  is_finished: boolean;
  carryover_enabled: boolean;
  use_handicaps: boolean;
}

interface SkinsHole {
  id: string;
  game_id: string;
  hole_number: number;
  par: number;
  stroke_index: number | null;
  player_scores: Record<string, number>; // player_id -> score directly
  winner_player: string | null;
  skins_available: number;
  is_carryover: boolean;
}

interface CourseHole {
  hole_number: number;
  par: number;
  stroke_index: number;
}

interface PlayerSkinResult {
  playerId: string;
  name: string;
  handicap: number | null;
  skinsWon: number;
  totalScore: number;
  holesPlayed: number;
  scores: Map<number, number>;
  mulligans: Set<number>;
}

export default function SkinsLeaderboard() {
  const { roundId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [game, setGame] = useState<SkinsGame | null>(null);
  const [holes, setHoles] = useState<SkinsHole[]>([]);
  const [courseHoles, setCourseHoles] = useState<CourseHole[]>([]);
  const [loading, setLoading] = useState(true);
  const [playerResults, setPlayerResults] = useState<PlayerSkinResult[]>([]);
  const [expandedPlayerId, setExpandedPlayerId] = useState<string | null>(null);
  const [leaderboardMode, setLeaderboardMode] = useState<LeaderboardMode>('primary');
  const [showCompletionDialog, setShowCompletionDialog] = useState(false);
  
  const { isSpectator } = useIsSpectator('skins', roundId);
  const { strokePlayEnabled } = useStrokePlayEnabled(roundId, 'skins');
  const { isAdmin } = useGameAdminStatus('skins', roundId);

  const handleFinishGame = async () => {
    if (!roundId) return;
    await supabase.from("skins_games").update({ is_finished: true }).eq("id", roundId);
    toast({ title: "Game finished" });
    setShowCompletionDialog(true);
  };

  const handleDeleteGame = async () => {
    if (!roundId) return;
    await supabase.from("skins_holes").delete().eq("game_id", roundId);
    await supabase.from("skins_games").delete().eq("id", roundId);
    toast({ title: "Game deleted" });
    navigate("/");
  };

  useEffect(() => {
    if (roundId) fetchGameData();
  }, [roundId]);

  // Refetch data when page comes back into focus (e.g., returning from GameSettingsDetail)
  useEffect(() => {
    const handleFocus = () => {
      if (roundId) {
        fetchGameData();
      }
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [roundId]);

  useEffect(() => {
    if (game && holes.length > 0) {
      calculatePlayerResults();
    }
  }, [game, holes]);

  const fetchGameData = async () => {
    try {
      const { data: gameData } = await supabase
        .from("skins_games")
        .select("*")
        .eq("id", roundId)
        .maybeSingle();

      if (gameData) {
        const typedGame: SkinsGame = {
          id: gameData.id,
          course_id: gameData.course_id,
          course_name: gameData.course_name,
          round_name: gameData.round_name,
          players: Array.isArray(gameData.players) ? gameData.players : [],
          holes_played: gameData.holes_played,
          is_finished: gameData.is_finished,
          carryover_enabled: gameData.carryover_enabled,
          use_handicaps: gameData.use_handicaps,
        };
        setGame(typedGame);

        // Set first player as expanded by default - use odId or name
        if (typedGame.players.length > 0) {
          const firstPlayer = typedGame.players[0];
          setExpandedPlayerId(firstPlayer.odId || firstPlayer.id || firstPlayer.name);
        }

        // Fetch course holes
        if (typedGame.course_id) {
          const { data: courseHolesData } = await supabase
            .from("course_holes")
            .select("hole_number, par, stroke_index")
            .eq("course_id", typedGame.course_id)
            .order("hole_number");

          if (courseHolesData) {
            const filteredHoles = typedGame.holes_played === 9 
              ? courseHolesData.slice(0, 9) 
              : courseHolesData;
            setCourseHoles(filteredHoles);
          }
        }
      }

      const { data: holesData } = await supabase
        .from("skins_holes")
        .select("*")
        .eq("game_id", roundId)
        .order("hole_number");

      if (holesData) {
        const typedHoles: SkinsHole[] = holesData.map(h => ({
          id: h.id,
          game_id: h.game_id,
          hole_number: h.hole_number,
          par: h.par,
          stroke_index: h.stroke_index,
          player_scores: (h.player_scores as Record<string, number>) || {},
          winner_player: h.winner_player,
          skins_available: h.skins_available,
          is_carryover: h.is_carryover,
        }));
        setHoles(typedHoles);
      }
    } finally {
      setLoading(false);
    }
  };

  const calculatePlayerResults = () => {
    if (!game) return;

    const results: PlayerSkinResult[] = game.players.map(player => {
      // Use odId (from skins format) or fallback to id/name
      const playerId = player.odId || player.id || player.name;
      let skinsWon = 0;
      let totalScore = 0;
      let holesPlayed = 0;
      const scores = new Map<number, number>();
      const mulligans = new Set<number>();

      holes.forEach(hole => {
        if (hole.winner_player === playerId) {
          skinsWon += hole.skins_available;
        }

        // player_scores is directly { playerId: score }
        const score = hole.player_scores[playerId];
        if (score && score > 0) {
          totalScore += score;
          holesPlayed++;
          scores.set(hole.hole_number, score);
        }
      });

      return {
        playerId,
        name: player.displayName || player.name || 'Player',
        handicap: player.handicap ?? null,
        skinsWon,
        totalScore,
        holesPlayed,
        scores,
        mulligans,
      };
    });

    setPlayerResults(results);
  };

  // Sort for position calculation and display (always sort by most skins on top)
  const sortedResultsForRanking = [...playerResults].sort((a, b) => b.skinsWon - a.skinsWon);
  
  // Always display sorted by skins won (most on top)
  const displayResults = sortedResultsForRanking;

  const getPositionLabel = (playerId: string): string => {
    const player = playerResults.find(p => p.playerId === playerId);
    if (!player) return "1";
    const playersAhead = sortedResultsForRanking.filter(p => p.skinsWon > player.skinsWon).length;
    const position = playersAhead + 1;
    const sameCount = sortedResultsForRanking.filter(p => p.skinsWon === player.skinsWon).length;
    if (sameCount > 1) return `T${position}`;
    return `${position}`;
  };

  const frontNine = courseHoles.filter(h => h.hole_number <= 9);
  const backNine = courseHoles.filter(h => h.hole_number > 9);

  // Stroke play data
  const strokePlayPlayers: StrokePlayPlayer[] = playerResults.map(p => ({
    id: p.playerId,
    name: p.name,
    handicap: p.handicap,
    scores: p.scores,
    mulligans: p.mulligans,
  }));

  const calculateTotals = (scores: Map<number, number>, holesRange: CourseHole[]) => {
    let total = 0;
    let par = 0;
    holesRange.forEach(hole => {
      const score = scores.get(hole.hole_number);
      if (score && score > 0) {
        total += score;
        par += hole.par;
      }
    });
    return { total, par };
  };

  const getHoleData = (holeNumber: number): SkinsHole | null => {
    return holes.find(h => h.hole_number === holeNumber) || null;
  };

  const getWinnerDisplayName = (winnerId: string | null): string => {
    if (!winnerId) return '';
    const winner = game?.players.find(p => {
      const playerId = p.odId || p.id || p.name;
      return playerId === winnerId;
    });
    if (!winner) return '';
    const name = winner.displayName || winner.name || '';
    return name.split(' ')[0]; // Return first name only
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center pb-16">
        <div className="text-muted-foreground">Loading...</div>
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

  const renderSkinsView = () => (
    <div className="space-y-3 p-4">
      {displayResults.map((player) => {
        const isExpanded = expandedPlayerId === player.playerId;
        const positionLabel = getPositionLabel(player.playerId);
        const isLeader = positionLabel === "1" || positionLabel === "T1";
        const frontTotals = calculateTotals(player.scores, frontNine);
        const backTotals = calculateTotals(player.scores, backNine);

        return (
          <Card key={player.playerId} className="overflow-hidden">
            {/* Player Info Bar */}
            <div 
              className="bg-card border-b border-border p-4 cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => setExpandedPlayerId(isExpanded ? null : player.playerId)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <ChevronDown 
                    size={20} 
                    className={`text-muted-foreground transition-transform ${isExpanded ? '' : '-rotate-90'}`}
                  />
                  <div className={`bg-muted rounded-full w-10 h-10 flex items-center justify-center text-sm font-bold ${
                    isLeader && player.skinsWon > 0 ? 'bg-amber-500/20 text-amber-600' : ''
                  }`}>
                    {positionLabel}
                  </div>
                  <div>
                    <div className="text-xl font-bold">{player.name}</div>
                    {player.handicap !== null && player.handicap !== undefined && (
                      <div className="text-sm text-muted-foreground">
                        HCP {player.handicap === 0 ? '0' : `+${Math.abs(player.handicap)}`}
                      </div>
                    )}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold">{player.skinsWon}</div>
                  <div className="text-sm text-muted-foreground">
                    SKINS
                  </div>
                </div>
              </div>
            </div>

            {/* Scorecard - Only shown when expanded */}
            {isExpanded && courseHoles.length > 0 && (
              <>
                {/* Front 9 */}
                <div className="border rounded-lg overflow-hidden w-full">
                  <Table className="table-fixed w-full">
                    <TableHeader>
                      <TableRow className="bg-primary">
                        <TableHead className="text-center font-bold text-[10px] px-0 py-1 w-[44px]">Hole</TableHead>
                        {frontNine.map(hole => (
                          <TableHead key={hole.hole_number} className="text-center font-bold text-[10px] px-0 py-1">
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
                      <TableRow className="font-bold">
                        <TableCell className="font-bold text-[10px] px-0 py-1 w-[44px] max-w-[44px] truncate">{player.name.split(' ')[0]}</TableCell>
                        {frontNine.map(hole => {
                          const score = player.scores.get(hole.hole_number);
                          const hasMulligan = player.mulligans.has(hole.hole_number);
                          return (
                            <TableCell 
                              key={hole.hole_number} 
                              className="text-center text-[10px] px-0 py-1"
                            >
                              <div className="flex items-center justify-center gap-0.5">
                                {score ? <ScorecardScoreCell score={score} par={hole.par} /> : ''}
                                {hasMulligan && <RotateCcw size={8} className="text-amber-500" />}
                              </div>
                            </TableCell>
                          );
                        })}
                        <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1">
                          {frontTotals.total > 0 ? frontTotals.total : ''}
                        </TableCell>
                        {backNine.length > 0 && <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1"></TableCell>}
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-bold text-foreground text-[10px] px-0 py-1 w-[44px]">Skins</TableCell>
                        {frontNine.map(hole => {
                          const holeData = getHoleData(hole.hole_number);
                          if (!holeData) return <TableCell key={hole.hole_number} className="text-center text-[10px] px-0 py-1"></TableCell>;
                          
                          if (holeData.is_carryover) {
                            return (
                              <TableCell key={hole.hole_number} className="text-center text-[10px] px-0 py-1 text-muted-foreground">
                                -
                              </TableCell>
                            );
                          }
                          
                          if (holeData.winner_player === player.playerId) {
                            // Current player won this hole, show number of skins they got
                            return (
                              <TableCell 
                                key={hole.hole_number} 
                                className="text-center text-[10px] px-0 py-1 text-green-600 font-bold"
                              >
                                {holeData.skins_available}
                              </TableCell>
                            );
                          }
                          
                          if (holeData.winner_player && holeData.winner_player !== player.playerId) {
                            // Another player won this hole, show 0
                            return (
                              <TableCell key={hole.hole_number} className="text-center text-[10px] px-0 py-1 text-foreground">
                                0
                              </TableCell>
                            );
                          }
                          
                          // No winner yet
                          return <TableCell key={hole.hole_number} className="text-center text-[10px] px-0 py-1"></TableCell>;
                        })}
                        <TableCell className="text-center bg-muted text-[10px] px-0 py-1"></TableCell>
                        {backNine.length > 0 && <TableCell className="text-center bg-muted text-[10px] px-0 py-1"></TableCell>}
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
                          <TableHead className="text-center font-bold text-[10px] px-0 py-1 w-[44px]">Hole</TableHead>
                          {backNine.map(hole => (
                            <TableHead key={hole.hole_number} className="text-center font-bold text-[10px] px-0 py-1">
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
                        <TableRow className="font-bold">
                          <TableCell className="font-bold text-[10px] px-0 py-1 w-[44px] max-w-[44px] truncate">{player.name.split(' ')[0]}</TableCell>
                          {backNine.map(hole => {
                            const score = player.scores.get(hole.hole_number);
                            const hasMulligan = player.mulligans.has(hole.hole_number);
                            return (
                              <TableCell 
                                key={hole.hole_number} 
                                className="text-center text-[10px] px-0 py-1"
                              >
                                <div className="flex items-center justify-center gap-0.5">
                                  {score ? <ScorecardScoreCell score={score} par={hole.par} /> : ''}
                                  {hasMulligan && <RotateCcw size={8} className="text-amber-500" />}
                                </div>
                              </TableCell>
                            );
                          })}
                          <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1">
                            {backTotals.total > 0 ? backTotals.total : ''}
                          </TableCell>
                          <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1">
                            {frontTotals.total + backTotals.total > 0 ? frontTotals.total + backTotals.total : ''}
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="font-bold text-foreground text-[10px] px-0 py-1 w-[44px]">Skins</TableCell>
                          {backNine.map(hole => {
                            const holeData = getHoleData(hole.hole_number);
                            if (!holeData) return <TableCell key={hole.hole_number} className="text-center text-[10px] px-0 py-1"></TableCell>;
                            
                            if (holeData.is_carryover) {
                              return (
                                <TableCell key={hole.hole_number} className="text-center text-[10px] px-0 py-1 text-muted-foreground">
                                  -
                                </TableCell>
                              );
                            }
                            
                            if (holeData.winner_player === player.playerId) {
                              // Current player won this hole, show number of skins they got
                              return (
                                <TableCell 
                                  key={hole.hole_number} 
                                  className="text-center text-[10px] px-0 py-1 text-green-600 font-bold"
                                >
                                  {holeData.skins_available}
                                </TableCell>
                              );
                            }
                            
                            if (holeData.winner_player && holeData.winner_player !== player.playerId) {
                              // Another player won this hole, show 0
                              return (
                                <TableCell key={hole.hole_number} className="text-center text-[10px] px-0 py-1 text-foreground">
                                  0
                                </TableCell>
                              );
                            }
                            
                            // No winner yet
                            return <TableCell key={hole.hole_number} className="text-center text-[10px] px-0 py-1"></TableCell>;
                          })}
                          <TableCell className="text-center bg-muted text-[10px] px-0 py-1"></TableCell>
                          <TableCell className="text-center bg-muted text-[10px] px-0 py-1"></TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                )}
              </>
            )}
            
            {/* Per-scorecard actions */}
            <div className="px-4 pb-3">
              <ScorecardActions
                gameId={roundId!}
                gameType="skins"
                scorecardPlayerId={player.playerId}
                scorecardPlayerName={player.name}
              />
            </div>
          </Card>
        );
      })}
    </div>
  );

  return (
    <div className="min-h-screen bg-background pb-24">
      <GameHeader 
        gameTitle={game.round_name || "Skins"} 
        courseName={game.course_name} 
        pageTitle="Leaderboard"
        isAdmin={isAdmin}
        onFinish={handleFinishGame}
        onSaveAndExit={() => navigate('/profile')}
        onDelete={handleDeleteGame}
        gameName="Skins Game"
      />

      <LeaderboardModeTabs
        primaryLabel="Skins"
        activeMode={leaderboardMode}
        onModeChange={setLeaderboardMode}
        strokePlayEnabled={strokePlayEnabled}
      />

      {leaderboardMode === 'stroke_play' ? (
        <div className="p-4">
          <StrokePlayLeaderboardView
            players={strokePlayPlayers}
            courseHoles={courseHoles}
            isSpectator={isSpectator}
            gameId={roundId}
            gameType="skins"
          />
        </div>
      ) : (
        renderSkinsView()
      )}

      {roundId && <SkinsBottomTabBar roundId={roundId} />}

      {/* Completion Dialog */}
      {game && (
        <SkinsCompletionModal
          open={showCompletionDialog}
          onOpenChange={setShowCompletionDialog}
          game={{
            id: game.id,
            course_name: game.course_name,
            date_played: new Date().toISOString().split('T')[0],
            holes_played: game.holes_played,
            round_name: game.round_name,
            user_id: '',
            is_finished: game.is_finished,
            skin_value: 1,
            carryover_enabled: game.carryover_enabled,
            use_handicaps: game.use_handicaps,
            players: game.players,
          }}
          holes={holes.map(h => ({
            id: h.id,
            game_id: h.game_id,
            hole_number: h.hole_number,
            par: h.par,
            player_scores: h.player_scores,
            winner_player: h.winner_player,
            skins_available: h.skins_available,
            is_carryover: h.is_carryover,
          }))}
          players={game.players.map((p: any) => ({
            id: p.odId || p.id || p.name,
            odId: p.odId,
            name: p.name,
            displayName: p.displayName || p.name,
            handicap: p.handicap,
          }))}
          courseHoles={courseHoles}
        />
      )}
    </div>
  );
}
