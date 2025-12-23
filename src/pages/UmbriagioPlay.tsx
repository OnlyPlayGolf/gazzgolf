import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ChevronLeft, ChevronRight, Zap, Dices } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useGameScoring, GameScoringConfig } from "@/hooks/useGameScoring";
import { useToast } from "@/hooks/use-toast";
import { UmbriagioGame, UmbriagioHole, RollEvent } from "@/types/umbriago";
import { UmbriagioBottomTabBar } from "@/components/UmbriagioBottomTabBar";
import { PlayerScoreSheet } from "@/components/play/PlayerScoreSheet";
import { supabase } from "@/integrations/supabase/client";
import {
  calculateTeamLow,
  calculateIndividualLow,
  calculateBirdieEagle,
  calculateHolePoints,
} from "@/utils/umbriagioScoring";
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

interface UmbriagioScores {
  teamAPlayer1: number;
  teamAPlayer2: number;
  teamBPlayer1: number;
  teamBPlayer2: number;
  closestToPinWinner: 'A' | 'B' | null;
  multiplier: 1 | 2 | 4;
  doubleCalledBy: 'A' | 'B' | null;
  doubleBackCalled: boolean;
}

const createUmbriagioConfig = (gameId: string): GameScoringConfig<UmbriagioGame, UmbriagioHole, UmbriagioScores> => ({
  gameId,
  gameTable: "umbriago_games",
  holesTable: "umbriago_holes",
  
  parseGame: (data): UmbriagioGame => ({
    ...data,
    payout_mode: data.payout_mode as 'difference' | 'total',
    roll_history: (data.roll_history as unknown as RollEvent[]) || [],
    winning_team: data.winning_team as 'A' | 'B' | 'TIE' | null,
  }),
  parseHole: (data): UmbriagioHole => ({
    ...data,
    team_low_winner: data.team_low_winner as 'A' | 'B' | null,
    individual_low_winner: data.individual_low_winner as 'A' | 'B' | null,
    closest_to_pin_winner: data.closest_to_pin_winner as 'A' | 'B' | null,
    birdie_eagle_winner: data.birdie_eagle_winner as 'A' | 'B' | null,
    multiplier: data.multiplier as 1 | 2 | 4,
    double_called_by: data.double_called_by as 'A' | 'B' | null,
  }),
  getHoleNumber: (hole) => hole.hole_number,
  getTotalHoles: (game) => game.holes_played || 18,
  getCourseId: (game) => game.course_id || null,
  getSummaryRoute: (id) => `/umbriago/${id}/summary`,
  
  createEmptyScores: () => ({
    teamAPlayer1: 0,
    teamAPlayer2: 0,
    teamBPlayer1: 0,
    teamBPlayer2: 0,
    closestToPinWinner: null,
    multiplier: 1,
    doubleCalledBy: null,
    doubleBackCalled: false,
  }),
  
  extractScoresFromHole: (hole) => ({
    teamAPlayer1: hole.team_a_player_1_score || 0,
    teamAPlayer2: hole.team_a_player_2_score || 0,
    teamBPlayer1: hole.team_b_player_1_score || 0,
    teamBPlayer2: hole.team_b_player_2_score || 0,
    closestToPinWinner: hole.closest_to_pin_winner,
    multiplier: hole.multiplier,
    doubleCalledBy: hole.double_called_by,
    doubleBackCalled: hole.double_back_called || false,
  }),
  
  buildHoleData: ({ gameId, holeNumber, par, scores, previousHoles }) => {
    const holeScores = {
      teamAPlayer1: scores.teamAPlayer1,
      teamAPlayer2: scores.teamAPlayer2,
      teamBPlayer1: scores.teamBPlayer1,
      teamBPlayer2: scores.teamBPlayer2,
      par,
    };

    const teamLowWinner = calculateTeamLow(holeScores);
    const individualLowWinner = calculateIndividualLow(holeScores);
    const birdieEagleWinner = calculateBirdieEagle(holeScores);

    const categories = {
      teamLowWinner,
      individualLowWinner,
      closestToPinWinner: scores.closestToPinWinner,
      birdieEagleWinner,
    };

    const { teamAPoints, teamBPoints, isUmbriago } = calculateHolePoints(categories, scores.multiplier, holeScores);

    const previousHolesTeamA = previousHoles.reduce((sum, h) => sum + h.team_a_hole_points, 0);
    const previousHolesTeamB = previousHoles.reduce((sum, h) => sum + h.team_b_hole_points, 0);

    return {
      game_id: gameId,
      hole_number: holeNumber,
      par,
      team_a_player_1_score: scores.teamAPlayer1,
      team_a_player_2_score: scores.teamAPlayer2,
      team_b_player_1_score: scores.teamBPlayer1,
      team_b_player_2_score: scores.teamBPlayer2,
      team_low_winner: teamLowWinner,
      individual_low_winner: individualLowWinner,
      closest_to_pin_winner: scores.closestToPinWinner,
      birdie_eagle_winner: birdieEagleWinner,
      multiplier: scores.multiplier,
      double_called_by: scores.doubleCalledBy,
      double_back_called: scores.doubleBackCalled,
      is_umbriago: isUmbriago,
      team_a_hole_points: teamAPoints,
      team_b_hole_points: teamBPoints,
      team_a_running_total: previousHolesTeamA + teamAPoints,
      team_b_running_total: previousHolesTeamB + teamBPoints,
    };
  },
  
  buildGameUpdate: ({ allHoles }) => {
    const totalTeamA = allHoles.reduce((sum, h) => sum + h.team_a_hole_points, 0);
    const totalTeamB = allHoles.reduce((sum, h) => sum + h.team_b_hole_points, 0);

    return {
      team_a_total_points: totalTeamA,
      team_b_total_points: totalTeamB,
    };
  },
  
  isGameFinished: (game, holeNumber, totalHoles) => holeNumber >= totalHoles,
});

