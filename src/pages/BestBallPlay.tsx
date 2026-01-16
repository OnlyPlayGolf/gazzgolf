import { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useGameScoring, GameScoringConfig } from "@/hooks/useGameScoring";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { BestBallGame, BestBallHole, BestBallPlayer, BestBallPlayerScore, BestBallGameType } from "@/types/bestBall";
import { BestBallBottomTabBar } from "@/components/BestBallBottomTabBar";
import { PlayerScoreSheet } from "@/components/play/PlayerScoreSheet";
import { ScoreMoreSheet } from "@/components/play/ScoreMoreSheet";
import { useIsSpectator } from "@/hooks/useIsSpectator";
import { usePlayerStatsMode } from "@/hooks/usePlayerStatsMode";
import { PlayerStatsModeDialog } from "@/components/play/PlayerStatsModeDialog";
import { InRoundStatsEntry } from "@/components/play/InRoundStatsEntry";
import {
  calculateBestBall,
  calculateHoleResult,
  calculateHandicapStrokes,
  formatMatchStatus,
  isMatchFinished,
  getScoreColorClass,
} from "@/utils/bestBallScoring";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface BestBallScores {
  teamA: Record<string, number | null>;
  teamB: Record<string, number | null>;
}

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

const createBestBallConfig = (gameId: string): GameScoringConfig<BestBallGame, BestBallHole, BestBallScores> => ({
  gameId,
  gameTable: "best_ball_games",
  holesTable: "best_ball_holes",
  
  parseGame: (data): BestBallGame => ({
    ...data,
    game_type: (data.game_type as BestBallGameType) || 'match',
    team_a_players: parsePlayerArray(data.team_a_players),
    team_b_players: parsePlayerArray(data.team_b_players),
    winner_team: data.winner_team as 'A' | 'B' | 'TIE' | null,
  }),
  parseHole: (data): BestBallHole => ({
    ...data,
    team_a_scores: data.team_a_scores as unknown as BestBallPlayerScore[],
    team_b_scores: data.team_b_scores as unknown as BestBallPlayerScore[],
  }),
  getHoleNumber: (hole) => hole.hole_number,
  getTotalHoles: (game) => game.holes_played || 18,
  getCourseId: (game) => game.course_id || null,
  getSummaryRoute: (id) => `/best-ball/${id}/summary`,
  
  // Only save on navigate if all players have scores
  shouldSaveOnNavigate: (game, scores) => {
    const teamAComplete = game.team_a_players.every(p => {
      const score = scores.teamA[p.odId];
      return score !== null && score !== undefined;
    });
    const teamBComplete = game.team_b_players.every(p => {
      const score = scores.teamB[p.odId];
      return score !== null && score !== undefined;
    });
    return teamAComplete && teamBComplete;
  },
  
  createEmptyScores: (game) => {
    const teamA: Record<string, number | null> = {};
    const teamB: Record<string, number | null> = {};
    (game.team_a_players || []).forEach(p => { if (p?.odId) teamA[p.odId] = null; });
    (game.team_b_players || []).forEach(p => { if (p?.odId) teamB[p.odId] = null; });
    return { teamA, teamB };
  },
  
  extractScoresFromHole: (hole, game) => {
    const teamA: Record<string, number | null> = {};
    const teamB: Record<string, number | null> = {};
    (hole.team_a_scores || []).forEach(s => { if (s?.playerId) teamA[s.playerId] = s.grossScore ?? null; });
    (hole.team_b_scores || []).forEach(s => { if (s?.playerId) teamB[s.playerId] = s.grossScore ?? null; });
    return { teamA, teamB };
  },
  
  buildHoleData: ({ gameId, holeNumber, par, strokeIndex, scores, previousHoles, game, courseHoles }) => {
    const buildPlayerScores = (
      players: BestBallPlayer[],
      scoresMap: Record<string, number | null>,
      useHandicaps: boolean
    ): BestBallPlayerScore[] => {
      return players.map(player => {
        const rawScore = scoresMap[player.odId];
        // Only use the score if it was actually entered (not null)
        const grossScore = rawScore !== null && rawScore !== undefined ? rawScore : null;
        const handicapStrokes = useHandicaps ? calculateHandicapStrokes(player.handicap, strokeIndex) : 0;
        const netScore = grossScore !== null ? grossScore - handicapStrokes : null;
        return {
          playerId: player.odId,
          playerName: player.displayName,
          grossScore,
          netScore,
          handicapStrokes,
        };
      });
    };

    const teamAPlayerScores = buildPlayerScores(game.team_a_players, scores.teamA, game.use_handicaps);
    const teamBPlayerScores = buildPlayerScores(game.team_b_players, scores.teamB, game.use_handicaps);
    
    const teamAResult = calculateBestBall(teamAPlayerScores, game.use_handicaps);
    const teamBResult = calculateBestBall(teamBPlayerScores, game.use_handicaps);
    
    const holeResult = calculateHoleResult(teamAResult.bestScore, teamBResult.bestScore);
    
    const prevHole = previousHoles.length > 0 ? previousHoles[previousHoles.length - 1] : null;
    const prevMatchStatus = prevHole?.match_status_after ?? 0;
    const newMatchStatus = prevMatchStatus + holeResult;
    const holesRemaining = (game.holes_played || 18) - holeNumber;
    
    const prevTeamATotal = previousHoles.reduce((sum, h) => sum + (h.team_a_best_gross || 0), 0);
    const prevTeamBTotal = previousHoles.reduce((sum, h) => sum + (h.team_b_best_gross || 0), 0);
    
    const teamARunning = prevTeamATotal + (teamAResult.bestScore || 0);
    const teamBRunning = prevTeamBTotal + (teamBResult.bestScore || 0);

    return {
      game_id: gameId,
      hole_number: holeNumber,
      par,
      stroke_index: strokeIndex,
      team_a_scores: teamAPlayerScores as unknown as any,
      team_b_scores: teamBPlayerScores as unknown as any,
      team_a_best_gross: game.use_handicaps 
        ? teamAPlayerScores.reduce((min, s) => Math.min(min, s.grossScore || Infinity), Infinity)
        : teamAResult.bestScore,
      team_a_best_net: game.use_handicaps ? teamAResult.bestScore : null,
      team_a_counting_player: teamAResult.countingPlayer,
      team_b_best_gross: game.use_handicaps
        ? teamBPlayerScores.reduce((min, s) => Math.min(min, s.grossScore || Infinity), Infinity)
        : teamBResult.bestScore,
      team_b_best_net: game.use_handicaps ? teamBResult.bestScore : null,
      team_b_counting_player: teamBResult.countingPlayer,
      team_a_running_total: teamARunning,
      team_b_running_total: teamBRunning,
      hole_result: holeResult,
      match_status_after: newMatchStatus,
      holes_remaining_after: holesRemaining,
    };
  },
  
  buildGameUpdate: ({ game, allHoles, newHoleData }) => {
    const allHolesTeamA = allHoles.reduce((sum, h) => sum + (game.use_handicaps ? (h.team_a_best_net || 0) : (h.team_a_best_gross || 0)), 0);
    const allHolesTeamB = allHoles.reduce((sum, h) => sum + (game.use_handicaps ? (h.team_b_best_net || 0) : (h.team_b_best_gross || 0)), 0);

    return {
      team_a_total: allHolesTeamA,
      team_b_total: allHolesTeamB,
      match_status: newHoleData.match_status_after,
      holes_remaining: newHoleData.holes_remaining_after,
    };
  },
  
  isGameFinished: (game, holeNumber, totalHoles, holeData) => {
    const holesRemaining = totalHoles - holeNumber;
    const isMatchOver = game.game_type === 'match' && isMatchFinished(holeData.match_status_after, holesRemaining);
    return isMatchOver || holeNumber >= totalHoles;
  },
});

