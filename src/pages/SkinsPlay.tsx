import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ChevronLeft, ChevronRight, Trophy, Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useGameScoring, GameScoringConfig } from "@/hooks/useGameScoring";
import { useToast } from "@/hooks/use-toast";
import { SkinsGame, SkinsHole, SkinsPlayer, SkinsPlayerScore } from "@/types/skins";
import { SkinsBottomTabBar } from "@/components/SkinsBottomTabBar";
import { PlayerScoreSheet } from "@/components/play/PlayerScoreSheet";
import { calculateSkinsHoleResult, calculateNetScore, formatHandicap } from "@/utils/skinsScoring";
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

type SkinsScores = Record<string, number>;

const createSkinsConfig = (gameId: string): GameScoringConfig<SkinsGame, SkinsHole, SkinsScores> => ({
  gameId,
  gameTable: "skins_games",
  holesTable: "skins_holes",
  
  parseGame: (data): SkinsGame => ({
    ...data,
    players: (data.players as unknown as SkinsPlayer[]) || [],
    handicap_mode: (data.handicap_mode as 'gross' | 'net') || 'net',
  }),
  parseHole: (data): SkinsHole => ({
    ...data,
    player_scores: (data.player_scores as unknown as Record<string, SkinsPlayerScore>) || {},
  }),
  getHoleNumber: (hole) => hole.hole_number,
  getTotalHoles: (game) => game.holes_played || 18,
  getCourseId: (game) => game.course_id || null,
  getSummaryRoute: (id) => `/skins/${id}/summary`,
  
  createEmptyScores: (game) => {
    const scores: SkinsScores = {};
    game.players.forEach(p => { scores[p.name] = 0; });
    return scores;
  },
  
  extractScoresFromHole: (hole) => {
    const scores: SkinsScores = {};
    Object.entries(hole.player_scores).forEach(([name, score]) => {
      scores[name] = score.gross;
    });
    return scores;
  },
  
  buildHoleData: ({ gameId, holeNumber, par, strokeIndex, scores, previousHoles, game }) => {
    // Calculate carryover
    let consecutiveCarryovers = 0;
    if (game.carryover_enabled) {
      for (let i = previousHoles.length - 1; i >= 0; i--) {
        if (previousHoles[i].is_carryover) {
          consecutiveCarryovers++;
        } else {
          break;
        }
      }
    }
    const carryoverCount = 1 + consecutiveCarryovers;
    
    // Build player scores
    const playerScores: Record<string, SkinsPlayerScore> = {};
    game.players.forEach(player => {
      const gross = scores[player.name] || par;
      const net = game.use_handicaps 
        ? calculateNetScore(gross, player.handicap, strokeIndex || 1, game.holes_played)
        : gross;
      playerScores[player.name] = { gross, net };
    });

    const useNet = game.use_handicaps && game.handicap_mode === 'net';
    const result = calculateSkinsHoleResult(playerScores, useNet, game.carryover_enabled, carryoverCount);

    return {
      game_id: gameId,
      hole_number: holeNumber,
      par,
      stroke_index: strokeIndex,
      player_scores: playerScores as any,
      skins_available: carryoverCount,
      winner_player: result.winnerPlayer,
      is_carryover: result.isCarryover,
    };
  },
  
  buildGameUpdate: ({ game, holeNumber, allHoles }) => {
    const totalHoles = game.holes_played || 18;
    if (holeNumber >= totalHoles) {
      return { is_finished: true };
    }
    return null;
  },
  
  isGameFinished: (game, holeNumber, totalHoles) => holeNumber >= totalHoles,
});