export default function UmbriagioPlay() {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [showExitDialog, setShowExitDialog] = useState(false);
  const [activeScoreSheet, setActiveScoreSheet] = useState<keyof Pick<UmbriagioScores, 'teamAPlayer1' | 'teamAPlayer2' | 'teamBPlayer1' | 'teamBPlayer2'> | null>(null);
  
  const config = createUmbriagioConfig(gameId || "");
  const [state, actions] = useGameScoring(config, navigate);
  
  const { game, holes, currentHoleIndex, loading, saving, scores, par } = state;
  const { setScores, saveHole, navigateHole, deleteGame, refetchGame } = actions;
  
  const currentHole = currentHoleIndex + 1;
  const totalHoles = game?.holes_played || 18;

  const playerOrder: (keyof Pick<UmbriagioScores, 'teamAPlayer1' | 'teamAPlayer2' | 'teamBPlayer1' | 'teamBPlayer2'>)[] = 
    ['teamAPlayer1', 'teamAPlayer2', 'teamBPlayer1', 'teamBPlayer2'];

  const handleScoreSelect = (player: typeof playerOrder[number], score: number | null) => {
    if (score === null) return;
    setScores(prev => ({ ...prev, [player]: score }));
  };

  const advanceToNextPlayerSheet = (player: typeof playerOrder[number]) => {
    const currentIndex = playerOrder.indexOf(player);
    if (currentIndex < playerOrder.length - 1) {
      setActiveScoreSheet(playerOrder[currentIndex + 1]);
    } else {
      setActiveScoreSheet(null);
      saveHole();
    }
  };

  const handleDouble = (team: 'A' | 'B') => {
    if (scores.multiplier === 1) {
      setScores(prev => ({ ...prev, multiplier: 2, doubleCalledBy: team }));
      toast({ title: `Team ${team} called Double!`, description: "Multiplier is now ×2" });
    }
  };

  const handleDoubleBack = () => {
    if (scores.multiplier === 2 && !scores.doubleBackCalled) {
      setScores(prev => ({ ...prev, multiplier: 4, doubleBackCalled: true }));
      toast({ title: "Double Back!", description: "Multiplier is now ×4" });
    }
  };

  const handleRoll = async (team: 'A' | 'B') => {
    if (!game) return;
    
    const rollHistory = game.roll_history || [];
    const teamRolls = rollHistory.filter(r => r.team === team).length;
    
    if (teamRolls >= game.rolls_per_team) {
      toast({ title: "No rolls remaining", variant: "destructive" });
      return;
    }

    const teamABefore = game.team_a_total_points;
    const teamBBefore = game.team_b_total_points;
    const teamAAfter = Math.floor(teamABefore / 2);
    const teamBAfter = Math.floor(teamBBefore / 2);
    
    const newRoll: RollEvent = {
      team,
      hole: currentHole,
      points_before: team === 'A' ? teamABefore : teamBBefore,
      points_after: team === 'A' ? teamAAfter : teamBAfter,
    };

    const newRollHistory = [...rollHistory, newRoll];

    try {
      await supabase
        .from("umbriago_games")
        .update({
          roll_history: newRollHistory as unknown as any,
          team_a_total_points: teamAAfter,
          team_b_total_points: teamBAfter,
        })
        .eq("id", game.id);

      await refetchGame();
      setScores(prev => ({ ...prev, multiplier: 2 }));

      toast({ 
        title: `🎲 Team ${team} called Roll!`, 
        description: `All points halved (${teamABefore}-${teamBBefore} → ${teamAAfter}-${teamBAfter}). This hole is now ×2!` 
      });
    } catch (error: any) {
      toast({ title: "Error saving roll", description: error.message, variant: "destructive" });
    }
  };

  const setClosestToPinWinner = (winner: 'A' | 'B' | null) => {
    setScores(prev => ({ ...prev, closestToPinWinner: winner }));
  };

  if (loading) {
    return (
      <div className="min-h-screen pb-24 flex items-center justify-center">
        <div className="text-muted-foreground">Loading game...</div>
        {gameId && <UmbriagioBottomTabBar gameId={gameId} />}
      </div>
    );
  }

  if (!game) {
    return (
      <div className="min-h-screen pb-24 flex items-center justify-center">
        <div className="text-muted-foreground">Game not found</div>
        {gameId && <UmbriagioBottomTabBar gameId={gameId} />}
      </div>
    );
  }

  const teamARollsUsed = (game.roll_history || []).filter(r => r.team === 'A').length;
  const teamBRollsUsed = (game.roll_history || []).filter(r => r.team === 'B').length;

  const allScoresEntered = scores.teamAPlayer1 > 0 && scores.teamAPlayer2 > 0 && 
                          scores.teamBPlayer1 > 0 && scores.teamBPlayer2 > 0;

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
              <h1 className="text-xl font-bold">Umbriago</h1>
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
              {scores.multiplier > 1 && (
                <div className="text-sm font-bold text-amber-600">×{scores.multiplier}</div>
              )}
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
        {/* Team A */}
        <Card className="p-4">
          <h3 className="font-semibold text-blue-600 mb-3">Team A</h3>
          <div className="space-y-2">
            {[
              { key: 'teamAPlayer1' as const, name: game.team_a_player_1, score: scores.teamAPlayer1 },
              { key: 'teamAPlayer2' as const, name: game.team_a_player_2, score: scores.teamAPlayer2 },
            ].map(player => (
              <div
                key={player.key}
                className="flex items-center justify-between p-3 rounded-lg bg-muted/50 cursor-pointer hover:bg-muted/70"
                onClick={() => setActiveScoreSheet(player.key)}
              >
                <span className="font-medium">{player.name}</span>
                <span className={`text-xl font-bold ${player.score > 0 ? '' : 'text-muted-foreground'}`}>
                  {player.score > 0 ? player.score : '–'}
                </span>
              </div>
            ))}
          </div>
          <div className="flex gap-2 mt-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleDouble('A')}
              disabled={scores.multiplier > 1}
              className="flex-1"
            >
              <Zap size={14} className="mr-1" /> Double
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleRoll('A')}
              disabled={teamARollsUsed >= game.rolls_per_team}
              className="flex-1"
            >
              <Dices size={14} className="mr-1" /> Roll ({game.rolls_per_team - teamARollsUsed})
            </Button>
          </div>
        </Card>

        {/* Team B */}
        <Card className="p-4">
          <h3 className="font-semibold text-red-600 mb-3">Team B</h3>
          <div className="space-y-2">
            {[
              { key: 'teamBPlayer1' as const, name: game.team_b_player_1, score: scores.teamBPlayer1 },
              { key: 'teamBPlayer2' as const, name: game.team_b_player_2, score: scores.teamBPlayer2 },
            ].map(player => (
              <div
                key={player.key}
                className="flex items-center justify-between p-3 rounded-lg bg-muted/50 cursor-pointer hover:bg-muted/70"
                onClick={() => setActiveScoreSheet(player.key)}
              >
                <span className="font-medium">{player.name}</span>
                <span className={`text-xl font-bold ${player.score > 0 ? '' : 'text-muted-foreground'}`}>
                  {player.score > 0 ? player.score : '–'}
                </span>
              </div>
            ))}
          </div>
          <div className="flex gap-2 mt-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleDouble('B')}
              disabled={scores.multiplier > 1}
              className="flex-1"
            >
              <Zap size={14} className="mr-1" /> Double
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleRoll('B')}
              disabled={teamBRollsUsed >= game.rolls_per_team}
              className="flex-1"
            >
              <Dices size={14} className="mr-1" /> Roll ({game.rolls_per_team - teamBRollsUsed})
            </Button>
          </div>
        </Card>

        {/* Double Back */}
        {scores.multiplier === 2 && !scores.doubleBackCalled && (
          <Button variant="outline" className="w-full" onClick={handleDoubleBack}>
            <Zap size={16} className="mr-2" /> Double Back (×4)
          </Button>
        )}

        {/* Closest to Pin */}
        <Card className="p-4">
          <h3 className="font-semibold mb-3">Closest to Pin</h3>
          <div className="flex gap-2">
            <Button
              variant={scores.closestToPinWinner === 'A' ? 'default' : 'outline'}
              className="flex-1"
              onClick={() => setClosestToPinWinner(scores.closestToPinWinner === 'A' ? null : 'A')}
            >
              Team A
            </Button>
            <Button
              variant={scores.closestToPinWinner === 'B' ? 'default' : 'outline'}
              className="flex-1"
              onClick={() => setClosestToPinWinner(scores.closestToPinWinner === 'B' ? null : 'B')}
            >
              Team B
            </Button>
          </div>
        </Card>

        {/* Points Display */}
        <Card className="p-4">
          <div className="flex justify-between items-center">
            <div className="text-center flex-1">
              <div className="text-sm text-muted-foreground">Team A</div>
              <div className="text-2xl font-bold text-blue-600">{game.team_a_total_points}</div>
            </div>
            <div className="text-muted-foreground">vs</div>
            <div className="text-center flex-1">
              <div className="text-sm text-muted-foreground">Team B</div>
              <div className="text-2xl font-bold text-red-600">{game.team_b_total_points}</div>
            </div>
          </div>
        </Card>

        {/* Player Score Sheets */}
        {playerOrder.map(key => {
          const playerName = key === 'teamAPlayer1' ? game.team_a_player_1 :
                            key === 'teamAPlayer2' ? game.team_a_player_2 :
                            key === 'teamBPlayer1' ? game.team_b_player_1 : game.team_b_player_2;
          return (
            <PlayerScoreSheet
              key={key}
              open={activeScoreSheet === key}
              onOpenChange={(open) => { if (!open) setActiveScoreSheet(null); }}
              playerName={playerName}
              par={par}
              holeNumber={currentHole}
              currentScore={scores[key]}
              onScoreSelect={(score) => handleScoreSelect(key, score)}
              onEnterAndNext={() => advanceToNextPlayerSheet(key)}
            />
          );
        })}

        {/* Save Button */}
        <Button 
          onClick={() => saveHole()} 
          disabled={saving || !allScoresEntered}
          className="w-full"
        >
          {saving ? "Saving..." : currentHole >= totalHoles ? "Finish Game" : "Save & Next Hole"}
        </Button>
      </div>

      {gameId && <UmbriagioBottomTabBar gameId={gameId} />}

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
