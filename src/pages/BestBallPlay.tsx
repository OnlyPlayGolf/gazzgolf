import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ChevronLeft, ChevronRight, Star } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useGameScoring, GameScoringConfig } from "@/hooks/useGameScoring";
import { useToast } from "@/hooks/use-toast";
import { BestBallGame, BestBallHole, BestBallPlayer, BestBallPlayerScore, BestBallGameType } from "@/types/bestBall";
import { BestBallBottomTabBar } from "@/components/BestBallBottomTabBar";
import { PlayerScoreSheet } from "@/components/play/PlayerScoreSheet";
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
  teamA: Record<string, number>;
  teamB: Record<string, number>;
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
  
  createEmptyScores: (game) => {
    const teamA: Record<string, number> = {};
    const teamB: Record<string, number> = {};
    (game.team_a_players || []).forEach(p => { if (p?.odId) teamA[p.odId] = 0; });
    (game.team_b_players || []).forEach(p => { if (p?.odId) teamB[p.odId] = 0; });
    return { teamA, teamB };
  },
  
  extractScoresFromHole: (hole, game) => {
    const teamA: Record<string, number> = {};
    const teamB: Record<string, number> = {};
    (hole.team_a_scores || []).forEach(s => { if (s?.playerId) teamA[s.playerId] = s.grossScore ?? 0; });
    (hole.team_b_scores || []).forEach(s => { if (s?.playerId) teamB[s.playerId] = s.grossScore ?? 0; });
    return { teamA, teamB };
  },
  
  buildHoleData: ({ gameId, holeNumber, par, strokeIndex, scores, previousHoles, game, courseHoles }) => {
    const buildPlayerScores = (
      players: BestBallPlayer[],
      scoresMap: Record<string, number>,
      useHandicaps: boolean
    ): BestBallPlayerScore[] => {
      return players.map(player => {
        const grossScore = scoresMap[player.odId] || par;
        const handicapStrokes = useHandicaps ? calculateHandicapStrokes(player.handicap, strokeIndex) : 0;
        const netScore = grossScore - handicapStrokes;
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
  
  const [showExitDialog, setShowExitDialog] = useState(false);
  const [activePlayerSheet, setActivePlayerSheet] = useState<{ team: 'A' | 'B', playerId: string } | null>(null);
  
  const config = createBestBallConfig(gameId || "");
  const [state, actions] = useGameScoring(config, navigate);
  
  const { game, holes, courseHoles, currentHoleIndex, loading, saving, scores, par, strokeIndex } = state;
  const { setScores, saveHole, navigateHole, deleteGame } = actions;
  
  const currentHole = currentHoleIndex + 1;
  const totalHoles = game?.holes_played || 18;

  const handleScoreSelect = (team: 'A' | 'B', playerId: string, score: number | null) => {
    if (score === null) return;
    
    if (team === 'A') {
      setScores(prev => ({ ...prev, teamA: { ...prev.teamA, [playerId]: score } }));
    } else {
      setScores(prev => ({ ...prev, teamB: { ...prev.teamB, [playerId]: score } }));
    }
  };

  const advanceToNextPlayerSheet = (team: 'A' | 'B', playerId: string) => {
    if (!game) return;

    const allPlayers = [
      ...game.team_a_players.map(p => ({ ...p, team: 'A' as const })),
      ...game.team_b_players.map(p => ({ ...p, team: 'B' as const })),
    ];

    const currentIndex = allPlayers.findIndex(p => p.team === team && p.odId === playerId);
    if (currentIndex < 0) {
      setActivePlayerSheet(null);
      return;
    }

    if (currentIndex < allPlayers.length - 1) {
      const nextPlayer = allPlayers[currentIndex + 1];
      setActivePlayerSheet({ team: nextPlayer.team, playerId: nextPlayer.odId });
    } else {
      setActivePlayerSheet(null);
      saveHole();
    }
  };

  // Calculate current best balls for display
  const getCurrentBestBalls = () => {
    if (!game) return { teamA: null, teamB: null };
    
    const buildPlayerScores = (
      players: BestBallPlayer[],
      scoresMap?: Record<string, number>
    ): BestBallPlayerScore[] => {
      return players.map((player) => {
        const grossFromMap = scoresMap?.[player.odId];
        const grossScore = grossFromMap ?? par;
        const handicapStrokes = game.use_handicaps
          ? calculateHandicapStrokes(player.handicap, strokeIndex)
          : 0;
        return {
          playerId: player.odId,
          playerName: player.displayName,
          grossScore,
          netScore: grossScore - handicapStrokes,
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
    scoresMap: Record<string, number>,
    countingPlayer: string | null
  ) => {
    const score = scoresMap[player.odId];
    const hasScore = score !== undefined && score !== null && score !== 0;
    const isCounting = countingPlayer === player.displayName;
    const handicapStrokes = game.use_handicaps ? calculateHandicapStrokes(player.handicap, strokeIndex) : 0;
    
    return (
      <div
        key={player.odId}
        className={`flex items-center justify-between p-3 rounded-lg transition-all cursor-pointer hover:bg-muted/70 ${
          isCounting ? 'bg-primary/10 ring-2 ring-primary/30' : 'bg-muted/50'
        }`}
        onClick={() => setActivePlayerSheet({ team, playerId: player.odId })}
      >
        <div className="flex items-center gap-2">
          {isCounting && <Star size={16} className="text-primary fill-primary" />}
          <div>
            <p className="font-medium">{player.displayName}</p>
            {game.use_handicaps && (
              <span className="text-xs text-muted-foreground">
                HCP: {player.handicap ?? 0} {handicapStrokes > 0 && `(+${handicapStrokes})`}
              </span>
            )}
          </div>
        </div>
        <span className={`text-xl font-bold ${hasScore ? '' : 'text-muted-foreground'}`}>
          {hasScore ? score : '–'}
        </span>
      </div>
    );
  };

  const allPlayersHaveScores = () => {
    const teamAHasScores = game.team_a_players.every((p) => (scores?.teamA?.[p.odId] ?? 0) > 0);
    const teamBHasScores = game.team_b_players.every((p) => (scores?.teamB?.[p.odId] ?? 0) > 0);
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
              <h1 className="text-xl font-bold">Best Ball</h1>
              <p className="text-sm text-muted-foreground">{game.course_name}</p>
            </div>
            <div className="w-10" />
          </div>
        </div>

        {/* Hole Navigation Bar */}
        <div className="bg-[hsl(120,20%,85%)] py-4 px-4">
          <div className="max-w-2xl mx-auto flex items-center justify-between">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigateHole("prev")}
              disabled={currentHoleIndex === 0}
              className="text-[hsl(120,20%,30%)] hover:bg-[hsl(120,20%,80%)]"
            >
              <ChevronLeft size={24} />
            </Button>

            <div className="text-center">
              <div className="text-sm text-[hsl(120,20%,40%)]">PAR {par}</div>
              <div className="text-2xl font-bold text-[hsl(120,20%,25%)]">Hole {currentHole}</div>
            </div>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigateHole("next")}
              disabled={currentHole > holes.length || currentHole >= totalHoles}
              className="text-[hsl(120,20%,30%)] hover:bg-[hsl(120,20%,80%)]"
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
            {bestBalls.teamA?.bestScore && (
              <span className="text-sm font-medium bg-blue-100 text-blue-700 px-2 py-1 rounded">
                Best: {bestBalls.teamA.bestScore}
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
            {bestBalls.teamB?.bestScore && (
              <span className="text-sm font-medium bg-red-100 text-red-700 px-2 py-1 rounded">
                Best: {bestBalls.teamB.bestScore}
              </span>
            )}
          </div>
          <div className="space-y-2">
            {game.team_b_players.map((player) =>
              renderPlayerScoreRow(player, 'B', scores?.teamB ?? {}, bestBalls.teamB?.countingPlayer || null)
            )}
          </div>
        </Card>

        {/* Match Status */}
        <div className="p-3 bg-primary/10 rounded-lg text-center">
          <p className="text-lg font-bold text-primary">
            {formatMatchStatus(game.match_status, game.holes_remaining, game.team_a_name, game.team_b_name)}
          </p>
        </div>

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
            currentScore={scores?.teamA?.[player.odId] ?? 0}
            onScoreSelect={(score) => handleScoreSelect('A', player.odId, score)}
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
            currentScore={scores?.teamB?.[player.odId] ?? 0}
            onScoreSelect={(score) => handleScoreSelect('B', player.odId, score)}
            onEnterAndNext={() => advanceToNextPlayerSheet('B', player.odId)}
          />
        ))}

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
    </div>
  );
}
