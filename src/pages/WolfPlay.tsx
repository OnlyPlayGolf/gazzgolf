import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ChevronLeft, ChevronRight, User, Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { WolfGame, WolfHole } from "@/types/wolf";
import { WolfBottomTabBar } from "@/components/WolfBottomTabBar";
import { PlayerScoreSheet } from "@/components/play/PlayerScoreSheet";
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

interface CourseHole {
  hole_number: number;
  par: number;
}

export default function WolfPlay() {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [game, setGame] = useState<WolfGame | null>(null);
  const [holes, setHoles] = useState<WolfHole[]>([]);
  const [courseHoles, setCourseHoles] = useState<CourseHole[]>([]);
  const [currentHoleIndex, setCurrentHoleIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showExitDialog, setShowExitDialog] = useState(false);
  const [activePlayerSheet, setActivePlayerSheet] = useState<number | null>(null);
  
  // Current hole state
  const [par, setPar] = useState(4);
  const [scores, setScores] = useState<(number | null)[]>([null, null, null, null, null]);
  const [wolfChoice, setWolfChoice] = useState<'lone' | 'partner' | null>(null);
  const [partnerPlayer, setPartnerPlayer] = useState<number | null>(null);
  
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
  
  // Get player name
  const getPlayerName = (index: number): string => {
    if (!game) return '';
    const names = [game.player_1, game.player_2, game.player_3, game.player_4 || '', game.player_5 || ''];
    return names[index];
  };
  
  // Get current wolf player for this hole
  const wolfPosition = game?.wolf_position as 'first' | 'last' || 'last';
  const currentWolfPlayer = getWolfPlayerForHole(currentHole, getPlayerCount(), wolfPosition);

  useEffect(() => {
    if (gameId) {
      fetchGame();
    }
  }, [gameId]);

  useEffect(() => {
    if (courseHoles.length > 0) {
      const holeData = courseHoles.find(h => h.hole_number === currentHole);
      if (holeData) {
        setPar(holeData.par);
        // Don't pre-set scores - keep null until entered
        const newScores = scores.map(s => s === null ? null : s);
        setScores(newScores);
      }
    }
  }, [currentHoleIndex, courseHoles]);

  const fetchGame = async () => {
    try {
      const { data: gameData, error: gameError } = await supabase
        .from("wolf_games" as any)
        .select("*")
        .eq("id", gameId)
        .single();

      if (gameError) throw gameError;
      
      const typedGame = gameData as unknown as WolfGame;
      setGame(typedGame);

      // Fetch course holes if course_id exists
      if (typedGame.course_id) {
        const { data: courseHolesData, error: courseHolesError } = await supabase
          .from("course_holes")
          .select("hole_number, par")
          .eq("course_id", typedGame.course_id)
          .order("hole_number");

        if (!courseHolesError && courseHolesData) {
          setCourseHoles(courseHolesData);
          const hole1 = courseHolesData.find(h => h.hole_number === 1);
        if (hole1) {
            setPar(hole1.par);
            // Initialize with null (no pre-set scores)
            setScores([null, null, null, null, null]);
          }
        }
      }

      const { data: holesData, error: holesError } = await supabase
        .from("wolf_holes" as any)
        .select("*")
        .eq("game_id", gameId)
        .order("hole_number");

      if (holesError) throw holesError;
      
      setHoles((holesData || []) as unknown as WolfHole[]);

      // Only set to next hole on initial load, not when refreshing
      if (holesData && holesData.length > 0 && currentHoleIndex === 0) {
        setCurrentHoleIndex(holesData.length);
      }
    } catch (error: any) {
      toast({ title: "Error loading game", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const advanceToNextPlayerSheet = (playerIndex: number) => {
    const playerCount = getPlayerCount();
    if (playerIndex < playerCount - 1) {
      setActivePlayerSheet(playerIndex + 1);
    } else {
      // Last player - close sheet (Wolf requires wolf choice before save, so don't auto-save)
      setActivePlayerSheet(null);
    }
  };

  const handleScoreSelect = (playerIndex: number, score: number | null) => {
    if (score === null) return;
    setScores(prev => {
      const newScores = [...prev];
      newScores[playerIndex] = score;
      return newScores;
    });
  };

  const handleChoosePartner = (playerIndex: number) => {
    if (playerIndex === currentWolfPlayer - 1) return; // Can't choose self
    setWolfChoice('partner');
    setPartnerPlayer(playerIndex + 1);
  };

  const handleGoLone = () => {
    setWolfChoice('lone');
    setPartnerPlayer(null);
  };

  const saveHole = async () => {
    if (!game || !wolfChoice) {
      toast({ title: "Please select Wolf's choice (Partner or Lone Wolf)", variant: "destructive" });
      return;
    }
    
    const playerCount = getPlayerCount();
    const settings = {
      lone_wolf_win_points: game.lone_wolf_win_points,
      lone_wolf_loss_points: game.lone_wolf_loss_points,
      team_win_points: game.team_win_points,
      wolf_position: game.wolf_position as 'first' | 'last',
    };
    
    const result = calculateWolfHoleScore({
      scores,
      wolfPlayer: currentWolfPlayer,
      wolfChoice,
      partnerPlayer,
      playerCount,
      settings,
    });

    const existingHole = holes.find(h => h.hole_number === currentHole);
    
    // Calculate running totals
    const previousTotals = [0, 0, 0, 0, 0];
    holes.filter(h => h.hole_number < currentHole).forEach(h => {
      previousTotals[0] += h.player_1_hole_points;
      previousTotals[1] += h.player_2_hole_points;
      previousTotals[2] += h.player_3_hole_points;
      previousTotals[3] += h.player_4_hole_points;
      previousTotals[4] += h.player_5_hole_points;
    });
    
    const runningTotals = previousTotals.map((t, i) => t + result.playerPoints[i]);

    setSaving(true);
    try {
      const holeData = {
        game_id: game.id,
        hole_number: currentHole,
        par,
        wolf_player: currentWolfPlayer,
        wolf_choice: wolfChoice,
        partner_player: partnerPlayer,
        player_1_score: scores[0],
        player_2_score: scores[1],
        player_3_score: scores[2],
        player_4_score: scores[3],
        player_5_score: scores[4],
        player_1_hole_points: result.playerPoints[0],
        player_2_hole_points: result.playerPoints[1],
        player_3_hole_points: result.playerPoints[2],
        player_4_hole_points: result.playerPoints[3],
        player_5_hole_points: result.playerPoints[4],
        player_1_running_total: runningTotals[0],
        player_2_running_total: runningTotals[1],
        player_3_running_total: runningTotals[2],
        player_4_running_total: runningTotals[3],
        player_5_running_total: runningTotals[4],
        winning_side: result.winningSide,
      };

      if (existingHole) {
        const { error } = await supabase
          .from("wolf_holes" as any)
          .update(holeData)
          .eq("id", existingHole.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("wolf_holes" as any)
          .insert(holeData);
        if (error) throw error;
      }

      // Update game totals
      const { error: gameError } = await supabase
        .from("wolf_games" as any)
        .update({
          player_1_points: runningTotals[0],
          player_2_points: runningTotals[1],
          player_3_points: runningTotals[2],
          player_4_points: runningTotals[3],
          player_5_points: runningTotals[4],
        })
        .eq("id", game.id);

      if (gameError) throw gameError;

      setGame({
        ...game,
        player_1_points: runningTotals[0],
        player_2_points: runningTotals[1],
        player_3_points: runningTotals[2],
        player_4_points: runningTotals[3],
        player_5_points: runningTotals[4],
      });

      // Refresh holes data after save
      const { data: updatedHolesData } = await supabase
        .from("wolf_holes" as any)
        .select("*")
        .eq("game_id", game.id)
        .order("hole_number");

      if (updatedHolesData) {
        setHoles(updatedHolesData as unknown as WolfHole[]);
      }

      if (currentHole >= totalHoles) {
        navigate(`/wolf/${game.id}/summary`);
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
    setPar(nextPar);
    // Reset to null for no pre-set scores
    setScores([null, null, null, null, null]);
    setWolfChoice(null);
    setPartnerPlayer(null);
  };

  const navigateHole = async (direction: "prev" | "next") => {
    if (direction === "prev" && currentHoleIndex > 0) {
      const targetHoleNumber = currentHole - 1;
      const prevHole = holes.find(h => h.hole_number === targetHoleNumber);
      if (prevHole) {
        setPar(prevHole.par);
        setScores([
          prevHole.player_1_score,
          prevHole.player_2_score,
          prevHole.player_3_score,
          prevHole.player_4_score,
          prevHole.player_5_score,
        ]);
        setWolfChoice(prevHole.wolf_choice as 'lone' | 'partner' | null);
        setPartnerPlayer(prevHole.partner_player);
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
            setScores([
              nextHole.player_1_score,
              nextHole.player_2_score,
              nextHole.player_3_score,
              nextHole.player_4_score,
              nextHole.player_5_score,
            ]);
            setWolfChoice(nextHole.wolf_choice as 'lone' | 'partner' | null);
            setPartnerPlayer(nextHole.partner_player);
          }
        } else {
          const nextHoleData = courseHoles.find(h => h.hole_number === nextHoleNumber);
          setPar(nextHoleData?.par || 4);
          setScores([null, null, null, null, null]);
          setWolfChoice(null);
          setPartnerPlayer(null);
        }
        setCurrentHoleIndex(currentHoleIndex + 1);
      }
    }
  };

  const handleDeleteGame = async () => {
    try {
      await supabase.from("wolf_holes").delete().eq("game_id", gameId);
      await supabase.from("wolf_games").delete().eq("id", gameId);
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
              disabled={saving}
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
          <div className="flex gap-2 justify-center flex-wrap">
            <Button
              variant={wolfChoice === 'lone' ? 'default' : 'outline'}
              onClick={handleGoLone}
              className="flex items-center gap-2"
            >
              <User size={18} />
              Lone Wolf
            </Button>
            {[...Array(playerCount)].map((_, i) => {
              if (i === currentWolfPlayer - 1) return null; // Skip wolf
              const isSelected = wolfChoice === 'partner' && partnerPlayer === i + 1;
              return (
                <Button
                  key={i}
                  variant={isSelected ? 'default' : 'outline'}
                  onClick={() => handleChoosePartner(i)}
                  className="flex items-center gap-2"
                >
                  <Users size={18} />
                  {getPlayerName(i)}
                </Button>
              );
            })}
          </div>
          {wolfChoice && (
            <p className="text-sm text-center mt-2 text-muted-foreground">
              {wolfChoice === 'lone' 
                ? `${getPlayerName(currentWolfPlayer - 1)} goes solo vs everyone!`
                : `${getPlayerName(currentWolfPlayer - 1)} + ${getPlayerName((partnerPlayer || 1) - 1)} vs the rest`
              }
            </p>
          )}
        </Card>

        {/* Score Entry */}
        <Card className="p-4">
          <h3 className="font-semibold mb-3 text-center">Scores</h3>
          <div className="space-y-3">
            {[...Array(playerCount)].map((_, i) => {
              const isWolf = i === currentWolfPlayer - 1;
              const isPartner = wolfChoice === 'partner' && partnerPlayer === i + 1;
              return (
                <div 
                  key={i} 
                  className={`flex items-center justify-between p-3 rounded-lg cursor-pointer hover:bg-muted/50 transition-colors ${
                    isWolf ? 'bg-amber-500/10' : isPartner ? 'bg-primary/10' : 'bg-muted/30'
                  }`}
                  onClick={() => setActivePlayerSheet(i)}
                >
                  <span className="font-medium flex items-center gap-2">
                    {isWolf && <span>🐺</span>}
                    {isPartner && <span>🤝</span>}
                    {getPlayerName(i)}
                  </span>
                  <div className={`text-2xl font-bold ${scores[i] !== null && scores[i] !== undefined ? '' : 'text-muted-foreground'}`}>
                    {scores[i] !== null && scores[i] !== undefined ? scores[i] : '–'}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Standings */}
        <Card className="p-4">
          <h3 className="font-semibold mb-3 text-center">Current Standings</h3>
          <div className="space-y-2">
            {[...Array(playerCount)]
              .map((_, i) => ({
                index: i,
                name: getPlayerName(i),
                points: [
                  game.player_1_points,
                  game.player_2_points,
                  game.player_3_points,
                  game.player_4_points,
                  game.player_5_points,
                ][i],
              }))
              .sort((a, b) => b.points - a.points)
              .map((player, rank) => (
                <div key={player.index} className="flex justify-between items-center">
                  <span className="text-muted-foreground">{rank + 1}. {player.name}</span>
                  <span className="font-bold">{player.points} pts</span>
                </div>
              ))}
          </div>
        </Card>

        <Button 
          onClick={saveHole} 
          disabled={saving || !wolfChoice} 
          className="w-full" 
          size="lg"
        >
          {saving ? "Saving..." : currentHole >= totalHoles ? "Finish Game" : "Next Hole"}
        </Button>
      </div>

      <WolfBottomTabBar gameId={gameId!} />

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

      {/* Score Entry Sheets */}
      {[...Array(getPlayerCount())].map((_, i) => (
        <PlayerScoreSheet
          key={i}
          open={activePlayerSheet === i}
          onOpenChange={(open) => {
            if (!open) {
              setActivePlayerSheet((prev) => (prev === i ? null : prev));
            }
          }}
          playerName={getPlayerName(i)}
          par={par}
          holeNumber={currentHole}
          currentScore={scores[i] || par}
          onScoreSelect={(score) => handleScoreSelect(i, score)}
          onEnterAndNext={() => advanceToNextPlayerSheet(i)}
        />
      ))}
    </div>
  );
}
