import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ChevronLeft, ChevronRight, Trophy, Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { SkinsGame, SkinsHole, SkinsPlayer, SkinsPlayerScore } from "@/types/skins";
import { SkinsBottomTabBar } from "@/components/SkinsBottomTabBar";
import { PlayerScoreSheet } from "@/components/play/PlayerScoreSheet";
import { calculateSkinsHoleResult, calculateNetScore, formatHandicap } from "@/utils/skinsScoring";
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

export default function SkinsPlay() {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [game, setGame] = useState<SkinsGame | null>(null);
  const [holes, setHoles] = useState<SkinsHole[]>([]);
  const [courseHoles, setCourseHoles] = useState<CourseHole[]>([]);
  const [currentHoleIndex, setCurrentHoleIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showExitDialog, setShowExitDialog] = useState(false);
  const [activePlayerIndex, setActivePlayerIndex] = useState<number | null>(null);
  
  const [par, setPar] = useState(4);
  const [strokeIndex, setStrokeIndex] = useState(1);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [carryoverCount, setCarryoverCount] = useState(0);
  
  const currentHole = currentHoleIndex + 1;
  const totalHoles = game?.holes_played || 18;
  const players = game?.players || [];

  useEffect(() => {
    if (gameId) fetchGame();
  }, [gameId]);

  useEffect(() => {
    if (courseHoles.length > 0 && players.length > 0) {
      const holeData = courseHoles.find(h => h.hole_number === currentHole);
      if (holeData) {
        setPar(holeData.par);
        setStrokeIndex(holeData.stroke_index);
        // Initialize scores to par if not set
        const initialScores: Record<string, number> = {};
        players.forEach(p => {
          initialScores[p.name] = holeData.par;
        });
        if (Object.keys(scores).length === 0) {
          setScores(initialScores);
        }
      }
    }
  }, [currentHoleIndex, courseHoles, players]);

  useEffect(() => {
    // Calculate carryover count from previous holes
    // For hole N, we look at all completed holes (1 to N-1) and count consecutive carryovers from the end
    if (!game) {
      setCarryoverCount(1);
      return;
    }
    
    if (holes.length === 0) {
      // First hole always starts with 1 skin
      setCarryoverCount(1);
      return;
    }
    
    if (!game.carryover_enabled) {
      // Carryovers disabled - always 1 skin per hole
      setCarryoverCount(1);
      return;
    }
    
    // Count consecutive carryovers from the most recent hole backwards
    let consecutiveCarryovers = 0;
    for (let i = holes.length - 1; i >= 0; i--) {
      if (holes[i].is_carryover) {
        consecutiveCarryovers++;
      } else {
        // Found a hole where someone won - stop counting
        break;
      }
    }
    
    // Skins available = 1 (for this hole) + number of previous carryovers
    setCarryoverCount(1 + consecutiveCarryovers);
  }, [holes, game]);

  const fetchGame = async () => {
    try {
      const { data: gameData, error: gameError } = await supabase
        .from("skins_games")
        .select("*")
        .eq("id", gameId)
        .single();

      if (gameError) throw gameError;
      
      const typedGame: SkinsGame = {
        ...gameData,
        players: (gameData.players as unknown as SkinsPlayer[]) || [],
        handicap_mode: (gameData.handicap_mode as 'gross' | 'net') || 'net',
      };
      
      setGame(typedGame);

      // Initialize scores
      const initialScores: Record<string, number> = {};
      typedGame.players.forEach(p => {
        initialScores[p.name] = 4;
      });
      setScores(initialScores);

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
            // Update initial scores with actual par
            typedGame.players.forEach(p => {
              initialScores[p.name] = hole1.par;
            });
            setScores(initialScores);
          }
        }
      }

      const { data: holesData } = await supabase
        .from("skins_holes")
        .select("*")
        .eq("game_id", gameId)
        .order("hole_number");
      
      const typedHoles: SkinsHole[] = (holesData || []).map(h => ({
        ...h,
        player_scores: (h.player_scores as unknown as Record<string, SkinsPlayerScore>) || {},
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

  const saveHole = async () => {
    if (!game) return;
    
    // Build player scores with net calculations
    const playerScores: Record<string, SkinsPlayerScore> = {};
    players.forEach(player => {
      const gross = scores[player.name] || par;
      const net = game.use_handicaps 
        ? calculateNetScore(gross, player.handicap, strokeIndex, game.holes_played)
        : gross;
      playerScores[player.name] = { gross, net };
    });

    // Calculate skins result
    const useNet = game.use_handicaps && game.handicap_mode === 'net';
    
    console.log('Skins calculation:', {
      hole: currentHole,
      carryoverEnabled: game.carryover_enabled,
      carryoverCount,
      playerScores,
      useNet,
    });
    
    const result = calculateSkinsHoleResult(
      playerScores,
      useNet,
      game.carryover_enabled,
      carryoverCount
    );
    
    console.log('Skins result:', result);

    const existingHole = holes.find(h => h.hole_number === currentHole);

    setSaving(true);
    try {
      const holeData = {
        game_id: game.id,
        hole_number: currentHole,
        par,
        stroke_index: strokeIndex,
        player_scores: playerScores as any,
        skins_available: carryoverCount,
        winner_player: result.winnerPlayer,
        is_carryover: result.isCarryover,
      };

      if (existingHole) {
        const { error } = await supabase
          .from("skins_holes")
          .update(holeData as any)
          .eq("id", existingHole.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("skins_holes")
          .insert(holeData as any);
        if (error) throw error;
      }

      // Show result toast
      if (result.winnerPlayer) {
        toast({ 
          title: `🏆 ${result.winnerPlayer} wins ${result.skinsWon} skin${result.skinsWon > 1 ? 's' : ''}!` 
        });
      } else if (result.isCarryover) {
        toast({ title: "Tie! Skin carries over to next hole." });
      } else {
        toast({ title: "Tie - no skin awarded." });
      }

      if (currentHole >= game.holes_played) {
        // Mark game as finished
        await supabase
          .from("skins_games")
          .update({ is_finished: true } as any)
          .eq("id", game.id);
        navigate(`/skins/${game.id}/summary`);
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
    const newScores: Record<string, number> = {};
    players.forEach(p => {
      newScores[p.name] = nextPar;
    });
    setScores(newScores);
  };

  const updateScore = (playerName: string, score: number | null) => {
    if (score === null) return;
    setScores(prev => ({ ...prev, [playerName]: score }));
  };

  const handleEnterAndNext = () => {
    if (activePlayerIndex !== null && activePlayerIndex < players.length - 1) {
      setActivePlayerIndex(activePlayerIndex + 1);
    } else {
      // Last player - close sheet and auto-save/advance
      setActivePlayerIndex(null);
      saveHole();
    }
  };

  const navigateHole = async (direction: "prev" | "next") => {
    if (direction === "prev" && currentHoleIndex > 0) {
      const prevHole = holes[currentHoleIndex - 1];
      if (prevHole) {
        setPar(prevHole.par);
        setStrokeIndex(prevHole.stroke_index || 1);
        const prevScores: Record<string, number> = {};
        Object.entries(prevHole.player_scores).forEach(([name, score]) => {
          prevScores[name] = score.gross;
        });
        setScores(prevScores);
      }
      setCurrentHoleIndex(currentHoleIndex - 1);
    } else if (direction === "next") {
      await saveHole();
    }
  };

  const handleFinishGame = () => navigate(`/skins/${gameId}/summary`);

  const handleDeleteGame = async () => {
    try {
      await supabase.from("skins_holes").delete().eq("game_id", gameId);
      await supabase.from("skins_games").delete().eq("id", gameId);
      toast({ title: "Game deleted" });
      navigate("/rounds-play");
    } catch (error: any) {
      toast({ title: "Error deleting game", description: error.message, variant: "destructive" });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen pb-32 flex items-center justify-center">
        <div className="text-muted-foreground">Loading game...</div>
        {gameId && <SkinsBottomTabBar gameId={gameId} />}
      </div>
    );
  }

  if (!game) {
    return (
      <div className="min-h-screen pb-32 flex items-center justify-center">
        <div className="text-muted-foreground">Game not found</div>
        {gameId && <SkinsBottomTabBar gameId={gameId} />}
      </div>
    );
  }

  // Group players by their group
  const playersByGroup = players.reduce((acc, player) => {
    const group = player.group_name || 'Group 1';
    if (!acc[group]) acc[group] = [];
    acc[group].push(player);
    return acc;
  }, {} as Record<string, SkinsPlayer[]>);

  return (
    <div className="min-h-screen pb-32 bg-background">
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
              <h1 className="text-xl font-bold">Skins</h1>
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
              disabled={saving}
              className="text-[hsl(120,20%,30%)] hover:bg-[hsl(120,20%,80%)]"
            >
              <ChevronRight size={24} />
            </Button>
          </div>
        </div>
      </div>

      {/* Skins Info Banner */}
      <div className="max-w-2xl mx-auto px-4 mt-4">
        <Card className="p-3 bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-amber-600" />
              <span className="font-medium text-amber-800 dark:text-amber-200">
                {carryoverCount} Skin{carryoverCount > 1 ? 's' : ''} on this hole
              </span>
            </div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Users size={14} />
              <span>{players.length} players</span>
            </div>
          </div>
          {carryoverCount > 1 && (
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
              Includes {carryoverCount - 1} carryover{carryoverCount > 2 ? 's' : ''} from previous tie{carryoverCount > 2 ? 's' : ''}
            </p>
          )}
        </Card>
      </div>

      {/* Score Entry by Group */}
      <div className="max-w-2xl mx-auto p-4 space-y-6">
        {Object.entries(playersByGroup).map(([groupName, groupPlayers]) => (
          <div key={groupName}>
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="outline" className="text-xs">{groupName}</Badge>
            </div>
            <div className="space-y-2">
              {groupPlayers.map((player, idx) => {
                const globalIndex = players.findIndex(p => p.name === player.name);
                const playerScore = scores[player.name] || par;
                const netScore = game.use_handicaps 
                  ? calculateNetScore(playerScore, player.handicap, strokeIndex, game.holes_played)
                  : playerScore;
                
                return (
                  <Card 
                    key={player.name}
                    className="p-4 cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => setActivePlayerIndex(globalIndex)}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium truncate max-w-[180px]">{player.name}</div>
                        {game.use_handicaps && player.handicap !== null && (
                          <div className="text-xs text-muted-foreground">
                            HCP: {formatHandicap(player.handicap)}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="bg-secondary text-secondary-foreground w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold">
                          {playerScore}
                        </div>
                        {game.use_handicaps && (
                          <div className="text-sm text-muted-foreground">
                            Net: {netScore}
                          </div>
                        )}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        ))}

        {/* Multi-Group Reminder */}
        {Object.keys(playersByGroup).length > 1 && (
          <Card className="p-3 bg-primary/5 border-primary/20">
            <div className="flex items-center gap-2 text-sm text-primary">
              <Users size={16} />
              <span>Skins are calculated across all {Object.keys(playersByGroup).length} groups</span>
            </div>
          </Card>
        )}
      </div>

      {/* Score Sheet */}
      {activePlayerIndex !== null && players[activePlayerIndex] && (
        <PlayerScoreSheet
          open={activePlayerIndex !== null}
          onOpenChange={(open) => !open && setActivePlayerIndex(null)}
          playerName={players[activePlayerIndex].name}
          handicap={players[activePlayerIndex].handicap}
          par={par}
          holeNumber={currentHole}
          currentScore={scores[players[activePlayerIndex].name] || par}
          onScoreSelect={(score) => {
            if (score !== null) {
              updateScore(players[activePlayerIndex].name, score);
            }
          }}
          onEnterAndNext={handleEnterAndNext}
        />
      )}

      {gameId && <SkinsBottomTabBar gameId={gameId} />}

      {/* Exit Dialog */}
      <AlertDialog open={showExitDialog} onOpenChange={setShowExitDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Exit Game</AlertDialogTitle>
            <AlertDialogDescription>
              What would you like to do with this game?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col gap-2 sm:flex-col">
            <AlertDialogAction onClick={handleFinishGame}>
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