export default function SkinsPlay() {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [showExitDialog, setShowExitDialog] = useState(false);
  const [activePlayerIndex, setActivePlayerIndex] = useState<number | null>(null);
  const [carryoverCount, setCarryoverCount] = useState(1);
  
  const config = createSkinsConfig(gameId || "");
  const [state, actions] = useGameScoring(config, navigate);
  
  const { game, holes, currentHoleIndex, loading, saving, scores, par, strokeIndex } = state;
  const { setScores, saveHole, navigateHole, deleteGame } = actions;
  
  const currentHole = currentHoleIndex + 1;
  const totalHoles = game?.holes_played || 18;
  const players = game?.players || [];

  // Calculate carryover count
  useEffect(() => {
    if (!game) {
      setCarryoverCount(1);
      return;
    }
    
    if (holes.length === 0 || !game.carryover_enabled) {
      setCarryoverCount(1);
      return;
    }
    
    let consecutiveCarryovers = 0;
    for (let i = holes.length - 1; i >= 0; i--) {
      if (holes[i].is_carryover) {
        consecutiveCarryovers++;
      } else {
        break;
      }
    }
    
    setCarryoverCount(1 + consecutiveCarryovers);
  }, [holes, game]);

  const updateScore = (playerName: string, score: number | null) => {
    if (score === null) return;
    setScores(prev => ({ ...prev, [playerName]: score }));
  };

  const handleEnterAndNext = async () => {
    if (activePlayerIndex !== null && activePlayerIndex < players.length - 1) {
      setActivePlayerIndex(activePlayerIndex + 1);
    } else {
      setActivePlayerIndex(null);
      await saveHole();
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen pb-32 flex items-center justify-center">
        <div className="text-muted-foreground">Loading game...</div>
        {gameId && <SkinsBottomTabBar gameId={gameId} />}
      </div>
    );
  }

  if (!game) {
    return (
      <div className="min-h-screen pb-32 flex items-center justify-center">
        <div className="text-muted-foreground">Game not found</div>
        {gameId && <SkinsBottomTabBar gameId={gameId} />}
      </div>
    );
  }

  // Group players by their group
  const playersByGroup = players.reduce((acc, player) => {
    const group = player.group_name || 'Group 1';
    if (!acc[group]) acc[group] = [];
    acc[group].push(player);
    return acc;
  }, {} as Record<string, SkinsPlayer[]>);

  return (
    <div className="min-h-screen pb-32 bg-background">
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
              <h1 className="text-xl font-bold">Skins</h1>
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
              <div className="text-sm text-[hsl(120,20%,40%)]">HCP {strokeIndex || 1}</div>
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

      {/* Skins Info Banner */}
      <div className="max-w-2xl mx-auto px-4 mt-4">
        <Card className="p-3 bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-amber-600" />
              <span className="font-medium text-amber-800 dark:text-amber-200">
                {carryoverCount} Skin{carryoverCount > 1 ? 's' : ''} on this hole
              </span>
            </div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Users size={14} />
              <span>{players.length} players</span>
            </div>
          </div>
          {carryoverCount > 1 && (
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
              Includes {carryoverCount - 1} carryover{carryoverCount > 2 ? 's' : ''} from previous tie{carryoverCount > 2 ? 's' : ''}
            </p>
          )}
        </Card>
      </div>

      {/* Score Entry by Group */}
      <div className="max-w-2xl mx-auto p-4 space-y-6">
        {Object.entries(playersByGroup).map(([groupName, groupPlayers]) => (
          <div key={groupName}>
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="outline" className="text-xs">{groupName}</Badge>
            </div>
            <div className="space-y-2">
              {groupPlayers.map((player) => {
                const globalIndex = players.findIndex(p => p.name === player.name);
                const rawScore = scores[player.name];
                const hasScore = rawScore !== undefined && rawScore !== null && rawScore > 0;
                const playerScore = hasScore ? rawScore : 0;
                const netScore = game.use_handicaps && hasScore
                  ? calculateNetScore(playerScore, player.handicap, strokeIndex || 1, game.holes_played)
                  : playerScore;
                
                return (
                  <Card 
                    key={player.name}
                    className="p-3 cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => setActivePlayerIndex(globalIndex)}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium truncate max-w-[180px]">{player.name}</p>
                        {game.use_handicaps && player.handicap !== null && (
                          <span className="text-xs text-muted-foreground">
                            HCP: {formatHandicap(player.handicap)}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-2xl font-bold ${hasScore ? '' : 'text-muted-foreground'}`}>
                          {hasScore ? playerScore : '–'}
                        </span>
                        {game.use_handicaps && hasScore && netScore !== playerScore && (
                          <span className="text-sm text-muted-foreground">({netScore})</span>
                        )}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        ))}

        {/* Player Score Sheets */}
        {players.map((player, idx) => (
          <PlayerScoreSheet
            key={player.name}
            open={activePlayerIndex === idx}
            onOpenChange={(open) => { if (!open) setActivePlayerIndex(null); }}
            playerName={player.name}
            handicap={player.handicap}
            par={par}
            holeNumber={currentHole}
            currentScore={scores[player.name] || 0}
            onScoreSelect={(score) => updateScore(player.name, score)}
            onEnterAndNext={handleEnterAndNext}
          />
        ))}

        {/* Save Button */}
        <Button 
          onClick={() => saveHole()} 
          disabled={saving || players.some(p => !scores[p.name] || scores[p.name] === 0)}
          className="w-full"
        >
          {saving ? "Saving..." : currentHole >= totalHoles ? "Finish Game" : "Save & Next Hole"}
        </Button>
      </div>

      {gameId && <SkinsBottomTabBar gameId={gameId} />}

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
