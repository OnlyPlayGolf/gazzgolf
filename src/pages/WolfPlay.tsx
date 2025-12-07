import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ChevronLeft, ChevronRight, Minus, Plus, User, Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { WolfGame, WolfHole } from "@/types/wolf";
import { WolfBottomTabBar } from "@/components/WolfBottomTabBar";
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
  const currentWolfPlayer = getWolfPlayerForHole(currentHole, getPlayerCount());

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
        // Initialize scores to par if null
        const newScores = scores.map(s => s === null ? holeData.par : s);
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
            setScores([hole1.par, hole1.par, hole1.par, hole1.par, hole1.par]);
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

      if (holesData && holesData.length > 0) {
        setCurrentHoleIndex(holesData.length);
      }
    } catch (error: any) {
      toast({ title: "Error loading game", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const updateScore = (playerIndex: number, delta: number) => {
    setScores(prev => {
      const newScores = [...prev];
      const currentScore = newScores[playerIndex] || par;
      newScores[playerIndex] = Math.max(1, currentScore + delta);
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

      if (currentHole >= totalHoles) {
        navigate(`/wolf/${game.id}/summary`);
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
    setPar(nextPar);
    setScores([nextPar, nextPar, nextPar, nextPar, nextPar]);
    setWolfChoice(null);
    setPartnerPlayer(null);
  };

  const navigateHole = async (direction: "prev" | "next") => {
    if (direction === "prev" && currentHoleIndex > 0) {
      const prevHole = holes[currentHoleIndex - 1];
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
      await saveHole();
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
            <div className="text-base font-bold">Wolf Game</div>
            <div className="text-xs opacity-80">{game.course_name}</div>
          </div>
          <div className="w-8" />
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-4 space-y-4">
        {/* Hole Navigation */}
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigateHole("prev")}
            disabled={currentHoleIndex === 0}
          >
            <ChevronLeft size={18} />
          </Button>
          <div className="text-center">
            <div className="text-2xl font-bold">Hole {currentHole}</div>
            <div className="text-sm text-muted-foreground">Par {par}</div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigateHole("next")}
            disabled={saving}
          >
            <ChevronRight size={18} />
          </Button>
        </div>

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
                  className={`flex items-center justify-between p-2 rounded ${
                    isWolf ? 'bg-amber-500/10' : isPartner ? 'bg-primary/10' : ''
                  }`}
                >
                  <span className="font-medium flex items-center gap-2">
                    {isWolf && <span>🐺</span>}
                    {isPartner && <span>🤝</span>}
                    {getPlayerName(i)}
                  </span>
                  <div className="flex items-center gap-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => updateScore(i, -1)}
                    >
                      <Minus size={16} />
                    </Button>
                    <span className="w-8 text-center font-bold text-lg">
                      {scores[i] || par}
                    </span>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => updateScore(i, 1)}
                    >
                      <Plus size={16} />
                    </Button>
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
            <AlertDialogTitle>Exit Game?</AlertDialogTitle>
            <AlertDialogDescription>
              Your progress is saved. You can continue this game later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => navigate('/rounds-play')}>
              Exit
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
