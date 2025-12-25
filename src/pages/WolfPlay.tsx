import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ChevronLeft, ChevronRight, User, Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useGameScoring, GameScoringConfig } from "@/hooks/useGameScoring";
import { useToast } from "@/hooks/use-toast";
import { WolfGame, WolfHole } from "@/types/wolf";
import { WolfBottomTabBar } from "@/components/WolfBottomTabBar";
import { PlayerScoreSheet } from "@/components/play/PlayerScoreSheet";
import { ScoreMoreSheet } from "@/components/play/ScoreMoreSheet";
import { calculateWolfHoleScore, getWolfPlayerForHole } from "@/utils/wolfScoring";
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

interface WolfScores {
  scores: (number | null)[];
  wolfChoice: 'lone' | 'partner' | null;
  partnerPlayer: number | null;
  doubleCalledBy: number | null; // Player number who doubled (1-5)
  doubleBackCalled: boolean; // Whether opponent doubled back
}

const createWolfConfig = (gameId: string): GameScoringConfig<WolfGame, WolfHole, WolfScores> => ({
  gameId,
  gameTable: "wolf_games",
  holesTable: "wolf_holes",
  
  parseGame: (data): WolfGame => data as unknown as WolfGame,
  parseHole: (data): WolfHole => data as unknown as WolfHole,
  getHoleNumber: (hole) => hole.hole_number,
  getTotalHoles: (game) => game.holes_played || 18,
  getCourseId: (game) => game.course_id || null,
  getSummaryRoute: (id) => `/wolf/${id}/summary`,
  
  createEmptyScores: () => ({
    scores: [null, null, null, null, null],
    wolfChoice: null,
    partnerPlayer: null,
    doubleCalledBy: null,
    doubleBackCalled: false,
  }),
  
  extractScoresFromHole: (hole) => ({
    scores: [
      hole.player_1_score,
      hole.player_2_score,
      hole.player_3_score,
      hole.player_4_score,
      hole.player_5_score,
    ],
    wolfChoice: hole.wolf_choice as 'lone' | 'partner' | null,
    partnerPlayer: hole.partner_player,
    doubleCalledBy: hole.double_called_by ?? null,
    doubleBackCalled: hole.double_back_called ?? false,
  }),
  
  buildHoleData: ({ gameId, holeNumber, par, scores: scoresState, previousHoles, game }) => {
    const { scores, wolfChoice, partnerPlayer, doubleCalledBy, doubleBackCalled } = scoresState;
    
    // Get player count
    let playerCount = 3;
    if (game.player_4) playerCount = 4;
    if (game.player_5) playerCount = 5;
    
    const wolfPosition = game.wolf_position as 'first' | 'last' || 'last';
    const currentWolfPlayer = getWolfPlayerForHole(holeNumber, playerCount, wolfPosition);
    
    const settings = {
      lone_wolf_win_points: game.lone_wolf_win_points,
      lone_wolf_loss_points: game.lone_wolf_loss_points,
      team_win_points: game.team_win_points,
      wolf_position: wolfPosition,
    };
    
    const result = calculateWolfHoleScore({
      scores,
      wolfPlayer: currentWolfPlayer,
      wolfChoice: wolfChoice || 'lone',
      partnerPlayer,
      playerCount,
      settings,
    });
    
    // Calculate multiplier based on doubles
    let multiplier = 1;
    if (doubleCalledBy !== null) {
      multiplier = 2;
      if (doubleBackCalled) {
        multiplier = 4;
      }
    }
    
    // Apply multiplier to hole points
    const multipliedPoints = result.playerPoints.map(p => p * multiplier);
    
    // Calculate running totals
    const previousTotals = [0, 0, 0, 0, 0];
    previousHoles.forEach(h => {
      previousTotals[0] += h.player_1_hole_points;
      previousTotals[1] += h.player_2_hole_points;
      previousTotals[2] += h.player_3_hole_points;
      previousTotals[3] += h.player_4_hole_points;
      previousTotals[4] += h.player_5_hole_points;
    });
    
    const runningTotals = previousTotals.map((t, i) => t + multipliedPoints[i]);

    return {
      game_id: gameId,
      hole_number: holeNumber,
      par,
      wolf_player: currentWolfPlayer,
      wolf_choice: wolfChoice,
      partner_player: partnerPlayer,
      multiplier,
      double_called_by: doubleCalledBy,
      double_back_called: doubleBackCalled,
      player_1_score: scores[0],
      player_2_score: scores[1],
      player_3_score: scores[2],
      player_4_score: scores[3],
      player_5_score: scores[4],
      player_1_hole_points: multipliedPoints[0],
      player_2_hole_points: multipliedPoints[1],
      player_3_hole_points: multipliedPoints[2],
      player_4_hole_points: multipliedPoints[3],
      player_5_hole_points: multipliedPoints[4],
      player_1_running_total: runningTotals[0],
      player_2_running_total: runningTotals[1],
      player_3_running_total: runningTotals[2],
      player_4_running_total: runningTotals[3],
      player_5_running_total: runningTotals[4],
      winning_side: result.winningSide,
    };
  },
  
  buildGameUpdate: ({ newHoleData }) => ({
    player_1_points: newHoleData.player_1_running_total,
    player_2_points: newHoleData.player_2_running_total,
    player_3_points: newHoleData.player_3_running_total,
    player_4_points: newHoleData.player_4_running_total,
    player_5_points: newHoleData.player_5_running_total,
  }),
  
  isGameFinished: (game, holeNumber, totalHoles) => holeNumber >= totalHoles,
});

