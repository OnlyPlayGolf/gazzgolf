import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ChevronLeft, ChevronRight, Zap } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { CopenhagenGame, CopenhagenHole, Press } from "@/types/copenhagen";
import { CopenhagenBottomTabBar } from "@/components/CopenhagenBottomTabBar";
import { calculateCopenhagenPoints, calculateNetScore, createPress } from "@/utils/copenhagenScoring";
import { PlayerScoreSheet } from "@/components/play/PlayerScoreSheet";
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

export default function CopenhagenPlay() {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [game, setGame] = useState<CopenhagenGame | null>(null);
  const [holes, setHoles] = useState<CopenhagenHole[]>([]);
  const [courseHoles, setCourseHoles] = useState<CourseHole[]>([]);
  const [currentHoleIndex, setCurrentHoleIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showExitDialog, setShowExitDialog] = useState(false);
  const [activePlayerSheet, setActivePlayerSheet] = useState<1 | 2 | 3 | null>(null);
  
  const [par, setPar] = useState(4);
  const [strokeIndex, setStrokeIndex] = useState(1);
  const [scores, setScores] = useState({
    player1: 0,
    player2: 0,
    player3: 0,
  });
  
  const currentHole = currentHoleIndex + 1;
  const totalHoles = game?.holes_played || 18;

  useEffect(() => {
    if (gameId) fetchGame();
  }, [gameId]);

  useEffect(() => {
    if (courseHoles.length > 0) {
      const holeData = courseHoles.find(h => h.hole_number === currentHole);
      if (holeData) {
        setPar(holeData.par);
        setStrokeIndex(holeData.stroke_index);
        // Don't pre-set scores to par - start with 0 (no score)
        if (scores.player1 === 0 && scores.player2 === 0 && scores.player3 === 0) {
          setScores({ player1: 0, player2: 0, player3: 0 });
        }
      }
    }
  }, [currentHoleIndex, courseHoles]);

  const fetchGame = async () => {
    try {
      const { data: gameData, error: gameError } = await supabase
        .from("copenhagen_games")
        .select("*")
        .eq("id", gameId)
        .single();

      if (gameError) throw gameError;
      
      const typedGame: CopenhagenGame = {
        ...gameData,
        presses: (gameData.presses as unknown as Press[]) || [],
      };
      
      setGame(typedGame);

      if (gameData.course_id) {
        const { data: courseHolesData } = await supabase
          .from("course_holes")
          .select("hole_number, par, stroke_index")
          .eq("course_id", gameData.course_id)
          .order("hole_number");

        if (courseHolesData) {
          setCourseHoles(courseHolesData);
          const hole1 = courseHolesData.find(h => h.hole_number === 1);
          if (hole1) {
            setPar(hole1.par);
            setStrokeIndex(hole1.stroke_index);
          }
        }
      }

      const { data: holesData } = await supabase
        .from("copenhagen_holes")
        .select("*")
        .eq("game_id", gameId)
        .order("hole_number");
      
      const typedHoles: CopenhagenHole[] = (holesData || []).map(h => ({
        ...h,
        press_points: (h.press_points as Record<string, any>) || {},
      }));
      
      setHoles(typedHoles);

      // Only set to next hole on initial load, not when refreshing
      if (typedHoles.length > 0 && currentHoleIndex === 0) {
        setCurrentHoleIndex(typedHoles.length);
      }
    } catch (error: any) {
      toast({ title: "Error loading game", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleStartPress = async (playerIndex: number) => {
    if (!game) return;
    
    const newPress = createPress(playerIndex, currentHole + 1, game.presses);
    const updatedPresses = [...game.presses, newPress];
    
    try {
      const { error } = await supabase
        .from("copenhagen_games")
        .update({ presses: updatedPresses as any })
        .eq("id", game.id);

      if (error) throw error;

      setGame({ ...game, presses: updatedPresses });
      toast({ title: "Press started!", description: `Press begins on hole ${currentHole + 1}` });
    } catch (error: any) {
      toast({ title: "Error starting press", description: error.message, variant: "destructive" });
    }
  };

  const saveHole = async () => {
    if (!game) return;
    
    const netScores = {
      player1: calculateNetScore(scores.player1, game.use_handicaps ? game.player_1_handicap : null, strokeIndex),
      player2: calculateNetScore(scores.player2, game.use_handicaps ? game.player_2_handicap : null, strokeIndex),
      player3: calculateNetScore(scores.player3, game.use_handicaps ? game.player_3_handicap : null, strokeIndex),
    };

    const playerScores = [
      { grossScore: scores.player1, netScore: netScores.player1, playerIndex: 1 },
      { grossScore: scores.player2, netScore: netScores.player2, playerIndex: 2 },
      { grossScore: scores.player3, netScore: netScores.player3, playerIndex: 3 },
    ];

    const result = calculateCopenhagenPoints(playerScores, par);

    const existingHole = holes.find(h => h.hole_number === currentHole);

    const previousHoles = holes.filter(h => h.hole_number < currentHole);
    const prevP1 = previousHoles.reduce((sum, h) => sum + h.player_1_hole_points, 0);
    const prevP2 = previousHoles.reduce((sum, h) => sum + h.player_2_hole_points, 0);
    const prevP3 = previousHoles.reduce((sum, h) => sum + h.player_3_hole_points, 0);

    const runningP1 = prevP1 + result.player1Points;
    const runningP2 = prevP2 + result.player2Points;
    const runningP3 = prevP3 + result.player3Points;

    const pressPoints: Record<string, any> = {};
    game.presses.forEach(press => {
      if (press.is_active && currentHole >= press.start_hole) {
        pressPoints[press.id] = {
          player_1: result.player1Points,
          player_2: result.player2Points,
          player_3: result.player3Points,
        };
      }
    });

    setSaving(true);
    try {
      const holeData = {
        game_id: game.id,
        hole_number: currentHole,
        par,
        stroke_index: strokeIndex,
        player_1_gross_score: scores.player1,
        player_2_gross_score: scores.player2,
        player_3_gross_score: scores.player3,
        player_1_net_score: netScores.player1,
        player_2_net_score: netScores.player2,
        player_3_net_score: netScores.player3,
        player_1_hole_points: result.player1Points,
        player_2_hole_points: result.player2Points,
        player_3_hole_points: result.player3Points,
        player_1_running_total: runningP1,
        player_2_running_total: runningP2,
        player_3_running_total: runningP3,
        is_sweep: result.isSweep,
        sweep_winner: result.sweepWinner,
        press_points: pressPoints,
      };

      if (existingHole) {
        const { error } = await supabase
          .from("copenhagen_holes")
          .update(holeData)
          .eq("id", existingHole.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("copenhagen_holes")
          .insert(holeData);
        if (error) throw error;
      }

      const futureHoles = holes.filter(h => h.hole_number > currentHole);
      const futureP1 = futureHoles.reduce((sum, h) => sum + h.player_1_hole_points, 0);
      const futureP2 = futureHoles.reduce((sum, h) => sum + h.player_2_hole_points, 0);
      const futureP3 = futureHoles.reduce((sum, h) => sum + h.player_3_hole_points, 0);

      const totalP1 = prevP1 + result.player1Points + futureP1;
      const totalP2 = prevP2 + result.player2Points + futureP2;
      const totalP3 = prevP3 + result.player3Points + futureP3;

      const updatedPresses = game.presses.map(press => {
        if (press.is_active && currentHole >= press.start_hole) {
          return {
            ...press,
            player_1_points: press.player_1_points + result.player1Points,
            player_2_points: press.player_2_points + result.player2Points,
            player_3_points: press.player_3_points + result.player3Points,
          };
        }
        return press;
      });

      await supabase
        .from("copenhagen_games")
        .update({
          player_1_total_points: totalP1,
          player_2_total_points: totalP2,
          player_3_total_points: totalP3,
          presses: updatedPresses as any,
        })
        .eq("id", game.id);

      setGame({
        ...game,
        player_1_total_points: totalP1,
        player_2_total_points: totalP2,
        player_3_total_points: totalP3,
        presses: updatedPresses,
      });

      if (result.isSweep) {
        const winnerName = result.sweepWinner === 1 ? game.player_1 : 
                          result.sweepWinner === 2 ? game.player_2 : game.player_3;
        toast({ title: "🎉 SWEEP!", description: `${winnerName} wins all 6 points!` });
      }

      // Refresh holes data after save
      const { data: updatedHolesData } = await supabase
        .from("copenhagen_holes")
        .select("*")
        .eq("game_id", game.id)
        .order("hole_number");

      if (updatedHolesData) {
        const typedUpdatedHoles: CopenhagenHole[] = updatedHolesData.map(h => ({
          ...h,
          press_points: (h.press_points as Record<string, any>) || {},
        }));
        setHoles(typedUpdatedHoles);
      }

      if (currentHole >= game.holes_played) {
        navigate(`/copenhagen/${game.id}/summary`);
      } else {
        // Only advance if we were on the latest hole
        const wasOnLatestHole = !existingHole || holes.length === currentHoleIndex;
        if (wasOnLatestHole) {
          setCurrentHoleIndex(currentHoleIndex + 1);
          resetHoleState();
        }
      }
    } catch (error: any) {
      toast({ title: "Error saving hole", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const resetHoleState = () => {
    const nextHoleNumber = currentHoleIndex + 2;
    const nextHoleData = courseHoles.find(h => h.hole_number === nextHoleNumber);
    const nextPar = nextHoleData?.par || 4;
    const nextSI = nextHoleData?.stroke_index || 1;
    setPar(nextPar);
    setStrokeIndex(nextSI);
    setScores({ player1: 0, player2: 0, player3: 0 }); // Reset to 0 for no pre-set score
  };

  const updateScore = (player: 'player1' | 'player2' | 'player3', score: number | null) => {
    setScores(prev => ({
      ...prev,
      [player]: score ?? prev[player],
    }));
  };

  const handlePlayerScoreSelect = (playerNum: 1 | 2 | 3, score: number | null) => {
    const playerKey = `player${playerNum}` as 'player1' | 'player2' | 'player3';
    updateScore(playerKey, score);
  };

  const handleEnterAndNext = () => {
    if (activePlayerSheet === 1) {
      setActivePlayerSheet(2);
    } else if (activePlayerSheet === 2) {
      setActivePlayerSheet(3);
    } else {
      // Last player - close sheet and auto-save/advance
      setActivePlayerSheet(null);
      saveHole();
    }
  };

  const navigateHole = async (direction: "prev" | "next") => {
    if (direction === "prev" && currentHoleIndex > 0) {
      const targetHoleNumber = currentHole - 1;
      const prevHole = holes.find(h => h.hole_number === targetHoleNumber);
      if (prevHole) {
        setPar(prevHole.par);
        setStrokeIndex(prevHole.stroke_index || 1);
        setScores({
          player1: prevHole.player_1_gross_score || 0,
          player2: prevHole.player_2_gross_score || 0,
          player3: prevHole.player_3_gross_score || 0,
        });
      }
      setCurrentHoleIndex(currentHoleIndex - 1);
    } else if (direction === "next") {
      // Check if we're editing a previous hole (not the latest)
      const isEditingPreviousHole = holes.some(h => h.hole_number === currentHole);
      const nextHoleNumber = currentHole + 1;
      const nextHoleExists = holes.some(h => h.hole_number === nextHoleNumber);
      
      // Save current hole first
      await saveHole();
      
      // If we were editing a previous hole, manually advance
      if (isEditingPreviousHole) {
        if (nextHoleExists) {
          const nextHole = holes.find(h => h.hole_number === nextHoleNumber);
          if (nextHole) {
            const nextHoleData = courseHoles.find(h => h.hole_number === nextHoleNumber);
            setPar(nextHoleData?.par || nextHole.par);
            setStrokeIndex(nextHoleData?.stroke_index || nextHole.stroke_index || 1);
            setScores({
              player1: nextHole.player_1_gross_score || 0,
              player2: nextHole.player_2_gross_score || 0,
              player3: nextHole.player_3_gross_score || 0,
            });
          }
        } else {
          const nextHoleData = courseHoles.find(h => h.hole_number === nextHoleNumber);
          setPar(nextHoleData?.par || 4);
          setStrokeIndex(nextHoleData?.stroke_index || 1);
          setScores({ player1: 0, player2: 0, player3: 0 });
        }
        setCurrentHoleIndex(currentHoleIndex + 1);
      }
    }
  };

  const handleFinishGame = () => navigate(`/copenhagen/${gameId}/summary`);

  const handleDeleteGame = async () => {
    try {
      await supabase.from("copenhagen_holes").delete().eq("game_id", gameId);
      await supabase.from("copenhagen_games").delete().eq("id", gameId);
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
        {gameId && <CopenhagenBottomTabBar gameId={gameId} />}
      </div>
    );
  }

  if (!game) {
    return (
      <div className="min-h-screen pb-24 flex items-center justify-center">
        <div className="text-muted-foreground">Game not found</div>
        {gameId && <CopenhagenBottomTabBar gameId={gameId} />}
      </div>
    );
  }

  const activePresses = game.presses.filter(p => p.is_active);

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
              <h1 className="text-xl font-bold">Copenhagen</h1>
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
              <div className="text-sm text-[hsl(120,20%,40%)]">HCP {strokeIndex}</div>
            </div>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigateHole("next")}
              disabled={currentHole >= totalHoles}
              className="text-[hsl(120,20%,30%)] hover:bg-[hsl(120,20%,80%)]"
            >
              <ChevronRight size={24} />
            </Button>
          </div>
        </div>
      </div>

      {/* Score Entry */}
      <div className="max-w-2xl mx-auto p-4 space-y-4">
        {/* Player 1 Card */}
        <Card 
          className="p-4 cursor-pointer hover:bg-muted/50 transition-colors"
          onClick={() => setActivePlayerSheet(1)}
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-emerald-600 truncate max-w-[180px]">{game.player_1}</div>
              {game.use_handicaps && game.player_1_handicap !== null && (
                <div className="text-xs text-muted-foreground">HCP: {game.player_1_handicap}</div>
              )}
            </div>
            <div className="flex items-center gap-4">
              <div className="bg-secondary text-secondary-foreground w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold">
                {scores.player1 || '-'}
              </div>
              <div className="text-lg font-bold text-emerald-600">{game.player_1_total_points} pts</div>
            </div>
          </div>
        </Card>

        {/* Player 2 Card */}
        <Card 
          className="p-4 cursor-pointer hover:bg-muted/50 transition-colors"
          onClick={() => setActivePlayerSheet(2)}
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-blue-600 truncate max-w-[180px]">{game.player_2}</div>
              {game.use_handicaps && game.player_2_handicap !== null && (
                <div className="text-xs text-muted-foreground">HCP: {game.player_2_handicap}</div>
              )}
            </div>
            <div className="flex items-center gap-4">
              <div className="bg-secondary text-secondary-foreground w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold">
                {scores.player2 || '-'}
              </div>
              <div className="text-lg font-bold text-blue-600">{game.player_2_total_points} pts</div>
            </div>
          </div>
        </Card>

        {/* Player 3 Card */}
        <Card 
          className="p-4 cursor-pointer hover:bg-muted/50 transition-colors"
          onClick={() => setActivePlayerSheet(3)}
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-amber-600 truncate max-w-[180px]">{game.player_3}</div>
              {game.use_handicaps && game.player_3_handicap !== null && (
                <div className="text-xs text-muted-foreground">HCP: {game.player_3_handicap}</div>
              )}
            </div>
            <div className="flex items-center gap-4">
              <div className="bg-secondary text-secondary-foreground w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold">
                {scores.player3 || '-'}
              </div>
              <div className="text-lg font-bold text-amber-600">{game.player_3_total_points} pts</div>
            </div>
          </div>
        </Card>

        {/* Presses */}
        <Card className="p-3">
          <div className="flex items-center justify-between mb-2">
            <Label className="font-semibold text-sm flex items-center gap-1">
              <Zap size={14} />
              Presses
            </Label>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => handleStartPress(1)}
              size="sm"
              className="flex-1 text-emerald-600"
            >
              {game.player_1.split(' ')[0]}: Press
            </Button>
            <Button
              variant="outline"
              onClick={() => handleStartPress(2)}
              size="sm"
              className="flex-1 text-blue-600"
            >
              {game.player_2.split(' ')[0]}: Press
            </Button>
            <Button
              variant="outline"
              onClick={() => handleStartPress(3)}
              size="sm"
              className="flex-1 text-amber-600"
            >
              {game.player_3.split(' ')[0]}: Press
            </Button>
          </div>
        </Card>

        {/* Active Presses */}
        {activePresses.length > 0 && (
          <Card className="p-3">
            <Label className="text-sm font-medium mb-2 block">Active Presses</Label>
            <div className="space-y-2">
              {activePresses.map((press, i) => (
                <div key={press.id} className="flex items-center justify-between text-sm p-2 bg-muted/50 rounded">
                  <span>Press #{i + 1} (hole {press.start_hole})</span>
                  <div className="flex gap-2">
                    <span className="text-emerald-600 font-medium">{press.player_1_points}</span>
                    <span className="text-muted-foreground">-</span>
                    <span className="text-blue-600 font-medium">{press.player_2_points}</span>
                    <span className="text-muted-foreground">-</span>
                    <span className="text-amber-600 font-medium">{press.player_3_points}</span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>


      <CopenhagenBottomTabBar gameId={gameId!} />

      <AlertDialog open={showExitDialog} onOpenChange={setShowExitDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Exit Game</AlertDialogTitle>
            <AlertDialogDescription>
              What would you like to do with this game?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col gap-2 sm:flex-col sm:space-x-0">
            <AlertDialogAction
              onClick={() => {
                setShowExitDialog(false);
                navigate("/rounds-play");
              }}
              className="w-full m-0"
            >
              Save and Exit
            </AlertDialogAction>
            <AlertDialogAction
              onClick={() => {
                setShowExitDialog(false);
                handleDeleteGame();
              }}
              className="w-full m-0 bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Game
            </AlertDialogAction>
            <AlertDialogCancel className="w-full m-0">Cancel</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Player Score Sheets */}
      <PlayerScoreSheet
        open={activePlayerSheet === 1}
        onOpenChange={(open) => !open && setActivePlayerSheet(null)}
        playerName={game.player_1}
        handicap={game.use_handicaps ? game.player_1_handicap : null}
        par={par}
        holeNumber={currentHole}
        currentScore={scores.player1 || null}
        onScoreSelect={(score) => handlePlayerScoreSelect(1, score)}
        onEnterAndNext={handleEnterAndNext}
      />
      <PlayerScoreSheet
        open={activePlayerSheet === 2}
        onOpenChange={(open) => !open && setActivePlayerSheet(null)}
        playerName={game.player_2}
        handicap={game.use_handicaps ? game.player_2_handicap : null}
        par={par}
        holeNumber={currentHole}
        currentScore={scores.player2 || null}
        onScoreSelect={(score) => handlePlayerScoreSelect(2, score)}
        onEnterAndNext={handleEnterAndNext}
      />
      <PlayerScoreSheet
        open={activePlayerSheet === 3}
        onOpenChange={(open) => !open && setActivePlayerSheet(null)}
        playerName={game.player_3}
        handicap={game.use_handicaps ? game.player_3_handicap : null}
        par={par}
        holeNumber={currentHole}
        currentScore={scores.player3 || null}
        onScoreSelect={(score) => handlePlayerScoreSelect(3, score)}
        onEnterAndNext={handleEnterAndNext}
      />
    </div>
  );
}
