import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ChevronLeft, ChevronRight, Check } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useGameScoring, GameScoringConfig, CourseHoleData } from "@/hooks/useGameScoring";
import { useToast } from "@/hooks/use-toast";
import { MatchPlayGame, MatchPlayHole } from "@/types/matchPlay";
import { MatchPlayBottomTabBar } from "@/components/MatchPlayBottomTabBar";
import { PlayerScoreSheet } from "@/components/play/PlayerScoreSheet";
import { ScoreMoreSheet } from "@/components/play/ScoreMoreSheet";
import {
  calculateHoleResult,
  formatMatchStatusWithHoles,
  isMatchFinished,
  getFinalResult,
} from "@/utils/matchPlayScoring";
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

interface MatchPlayScores {
  player1: number;
  player2: number;
  player1Mulligan?: boolean;
  player2Mulligan?: boolean;
}

// Configuration for Match Play format
const createMatchPlayConfig = (gameId: string): GameScoringConfig<MatchPlayGame, MatchPlayHole, MatchPlayScores> => ({
  gameId,
  gameTable: "match_play_games",
  holesTable: "match_play_holes",
  
  parseGame: (data): MatchPlayGame => data as MatchPlayGame,
  parseHole: (data): MatchPlayHole => data as MatchPlayHole,
  getHoleNumber: (hole) => hole.hole_number,
  getTotalHoles: (game) => game.holes_played || 18,
  getCourseId: (game) => game.course_id || null,
  getSummaryRoute: (id) => `/match-play/${id}/summary`,
  
  createEmptyScores: () => ({ player1: 0, player2: 0, player1Mulligan: false, player2Mulligan: false }),
  
  extractScoresFromHole: (hole) => ({
    player1: hole.player_1_gross_score || 0,
    player2: hole.player_2_gross_score || 0,
    player1Mulligan: hole.player_1_mulligan || false,
    player2Mulligan: hole.player_2_mulligan || false,
  }),
  
  buildHoleData: ({ gameId, holeNumber, par, strokeIndex, scores, previousHoles }) => {
    const holeResult = calculateHoleResult(scores.player1, scores.player2);
    const previousStatus = previousHoles.length > 0 
      ? previousHoles[previousHoles.length - 1].match_status_after 
      : 0;
    const newMatchStatus = previousStatus + holeResult;
    
    return {
      game_id: gameId,
      hole_number: holeNumber,
      par,
      stroke_index: strokeIndex,
      player_1_gross_score: scores.player1,
      player_1_net_score: scores.player1,
      player_2_gross_score: scores.player2,
      player_2_net_score: scores.player2,
      player_1_mulligan: scores.player1Mulligan || false,
      player_2_mulligan: scores.player2Mulligan || false,
      hole_result: holeResult,
      match_status_after: newMatchStatus,
      holes_remaining_after: 18 - holeNumber, // Will be updated based on actual total
    };
  },
  
  buildGameUpdate: ({ game, allHoles, newHoleData }) => {
    const totalHoles = game.holes_played || 18;
    const holesRemaining = totalHoles - newHoleData.hole_number;
    const matchFinished = isMatchFinished(newHoleData.match_status_after, holesRemaining);
    
    const update: Record<string, any> = {
      match_status: newHoleData.match_status_after,
      holes_remaining: holesRemaining,
    };
    
    if (matchFinished) {
      const { winner, result } = getFinalResult(
        newHoleData.match_status_after, 
        holesRemaining, 
        game.player_1, 
        game.player_2
      );
      update.is_finished = true;
      update.winner_player = winner;
      update.final_result = result;
    }
    
    return update;
  },
  
  isGameFinished: (game, holeNumber, totalHoles, holeData) => {
    const holesRemaining = totalHoles - holeNumber;
    return isMatchFinished(holeData.match_status_after, holesRemaining) || holeNumber >= totalHoles;
  },
});