export default function WolfPlay() {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [showExitDialog, setShowExitDialog] = useState(false);
  const [activePlayerSheet, setActivePlayerSheet] = useState<number | null>(null);
  const [showMoreSheet, setShowMoreSheet] = useState(false);
  const [currentComment, setCurrentComment] = useState("");
  
  const config = createWolfConfig(gameId || "");
  const [state, actions] = useGameScoring(config, navigate);
  
  const { game, holes, currentHoleIndex, loading, saving, scores: scoresState, par } = state;
  const { setScores, saveHole, navigateHole, deleteGame } = actions;
  
  const currentHole = currentHoleIndex + 1;
  const totalHoles = game?.holes_played || 18;
  
  // Get player count
  const getPlayerCount = () => {
    if (!game) return 3;
    let count = 3;
    if (game.player_4) count = 4;
    if (game.player_5) count = 5;
    return count;
  };
  
  const getPlayerName = (index: number): string => {
    if (!game) return '';
    const names = [game.player_1, game.player_2, game.player_3, game.player_4 || '', game.player_5 || ''];
    return names[index];
  };
  
  const wolfPosition = game?.wolf_position as 'first' | 'last' || 'last';
  const currentWolfPlayer = getWolfPlayerForHole(currentHole, getPlayerCount(), wolfPosition);

  // Auto-advance to next hole when all scores and wolf choice are entered
  useEffect(() => {
    if (!game || saving || loading) return;
    
    const playerCount = getPlayerCount();
    const allScoresEntered = scoresState.scores.slice(0, playerCount).every(s => s !== null);
    const wolfChoiceMade = scoresState.wolfChoice !== null;
    
    if (allScoresEntered && wolfChoiceMade) {
      // Small delay for visual feedback before auto-saving and advancing
      const timer = setTimeout(async () => {
        await saveHole();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [scoresState.scores, scoresState.wolfChoice, game, saving, loading]);

  const handleScoreSelect = (playerIndex: number, score: number | null) => {
    if (score === null) return;
    setScores(prev => {
      const newScores = [...prev.scores];
      newScores[playerIndex] = score;
      return { ...prev, scores: newScores };
    });
  };

  const handleChoosePartner = (playerIndex: number) => {
    if (playerIndex === currentWolfPlayer - 1) return;
    setScores(prev => ({
      ...prev,
      wolfChoice: 'partner',
      partnerPlayer: playerIndex + 1,
    }));
  };

  const handleGoLone = () => {
    setScores(prev => ({
      ...prev,
      wolfChoice: 'lone',
      partnerPlayer: null,
    }));
  };

  const advanceToNextPlayerSheet = (currentPlayerIndex: number) => {
    const playerCount = getPlayerCount();
    
    // Find next player without a score
    for (let i = currentPlayerIndex + 1; i < playerCount; i++) {
      if (scoresState.scores[i] === null) {
        setActivePlayerSheet(i);
        return;
      }
    }
    // Check players before current (wrap around)
    for (let i = 0; i < currentPlayerIndex; i++) {
      if (scoresState.scores[i] === null) {
        setActivePlayerSheet(i);
        return;
      }
    }
    // All players have scores - close the sheet
    setActivePlayerSheet(null);
  };

  const handleOpenMoreSheet = () => {
    setCurrentComment("");
    setShowMoreSheet(true);
  };

  const handleSaveMore = () => {
    // Comments are handled via the round_comments table if needed
    // For now, just close the sheet
    setShowMoreSheet(false);
  };

  const handleSaveHole = async () => {
    if (!scoresState.wolfChoice) {
      toast({ title: "Please select Wolf's choice (Partner or Lone Wolf)", variant: "destructive" });
      return;
    }
    await saveHole();
  };

  if (loading) {
    return (
      <div className="min-h-screen pb-24 flex items-center justify-center">
        <div className="text-muted-foreground">Loading game...</div>
        {gameId && <WolfBottomTabBar gameId={gameId} />}
      </div>
    );
  }

  if (!game) {
    return (
      <div className="min-h-screen pb-24 flex items-center justify-center">
        <div className="text-muted-foreground">Game not found</div>
        {gameId && <WolfBottomTabBar gameId={gameId} />}
      </div>
    );
  }

  const playerCount = getPlayerCount();

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
              <h1 className="text-xl font-bold">Wolf</h1>
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

      <div className="max-w-2xl mx-auto p-4 space-y-4">
        {/* Wolf indicator */}
        <Card className="p-3 bg-amber-500/10 border-amber-500">
          <div className="text-center">
            <span className="text-amber-600 font-bold text-lg">
              🐺 Wolf: {getPlayerName(currentWolfPlayer - 1)}
            </span>
          </div>
        </Card>

        {/* Wolf Choice */}
        <Card className="p-4">
          <h3 className="font-semibold mb-3 text-center">Wolf's Choice</h3>
          <div className="space-y-2">
            {/* Lone Wolf on its own row */}
            <Button
              variant={scoresState.wolfChoice === 'lone' ? 'default' : 'outline'}
              onClick={handleGoLone}
              className="flex items-center justify-center gap-2 w-full"
            >
              <User size={18} />
              Lone Wolf
            </Button>
            {/* Partner choices in a grid */}
            <div className="grid grid-cols-2 gap-2">
              {[...Array(playerCount)].map((_, i) => {
                if (i === currentWolfPlayer - 1) return null;
                const isSelected = scoresState.wolfChoice === 'partner' && scoresState.partnerPlayer === i + 1;
                return (
                  <Button
                    key={i}
                    variant={isSelected ? 'default' : 'outline'}
                    onClick={() => handleChoosePartner(i)}
                    className="flex items-center justify-center gap-2 w-full truncate"
                  >
                    <Users size={18} className="flex-shrink-0" />
                    <span className="truncate">{getPlayerName(i)}</span>
                  </Button>
                );
              })}
            </div>
          </div>
          {scoresState.wolfChoice && (
            <p className="text-sm text-center mt-2 text-muted-foreground">
              {scoresState.wolfChoice === 'lone' 
                ? `${getPlayerName(currentWolfPlayer - 1)} goes solo vs everyone!`
                : `${getPlayerName(currentWolfPlayer - 1)} + ${getPlayerName((scoresState.partnerPlayer || 1) - 1)} vs the rest`
              }
            </p>
          )}
        </Card>

        {/* Double Section */}
        <Card className="p-4">
          <h3 className="font-semibold mb-3">Double</h3>
          {(() => {
            // Determine which side has fewer players (tees off first, can double first)
            const isLoneWolf = scoresState.wolfChoice === 'lone';
            const wolfTeamSize = isLoneWolf ? 1 : 2;
            const opponentTeamSize = playerCount - wolfTeamSize;
            
            // The side with fewer players tees off first
            const wolfTeamTeeFirst = wolfTeamSize <= opponentTeamSize;
            
            // Get players for each side
            const wolfTeamPlayers = isLoneWolf 
              ? [currentWolfPlayer] 
              : [currentWolfPlayer, scoresState.partnerPlayer].filter(Boolean) as number[];
            const opponentPlayers = [...Array(playerCount)]
              .map((_, i) => i + 1)
              .filter(p => !wolfTeamPlayers.includes(p));
            
            // First doubler side
            const firstDoublerSide = wolfTeamTeeFirst ? 'wolf' : 'opponents';
            const secondDoublerSide = wolfTeamTeeFirst ? 'opponents' : 'wolf';
            
            // Check who has doubled
            const hasFirstDouble = scoresState.doubleCalledBy !== null;
            const isFirstDoublerFromWolfTeam = hasFirstDouble && wolfTeamPlayers.includes(scoresState.doubleCalledBy!);
            
            // Can second side double back?
            const canDoubleBack = hasFirstDouble && !scoresState.doubleBackCalled;
            
            const getTeamLabel = (side: 'wolf' | 'opponents') => {
              if (side === 'wolf') {
                return isLoneWolf 
                  ? `${getPlayerName(currentWolfPlayer - 1)} (Lone Wolf)` 
                  : `Wolf Team`;
              }
              return 'Opponents';
            };
            
            const handleDouble = (side: 'wolf' | 'opponents') => {
              const playerToUse = side === 'wolf' ? currentWolfPlayer : opponentPlayers[0];
              if (!hasFirstDouble) {
                // First double
                setScores(prev => ({
                  ...prev,
                  doubleCalledBy: playerToUse,
                  doubleBackCalled: false,
                }));
              } else if (canDoubleBack) {
                // Double back
                setScores(prev => ({
                  ...prev,
                  doubleBackCalled: true,
                }));
              }
            };
            
            const handleClearDouble = () => {
              setScores(prev => ({
                ...prev,
                doubleCalledBy: null,
                doubleBackCalled: false,
              }));
            };
            
            const multiplier = hasFirstDouble ? (scoresState.doubleBackCalled ? 4 : 2) : 1;
            
            return (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  {/* First doubler side */}
                  <Button
                    variant={hasFirstDouble && 
                      ((firstDoublerSide === 'wolf' && isFirstDoublerFromWolfTeam) || 
                       (firstDoublerSide === 'opponents' && !isFirstDoublerFromWolfTeam)) 
                      ? 'default' : 'outline'}
                    onClick={() => handleDouble(firstDoublerSide)}
                    disabled={hasFirstDouble}
                    className="flex flex-col items-center py-3 h-auto"
                  >
                    <span className="text-xs text-muted-foreground mb-1">Tees off first</span>
                    <span className="font-medium truncate w-full text-center">{getTeamLabel(firstDoublerSide)}</span>
                    <span className="text-sm mt-1">Double</span>
                  </Button>
                  
                  {/* Second doubler side (can only double after first double) */}
                  <Button
                    variant={scoresState.doubleBackCalled ? 'default' : 'outline'}
                    onClick={() => handleDouble(secondDoublerSide)}
                    disabled={!canDoubleBack}
                    className="flex flex-col items-center py-3 h-auto"
                  >
                    <span className="text-xs text-muted-foreground mb-1">Tees off second</span>
                    <span className="font-medium truncate w-full text-center">{getTeamLabel(secondDoublerSide)}</span>
                    <span className="text-sm mt-1">Double Back</span>
                  </Button>
                </div>
                
                {hasFirstDouble && (
                  <div className="flex items-center justify-between">
                    <div className="text-center flex-1">
                      <span className="text-lg font-bold text-amber-600">
                        {multiplier}x Points
                      </span>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={handleClearDouble}
                      className="text-muted-foreground"
                    >
                      Clear
                    </Button>
                  </div>
                )}
                
                {!scoresState.wolfChoice && (
                  <p className="text-sm text-muted-foreground text-center">
                    Select Wolf's choice first
                  </p>
                )}
              </div>
            );
          })()}
        </Card>

        {/* Score Entry */}
        <Card className="p-4">
          <h3 className="font-semibold mb-3">Scores</h3>
          <div className="space-y-2">
            {[...Array(playerCount)].map((_, i) => {
              const isWolf = i === currentWolfPlayer - 1;
              const score = scoresState.scores[i];
              const hasScore = score !== null && score !== undefined;
              
              return (
                <div
                  key={i}
                  className={`flex items-center justify-between p-3 rounded-lg cursor-pointer hover:bg-muted/70 ${
                    isWolf ? 'bg-amber-500/10 border border-amber-500/30' : 'bg-muted/50'
                  }`}
                  onClick={() => setActivePlayerSheet(i)}
                >
                  <div className="flex items-center gap-2">
                    {isWolf && <span>🐺</span>}
                    <span className="font-medium">{getPlayerName(i)}</span>
                  </div>
                  <span className={`text-xl font-bold ${hasScore ? '' : 'text-muted-foreground'}`}>
                    {hasScore ? score : '–'}
                  </span>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Player Score Sheets */}
        {[...Array(playerCount)].map((_, i) => (
          <PlayerScoreSheet
            key={i}
            open={activePlayerSheet === i}
            onOpenChange={(open) => { if (!open) setActivePlayerSheet(null); }}
            playerName={getPlayerName(i)}
            par={par}
            holeNumber={currentHole}
            currentScore={scoresState.scores[i] ?? 0}
            onScoreSelect={(score) => handleScoreSelect(i, score)}
            onMore={handleOpenMoreSheet}
            onEnterAndNext={() => advanceToNextPlayerSheet(i)}
          />
        ))}

        {/* More Sheet for comments */}
        {activePlayerSheet !== null && (
          <ScoreMoreSheet
            open={showMoreSheet}
            onOpenChange={setShowMoreSheet}
            holeNumber={currentHole}
            par={par}
            playerName={getPlayerName(activePlayerSheet)}
            comment={currentComment}
            onCommentChange={setCurrentComment}
            mulligansAllowed={0}
            mulligansUsed={0}
            mulliganUsedOnThisHole={false}
            onUseMulligan={() => {}}
            onRemoveMulligan={() => {}}
            onSave={handleSaveMore}
          />
        )}

        {/* Points Summary */}
        <Card className="p-4">
          <h3 className="font-semibold mb-2">Points</h3>
          <div className="grid grid-cols-3 gap-2 text-center">
            {[...Array(Math.min(playerCount, 3))].map((_, i) => (
              <div key={i}>
                <div className="text-sm text-muted-foreground truncate">{getPlayerName(i)}</div>
                <div className="text-xl font-bold">
                  {i === 0 ? game.player_1_points : i === 1 ? game.player_2_points : game.player_3_points}
                </div>
              </div>
            ))}
          </div>
          {playerCount > 3 && (
            <div className="grid grid-cols-2 gap-2 text-center mt-2">
              {[3, 4].map(i => {
                if (i >= playerCount) return null;
                return (
                  <div key={i}>
                    <div className="text-sm text-muted-foreground truncate">{getPlayerName(i)}</div>
                    <div className="text-xl font-bold">
                      {i === 3 ? game.player_4_points : game.player_5_points}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

      </div>

      {gameId && <WolfBottomTabBar gameId={gameId} />}

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
