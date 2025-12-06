import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ChevronLeft, ChevronRight, Minus, Plus, Check, Zap, Dices } from "lucide-react";
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

interface CourseHole {
  hole_number: number;
  par: number;
  stroke_index: number;
}

export default function UmbriagioPlay() {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [game, setGame] = useState<UmbriagioGame | null>(null);
  const [holes, setHoles] = useState<UmbriagioHole[]>([]);
  const [courseHoles, setCourseHoles] = useState<CourseHole[]>([]);
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

  // Update par and default scores when hole changes and we have course data
  useEffect(() => {
    if (courseHoles.length > 0) {
      const holeData = courseHoles.find(h => h.hole_number === currentHole);
      if (holeData) {
        setPar(holeData.par);
        // Only set default scores if all scores are 0 (new hole, not loaded from DB)
        if (scores.teamAPlayer1 === 0 && scores.teamAPlayer2 === 0 && scores.teamBPlayer1 === 0 && scores.teamBPlayer2 === 0) {
          setScores({ teamAPlayer1: holeData.par, teamAPlayer2: holeData.par, teamBPlayer1: holeData.par, teamBPlayer2: holeData.par });
        }
      }
    }
  }, [currentHoleIndex, courseHoles]);

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

      // Fetch course holes if course_id exists
      if (gameData.course_id) {
        const { data: courseHolesData, error: courseHolesError } = await supabase
          .from("course_holes")
          .select("hole_number, par, stroke_index")
          .eq("course_id", gameData.course_id)
          .order("hole_number");

        if (!courseHolesError && courseHolesData) {
          setCourseHoles(courseHolesData);
          // Set initial par for hole 1
          const hole1 = courseHolesData.find(h => h.hole_number === 1);
          if (hole1) {
            setPar(hole1.par);
          }
        }
      }

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

  const handleRoll = async (team: 'A' | 'B') => {
    if (!game) return;
    
    const rollHistory = game.roll_history || [];
    const teamRolls = rollHistory.filter(r => r.team === team).length;
    
    if (teamRolls >= game.rolls_per_team) {
      toast({ title: "No rolls remaining", variant: "destructive" });
      return;
    }

    const pointsBefore = team === 'A' ? game.team_a_total_points : game.team_b_total_points;
    const pointsAfter = Math.floor(pointsBefore / 2);
    
    const newRoll: RollEvent = {
      team,
      hole: currentHole,
      points_before: pointsBefore,
      points_after: pointsAfter,
    };

    const newRollHistory = [...rollHistory, newRoll];
    const newTeamAPoints = team === 'A' ? pointsAfter : game.team_a_total_points;
    const newTeamBPoints = team === 'B' ? pointsAfter : game.team_b_total_points;

    try {
      const { error } = await supabase
        .from("umbriago_games")
        .update({
          roll_history: newRollHistory as unknown as any,
          team_a_total_points: newTeamAPoints,
          team_b_total_points: newTeamBPoints,
        })
        .eq("id", game.id);

      if (error) throw error;

      setGame({
        ...game,
        roll_history: newRollHistory,
        team_a_total_points: newTeamAPoints,
        team_b_total_points: newTeamBPoints,
      });
      
      // Set multiplier for next hole to 2
      setMultiplier(2);

      toast({ 
        title: `🎲 Team ${team} called Roll!`, 
        description: `Points halved (${pointsBefore} → ${pointsAfter}). Next hole is ×2!` 
      });
    } catch (error: any) {
      toast({ title: "Error saving roll", description: error.message, variant: "destructive" });
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

    const { teamAPoints, teamBPoints, isUmbriago, umbriagioMultiplier } = calculateHolePoints(categories, multiplier, holeScores);

    // Check if this hole already exists
    const existingHole = holes.find(h => h.hole_number === currentHole);

    // Calculate running totals properly
    // Sum up all previous holes' points (excluding current hole if it exists)
    const previousHolesTeamA = holes
      .filter(h => h.hole_number < currentHole)
      .reduce((sum, h) => sum + h.team_a_hole_points, 0);
    const previousHolesTeamB = holes
      .filter(h => h.hole_number < currentHole)
      .reduce((sum, h) => sum + h.team_b_hole_points, 0);

    const teamARunning = previousHolesTeamA + teamAPoints;
    const teamBRunning = previousHolesTeamB + teamBPoints;

    setSaving(true);
    try {
      if (existingHole) {
        // Update existing hole
        const { error: holeError } = await supabase
          .from("umbriago_holes")
          .update({
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
          })
          .eq("id", existingHole.id);

        if (holeError) throw holeError;
      } else {
        // Insert new hole
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
      }

      // Calculate total game points from all holes including this update
      // Sum previous holes + current hole + future holes (if any)
      const futureHolesTeamA = holes
        .filter(h => h.hole_number > currentHole)
        .reduce((sum, h) => sum + h.team_a_hole_points, 0);
      const futureHolesTeamB = holes
        .filter(h => h.hole_number > currentHole)
        .reduce((sum, h) => sum + h.team_b_hole_points, 0);

      const totalTeamA = previousHolesTeamA + teamAPoints + futureHolesTeamA;
      const totalTeamB = previousHolesTeamB + teamBPoints + futureHolesTeamB;

      const { error: gameError } = await supabase
        .from("umbriago_games")
        .update({
          team_a_total_points: totalTeamA,
          team_b_total_points: totalTeamB,
        })
        .eq("id", game.id);

      if (gameError) throw gameError;

      setGame({
        ...game,
        team_a_total_points: totalTeamA,
        team_b_total_points: totalTeamB,
      });

      if (isUmbriago) {
        const umbriagioLabel = umbriagioMultiplier === 4 ? "x4 UMBRIAGO!" : umbriagioMultiplier === 2 ? "x2 UMBRIAGO!" : "UMBRIAGO!";
        const description = umbriagioMultiplier === 4 ? "Both players with eagle - 32 base points!" : 
                            umbriagioMultiplier === 2 ? "Eagle scored - 16 base points!" : 
                            "All 4 categories won - points doubled!";
        toast({ title: `🎉 ${umbriagioLabel}`, description });
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
    // Par will be set by useEffect when courseHoles is available
    const nextHoleNumber = currentHoleIndex + 2; // +1 for 0-index, +1 for next hole
    const nextHoleData = courseHoles.find(h => h.hole_number === nextHoleNumber);
    const nextPar = nextHoleData?.par || 4;
    setPar(nextPar);
    // Default scores to par
    setScores({ teamAPlayer1: nextPar, teamAPlayer2: nextPar, teamBPlayer1: nextPar, teamBPlayer2: nextPar });
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

  const navigateHole = async (direction: "prev" | "next") => {
    if (direction === "prev" && currentHoleIndex > 0) {
      // Load previous hole data
      const prevHole = holes[currentHoleIndex - 1];
      if (prevHole) {
        setPar(prevHole.par);
        setScores({
          teamAPlayer1: prevHole.team_a_player_1_score || 0,
          teamAPlayer2: prevHole.team_a_player_2_score || 0,
          teamBPlayer1: prevHole.team_b_player_1_score || 0,
          teamBPlayer2: prevHole.team_b_player_2_score || 0,
        });
        setClosestToPinWinner(prevHole.closest_to_pin_winner);
        setMultiplier(prevHole.multiplier);
        setDoubleCalledBy(prevHole.double_called_by);
        setDoubleBackCalled(prevHole.double_back_called || false);
      }
      setCurrentHoleIndex(currentHoleIndex - 1);
    } else if (direction === "next") {
      // Save current hole before moving to next (saveHole handles last hole → summary)
      await saveHole();
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

  return (
    <div className="min-h-screen pb-44 bg-background">
      {/* Game Info Bar */}
      <div className="bg-primary text-primary-foreground py-2 px-4">
        <div className="max-w-2xl mx-auto flex items-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowExitDialog(true)}
            className="rounded-full text-primary-foreground hover:bg-primary-foreground/20"
          >
            <ChevronLeft size={20} />
          </Button>
          <div className="flex-1 text-center">
            <div className="text-base font-bold">Game {game.date_played}</div>
            <div className="text-xs opacity-80">{game.course_name}</div>
          </div>
          <div className="w-8" />
        </div>
      </div>

      {/* Score Entry */}
      <div className="max-w-2xl mx-auto p-4 space-y-4">

        {/* Team A */}
        <Card className="p-3">
          <div className="text-center mb-2">
            <span className="text-xl font-bold text-blue-500">{game.team_a_total_points}</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <ScoreInput
              label={game.team_a_player_1}
              value={scores.teamAPlayer1}
              onChange={(delta) => updateScore('teamAPlayer1', delta)}
              labelColor="text-blue-500"
            />
            <ScoreInput
              label={game.team_a_player_2}
              value={scores.teamAPlayer2}
              onChange={(delta) => updateScore('teamAPlayer2', delta)}
              labelColor="text-blue-500"
            />
          </div>
        </Card>

        {/* Team B */}
        <Card className="p-3">
          <div className="text-center mb-2">
            <span className="text-xl font-bold text-red-500">{game.team_b_total_points}</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <ScoreInput
              label={game.team_b_player_1}
              value={scores.teamBPlayer1}
              onChange={(delta) => updateScore('teamBPlayer1', delta)}
              labelColor="text-red-500"
            />
            <ScoreInput
              label={game.team_b_player_2}
              value={scores.teamBPlayer2}
              onChange={(delta) => updateScore('teamBPlayer2', delta)}
              labelColor="text-red-500"
            />
          </div>
        </Card>

        {/* Closest to Pin */}
        <Card className="p-3">
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
        <Card className="p-3">
          <div className="flex items-center justify-between mb-2">
            <Label className="font-semibold text-sm">Multiplier</Label>
            <div className="flex items-center gap-1">
              <Zap className={multiplier > 1 ? "text-yellow-500" : "text-muted-foreground"} size={14} />
              <span className="text-lg font-bold">×{multiplier}</span>
            </div>
          </div>
          
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => handleDouble('A')}
              disabled={multiplier > 1}
              size="sm"
              className="flex-1 text-blue-500"
            >
              A: Double
            </Button>
            <Button
              variant="outline"
              onClick={() => handleDouble('B')}
              disabled={multiplier > 1}
              size="sm"
              className="flex-1 text-red-500"
            >
              B: Double
            </Button>
            {multiplier === 2 && (
              <Button
                variant="outline"
                onClick={handleDoubleBack}
                disabled={doubleBackCalled}
                size="sm"
                className="flex-1"
              >
                {doubleBackCalled ? "×4" : "Back"}
              </Button>
            )}
          </div>
        </Card>

        {/* Rolls */}
        {game.rolls_per_team > 0 && (
          <Card className="p-3">
            <div className="flex items-center justify-between mb-2">
              <Label className="font-semibold text-sm flex items-center gap-1">
                <Dices size={14} />
                Rolls
              </Label>
              <div className="text-xs text-muted-foreground">
                {game.rolls_per_team} per team
              </div>
            </div>
            
            {(() => {
              const rollHistory = game.roll_history || [];
              const teamARolls = rollHistory.filter(r => r.team === 'A').length;
              const teamBRolls = rollHistory.filter(r => r.team === 'B').length;
              const teamAIsLosing = game.team_a_total_points < game.team_b_total_points;
              const teamBIsLosing = game.team_b_total_points < game.team_a_total_points;
              const isTied = game.team_a_total_points === game.team_b_total_points;
              
              return (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => handleRoll('A')}
                      disabled={!teamAIsLosing || teamARolls >= game.rolls_per_team}
                      size="sm"
                      className="flex-1 text-blue-500"
                    >
                      A: Roll ({teamARolls}/{game.rolls_per_team})
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => handleRoll('B')}
                      disabled={!teamBIsLosing || teamBRolls >= game.rolls_per_team}
                      size="sm"
                      className="flex-1 text-red-500"
                    >
                      B: Roll ({teamBRolls}/{game.rolls_per_team})
                    </Button>
                  </div>
                  {isTied && (
                    <p className="text-xs text-amber-500">
                      Score is tied - no team can roll
                    </p>
                  )}
                </div>
              );
            })()}
            <p className="text-xs text-muted-foreground mt-2">
              Only losing team can roll. Halves points, doubles next hole.
            </p>
          </Card>
        )}
      </div>

      {/* Hole Navigation */}
      <div className="fixed bottom-10 left-0 right-0 bg-muted/50 backdrop-blur-sm border-t border-border py-2">
        <div className="max-w-2xl mx-auto px-4">
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigateHole("prev")}
              disabled={currentHoleIndex === 0}
            >
              <ChevronLeft size={20} />
            </Button>

            <div className="flex items-center justify-center gap-6">
              <div className="text-sm text-muted-foreground">Par {par}</div>
              <div className="text-lg font-bold">Hole {currentHole}</div>
              <div className="text-sm text-muted-foreground">
                HCP {courseHoles.find(h => h.hole_number === currentHole)?.stroke_index || '-'}
              </div>
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigateHole("next")}
              disabled={saving}
            >
              <ChevronRight size={20} />
            </Button>
          </div>
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
  onChange,
  labelColor = "text-muted-foreground"
}: { 
  label: string; 
  value: number; 
  onChange: (delta: number) => void;
  labelColor?: string;
}) {
  return (
    <div className="space-y-0.5">
      <span className={`text-sm font-medium truncate block ${labelColor}`}>{label}</span>
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="icon"
          onClick={() => onChange(-1)}
          disabled={value <= 1}
          className="h-8 w-8 rounded-full"
        >
          <Minus size={14} />
        </Button>
        <div className="flex-1 text-center text-xl font-bold">{value || '-'}</div>
        <Button
          variant="outline"
          size="icon"
          onClick={() => onChange(1)}
          className="h-8 w-8 rounded-full"
        >
          <Plus size={14} />
        </Button>
      </div>
    </div>
  );
}