export default function MatchPlayPlay() {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [showExitDialog, setShowExitDialog] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<1 | 2 | null>(null);
  const [showScoreSheet, setShowScoreSheet] = useState(false);
  const [showMoreSheet, setShowMoreSheet] = useState(false);
  const [currentComment, setCurrentComment] = useState("");
  
  const config = createMatchPlayConfig(gameId || "");
  const [state, actions] = useGameScoring(config, navigate);
  
  const { game, holes, currentHoleIndex, loading, saving, scores, par } = state;
  const { setScores, saveHole, navigateHole, deleteGame } = actions;
  
  const currentHole = currentHoleIndex + 1;
  const totalHoles = game?.holes_played || 18;

  // Calculate mulligans used by each player
  const mulligansPerPlayer = game?.mulligans_per_player || 0;
  const player1MulligansUsed = holes.filter(h => h.player_1_mulligan).length + (scores.player1Mulligan ? 1 : 0);
  const player2MulligansUsed = holes.filter(h => h.player_2_mulligan).length + (scores.player2Mulligan ? 1 : 0);

  const updateScore = (player: 'player1' | 'player2', newScore: number) => {
    if (newScore === 0) return; // 0 is not valid, but -1 (dash) and positive are valid
    setScores(prev => ({ ...prev, [player]: newScore }));
  };

  const handleUseMulligan = () => {
    if (selectedPlayer === 1) {
      setScores(prev => ({ ...prev, player1Mulligan: true }));
    } else if (selectedPlayer === 2) {
      setScores(prev => ({ ...prev, player2Mulligan: true }));
    }
  };

  const handleRemoveMulligan = () => {
    if (selectedPlayer === 1) {
      setScores(prev => ({ ...prev, player1Mulligan: false }));
    } else if (selectedPlayer === 2) {
      setScores(prev => ({ ...prev, player2Mulligan: false }));
    }
  };

  const handleOpenMoreSheet = () => {
    setShowScoreSheet(false);
    setShowMoreSheet(true);
  };

  // Check if both players have entered scores for current hole
  // -1 means dash/conceded, which is also a valid entry
  const allPlayersEnteredCurrentHole = (scores.player1 > 0 || scores.player1 === -1) && (scores.player2 > 0 || scores.player2 === -1);

  // Auto-save and advance to next hole when all players have entered scores
  useEffect(() => {
    if (allPlayersEnteredCurrentHole && !showScoreSheet && !showMoreSheet && !saving) {
      saveHole();
    }
  }, [allPlayersEnteredCurrentHole, showScoreSheet, showMoreSheet]);

  const handleSaveMoreSheet = async () => {
    // Save comment to feed if provided
    if (currentComment.trim() && gameId && selectedPlayer) {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const playerName = selectedPlayer === 1 ? game?.player_1 : game?.player_2;
          const mulliganUsed = selectedPlayer === 1 ? scores.player1Mulligan : scores.player2Mulligan;
          
          let content = currentComment.trim();
          if (mulliganUsed) {
            content = `🔄 ${playerName} used a mulligan on hole ${currentHole}: "${content}"`;
          }
          
          await supabase.from("round_comments").insert({
            round_id: gameId,
            user_id: user.id,
            content,
            hole_number: currentHole,
            game_type: "match_play",
            game_id: gameId,
          });
        }
      } catch (error) {
        console.error("Error saving comment:", error);
      }
    } else if (selectedPlayer) {
      // Save mulligan-only comment if no text but mulligan was used
      const mulliganUsed = selectedPlayer === 1 ? scores.player1Mulligan : scores.player2Mulligan;
      if (mulliganUsed && gameId) {
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            const playerName = selectedPlayer === 1 ? game?.player_1 : game?.player_2;
            await supabase.from("round_comments").insert({
              round_id: gameId,
              user_id: user.id,
              content: `🔄 ${playerName} used a mulligan on hole ${currentHole}`,
              hole_number: currentHole,
              game_type: "match_play",
              game_id: gameId,
            });
          }
        } catch (error) {
          console.error("Error saving mulligan comment:", error);
        }
      }
    }
    
    setShowMoreSheet(false);
    setCurrentComment("");
  };

  const handleDeleteGame = async () => {
    await deleteGame();
  };

  if (loading) {
    return (
      <div className="min-h-screen pb-24 flex items-center justify-center">
        <div className="text-muted-foreground">Loading game...</div>
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

  const currentMatchStatus = holes.length > 0 
    ? holes[holes.length - 1].match_status_after 
    : 0;
  const currentHolesRemaining = totalHoles - holes.length;

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
              <h1 className="text-xl font-bold">Match Play</h1>
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
      <div className="p-4 max-w-2xl mx-auto space-y-4">
        {/* Player 1 */}
        <Card 
          className="p-6 cursor-pointer hover:bg-muted/50 transition-colors"
          onClick={() => {
            setSelectedPlayer(1);
            setShowScoreSheet(true);
          }}
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-bold text-blue-600">{game.player_1}</span>
                {scores.player1Mulligan && (
                  <Badge variant="outline" className="text-xs border-amber-500 text-amber-600">
                    Mulligan
                  </Badge>
                )}
              </div>
              {game.use_handicaps && game.player_1_handicap && (
                <span className="text-sm text-muted-foreground">HCP: {game.player_1_handicap}</span>
              )}
            </div>
            <div className="text-center">
              <div className={`text-2xl font-bold ${scores.player1 !== 0 ? '' : 'text-muted-foreground'}`}>
                {scores.player1 === -1 ? '–' : scores.player1}
              </div>
              <div className="text-xs text-muted-foreground">Strokes</div>
            </div>
          </div>
        </Card>

        {/* Player 2 */}
        <Card 
          className="p-6 cursor-pointer hover:bg-muted/50 transition-colors"
          onClick={() => {
            setSelectedPlayer(2);
            setShowScoreSheet(true);
          }}
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-bold text-red-600">{game.player_2}</span>
                {scores.player2Mulligan && (
                  <Badge variant="outline" className="text-xs border-amber-500 text-amber-600">
                    Mulligan
                  </Badge>
                )}
              </div>
              {game.use_handicaps && game.player_2_handicap && (
                <span className="text-sm text-muted-foreground">HCP: {game.player_2_handicap}</span>
              )}
            </div>
            <div className="text-center">
              <div className={`text-2xl font-bold ${scores.player2 !== 0 ? '' : 'text-muted-foreground'}`}>
                {scores.player2 === -1 ? '–' : scores.player2}
              </div>
              <div className="text-xs text-muted-foreground">Strokes</div>
            </div>
          </div>
        </Card>

        {/* Score Sheet */}
        <PlayerScoreSheet
          open={showScoreSheet}
          onOpenChange={setShowScoreSheet}
          playerName={selectedPlayer === 1 ? game.player_1 : game.player_2}
          handicap={selectedPlayer === 1 ? game.player_1_handicap : game.player_2_handicap}
          par={par}
          holeNumber={currentHole}
          currentScore={selectedPlayer === 1 ? scores.player1 : scores.player2}
          onScoreSelect={(score) => {
            if (score !== null && selectedPlayer) {
              updateScore(selectedPlayer === 1 ? 'player1' : 'player2', score);
            }
          }}
          onMore={handleOpenMoreSheet}
          onEnterAndNext={() => {
            // Find next player without a score (0 means no entry, -1 is dash which counts as entered)
            if (selectedPlayer === 1 && scores.player2 === 0) {
              setSelectedPlayer(2);
            } else if (selectedPlayer === 2 && scores.player1 === 0) {
              setSelectedPlayer(1);
            } else {
              // Both players have scores - close sheet
              setShowScoreSheet(false);
            }
          }}
        />

        {/* More Sheet for Mulligans and Comments */}
        {selectedPlayer && (
          <ScoreMoreSheet
            open={showMoreSheet}
            onOpenChange={setShowMoreSheet}
            holeNumber={currentHole}
            par={par}
            playerName={selectedPlayer === 1 ? game.player_1 : game.player_2}
            comment={currentComment}
            onCommentChange={setCurrentComment}
            mulligansAllowed={mulligansPerPlayer}
            mulligansUsed={selectedPlayer === 1 ? player1MulligansUsed : player2MulligansUsed}
            mulliganUsedOnThisHole={selectedPlayer === 1 ? (scores.player1Mulligan || false) : (scores.player2Mulligan || false)}
            onUseMulligan={handleUseMulligan}
            onRemoveMulligan={handleRemoveMulligan}
            onSave={handleSaveMoreSheet}
          />
        )}

        {/* Match Status */}
        <div className="p-3 bg-primary/10 rounded-lg text-center">
          <p className="text-lg font-bold text-primary">
            {formatMatchStatusWithHoles(currentMatchStatus, currentHolesRemaining, game.player_1, game.player_2)}
          </p>
        </div>

        {/* Preview Result */}
        {scores.player1 > 0 && scores.player2 > 0 && scores.player1 !== scores.player2 && (
          <Card className="p-4 bg-muted/50">
            <p className="text-center text-sm">
              {scores.player1 < scores.player2 && (
                <span className="text-blue-600 font-medium">{game.player_1} wins this hole</span>
              )}
              {scores.player2 < scores.player1 && (
                <span className="text-red-600 font-medium">{game.player_2} wins this hole</span>
              )}
            </p>
          </Card>
        )}

        {/* Hole History */}
        {holes.length > 0 && (
          <Card className="p-4">
            <h3 className="font-semibold mb-3">Hole Results</h3>
            <div className="grid grid-cols-9 gap-1 text-xs">
              {holes.slice(0, 9).map((hole, i) => (
                <div key={hole.id} className="text-center">
                  <div className="text-muted-foreground">{i + 1}</div>
                  <div className={`font-medium ${
                    hole.hole_result === 1 ? 'text-blue-600' : 
                    hole.hole_result === -1 ? 'text-red-600' : 
                    'text-muted-foreground'
                  }`}>
                    {hole.hole_result === 1 ? 'W' : hole.hole_result === -1 ? 'L' : '-'}
                  </div>
                </div>
              ))}
            </div>
            {holes.length > 9 && (
              <div className="grid grid-cols-9 gap-1 text-xs mt-2">
                {holes.slice(9, 18).map((hole, i) => (
                  <div key={hole.id} className="text-center">
                    <div className="text-muted-foreground">{i + 10}</div>
                    <div className={`font-medium ${
                      hole.hole_result === 1 ? 'text-blue-600' : 
                      hole.hole_result === -1 ? 'text-red-600' : 
                      'text-muted-foreground'
                    }`}>
                      {hole.hole_result === 1 ? 'W' : hole.hole_result === -1 ? 'L' : '-'}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}

      </div>

      {gameId && <MatchPlayBottomTabBar gameId={gameId} />}

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
              onClick={handleDeleteGame}
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
