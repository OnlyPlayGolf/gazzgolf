import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ChevronLeft, ChevronRight, Minus, Plus, Zap, Trophy } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { CopenhagenGame, CopenhagenHole, Press } from "@/types/copenhagen";
import { CopenhagenBottomTabBar } from "@/components/CopenhagenBottomTabBar";
import { calculateCopenhagenPoints, calculateNetScore, createPress } from "@/utils/copenhagenScoring";
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
        if (scores.player1 === 0 && scores.player2 === 0 && scores.player3 === 0) {
          setScores({ player1: holeData.par, player2: holeData.par, player3: holeData.par });
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

      if (typedHoles.length > 0) {
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

    // Calculate press points for active presses
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

      // Update game totals and press totals
      const futureHoles = holes.filter(h => h.hole_number > currentHole);
      const futureP1 = futureHoles.reduce((sum, h) => sum + h.player_1_hole_points, 0);
      const futureP2 = futureHoles.reduce((sum, h) => sum + h.player_2_hole_points, 0);
      const futureP3 = futureHoles.reduce((sum, h) => sum + h.player_3_hole_points, 0);

      const totalP1 = prevP1 + result.player1Points + futureP1;
      const totalP2 = prevP2 + result.player2Points + futureP2;
      const totalP3 = prevP3 + result.player3Points + futureP3;

      // Update press totals
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

      if (currentHole >= game.holes_played) {
        navigate(`/copenhagen/${game.id}/summary`);
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
    const nextHoleNumber = currentHoleIndex + 2;
    const nextHoleData = courseHoles.find(h => h.hole_number === nextHoleNumber);
    const nextPar = nextHoleData?.par || 4;
    const nextSI = nextHoleData?.stroke_index || 1;
    setPar(nextPar);
    setStrokeIndex(nextSI);
    setScores({ player1: nextPar, player2: nextPar, player3: nextPar });
  };

  const updateScore = (player: keyof typeof scores, delta: number) => {
    setScores(prev => ({
      ...prev,
      [player]: Math.max(1, prev[player] + delta),
    }));
  };

  const navigateHole = async (direction: "prev" | "next") => {
    if (direction === "prev" && currentHoleIndex > 0) {
      const prevHole = holes[currentHoleIndex - 1];
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
      await saveHole();
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

  const ScoreInput = ({ label, value, onChange, playerPoints, color }: { 
    label: string; 
    value: number; 
    onChange: (delta: number) => void;
    playerPoints: number;
    color: string;
  }) => (
    <div className="flex flex-col items-center gap-2 p-3 rounded-lg bg-muted/50">
      <Label className={`text-sm font-medium truncate max-w-full ${color}`}>{label}</Label>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="icon" className="h-10 w-10" onClick={() => onChange(-1)}>
          <Minus size={16} />
        </Button>
        <span className="text-2xl font-bold w-12 text-center">{value}</span>
        <Button variant="outline" size="icon" className="h-10 w-10" onClick={() => onChange(1)}>
          <Plus size={16} />
        </Button>
      </div>
      <span className="text-xs text-muted-foreground">{playerPoints} pts</span>
    </div>
  );

  return (
    <div className="min-h-screen pb-44 bg-background">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur border-b">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="font-bold text-lg">Copenhagen</h1>
              <p className="text-xs text-muted-foreground">{game.course_name}</p>
            </div>
            <div className="flex items-center gap-2">
              {activePresses.length > 0 && (
                <Badge variant="secondary" className="gap-1">
                  <Zap size={12} />
                  {activePresses.length} Press{activePresses.length > 1 ? 'es' : ''}
                </Badge>
              )}
              <Button variant="ghost" size="sm" onClick={() => setShowExitDialog(true)}>
                Exit
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4 max-w-2xl mx-auto">
        {/* Hole Navigation */}
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigateHole("prev")}
              disabled={currentHoleIndex === 0}
            >
              <ChevronLeft size={24} />
            </Button>
            <div className="text-center">
              <div className="text-3xl font-bold">Hole {currentHole}</div>
              <div className="text-sm text-muted-foreground">Par {par} • SI {strokeIndex}</div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigateHole("next")}
              disabled={saving}
            >
              <ChevronRight size={24} />
            </Button>
          </div>
        </Card>

        {/* Standings */}
        <Card className="p-3">
          <div className="flex items-center justify-around text-center">
            <div>
              <div className="text-xs text-emerald-600 font-medium truncate max-w-[80px]">{game.player_1}</div>
              <div className="text-xl font-bold">{game.player_1_total_points}</div>
            </div>
            <div>
              <div className="text-xs text-blue-600 font-medium truncate max-w-[80px]">{game.player_2}</div>
              <div className="text-xl font-bold">{game.player_2_total_points}</div>
            </div>
            <div>
              <div className="text-xs text-amber-600 font-medium truncate max-w-[80px]">{game.player_3}</div>
              <div className="text-xl font-bold">{game.player_3_total_points}</div>
            </div>
          </div>
        </Card>

        {/* Score Entry */}
        <Card className="p-4 space-y-4">
          <div className="text-center">
            <Label className="text-sm font-medium">Enter Gross Scores</Label>
            {game.use_handicaps && (
              <p className="text-xs text-muted-foreground">Net scores calculated automatically</p>
            )}
          </div>
          <div className="grid grid-cols-3 gap-2">
            <ScoreInput
              label={game.player_1}
              value={scores.player1}
              onChange={(delta) => updateScore('player1', delta)}
              playerPoints={game.player_1_total_points}
              color="text-emerald-600"
            />
            <ScoreInput
              label={game.player_2}
              value={scores.player2}
              onChange={(delta) => updateScore('player2', delta)}
              playerPoints={game.player_2_total_points}
              color="text-blue-600"
            />
            <ScoreInput
              label={game.player_3}
              value={scores.player3}
              onChange={(delta) => updateScore('player3', delta)}
              playerPoints={game.player_3_total_points}
              color="text-amber-600"
            />
          </div>
        </Card>

        {/* Press Buttons */}
        <Card className="p-4">
          <Label className="text-sm font-medium mb-3 block">Start a Press</Label>
          <div className="grid grid-cols-3 gap-2">
            <Button variant="outline" size="sm" onClick={() => handleStartPress(1)} className="text-xs">
              <Zap size={14} className="mr-1" />
              {game.player_1}
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleStartPress(2)} className="text-xs">
              <Zap size={14} className="mr-1" />
              {game.player_2}
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleStartPress(3)} className="text-xs">
              <Zap size={14} className="mr-1" />
              {game.player_3}
            </Button>
          </div>
        </Card>

        {/* Active Presses */}
        {activePresses.length > 0 && (
          <Card className="p-4">
            <Label className="text-sm font-medium mb-2 block">Active Presses</Label>
            <div className="space-y-2">
              {activePresses.map((press, i) => (
                <div key={press.id} className="flex items-center justify-between text-sm p-2 bg-muted/50 rounded">
                  <span>Press #{i + 1} (from hole {press.start_hole})</span>
                  <span className="font-medium">
                    {press.player_1_points} - {press.player_2_points} - {press.player_3_points}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2">
          <Button
            onClick={saveHole}
            disabled={saving}
            className="flex-1 h-12"
          >
            {saving ? "Saving..." : currentHole >= totalHoles ? "Finish Game" : "Next Hole"}
          </Button>
        </div>
      </div>

      {/* Exit Dialog */}
      <AlertDialog open={showExitDialog} onOpenChange={setShowExitDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Exit Game</AlertDialogTitle>
            <AlertDialogDescription>What would you like to do with this game?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col gap-2 sm:flex-col">
            <AlertDialogAction onClick={handleFinishGame}>Save and Exit</AlertDialogAction>
            <AlertDialogAction onClick={handleDeleteGame} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete Game
            </AlertDialogAction>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {gameId && <CopenhagenBottomTabBar gameId={gameId} />}
    </div>
  );
}