export default function BestBallPlay() {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  // Check spectator status - redirect if not a participant or edit window expired
  const { isSpectator, isLoading: spectatorLoading } = useIsSpectator('best_ball', gameId);
  
  useEffect(() => {
    if (!spectatorLoading && isSpectator && gameId) {
      navigate(`/best-ball/${gameId}/leaderboard`, { replace: true });
    }
  }, [isSpectator, spectatorLoading, gameId, navigate]);
  
  const [showExitDialog, setShowExitDialog] = useState(false);
  const [activePlayerSheet, setActivePlayerSheet] = useState<{ team: 'A' | 'B', playerId: string } | null>(null);
  const [shouldSaveOnComplete, setShouldSaveOnComplete] = useState(false);
  const [showStatsModeDialog, setShowStatsModeDialog] = useState(false);
  
  // More sheet state
  const [showMoreSheet, setShowMoreSheet] = useState(false);
  const [currentComment, setCurrentComment] = useState("");
  const [mulliganJustAdded, setMulliganJustAdded] = useState(false);
  
  // Mulligan tracking: Map<playerId, Set<holeNumber>>
  const [mulligansUsed, setMulligansUsed] = useState<Map<string, Set<number>>>(new Map());
  const [mulligansPerPlayer, setMulligansPerPlayer] = useState(0);
  
  // Per-player stats mode
  const { statsMode, loading: statsModeLoading, saving: statsModeSaving, setStatsMode } = usePlayerStatsMode(gameId, 'best_ball');
  
  // Use a ref to track latest scores for the advance logic (avoids stale state)
  const scoresRef = useRef<BestBallScores>({ teamA: {}, teamB: {} });
  
  const config = createBestBallConfig(gameId || "");
  const [state, actions] = useGameScoring(config, navigate);
  
  const { game, holes, courseHoles, currentHoleIndex, loading, saving, scores, par, strokeIndex } = state;
  const { setScores, saveHole, navigateHole, deleteGame } = actions;
  
  // Keep ref in sync with state
  useEffect(() => {
    if (scores) {
      scoresRef.current = scores;
    }
  }, [scores]);
  
  // Load mulligans setting from the game data (database)
  useEffect(() => {
    if (game) {
      setMulligansPerPlayer(game.mulligans_per_player || 0);
    }
  }, [game]);
  
  const currentHole = currentHoleIndex + 1;
  const totalHoles = game?.holes_played || 18;
  
  // Show stats mode dialog on first load if not set
  useEffect(() => {
    if (!statsModeLoading && statsMode === 'none' && game && !loading) {
      const hasShownDialog = sessionStorage.getItem(`bestBallStatsModeShown_${gameId}`);
      if (!hasShownDialog) {
        setShowStatsModeDialog(true);
        sessionStorage.setItem(`bestBallStatsModeShown_${gameId}`, 'true');
      }
    }
  }, [statsModeLoading, statsMode, game, loading, gameId]);
  
  // Get hole distance from course data based on tee set
  const currentCourseHole = courseHoles.find(h => h.hole_number === currentHole);
  const getHoleDistance = (): number | undefined => {
    if (!currentCourseHole) return undefined;
    // Best Ball doesn't have a single tee_set, default to white
    const distanceKey = 'white_distance' as keyof typeof currentCourseHole;
    const distance = currentCourseHole[distanceKey];
    return typeof distance === 'number' ? distance : undefined;
  };
  const holeDistance = getHoleDistance();

  const handleScoreSelect = (team: 'A' | 'B', playerId: string, score: number | null) => {
    if (score === null) return;
    
    // Update ref immediately for the advance logic
    if (team === 'A') {
      scoresRef.current = { ...scoresRef.current, teamA: { ...scoresRef.current.teamA, [playerId]: score } };
      setScores(prev => ({ ...prev, teamA: { ...prev.teamA, [playerId]: score } }));
    } else {
      scoresRef.current = { ...scoresRef.current, teamB: { ...scoresRef.current.teamB, [playerId]: score } };
      setScores(prev => ({ ...prev, teamB: { ...prev.teamB, [playerId]: score } }));
    }
  };

  const advanceToNextPlayerSheet = (team: 'A' | 'B', playerId: string) => {
    if (!game) return;

    const latestScores = scoresRef.current;
    
    const allPlayers = [
      ...game.team_a_players.map(p => ({ ...p, team: 'A' as const })),
      ...game.team_b_players.map(p => ({ ...p, team: 'B' as const })),
    ];

    const currentIndex = allPlayers.findIndex(p => p.team === team && p.odId === playerId);
    if (currentIndex < 0) {
      setActivePlayerSheet(null);
      return;
    }

    // Find the next player without a score, starting from the next player in the list
    for (let i = 1; i < allPlayers.length; i++) {
      const checkIndex = (currentIndex + i) % allPlayers.length;
      const player = allPlayers[checkIndex];
      const playerScore = player.team === 'A' 
        ? latestScores.teamA[player.odId]
        : latestScores.teamB[player.odId];
      
      // Score is missing if null or undefined
      if (playerScore === null || playerScore === undefined) {
        setActivePlayerSheet({ team: player.team, playerId: player.odId });
        return;
      }
    }

    // All players have scores - close sheet and save/advance
    setActivePlayerSheet(null);
    setShouldSaveOnComplete(true);
  };

  // Effect to save hole after the last player's score has been set in state
  useEffect(() => {
    if (shouldSaveOnComplete && game) {
      // Check if all players now have scores before saving
      const allHaveScores = game.team_a_players.every((p) => {
        const score = scores?.teamA?.[p.odId];
        return score !== null && score !== undefined;
      }) && game.team_b_players.every((p) => {
        const score = scores?.teamB?.[p.odId];
        return score !== null && score !== undefined;
      });
      
      if (allHaveScores) {
        setShouldSaveOnComplete(false);
        saveHole();
      }
    }
  }, [shouldSaveOnComplete, scores, game, saveHole]);

  // Calculate current best balls for display
  const getCurrentBestBalls = () => {
    if (!game) return { teamA: null, teamB: null };
    
    const buildPlayerScores = (
      players: BestBallPlayer[],
      scoresMap?: Record<string, number | null>
    ): BestBallPlayerScore[] => {
      return players.map((player) => {
        const grossFromMap = scoresMap?.[player.odId];
        // Only use the score if actually entered (not null)
        const grossScore = grossFromMap !== null && grossFromMap !== undefined ? grossFromMap : null;
        const handicapStrokes = game.use_handicaps
          ? calculateHandicapStrokes(player.handicap, strokeIndex)
          : 0;
        return {
          playerId: player.odId,
          playerName: player.displayName,
          grossScore,
          netScore: grossScore !== null ? grossScore - handicapStrokes : null,
          handicapStrokes,
        };
      });
    };
    
    const teamAPlayerScores = buildPlayerScores(game.team_a_players, scores?.teamA);
    const teamBPlayerScores = buildPlayerScores(game.team_b_players, scores?.teamB);
    
    return {
      teamA: calculateBestBall(teamAPlayerScores, game.use_handicaps),
      teamB: calculateBestBall(teamBPlayerScores, game.use_handicaps),
    };
  };

  // Calculate team score to par based on played holes
  const getTeamScoreToPar = (team: 'A' | 'B') => {
    if (!game) return null;
    
    const teamTotal = team === 'A' ? game.team_a_total : game.team_b_total;
    
    // Calculate par for played holes
    const playedHoleNumbers = holes.map(h => h.hole_number);
    const parForPlayedHoles = courseHoles
      .filter(ch => playedHoleNumbers.includes(ch.hole_number))
      .reduce((sum, ch) => sum + ch.par, 0);
    
    if (parForPlayedHoles === 0) return null;
    
    const scoreToPar = teamTotal - parForPlayedHoles;
    if (scoreToPar === 0) return 'E';
    return scoreToPar > 0 ? `+${scoreToPar}` : scoreToPar.toString();
  };

  // Mulligan helpers
  const getPlayerMulligansUsed = (playerId: string): number => {
    return mulligansUsed.get(playerId)?.size || 0;
  };

  const hasPlayerUsedMulliganOnHole = (playerId: string, holeNumber: number): boolean => {
    return mulligansUsed.get(playerId)?.has(holeNumber) || false;
  };

  const useMulliganOnHole = (playerId: string, holeNumber: number) => {
    setMulligansUsed(prev => {
      const updated = new Map(prev);
      const playerMulligans = new Set(prev.get(playerId) || []);
      playerMulligans.add(holeNumber);
      updated.set(playerId, playerMulligans);
      return updated;
    });
    setMulliganJustAdded(true);
  };

  const removeMulliganFromHole = (playerId: string, holeNumber: number) => {
    setMulligansUsed(prev => {
      const updated = new Map(prev);
      const playerMulligans = new Set(prev.get(playerId) || []);
      playerMulligans.delete(holeNumber);
      updated.set(playerId, playerMulligans);
      return updated;
    });
  };

  // More sheet handlers
  const handleOpenMoreSheet = () => {
    if (activePlayerSheet) {
      setCurrentComment("");
      setMulliganJustAdded(false);
      setShowMoreSheet(true);
    }
  };

  const handleSaveMore = async () => {
    if (!activePlayerSheet || !gameId) return;
    
    const hasComment = currentComment.trim().length > 0;
    const hasMulligan = mulliganJustAdded;
    
    if (hasComment || hasMulligan) {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const playerName = activePlayerSheet.team === 'A'
            ? game?.team_a_players.find(p => p.odId === activePlayerSheet.playerId)?.displayName || 'Player'
            : game?.team_b_players.find(p => p.odId === activePlayerSheet.playerId)?.displayName || 'Player';
          
          let content = "";
          if (hasMulligan && hasComment) {
            content = `🔄 ${playerName} used a mulligan on hole ${currentHole}: "${currentComment.trim()}"`;
          } else if (hasMulligan) {
            content = `🔄 ${playerName} used a mulligan on hole ${currentHole}`;
          } else {
            content = currentComment.trim();
          }
          
          await supabase.from("round_comments").insert({
            round_id: gameId,
            user_id: user.id,
            content,
            hole_number: currentHole,
            game_type: "best_ball",
          });
        }
      } catch (error) {
        console.error("Error saving to feed:", error);
      }
    }
    
    setMulliganJustAdded(false);
  };

  const bestBalls = getCurrentBestBalls();

  if (loading) {
    return (
      <div className="min-h-screen pb-24 flex items-center justify-center">
        <div className="text-muted-foreground">Loading game...</div>
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

  const renderPlayerScoreRow = (
    player: BestBallPlayer,
    team: 'A' | 'B',
    scoresMap: Record<string, number | null>,
    countingPlayer: string | null
  ) => {
    const score = scoresMap[player.odId];
    const hasScore = score !== undefined && score !== null;
    const handicapStrokes = game.use_handicaps ? calculateHandicapStrokes(player.handicap, strokeIndex) : 0;
    
    return (
      <Card
        key={player.odId}
        className="p-4 cursor-pointer hover:bg-muted/50 transition-colors"
        onClick={() => setActivePlayerSheet({ team, playerId: player.odId })}
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-lg font-bold">{player.displayName}</p>
            {game.use_handicaps && (
              <div className="text-sm text-muted-foreground">
                HCP: {player.handicap ?? 0} {handicapStrokes > 0 && `(+${handicapStrokes})`}
              </div>
            )}
          </div>
          <div className="text-center">
            <div className={`text-2xl font-bold ${hasScore ? '' : 'text-muted-foreground'}`}>
              {hasScore ? score : 0}
            </div>
            <div className="text-xs text-muted-foreground">Strokes</div>
          </div>
        </div>
      </Card>
    );
  };

  const allPlayersHaveScores = () => {
    const teamAHasScores = game.team_a_players.every((p) => {
      const score = scores?.teamA?.[p.odId];
      return score !== null && score !== undefined;
    });
    const teamBHasScores = game.team_b_players.every((p) => {
      const score = scores?.teamB?.[p.odId];
      return score !== null && score !== undefined;
    });
    return teamAHasScores && teamBHasScores;
  };

  return (
    <div className="min-h-screen pb-24 bg-background">
      {/* Header */}
      <div className="bg-card border-b border-border">
        <div className="p-4 max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowExitDialog(true)}
              className="rounded-full"
            >
              <ChevronLeft size={24} />
            </Button>
            <div className="flex-1 text-center">
              <h1 className="text-xl font-bold">{game.round_name || 'Best Ball'}</h1>
              <p className="text-sm text-muted-foreground">{game.course_name}</p>
            </div>
            <div className="w-10" />
          </div>
        </div>

        {/* Hole Navigation Bar */}
        <div className="bg-primary py-4 px-4">
          <div className="max-w-2xl mx-auto flex items-center justify-between">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigateHole("prev")}
              disabled={currentHoleIndex === 0}
              className="text-primary-foreground hover:bg-primary/80 disabled:text-primary-foreground/50"
            >
              <ChevronLeft size={24} />
            </Button>

            <div className="text-center">
              <div className="text-sm text-primary-foreground/90">PAR {par}</div>
              <div className="text-2xl font-bold text-primary-foreground">Hole {currentHole}</div>
              <div className="text-xs text-primary-foreground/90">HCP {strokeIndex}</div>
            </div>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigateHole("next")}
              disabled={currentHole > holes.length || currentHole >= totalHoles}
              className="text-primary-foreground hover:bg-primary/80 disabled:text-primary-foreground/50"
            >
              <ChevronRight size={24} />
            </Button>
          </div>
        </div>
      </div>

      {/* Score Entry */}
      <div className="p-4 max-w-2xl mx-auto space-y-6">
        {/* Team A */}
        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-blue-600">{game.team_a_name}</h3>
            {game.game_type === 'stroke' && getTeamScoreToPar('A') !== null && (
              <span className="text-sm font-medium bg-blue-100 text-blue-700 px-2 py-1 rounded">
                {getTeamScoreToPar('A')}
              </span>
            )}
          </div>
          <div className="space-y-2">
            {game.team_a_players.map((player) =>
              renderPlayerScoreRow(player, 'A', scores?.teamA ?? {}, bestBalls.teamA?.countingPlayer || null)
            )}
          </div>
        </Card>

        {/* Team B */}
        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-red-600">{game.team_b_name}</h3>
            {game.game_type === 'stroke' && getTeamScoreToPar('B') !== null && (
              <span className="text-sm font-medium bg-red-100 text-red-700 px-2 py-1 rounded">
                {getTeamScoreToPar('B')}
              </span>
            )}
          </div>
          <div className="space-y-2">
            {game.team_b_players.map((player) =>
              renderPlayerScoreRow(player, 'B', scores?.teamB ?? {}, bestBalls.teamB?.countingPlayer || null)
            )}
          </div>
        </Card>

        {/* Match Status - only show for match play */}
        {game.game_type === 'match' && (
          <div className={`p-3 rounded-lg text-center ${
            game.match_status > 0 
              ? 'bg-blue-600 text-white' 
              : game.match_status < 0 
                ? 'bg-red-600 text-white' 
                : 'bg-muted text-foreground'
          }`}>
            <p className="text-lg font-bold">
              {formatMatchStatus(game.match_status, game.holes_remaining, game.team_a_name, game.team_b_name)}
            </p>
          </div>
        )}

        {/* Player Score Sheets */}
        {game.team_a_players.map(player => (
          <PlayerScoreSheet
            key={player.odId}
            open={activePlayerSheet?.team === 'A' && activePlayerSheet.playerId === player.odId}
            onOpenChange={(open) => { if (!open) setActivePlayerSheet(null); }}
            playerName={player.displayName}
            handicap={player.handicap}
            par={par}
            holeNumber={currentHole}
            currentScore={scores?.teamA?.[player.odId] ?? null}
            onScoreSelect={(score) => handleScoreSelect('A', player.odId, score)}
            onMore={handleOpenMoreSheet}
            onEnterAndNext={() => advanceToNextPlayerSheet('A', player.odId)}
          />
        ))}
        {game.team_b_players.map(player => (
          <PlayerScoreSheet
            key={player.odId}
            open={activePlayerSheet?.team === 'B' && activePlayerSheet.playerId === player.odId}
            onOpenChange={(open) => { if (!open) setActivePlayerSheet(null); }}
            playerName={player.displayName}
            handicap={player.handicap}
            par={par}
            holeNumber={currentHole}
            currentScore={scores?.teamB?.[player.odId] ?? null}
            onScoreSelect={(score) => handleScoreSelect('B', player.odId, score)}
            onMore={handleOpenMoreSheet}
            onEnterAndNext={() => advanceToNextPlayerSheet('B', player.odId)}
          />
        ))}

        {/* Score More Sheet */}
        {activePlayerSheet && (
          <ScoreMoreSheet
            open={showMoreSheet}
            onOpenChange={setShowMoreSheet}
            holeNumber={currentHole}
            par={par}
            playerName={
              activePlayerSheet.team === 'A'
                ? game.team_a_players.find(p => p.odId === activePlayerSheet.playerId)?.displayName || 'Player'
                : game.team_b_players.find(p => p.odId === activePlayerSheet.playerId)?.displayName || 'Player'
            }
            comment={currentComment}
            onCommentChange={setCurrentComment}
            mulligansAllowed={mulligansPerPlayer}
            mulligansUsed={getPlayerMulligansUsed(activePlayerSheet.playerId)}
            mulliganUsedOnThisHole={hasPlayerUsedMulliganOnHole(activePlayerSheet.playerId, currentHole)}
            onUseMulligan={() => useMulliganOnHole(activePlayerSheet.playerId, currentHole)}
            onRemoveMulligan={() => removeMulliganFromHole(activePlayerSheet.playerId, currentHole)}
            onSave={handleSaveMore}
          />
        )}

      </div>

      {gameId && <BestBallBottomTabBar gameId={gameId} />}

      {/* Exit Dialog */}
      <AlertDialog open={showExitDialog} onOpenChange={setShowExitDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Exit Game</AlertDialogTitle>
            <AlertDialogDescription>
              What would you like to do with this game?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col gap-2 sm:flex-row">
            <AlertDialogAction onClick={() => {
              setShowExitDialog(false);
              navigate("/rounds-play");
            }}>
              Save and Exit
            </AlertDialogAction>
            <AlertDialogAction
              onClick={() => deleteGame()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Game
            </AlertDialogAction>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Stats Mode Dialog */}
      <PlayerStatsModeDialog
        open={showStatsModeDialog}
        onOpenChange={setShowStatsModeDialog}
        onSelect={setStatsMode}
        saving={statsModeSaving}
      />

      {/* Per-player stats entry */}
      {game?.team_a_players?.[0] && (
        <InRoundStatsEntry
          statsMode={statsMode}
          roundId={gameId}
          holeNumber={currentHole}
          par={par}
          score={scores?.teamA?.[game.team_a_players[0].odId] ?? 0}
          holeDistance={holeDistance}
          playerId={game.team_a_players[0].odId}
          isCurrentUser={true}
        />
      )}
    </div>
  );
}
