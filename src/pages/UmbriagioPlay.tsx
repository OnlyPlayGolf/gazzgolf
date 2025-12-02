import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ChevronLeft, ChevronRight, Minus, Plus, Check, Zap } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { UmbriagioGame, UmbriagioHole, RollEvent } from "@/types/umbriago";
import { UmbriagioBottomTabBar } from "@/components/UmbriagioBottomTabBar";
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

export default function UmbriagioPlay() {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [game, setGame] = useState<UmbriagioGame | null>(null);
  const [holes, setHoles] = useState<UmbriagioHole[]>([]);
  const [currentHoleIndex, setCurrentHoleIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showExitDialog, setShowExitDialog] = useState(false);
  
  // Current hole state
  const [par, setPar] = useState(4);
  const [scores, setScores] = useState({
    teamAPlayer1: 0,
    teamAPlayer2: 0,
    teamBPlayer1: 0,
    teamBPlayer2: 0,
  });
  const [closestToPinWinner, setClosestToPinWinner] = useState<'A' | 'B' | null>(null);
  const [multiplier, setMultiplier] = useState<1 | 2 | 4>(1);
  const [doubleCalledBy, setDoubleCalledBy] = useState<'A' | 'B' | null>(null);
  const [doubleBackCalled, setDoubleBackCalled] = useState(false);
  
  const currentHole = currentHoleIndex + 1;
  const totalHoles = game?.holes_played || 18;

  useEffect(() => {
    if (gameId) {
      fetchGame();
    }
  }, [gameId]);

  const fetchGame = async () => {
    try {
      const { data: gameData, error: gameError } = await supabase
        .from("umbriago_games")
        .select("*")
        .eq("id", gameId)
        .single();

      if (gameError) throw gameError;
      
      const typedGame: UmbriagioGame = {
        ...gameData,
        payout_mode: gameData.payout_mode as 'difference' | 'total',
        roll_history: (gameData.roll_history as unknown as RollEvent[]) || [],
        winning_team: gameData.winning_team as 'A' | 'B' | 'TIE' | null,
      };
      
      setGame(typedGame);

      const { data: holesData, error: holesError } = await supabase
        .from("umbriago_holes")
        .select("*")
        .eq("game_id", gameId)
        .order("hole_number");

      if (holesError) throw holesError;
      
      const typedHoles: UmbriagioHole[] = (holesData || []).map(h => ({
        ...h,
        team_low_winner: h.team_low_winner as 'A' | 'B' | null,
        individual_low_winner: h.individual_low_winner as 'A' | 'B' | null,
        closest_to_pin_winner: h.closest_to_pin_winner as 'A' | 'B' | null,
        birdie_eagle_winner: h.birdie_eagle_winner as 'A' | 'B' | null,
        multiplier: h.multiplier as 1 | 2 | 4,
        double_called_by: h.double_called_by as 'A' | 'B' | null,
      }));
      
      setHoles(typedHoles);

      if (typedHoles.length > 0) {
        setCurrentHoleIndex(typedHoles.length);
      }
    } catch (error: any) {
      toast({ title: "Error loading game", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleDouble = (team: 'A' | 'B') => {
    if (multiplier === 1) {
      setMultiplier(2);
      setDoubleCalledBy(team);
      toast({ title: `Team ${team} called Double!`, description: "Multiplier is now ×2" });
    }
  };

  const handleDoubleBack = () => {
    if (multiplier === 2 && !doubleBackCalled) {
      setMultiplier(4);
      setDoubleBackCalled(true);
      toast({ title: "Double Back!", description: "Multiplier is now ×4" });
    }
  };

  const saveHole = async () => {
    if (!game) return;
    
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
      closestToPinWinner,
      birdieEagleWinner,
    };

    const { teamAPoints, teamBPoints, isUmbriago } = calculateHolePoints(categories, multiplier);

    const teamARunning = game.team_a_total_points + teamAPoints;
    const teamBRunning = game.team_b_total_points + teamBPoints;

    setSaving(true);
    try {
      const { error: holeError } = await supabase
        .from("umbriago_holes")
        .insert({
          game_id: game.id,
          hole_number: currentHole,
          par,
          team_a_player_1_score: scores.teamAPlayer1,
          team_a_player_2_score: scores.teamAPlayer2,
          team_b_player_1_score: scores.teamBPlayer1,
          team_b_player_2_score: scores.teamBPlayer2,
          team_low_winner: teamLowWinner,
          individual_low_winner: individualLowWinner,
          closest_to_pin_winner: closestToPinWinner,
          birdie_eagle_winner: birdieEagleWinner,
          multiplier,
          double_called_by: doubleCalledBy,
          double_back_called: doubleBackCalled,
          is_umbriago: isUmbriago,
          team_a_hole_points: teamAPoints,
          team_b_hole_points: teamBPoints,
          team_a_running_total: teamARunning,
          team_b_running_total: teamBRunning,
        });

      if (holeError) throw holeError;

      const { error: gameError } = await supabase
        .from("umbriago_games")
        .update({
          team_a_total_points: teamARunning,
          team_b_total_points: teamBRunning,
        })
        .eq("id", game.id);

      if (gameError) throw gameError;

      setGame({
        ...game,
        team_a_total_points: teamARunning,
        team_b_total_points: teamBRunning,
      });

      if (isUmbriago) {
        toast({ title: "🎉 UMBRIAGO!", description: "All 4 categories won - points doubled!" });
      }

      if (currentHole >= game.holes_played) {
        navigate(`/umbriago/${game.id}/summary`);
      } else {
        setCurrentHoleIndex(currentHoleIndex + 1);
        resetHoleState();
        await fetchGame();
      }
    } catch (error: any) {
      toast({ title: "Error saving hole", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const resetHoleState = () => {
    setPar(4);
    setScores({ teamAPlayer1: 0, teamAPlayer2: 0, teamBPlayer1: 0, teamBPlayer2: 0 });
    setClosestToPinWinner(null);
    setMultiplier(1);
    setDoubleCalledBy(null);
    setDoubleBackCalled(false);
  };

  const updateScore = (player: keyof typeof scores, delta: number) => {
    setScores(prev => ({
      ...prev,
      [player]: Math.max(1, prev[player] + delta),
    }));
  };

  const navigateHole = (direction: "prev" | "next") => {
    if (direction === "prev" && currentHoleIndex > 0) {
      setCurrentHoleIndex(currentHoleIndex - 1);
    } else if (direction === "next" && currentHoleIndex < totalHoles - 1) {
      setCurrentHoleIndex(currentHoleIndex + 1);
    }
  };

  const handleFinishGame = () => {
    navigate(`/umbriago/${gameId}/summary`);
  };

  const handleDeleteGame = async () => {
    try {
      await supabase.from("umbriago_holes").delete().eq("game_id", gameId);
      await supabase.from("umbriago_games").delete().eq("id", gameId);
      toast({ title: "Game deleted" });
      navigate("/rounds-play");
    } catch (error: any) {
      toast({ title: "Error deleting game", description: error.message, variant: "destructive" });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted-foreground">Loading game...</div>
      </div>
    );
  }

  if (!game) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted-foreground">Game not found</div>
      </div>
    );
  }

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
              <h1 className="text-xl font-bold">{game.date_played}</h1>
              <p className="text-sm text-muted-foreground">{game.course_name}</p>
            </div>
            <div className="w-10" />
          </div>
        </div>

        {/* Game Info Bar */}
        <div className="bg-primary text-primary-foreground py-4 px-4">
          <div className="max-w-2xl mx-auto flex items-center justify-between">
            <div>
              <div className="text-lg font-bold">UMBRIAGO</div>
              <div className="text-sm opacity-90">2v2</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{game.team_a_total_points} - {game.team_b_total_points}</div>
              <div className="text-xs opacity-90">Points</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{currentHole}</div>
              <div className="text-xs opacity-90">Hole</div>
            </div>
          </div>
        </div>
      </div>

      {/* Score Entry */}
      <div className="max-w-2xl mx-auto p-4 space-y-4">
        {/* Team A */}
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-3 h-3 rounded-full bg-blue-500" />
            <span className="font-semibold">Team A</span>
            <span className="text-2xl font-bold text-blue-500 ml-auto">{game.team_a_total_points}</span>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <ScoreInput
              label={game.team_a_player_1}
              value={scores.teamAPlayer1}
              onChange={(delta) => updateScore('teamAPlayer1', delta)}
            />
            <ScoreInput
              label={game.team_a_player_2}
              value={scores.teamAPlayer2}
              onChange={(delta) => updateScore('teamAPlayer2', delta)}
            />
          </div>
        </Card>

        {/* Team B */}
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-3 h-3 rounded-full bg-red-500" />
            <span className="font-semibold">Team B</span>
            <span className="text-2xl font-bold text-red-500 ml-auto">{game.team_b_total_points}</span>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <ScoreInput
              label={game.team_b_player_1}
              value={scores.teamBPlayer1}
              onChange={(delta) => updateScore('teamBPlayer1', delta)}
            />
            <ScoreInput
              label={game.team_b_player_2}
              value={scores.teamBPlayer2}
              onChange={(delta) => updateScore('teamBPlayer2', delta)}
            />
          </div>
        </Card>

        {/* Closest to Pin */}
        <Card className="p-4">
          <Label className="font-semibold text-sm mb-2 block">Closest to Pin (GIR)</Label>
          <div className="flex gap-2">
            <Button
              variant={closestToPinWinner === 'A' ? "default" : "outline"}
              onClick={() => setClosestToPinWinner('A')}
              className="flex-1"
              size="sm"
            >
              Team A
            </Button>
            <Button
              variant={closestToPinWinner === null ? "secondary" : "outline"}
              onClick={() => setClosestToPinWinner(null)}
              className="flex-1"
              size="sm"
            >
              Tie
            </Button>
            <Button
              variant={closestToPinWinner === 'B' ? "default" : "outline"}
              onClick={() => setClosestToPinWinner('B')}
              className="flex-1"
              size="sm"
            >
              Team B
            </Button>
          </div>
        </Card>

        {/* Multiplier */}
        <Card className="p-4">
          <div className="flex items-center justify-between mb-2">
            <Label className="font-semibold text-sm">Multiplier</Label>
            <div className="flex items-center gap-2">
              <Zap className={multiplier > 1 ? "text-yellow-500" : "text-muted-foreground"} size={16} />
              <span className="text-xl font-bold">×{multiplier}</span>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              onClick={() => handleDouble('A')}
              disabled={multiplier > 1}
              size="sm"
              className="text-blue-500"
            >
              Team A: Double
            </Button>
            <Button
              variant="outline"
              onClick={() => handleDouble('B')}
              disabled={multiplier > 1}
              size="sm"
              className="text-red-500"
            >
              Team B: Double
            </Button>
          </div>
          
          {multiplier === 2 && (
            <Button
              variant="outline"
              onClick={handleDoubleBack}
              disabled={doubleBackCalled}
              className="w-full mt-2"
              size="sm"
            >
              {doubleBackCalled ? "Double Back Applied" : "Double Back (→ ×4)"}
            </Button>
          )}
        </Card>
      </div>

      {/* Hole Navigation */}
      <div className="fixed bottom-16 left-0 right-0 bg-muted/50 backdrop-blur-sm border-t border-border py-4">
        <div className="max-w-2xl mx-auto px-4">
          <div className="flex items-center justify-between mb-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigateHole("prev")}
              disabled={currentHoleIndex === 0}
            >
              <ChevronLeft size={24} />
            </Button>

            <div className="text-center">
              <div className="text-2xl font-bold">Hole {currentHole}</div>
              <div className="text-sm text-muted-foreground">{currentHole} of {totalHoles}</div>
            </div>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigateHole("next")}
              disabled={currentHoleIndex === totalHoles - 1}
            >
              <ChevronRight size={24} />
            </Button>
          </div>
          
          {currentHoleIndex === totalHoles - 1 ? (
            <Button
              onClick={handleFinishGame}
              className="w-full"
              size="lg"
            >
              <Check size={20} className="mr-2" />
              Finish Game
            </Button>
          ) : (
            <Button
              onClick={saveHole}
              disabled={saving || scores.teamAPlayer1 === 0}
              className="w-full"
              size="lg"
            >
              {saving ? "Saving..." : "Save & Next Hole"}
            </Button>
          )}
        </div>
      </div>

      <UmbriagioBottomTabBar gameId={gameId!} />

      <AlertDialog open={showExitDialog} onOpenChange={setShowExitDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Exit Game</AlertDialogTitle>
            <AlertDialogDescription>
              What would you like to do with this game?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col gap-2 sm:flex-col">
            <AlertDialogAction
              onClick={() => {
                setShowExitDialog(false);
                navigate("/rounds-play");
              }}
              className="w-full"
            >
              Save and Exit
            </AlertDialogAction>
            <AlertDialogAction
              onClick={() => {
                setShowExitDialog(false);
                handleDeleteGame();
              }}
              className="w-full bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Game
            </AlertDialogAction>
            <AlertDialogCancel className="w-full mt-0">Cancel</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ScoreInput({ 
  label, 
  value, 
  onChange 
}: { 
  label: string; 
  value: number; 
  onChange: (delta: number) => void;
}) {
  return (
    <div className="space-y-1">
      <span className="text-xs text-muted-foreground truncate block">{label}</span>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="icon"
          onClick={() => onChange(-1)}
          disabled={value <= 1}
          className="h-10 w-10 rounded-full"
        >
          <Minus size={16} />
        </Button>
        <div className="flex-1 text-center text-2xl font-bold">{value || '-'}</div>
        <Button
          variant="outline"
          size="icon"
          onClick={() => onChange(1)}
          className="h-10 w-10 rounded-full"
        >
          <Plus size={16} />
        </Button>
      </div>
    </div>
  );
}
