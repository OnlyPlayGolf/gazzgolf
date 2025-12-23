import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ChevronLeft, ChevronRight, Check } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useGameScoring, GameScoringConfig, CourseHoleData } from "@/hooks/useGameScoring";
import { useToast } from "@/hooks/use-toast";
import { MatchPlayGame, MatchPlayHole } from "@/types/matchPlay";
import { MatchPlayBottomTabBar } from "@/components/MatchPlayBottomTabBar";
import { PlayerScoreSheet } from "@/components/play/PlayerScoreSheet";
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
  
  createEmptyScores: () => ({ player1: 0, player2: 0 }),
  
  extractScoresFromHole: (hole) => ({
    player1: hole.player_1_gross_score || 0,
    player2: hole.player_2_gross_score || 0,
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
  
  const config = createMatchPlayConfig(gameId || "");
  const [state, actions] = useGameScoring(config, navigate);
  
  const { game, holes, currentHoleIndex, loading, saving, scores, par } = state;
  const { setScores, saveHole, navigateHole, deleteGame } = actions;
  
  const currentHole = currentHoleIndex + 1;
  const totalHoles = game?.holes_played || 18;

  const updateScore = (player: 'player1' | 'player2', newScore: number) => {
    if (newScore < 1) return;
    setScores(prev => ({ ...prev, [player]: newScore }));
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
          className="p-4 cursor-pointer hover:bg-muted/50 transition-colors"
          onClick={() => {
            setSelectedPlayer(1);
            setShowScoreSheet(true);
          }}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-blue-600">{game.player_1}</p>
              {game.use_handicaps && game.player_1_handicap && (
                <span className="text-xs text-muted-foreground">HCP: {game.player_1_handicap}</span>
              )}
            </div>
            <span className={`text-3xl font-bold ${scores.player1 > 0 ? '' : 'text-muted-foreground'}`}>
              {scores.player1 > 0 ? scores.player1 : '–'}
            </span>
          </div>
        </Card>

        {/* Player 2 */}
        <Card 
          className="p-4 cursor-pointer hover:bg-muted/50 transition-colors"
          onClick={() => {
            setSelectedPlayer(2);
            setShowScoreSheet(true);
          }}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-red-600">{game.player_2}</p>
              {game.use_handicaps && game.player_2_handicap && (
                <span className="text-xs text-muted-foreground">HCP: {game.player_2_handicap}</span>
              )}
            </div>
            <span className={`text-3xl font-bold ${scores.player2 > 0 ? '' : 'text-muted-foreground'}`}>
              {scores.player2 > 0 ? scores.player2 : '–'}
            </span>
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
          onEnterAndNext={() => {
            if (selectedPlayer === 1) {
              setSelectedPlayer(2);
            } else {
              setShowScoreSheet(false);
              saveHole();
            }
          }}
        />

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

        {/* Save Button */}
        <Button 
          onClick={() => saveHole()} 
          disabled={saving || scores.player1 === 0 || scores.player2 === 0}
          className="w-full"
        >
          {saving ? "Saving..." : currentHole >= totalHoles ? "Finish Match" : "Save & Next Hole"}
        </Button>
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
