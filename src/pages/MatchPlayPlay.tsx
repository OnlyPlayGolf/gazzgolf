import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ChevronLeft, ChevronRight, Check } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
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

interface CourseHole {
  hole_number: number;
  par: number;
  stroke_index: number;
}

export default function MatchPlayPlay() {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [game, setGame] = useState<MatchPlayGame | null>(null);
  const [holes, setHoles] = useState<MatchPlayHole[]>([]);
  const [courseHoles, setCourseHoles] = useState<CourseHole[]>([]);
  const [currentHoleIndex, setCurrentHoleIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showExitDialog, setShowExitDialog] = useState(false);
  
  const [par, setPar] = useState(4);
  const [scores, setScores] = useState({
    player1: 0,
    player2: 0,
  });
  const [selectedPlayer, setSelectedPlayer] = useState<1 | 2 | null>(null);
  const [showScoreSheet, setShowScoreSheet] = useState(false);
  
  const currentHole = currentHoleIndex + 1;
  const totalHoles = game?.holes_played || 18;

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
        if (scores.player1 === 0 && scores.player2 === 0) {
          setScores({ player1: holeData.par, player2: holeData.par });
        }
      }
    }
  }, [currentHoleIndex, courseHoles]);

  const fetchGame = async () => {
    try {
      const { data: gameData, error: gameError } = await supabase
        .from("match_play_games")
        .select("*")
        .eq("id", gameId)
        .single();

      if (gameError) throw gameError;
      
      setGame(gameData as MatchPlayGame);

      if (gameData.course_id) {
        const { data: courseHolesData, error: courseHolesError } = await supabase
          .from("course_holes")
          .select("hole_number, par, stroke_index")
          .eq("course_id", gameData.course_id)
          .order("hole_number");

        if (!courseHolesError && courseHolesData) {
          setCourseHoles(courseHolesData);
          const hole1 = courseHolesData.find(h => h.hole_number === 1);
          if (hole1) {
            setPar(hole1.par);
          }
        }
      }

      const { data: holesData, error: holesError } = await supabase
        .from("match_play_holes")
        .select("*")
        .eq("game_id", gameId)
        .order("hole_number");

      if (holesError) throw holesError;
      
      setHoles((holesData || []) as MatchPlayHole[]);

      if (holesData && holesData.length > 0) {
        setCurrentHoleIndex(holesData.length);
      }
    } catch (error: any) {
      toast({ title: "Error loading game", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const saveHole = async () => {
    if (!game) return;
    
    const holeResult = calculateHoleResult(scores.player1, scores.player2);
    
    const previousStatus = holes.length > 0 
      ? holes[holes.length - 1].match_status_after 
      : 0;
    
    const newMatchStatus = previousStatus + holeResult;
    const newHolesRemaining = totalHoles - currentHole;
    
    const existingHole = holes.find(h => h.hole_number === currentHole);

    setSaving(true);
    try {
      const strokeIndex = courseHoles.find(h => h.hole_number === currentHole)?.stroke_index || null;
      
      if (existingHole) {
        const { error: holeError } = await supabase
          .from("match_play_holes")
          .update({
            par,
            stroke_index: strokeIndex,
            player_1_gross_score: scores.player1,
            player_1_net_score: scores.player1,
            player_2_gross_score: scores.player2,
            player_2_net_score: scores.player2,
            hole_result: holeResult,
            match_status_after: newMatchStatus,
            holes_remaining_after: newHolesRemaining,
          })
          .eq("id", existingHole.id);

        if (holeError) throw holeError;
      } else {
        const { error: holeError } = await supabase
          .from("match_play_holes")
          .insert({
            game_id: game.id,
            hole_number: currentHole,
            par,
            stroke_index: strokeIndex,
            player_1_gross_score: scores.player1,
            player_1_net_score: scores.player1,
            player_2_gross_score: scores.player2,
            player_2_net_score: scores.player2,
            hole_result: holeResult,
            match_status_after: newMatchStatus,
            holes_remaining_after: newHolesRemaining,
          });

        if (holeError) throw holeError;
      }

      const matchFinished = isMatchFinished(newMatchStatus, newHolesRemaining);
      
      let updateData: any = {
        match_status: newMatchStatus,
        holes_remaining: newHolesRemaining,
      };
      
      if (matchFinished) {
        const { winner, result } = getFinalResult(newMatchStatus, newHolesRemaining, game.player_1, game.player_2);
        updateData.is_finished = true;
        updateData.winner_player = winner;
        updateData.final_result = result;
      }

      const { error: gameError } = await supabase
        .from("match_play_games")
        .update(updateData)
        .eq("id", game.id);

      if (gameError) throw gameError;

      setGame({
        ...game,
        ...updateData,
      });

      if (holeResult === 1) {
        toast({ title: `${game.player_1} wins the hole!` });
      } else if (holeResult === -1) {
        toast({ title: `${game.player_2} wins the hole!` });
      }

      if (matchFinished) {
        navigate(`/match-play/${game.id}/summary`);
      } else if (currentHole >= game.holes_played) {
        navigate(`/match-play/${game.id}/summary`);
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
    setScores({ player1: nextPar, player2: nextPar });
  };

  const updateScore = (player: 'player1' | 'player2', newScore: number) => {
    if (newScore < 1) return;
    setScores(prev => ({
      ...prev,
      [player]: newScore,
    }));
  };

  const navigateHole = async (direction: "prev" | "next") => {
    if (direction === "prev" && currentHoleIndex > 0) {
      const prevHole = holes[currentHoleIndex - 1];
      if (prevHole) {
        setPar(prevHole.par);
        setScores({
          player1: prevHole.player_1_gross_score || 0,
          player2: prevHole.player_2_gross_score || 0,
        });
      }
      setCurrentHoleIndex(currentHoleIndex - 1);
    } else if (direction === "next") {
      await saveHole();
    }
  };

  const handleFinishGame = () => {
    navigate(`/match-play/${gameId}/summary`);
  };

  const handleDeleteGame = async () => {
    try {
      await supabase.from("match_play_holes").delete().eq("game_id", gameId);
      await supabase.from("match_play_games").delete().eq("id", gameId);
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
  const currentHolesRemaining = totalHoles - (holes.length);

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
              disabled={saving}
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
            <span className="text-3xl font-bold">{scores.player1}</span>
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
            <span className="text-3xl font-bold">{scores.player2}</span>
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
              // Last player - close sheet and save hole, then go to next
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
        {scores.player1 !== scores.player2 && (
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
